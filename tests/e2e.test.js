'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

async function setupE2e() {
    const result = spawnSync('node', ['utils/init-dev.js'], {
        cwd: ROOT,
        stdio: 'pipe',
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' }
    });
    if (result.status !== 0) {
        throw new Error(`init-dev.js failed: ${result.stderr || result.stdout}`);
    }

    process.env.NODE_ENV = 'test';
    process.env.NIL_MENU_FILE = path.join(ROOT, 'dev', 'menu.xml');
    process.env.NIL_DB_FILE = path.join(ROOT, 'dev', 'dbase', 'dev.db');
    process.env.NIL_AUTH_DB = path.join(ROOT, 'data', 'auth.db');
    process.env.NIL_JWT_SECRET = 'e2e-test-secret-not-for-prod-32bytes!';
    process.env.NIL_JWT_EXPIRY = '1h';

    const { app, closeDatabase, closeAuthDatabase, initDatabase, initAuthDatabase } = require('../server');
    const bcrypt = require('bcryptjs');

    await initDatabase();
    await initAuthDatabase();

    const { getAuthDatabase, saveAuthDatabase } = require('../src/services/authDatabase');
    const authDb = getAuthDatabase();

    const addUser = (usuario, password, nombre, rol, permisos, empresaId = 99) => {
        const exists = authDb.exec(`SELECT id FROM usuarios WHERE usuario = '${usuario}'`);
        if (!exists.length || !exists[0].values.length) {
            const hash = bcrypt.hashSync(password, 4);
            authDb.run(
                `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, permisos)
                 VALUES (?, ?, ?, ?, ?, ?)`, [empresaId, nombre, usuario, hash, rol, permisos]
            );
        }
    };

    // Filas dedicadas para el test de fillForm() (ver test 8): un cliente
    // con saldo NULL y otro con saldo real, ids fuera del rango de la data
    // seed real de clientes.xml para no depender de sus valores.
    const { getDatabase, saveDatabase } = require('../src/services/database');
    const appDb = getDatabase();
    appDb.run(`DELETE FROM clientes WHERE clieno IN (9001, 9002)`);
    appDb.run(`INSERT INTO clientes (empresa_id, clieno, nombre, saldo) VALUES (99, 9001, 'E2E Sin Saldo', NULL)`);
    appDb.run(`INSERT INTO clientes (empresa_id, clieno, nombre, saldo) VALUES (99, 9002, 'E2E Con Saldo', 500)`);
    saveDatabase();

    addUser('operador', 'operador1234', 'Operador E2E', 'operador', 'RADU');
    // empresa_id=0, not 99 — authRecordController.js's authEmpresaId() now
    // requires rol='wizard' AND empresa_id=0 for global (cross-tenant) access.
    // A wizard scoped to a real tenant's empresa_id is just that tenant's
    // admin now (see utils/migrate-wizard-scope.js for the migration that
    // downgraded exactly this kind of row).
    addUser('e2ewizard', 'wizard1234', 'Wizard E2E', 'wizard', 'RADU', 0);

    saveAuthDatabase();

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    async function loginAsOperador() {
        const res = await page.request.post(`${baseUrl}/api/auth/login`, {
            data: { usuario: 'operador', password: 'operador1234' }
        });
        assert.equal(res.status(), 200);
    }

    async function loginAsWizard() {
        const res = await page.request.post(`${baseUrl}/api/auth/login`, {
            data: { usuario: 'e2ewizard', password: 'wizard1234' }
        });
        assert.equal(res.status(), 200);
    }

    function cleanup() {
        server.close();
        try { closeDatabase(); } catch {}
        try { closeAuthDatabase(); } catch {}
        browser.close();
    }

    return { baseUrl, page, context, browser, server, loginAsOperador, loginAsWizard, cleanup };
}

describe('E2E — Dev Sandbox', async () => {
    let ctx;

    before(async () => {
        ctx = await setupE2e();
    });

    after(() => ctx.cleanup());

    it('1. Login/Logout — login via UI form, verify session, logout', async () => {
        const { page, baseUrl, context } = ctx;
        await context.clearCookies();

        await page.goto(`${baseUrl}/nil-login`, { waitUntil: 'networkidle' });
        assert.ok(page.url().includes('/nil-login'), 'on login page');

        await page.waitForSelector('#usuario');
        await page.fill('#usuario', 'superdvlp');
        await page.fill('#password', 'devpass1234');
        await page.click('button[type="submit"]');

        // Admin role redirects to /nil-sys
        await page.waitForURL(url => url.pathname === '/nil-sys', { timeout: 10000 });
        assert.equal(page.url(), `${baseUrl}/nil-sys`);

        const checkRes = await page.request.get(`${baseUrl}/api/auth/check`);
        assert.equal(checkRes.status(), 200);
        const session = await checkRes.json();
        assert.equal(session.usuario, 'superdvlp');
        assert.equal(session.rol, 'admin');
        assert.ok(session.ok);

        const logoutRes = await page.request.post(`${baseUrl}/api/auth/logout`);
        assert.equal(logoutRes.status(), 200);

        const checkAfter = await page.request.get(`${baseUrl}/api/auth/check`);
        assert.equal(checkAfter.status(), 401);
    });

    it('2. Auth guard — without session redirects to login', async () => {
        const { page, baseUrl, context } = ctx;
        await context.clearCookies();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        assert.ok(page.url().includes('/nil-login'), 'root should redirect to login');

        await page.goto(`${baseUrl}/nil-sys`, { waitUntil: 'networkidle' });
        assert.ok(page.url().includes('/nil-login'), 'nil-sys should redirect to login');

        const checkRes = await page.request.get(`${baseUrl}/api/auth/check`);
        assert.equal(checkRes.status(), 401);
    });

    it('3. Form loads — Clientes form renders all fields after login', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#sidebar');

        // Click "Clientes" in sidebar tree
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });

        assert.ok(await page.$('#clieno'), 'clieno field');
        assert.ok(await page.$('#fealta'), 'fealta field');
        assert.ok(await page.$('#activo'), 'activo checkbox');
        assert.ok(await page.$('#nombre'), 'nombre field');
        assert.ok(await page.$('#direc'), 'direc field');
        assert.ok(await page.$('#ciudad'), 'ciudad field');
        assert.ok(await page.$('#prov'), 'prov select');
        assert.ok(await page.$('#cp'), 'cp field');
        assert.ok(await page.$('#saldo'), 'saldo field');

        const body = await page.textContent('body');
        assert.ok(body.includes('ENVIAR'));
        assert.ok(!body.includes('LIMPIAR'), 'LIMPIAR button was removed');
        assert.ok(body.includes('< ANT'));
        assert.ok(body.includes('SIG >'));
    });

    it('4. Create record — fill Items form and submit', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Ítems"))');
        await page.waitForSelector('#itemno', { timeout: 10000 });

        await page.fill('#itemno', '100');
        await page.fill('#dsc', 'E2E Test Item');
        await page.fill('#peso', '500');
        await page.fill('#volumen', '200');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        const btnText = await page.textContent('button[type="submit"]');
        assert.ok(btnText.includes('CREADO'), `expected CREADO, got: ${btnText}`);
    });

    it('5. Navigate ANT/SIG — browse through existing clientes records', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });

        await page.fill('#clieno', '1');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1500);

        const initialNombre = await page.inputValue('#nombre');
        assert.ok(initialNombre.length > 0, 'record 1 should have a nombre');

        await page.click('text=SIG >');
        await page.waitForTimeout(1000);

        const nextClieno = await page.inputValue('#clieno');
        assert.equal(nextClieno, '2', 'SIG should go to clieno=2');

        await page.click('text=< ANT');
        await page.waitForTimeout(1000);

        const prevClieno = await page.inputValue('#clieno');
        assert.equal(prevClieno, '1', 'ANT should return to clieno=1');
        const prevNombre = await page.inputValue('#nombre');
        assert.equal(prevNombre, initialNombre, 'ANT should restore original record');
    });

    it('6. Update record — modify nombre in Clientes and verify persistence', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });

        // Submit to trigger initial form state (will fill defaults)
        await page.fill('#clieno', '1');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1500);

        // Modify nombre and submit to update
        const newNombre = 'E2E Updated ' + Date.now();
        await page.fill('#nombre', '');
        await page.fill('#nombre', newNombre);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        const btnText = await page.textContent('button[type="submit"]');
        assert.ok(btnText.includes('ACTUALIZADO') || btnText.includes('CREADO') || btnText.includes('GUARDADO'),
            `expected save feedback, got: ${btnText}`);

        // Navigate away to SIG > then back to < ANT to reload from DB
        await page.click('text=SIG >');
        await page.waitForTimeout(1000);
        await page.click('text=< ANT');
        await page.waitForTimeout(1000);

        const updatedNombre = await page.inputValue('#nombre');
        assert.equal(updatedNombre, newNombre, 'nombre should persist after reload via navigation');
    });

    it('7. Nil-wizard — creating a system user with a rol is rejected pending a role-gated endpoint', async () => {
        // authRecordService.js's EDITABLE_FIELDS allowlist (security fix) blocks
        // rol/activo/failed_attempts/estado from this generic @auth: CRUD path
        // entirely — including at creation time. That means this form can no
        // longer create a NEW wizard/admin/auditor account with a chosen rol at
        // all: doing so needs a dedicated, role-gated endpoint (mirroring
        // PUT /api/users/:id/password's rank check) that doesn't exist yet.
        // This test documents that gap instead of silently going green on a
        // capability that's currently unavailable through the UI.
        const { page, baseUrl, context, loginAsWizard } = ctx;
        await context.clearCookies();
        await loginAsWizard();

        await page.goto(`${baseUrl}/nil-sys`, { waitUntil: 'networkidle' });
        await page.waitForSelector('#sidebar');

        // Click "Usuarios sistema" in nil-sys sidebar
        await page.click('.tree-node:has(span:text("Usuarios sistema"))');
        await page.waitForSelector('#usuario', { timeout: 10000 });

        // Fill new system user form (keyField #id left empty = create mode)
        const testUser = 'e2e-test-admin-' + Date.now();
        await page.fill('#nombre', 'E2E Test Admin');
        await page.fill('#usuario', testUser);

        // Rol is autocomplete (rendered as input + button). Open dropdown, pick "Admin".
        // Click the input itself (not "+ .autocomplete-btn": desde el overlay
        // "clave - nombre" de catálogos reales, #rol ya no es sibling directo
        // del botón — clickear el input abre el dropdown igual).
        await page.click('#rol');
        await page.waitForSelector('.autocomplete-dropdown:not([style*="none"])', { timeout: 3000 });
        await page.locator('.autocomplete-dropdown .autocomplete-item').filter({ hasText: 'Admin' }).click();

        await page.fill('#password', 'TestPass123!');

        // Submit
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        // The submit is rejected server-side (FIELD_NOT_ALLOWED) — the button
        // never reaches CREADO/GUARDADO feedback.
        const btnText = await page.textContent('button[type="submit"]');
        assert.ok(!btnText.includes('CREADO') && !btnText.includes('GUARDADO'),
            `expected the save to be rejected, but got success feedback: ${btnText}`);

        // And no such user was actually created.
        const usersRes = await page.request.get(`${baseUrl}/api/nil/usuarios`);
        assert.equal(usersRes.status(), 200);
        const users = await usersRes.json();
        const found = users.rows.find(u => u.usuario === testUser);
        assert.ok(!found, `user ${testUser} should NOT have been created`);
    });

    it('8. fillForm() clears a field when navigating to a record where it is NULL', async () => {
        // Regression test: fillForm() used to skip `field.value = value` whenever
        // the incoming record had null/undefined for a field, leaving the DOM
        // input showing the PREVIOUS record's value. Reproduced with clieno=9002
        // (saldo=500) -> ANT -> clieno=9001 (saldo=NULL): saldo used to stay "500".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });

        await page.fill('#clieno', '9002');
        await page.press('#clieno', 'Tab');
        await page.waitForTimeout(800);
        assert.equal(await page.inputValue('#saldo'), '500', 'record 9002 should show saldo 500');

        await page.click('text=< ANT');
        await page.waitForTimeout(800);

        assert.equal(await page.inputValue('#clieno'), '9001', 'should have navigated to record 9001');
        assert.equal(await page.inputValue('#saldo'), '', 'saldo must be cleared, not stuck on the previous record\'s 500');
    });

    it('9. Self-referencing select+in-table fills the whole form, no 404', async () => {
        // Regression test: LookupService.loadRecord() built /api/v1/records/{table}
        // instead of /api/v1/records/{db}/{table} (missing the db segment), always
        // 404ing. Only manifests when a type="select" field is BOTH the form's own
        // keyField AND has its own <in-table> — see form/mf_productos.xml.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        const consoleErrors = [];
        const onConsole = msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
        page.on('console', onConsole);

        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("MF Productos"))');
            await page.waitForSelector('#id', { timeout: 10000 });
            await page.waitForTimeout(300);

            await page.click('#id');
            await page.waitForTimeout(300);
            const item = page.locator('.autocomplete-item', { hasText: 'Tote Fixture' }).first();
            await item.click();
            await page.waitForTimeout(500);

            assert.equal(await page.inputValue('#nombre'), 'Tote Fixture', 'nombre should be auto-filled after picking the product');
            assert.equal(await page.inputValue('#precio_mayor'), '1500', 'precio_mayor should be auto-filled');
            assert.equal(await page.inputValue('#precio_menor'), '2500', 'precio_menor should be auto-filled');

            const has404 = consoleErrors.some(e => e.includes('404'));
            assert.ok(!has404, `expected no 404 console errors, got: ${JSON.stringify(consoleErrors)}`);
        } finally {
            page.off('console', onConsole);
        }
    });

    it('10. <choice> cell renders as the Autocomplete widget (not a native <select>) inside the add/edit modal', async () => {
        // Regression test: <choice> used to render a native <select>. It now
        // reuses the same Autocomplete.js widget as <options> — see
        // form/mf_pedidos.xml (id_producto catalog column + precio_unitario choice).
        // Also covers the "agregar vía modal" flow (2026-08-23): the grid is
        // read-only, alta/edición van por _openRowModal (Multifield.js).
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("MF Pedidos"))');
        await page.waitForSelector('text=+ AGREGAR ITEM', { timeout: 10000 });

        await page.click('text=+ AGREGAR ITEM');
        await page.waitForSelector('[data-col-id="id_producto"]', { timeout: 5000 });

        const choiceTag = await page.$eval('[data-col-id="precio_unitario"]', el => el.tagName);
        assert.equal(choiceTag, 'INPUT', 'choice cell must be an <input> (Autocomplete widget), not a native <select>');

        // Pick "Tote Fixture" (precio_mayor=1500, precio_menor=2500) in the catalog column
        await page.click('[data-col-id="id_producto"]');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Tote Fixture' }).first().click();
        await page.waitForTimeout(500);

        // default-from="precio_menor" -> should default to 2500
        assert.equal(await page.inputValue('[data-col-id="precio_unitario"]'), '2500', 'choice should default to precio_menor (2500)');

        // Manually pick "x mayor" (1500)
        await page.click('[data-col-id="precio_unitario"]');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'x mayor' }).first().click();
        await page.waitForTimeout(400);
        assert.equal(await page.inputValue('[data-col-id="precio_unitario"]'), '1500', 'should now show precio_mayor (1500)');

        // Switch product to "Mochila Fixture" (precio_mayor=3000) — the manual
        // "mayor" choice should carry forward, not reset to precio_menor default
        await page.click('[data-col-id="id_producto"]');
        await page.waitForTimeout(300);
        await page.fill('[data-col-id="id_producto"]', '');
        await page.click('[data-col-id="id_producto"]');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.waitForTimeout(500);

        assert.equal(await page.inputValue('[data-col-id="precio_unitario"]'), '3000',
            'touched "mayor" choice should carry forward to Mochila Fixture\'s precio_mayor (3000)');

        // Guardar -> el modal cierra y aparece una fila compacta de solo lectura
        await page.click('.mf-row-modal-save-btn');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });

        const rowText = await page.textContent('.multifield-display-row');
        assert.ok(rowText.includes('Mochila Fixture'), `expected compact row to show the product name, got: ${rowText}`);
        assert.ok(rowText.includes('3000'), `expected compact row to show precio_unitario 3000, got: ${rowText}`);

        // Click en la fila (no en ✕) reabre el modal precargado con los mismos valores
        await page.click('.multifield-display-row');
        await page.waitForSelector('[data-col-id="precio_unitario"]', { timeout: 5000 });
        assert.equal(await page.inputValue('[data-col-id="precio_unitario"]'), '3000', 'reopening should prefill the same precio_unitario');

        // Cerrar sin guardar (Escape) no debe duplicar la fila
        await page.keyboard.press('Escape');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
        const rowCount = await page.locator('.multifield-display-row').count();
        assert.equal(rowCount, 1, 'closing without saving should not add a duplicate row');
    });

    it('11. Top-level catalog select hides its copy-target companion field (no duplicate name)', async () => {
        // Regression test: a type="select" field with <in-table><copy to="X"/>
        // now shows "key - name" via the Autocomplete.js overlay (see
        // refreshOverlay()), so a separate readonly/skip field just holding
        // the same copied name is redundant — LayoutProcessor.js hides it.
        // See form/top_level_catalog.xml (id_producto_ref -> copy to
        // nombre_producto). Same mechanism as the multifield's copyTargetIds,
        // but computed for the whole top-level <layout> in processLayout().
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Top Level Catalog"))');
        await page.waitForSelector('#id_producto_ref', { timeout: 10000 });
        await page.waitForTimeout(300);

        const nombreWrapper = page.locator('#nombre_producto').locator('xpath=ancestor::*[contains(@class,"field-row") or contains(@class,"field-block-horizontal")][1]');
        assert.equal(await nombreWrapper.isVisible(), false, 'companion "nombre_producto" field must be hidden');

        // Elegir un producto y confirmar el overlay "clave - nombre" en el campo catálogo
        await page.click('#id_producto_ref');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Tote Fixture' }).first().click();
        await page.waitForTimeout(300);
        await page.click('body');
        await page.waitForTimeout(300);

        const overlayText = await page.textContent('#id_producto_ref ~ .autocomplete-display-overlay');
        assert.ok(overlayText.includes('Tote Fixture'), `expected overlay to show "key - Tote Fixture", got: ${overlayText}`);
    });

    it('12. Submitting a form sends the flat items_<col>_<idx> keys the multifield modal produces', async () => {
        // Regression test: _buildDisplayRow() (Multifield.js) carries each
        // row's values as <input type="hidden" name="{multifieldId}_{col}_{idx}">
        // instead of the old always-visible editable inputs — SubmitManager.js
        // still collects data via `new FormData(formEl)`, so if that naming
        // convention ever breaks, a form silently submits without its
        // multifield rows (no client error, no server error — the data is
        // just missing). Real handlers (ej. THYM POS's ventas.handler.js)
        // parse these exact flat keys via regex, so the naming has to stay
        // byte-for-byte stable even though the grid itself is now read-only.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        let capturedPayload = null;
        const onRequest = (req) => {
            if (req.method() === 'POST' && req.url().includes('/api/v1/records/')) {
                capturedPayload = req.postDataJSON();
            }
        };
        page.on('request', onRequest);

        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("MF Pedidos"))');
            await page.waitForSelector('#id', { timeout: 10000 });

            const pedidoId = String(90000 + Math.floor(Math.random() * 9999));
            await page.fill('#id', pedidoId);

            await page.click('text=+ AGREGAR ITEM');
            await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
            await page.click('[data-col-id="id_producto"]');
            await page.waitForSelector('.mf-row-modal .autocomplete-item', { timeout: 3000 });
            await page.locator('.mf-row-modal .autocomplete-item', { hasText: 'Tote Fixture' }).first().click();
            await page.waitForTimeout(200);
            await page.click('.mf-row-modal-save-btn');
            await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });

            await page.click('button[type="submit"]');
            await page.waitForTimeout(1500);

            assert.ok(capturedPayload, 'expected a POST to /api/v1/records/ to fire on submit');
            const data = capturedPayload.data;
            assert.equal(data.items_id_producto_0, '1', 'items_id_producto_0 must carry the selected product id');
            assert.equal(data.items_producto_0, 'Tote Fixture', 'items_producto_0 must carry the copied name');
            assert.equal(data.items_precio_unitario_0, '2500', 'items_precio_unitario_0 must carry the resolved price');
        } finally {
            page.off('request', onRequest);
        }
    });

    it('13. Submitting with an empty required field shows an inline summary instead of the native browser tooltip', async () => {
        // Regression test: SubmitManager.js used to rely on formEl.checkValidity()
        // + reportValidity() (native browser tooltip) for required fields. Now
        // formEl.noValidate=true (FormRenderer.js) and the submit handler calls
        // ValidationCoordinator.validateAll(), which marks every invalid field
        // (.field-error) and pushes a summary to the StatusBar — no native
        // popup, no silent submit with missing required data. Since #28 an
        // empty required field gets no inline text: the summary names it.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        let submitPosted = false;
        const onRequest = (req) => {
            if (req.method() === 'POST' && req.url().includes('/api/v1/records/')) submitPosted = true;
        };
        page.on('request', onRequest);

        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Clientes"))');
            await page.waitForSelector('#clieno', { timeout: 10000 });

            // "nombre" (required) queda vacío a propósito
            await page.click('button[type="submit"]');
            await page.waitForTimeout(500);

            assert.equal(submitPosted, false, 'an invalid submit must not reach the server');
            assert.equal(await page.locator('#nombre').evaluate(el => el.classList.contains('field-error')), true,
                'the empty required field must get .field-error');
            assert.equal(await page.locator('.error-msg').count(), 0, 'no inline text for an empty required field (#28)');
            const statusText = await page.textContent('.status-bar');
            assert.ok(statusText.includes('Nombre'), `expected StatusBar summary to name the field, got: ${statusText}`);
        } finally {
            page.off('request', onRequest);
        }
    });

    it('14. <enabled-when> disables/enables a field based on a sibling field\'s value', async () => {
        // Regression test for two things in the same change:
        // 1. LayoutProcessor.js's new setupConditional(): envio_costo starts
        //    disabled (envio_retiro defaults to empty), and toggles based on
        //    envio_retiro's value — see form/conditional_fields.xml.
        // 2. ExpressionEngine.evaluateRelational() bug found while building
        //    this: "campo == 'Texto'" used to route both sides through
        //    evaluateArithmetic() (numeric-only), which can't parse a quoted
        //    string and silently falls back to 0 for BOTH sides — so the
        //    comparison was always true regardless of the actual value.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Conditional Fields"))');
        await page.waitForSelector('#envio_retiro', { timeout: 10000 });
        await page.waitForTimeout(300);

        assert.equal(await page.locator('#envio_costo').isDisabled(), true,
            'envio_costo must start disabled (envio_retiro has no value yet)');

        // envio_retiro es type="select" con <options> literales — mismo
        // widget Autocomplete que cualquier otro select, no un <select> nativo.
        await page.click('#envio_retiro');
        await page.waitForTimeout(200);
        await page.locator('.autocomplete-item', { hasText: 'Retira' }).first().click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#envio_costo').isDisabled(), true,
            '"Retira" must keep envio_costo disabled — this is exactly the case the == string-comparison bug got backwards');

        await page.click('#envio_retiro');
        await page.waitForTimeout(200);
        await page.locator('.autocomplete-item', { hasText: 'Envío' }).first().click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('#envio_costo').isDisabled(), false,
            '"Envío" must enable envio_costo');
    });

    it('15. A form with table+handler but no keyField-marked field has no ANT/SIG, and save feedback still shows the real new id', async () => {
        // Regression test for the ventas.xml change (removed the manual "N°
        // de venta" field — the "corrección de venta" flow it existed for
        // never actually worked, ventas.handler.js always INSERTs, never
        // UPDATEs). FormContext._findKeyField() returns null when no field
        // has key="true"/keyField="true" anywhere in the layout, so
        // tableConfig.keyField ends up null even though table+handler are
        // set — SubmitManager.js's ANT/SIG condition (tableConfig?.keyField
        // && tableConfig?.table) then naturally stays false, no extra code
        // needed to hide the buttons. But that same missing keyField broke
        // the post-save feedback ("ID: undefined") until SubmitManager.js
        // got a `|| 'id'` fallback — see form/no_keyfield.xml.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("No Keyfield"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.waitForTimeout(300);

        assert.equal(await page.locator('text=< ANT').count(), 0, 'no ANT button without a keyField-marked field');
        assert.equal(await page.locator('text=SIG >').count(), 0, 'no SIG button without a keyField-marked field');

        await page.fill('#nombre', 'No Keyfield Test ' + Date.now());
        await page.click('button[type="submit"]');
        await page.waitForTimeout(600);

        const btnText = await page.textContent('button[type="submit"]');
        assert.match(btnText, /¡CREADO! \(N° \d+\)/, `expected a real numeric id in the feedback, got: ${btnText}`);
    });

    it('16. Mobile — #workspace scrolls internally when form content is taller than the viewport', async () => {
        // Regression test: #os-interface{height:auto} (added so a short mobile
        // form doesn't stretch #workspace's background to fill the full
        // viewport) removed #workspace's only height ceiling, so its own
        // overflow-y:auto (base rule) never found anything to overflow
        // against — #workspace just grew to match its content instead of
        // scrolling. On a viewport shorter than the form, that left content
        // below the fold completely unreachable, no scroll possible at all
        // (confirmed live: submit button off-screen, scrollBy did nothing).
        // Fix: #workspace{max-height: calc(100dvh - 48px)} in the same
        // mobile media query restores the ceiling only when content actually
        // needs it — short content still hugs its own height (no dead space,
        // the original goal), tall content scrolls again.
        const { baseUrl, browser } = ctx;
        const mobileContext = await browser.newContext({ viewport: { width: 390, height: 500 }, hasTouch: true });
        const page = await mobileContext.newPage();
        try {
            const loginRes = await page.request.post(`${baseUrl}/api/auth/login`, {
                data: { usuario: 'operador', password: 'operador1234' }
            });
            assert.equal(loginRes.status(), 200);

            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.waitForSelector('#sidebar');
            await page.click('#sidebar-toggle');
            await page.click('.tree-node:has(span:text("Clientes"))');
            await page.waitForSelector('#nombre', { timeout: 10000 });
            await page.waitForTimeout(300);

            const before = await page.evaluate(() => {
                const ws = document.getElementById('workspace');
                return { scrollHeight: ws.scrollHeight, clientHeight: ws.clientHeight, scrollTop: ws.scrollTop };
            });
            assert.ok(before.scrollHeight > before.clientHeight, 'workspace content should exceed its own visible height on a short viewport');

            await page.evaluate(() => document.getElementById('workspace').scrollBy(0, 500));
            await page.waitForTimeout(150);

            const after = await page.evaluate(() => document.getElementById('workspace').scrollTop);
            assert.ok(after > before.scrollTop, `scrollBy should move #workspace's scroll position, stayed at ${after}`);
        } finally {
            await mobileContext.close();
        }
    });

    it('17. Mobile — a long catalog item does not push the autocomplete dropdown past the viewport, and its text ellipsizes', async () => {
        // Regression test: .autocomplete-dropdown is min-width:100% with no
        // max-width (deliberate on desktop — lets the dropdown show a full
        // "key - display" even next to a narrow size="6" input). Once mobile
        // forces the wrapper to width:100% (see test above's neighboring
        // fixes), a single long item's text had nothing capping the
        // dropdown's own width, so it grew far past the screen edge
        // (confirmed live: 729px wide against a 390px viewport, covering the
        // submit button, text hard-cut mid-word with no ellipsis). Two fixes
        // needed together: .autocomplete-dropdown{max-width:100%} (mobile
        // only) to actually cap it, and moving text-overflow:ellipsis off
        // .autocomplete-item (display:flex — the spec doesn't apply
        // text-overflow to flex containers, so it was silently a no-op) onto
        // .autocomplete-display, the actual text span.
        const { baseUrl, browser } = ctx;
        const { getDatabase, saveDatabase } = require('../src/services/database');
        const appDb = getDatabase();
        const longName = 'Producto Con Nombre Extremadamente Largo Para Forzar Overflow En Mobile';
        appDb.run(`DELETE FROM mf_productos WHERE nombre = ?`, [longName]);
        appDb.run(`INSERT INTO mf_productos (empresa_id, nombre, precio_mayor, precio_menor) VALUES (99, ?, 100, 200)`, [longName]);
        saveDatabase();

        const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const page = await mobileContext.newPage();
        try {
            const loginRes = await page.request.post(`${baseUrl}/api/auth/login`, {
                data: { usuario: 'operador', password: 'operador1234' }
            });
            assert.equal(loginRes.status(), 200);

            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.waitForSelector('#sidebar');
            await page.click('#sidebar-toggle');
            await page.click('.tree-node:has(span:text("Top Level Catalog"))');
            await page.waitForSelector('#id_producto_ref', { timeout: 10000 });

            await page.click('#id_producto_ref');
            await page.fill('#id_producto_ref', 'Extremadamente');
            await page.waitForSelector('.autocomplete-item', { timeout: 3000 });

            const info = await page.evaluate(() => {
                const dd = document.querySelector('.autocomplete-dropdown').getBoundingClientRect();
                const displayEl = document.querySelector('.autocomplete-display');
                return {
                    dropdownRight: dd.right,
                    innerWidth: window.innerWidth,
                    displayScrollWidth: displayEl.scrollWidth,
                    displayClientWidth: displayEl.clientWidth,
                };
            });
            assert.ok(info.dropdownRight <= info.innerWidth + 1, `dropdown should stay within the viewport, right=${info.dropdownRight} > innerWidth=${info.innerWidth}`);
            assert.ok(info.displayScrollWidth > info.displayClientWidth, 'the long display text should be wider than its own box (i.e. actually truncating, not just wrapping)');
        } finally {
            await mobileContext.close();
        }
    });

    it('18. handlerController afterLoad forwards populate — reloading a record repopulates its multifield, and re-saving updates instead of duplicating', async () => {
        // Regression test: handlerController.js's afterLoad() calls handler.after()
        // once per field of the loaded record, but used to only aggregate
        // enableFields/disableFields into its response — any populate/appendRow/
        // setValues/filterSelect a handler returned was silently dropped, even
        // though HandlerBridge._applyResult() (client) has always known how to
        // apply `populate`. This broke reloading a record whose child rows live in
        // a multifield with no column of their own (e.g. a draft "venta" + its
        // detalle_ventas lines) — ValidationCoordinator.loadRecord() (typing a key
        // into the keyField input) calls callAfterLoad(), which hit exactly this
        // path. (navigateToAdjacent()/ANT-SIG uses callAfter() instead, a
        // different route that was never affected — see form/venta_draft.xml's
        // handler for the after('id', ...) convention both routes rely on.)
        //
        // Also covers the accompanying beforeSave update-vs-insert fix: with the
        // keyField populated, beforeSave should UPDATE the header + replace the
        // detail rows (delete-all + reinsert) instead of always inserting a new
        // record.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        async function openForm() {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Venta Draft"))');
            await page.waitForSelector('#fecha', { timeout: 10000 });
        }

        async function addItem(productMatch, cantidad) {
            await page.click('button:has-text("AGREGAR ITEM")');
            await page.waitForSelector('[data-col-id="id_producto"]', { timeout: 5000 });
            await page.click('[data-col-id="id_producto"]');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: productMatch }).first().click();
            await page.waitForTimeout(300);
            await page.fill('[data-col-id="cantidad"]', String(cantidad));
            await page.click('.mf-row-modal-save-btn');
            await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
        }

        // 1. Create a draft with one line (Tote Fixture x2).
        await openForm();
        await addItem('Tote Fixture', 2);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        const created = await page.textContent('button[type="submit"]');
        const createdMatch = created.match(/¡CREADO! \(N° (\d+)\)/);
        assert.ok(createdMatch, `expected a fresh insert with a numeric id, got: ${created}`);
        const ventaId = createdMatch[1];

        // 2. Reload the form and type the id — this is the path that used to
        // drop `populate` entirely.
        await openForm();
        await page.fill('#id', ventaId);
        await page.locator('#id').blur();
        await page.waitForTimeout(600);

        const rows = await page.evaluate(() => {
            const grid = document.querySelector('[data-multifield-id="items"]');
            return grid ? JSON.parse(grid.dataset.allRows || '[]') : null;
        });
        assert.equal(rows?.length, 1, `expected the multifield to repopulate with the saved line, got: ${JSON.stringify(rows)}`);
        assert.equal(rows[0].producto, 'Tote Fixture');
        assert.equal(Number(rows[0].cantidad), 2);
        assert.equal(Number(rows[0].precio_total), 5000);

        // 3. Add a second line and resubmit — should UPDATE, not duplicate.
        await addItem('Mochila Fixture', 1);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        const updated = await page.textContent('button[type="submit"]');
        const updatedMatch = updated.match(/¡ACTUALIZADO! \(N° (\d+)\)/);
        assert.ok(updatedMatch, `expected an update, got: ${updated}`);
        assert.equal(updatedMatch[1], ventaId, 'id must stay the same across the update, not create a new record');
    });

    it('19. Menu reports render inline in the workspace (no QR/share card), and a type: month param filters via a picker', async () => {
        // Regression test: type="report" menu items used to always open
        // Workspace.js's showYamlInfo() — a QR code + public link "share"
        // card meant for a report you hand to someone external (the
        // customer-facing "carta"/factura, which in practice never goes
        // through this path at all — it opens via SubmitManager's post-save
        // redirect, not the menu). Every report actually reachable from a
        // menu (Tablero mensual, Por canal in thym-pos) is an internal
        // dashboard with no use for that card. Workspace.js.renderReport()
        // now renders the report inline into the workspace body instead,
        // same as a form. Also covers reportParamHelpers.js: a report
        // declaring params: [{type: month}] gets a default of the current
        // month and an <input type="month"> that re-filters on change —
        // without it, dataSources.resumen's filter: "mes = :mes" would throw
        // "Missing required report param" on a plain menu click.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Mes Fixture"))');
        await page.waitForSelector('.report-container', { timeout: 15000 });

        assert.equal(await page.locator('.qr-container').count(), 0, 'no QR/share card for a menu-driven report');
        assert.equal(await page.locator('.report-preview-btn').count(), 0, 'no share-preview button either');

        const picker = page.locator('.month-picker-bar input[type="month"]');
        assert.equal(await picker.count(), 1, 'a type: month param should render a picker');
        const currentMonth = new Date().toISOString().slice(0, 7);
        assert.equal(await picker.inputValue(), currentMonth, 'defaults to the current month when the URL/menu gives no value');

        await picker.fill('2026-06');
        await page.waitForSelector('.terminal-window table', { timeout: 20000 });
        const bodyText = await page.textContent('.terminal-window');
        assert.ok(bodyText.includes('2026-06') && bodyText.includes('$1.000,00'),
            `expected the June fixture row after switching months, got: ${bodyText}`);

        // Switching again must not leak the previous month's filter (fresh
        // ReportEngine per render — DataSourceManager caches per-instance).
        // Each new ReportEngine reinitializes its own DuckDBAdapter (not
        // cached across instances), so this can take a few seconds — wait
        // for the actual content instead of a flat timeout.
        await picker.fill('2026-07');
        await page.waitForFunction(
            () => document.querySelector('.terminal-window')?.textContent.includes('2026-07'),
            { timeout: 20000 }
        );
        const bodyText2 = await page.textContent('.terminal-window');
        assert.ok(bodyText2.includes('2026-07') && bodyText2.includes('$2.000,00'), `expected July's row, got: ${bodyText2}`);
        assert.ok(!bodyText2.includes('2026-06'), `June's row should not still be showing after switching to July, got: ${bodyText2}`);
    });

    it('20. Loading a record (key or ANT/SIG) refreshes a top-level catalog select\'s "key - name" overlay, not the last manual pick', async () => {
        // Regression test: Autocomplete.js's overlay is built from
        // dataset.selectedRow, which only selectItem()/loadAndCopyRecord()
        // set. ValidationCoordinator.fillForm() writes inputEl.value + fires
        // 'change', so the input held the loaded record's key while the
        // overlay kept showing whatever had been picked by hand before — e.g.
        // a venta from clienta Lu displayed as "3 - Flor" (thym-pos). See
        // dev/form/catalog_keyfield.xml: record 1 -> Tote Fixture, 2 -> Mochila.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Catalog Keyfield"))');
        await page.waitForSelector('#id_producto_ref', { timeout: 10000 });
        await page.waitForTimeout(300);

        const overlay = () => page.textContent('#id_producto_ref ~ .autocomplete-display-overlay');

        // Pick "Mochila Fixture" by hand first, in insert mode.
        await page.click('#id_producto_ref');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.waitForTimeout(300);
        await page.click('body');
        assert.ok((await overlay()).includes('Mochila Fixture'), 'sanity: manual pick shows in the overlay');

        // Load record 1 by typing its key — it belongs to Tote Fixture. The
        // manual pick is unsaved, so it asks first (#55-#57): discard.
        await page.fill('#id', '1');
        await page.locator('#id').blur();
        await page.click('.confirm-dialog-discard', { timeout: 5000 });
        await page.waitForTimeout(800);
        assert.equal(await page.inputValue('#id_producto_ref'), '1', 'sanity: the input holds the loaded key');
        assert.equal(await overlay(), '1 - Tote Fixture', 'overlay must show the loaded record, not the manual pick');
        assert.equal(await page.inputValue('#nombre_producto'), 'Tote Fixture', 'copy target must follow the loaded record too');

        // SIG -> record 2 (Mochila), ANT -> back to record 1 (Tote).
        await page.click('text=SIG >');
        await page.waitForTimeout(800);
        assert.equal(await page.inputValue('#id'), '2');
        assert.equal(await overlay(), '2 - Mochila Fixture', 'SIG must refresh the overlay');

        await page.click('text=< ANT');
        await page.waitForTimeout(800);
        assert.equal(await page.inputValue('#id'), '1');
        assert.equal(await overlay(), '1 - Tote Fixture', 'ANT must refresh the overlay');
        assert.equal(await page.inputValue('#nombre_producto'), 'Tote Fixture');
    });

    it('21. Reloading a saved record shows catalog names (not raw keys) in its multifield rows and in the edit modal', async () => {
        // Regression test: rows that come from a handler's `populate` have no
        // __catalogRow (only a manual pick in the modal sets it), so
        // Multifield.js _resolveDisplayValue() fell back to the raw key — a
        // reloaded venta listed its products as "13", "7" while a freshly
        // added line showed "Mochila" (thym-pos). The copy-target column that
        // does hold the name is hidden as redundant. Seeded venta_draft id=1
        // has one line: Tote Fixture (id 1) x2 — see utils/init-dev.js.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('#fecha', { timeout: 10000 });

        await page.fill('#id', '1');
        await page.locator('#id').blur();
        await page.waitForTimeout(800);

        const row = page.locator('[data-multifield-id="items"] tbody tr.multifield-display-row').first();
        const visibleCells = await row.evaluate(tr =>
            [...tr.querySelectorAll('td')]
                .filter(td => td.style.display !== 'none' && !td.classList.contains('multifield-action-cell'))
                .map(td => td.querySelector('.multifield-display-value')?.textContent ?? ''));
        assert.equal(visibleCells[0], 'Tote Fixture', `product cell must show the name, got: ${JSON.stringify(visibleCells)}`);

        // Opening the row for editing: the modal's catalog cell overlay must
        // show "key - name" as well, not just the bare key.
        await row.click();
        await page.waitForSelector('.mf-row-modal-backdrop', { timeout: 5000 });
        await page.waitForTimeout(500);
        const modalOverlay = await page.textContent('.mf-row-modal-backdrop [data-col-id="id_producto"] ~ .autocomplete-display-overlay');
        assert.equal(modalOverlay, '1 - Tote Fixture', `modal overlay must show the product, got: ${modalOverlay}`);
    });
    it('22. A handler validate() message reaches the status bar verbatim — not "Validation failed" plus a stack frame', async () => {
        // Regression test: recordController.js answers a failed handler
        // validate() with 400 { error: { message: 'Validation failed',
        // errors: [<the handler's own text>] } }, but RecordService.js only
        // read error.message — so the user saw "❌ Error guardando
        // tabla=ventas | Validation failed — at RecordService.upsert (...)"
        // instead of thym-pos's "Las ventas registradas no se modifican…".
        // See dev/apps/comprobante_fixture.handler.js.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });

        const statusText = async () => (await page.textContent('.status-bar-message')) ?? '';

        // Insert without nombre → the handler's own message.
        await page.click('button[type="submit"]');
        await page.waitForFunction(() => document.querySelector('.status-bar-message')?.textContent.trim(), null, { timeout: 5000 });
        let status = await statusText();
        assert.ok(status.includes('Escribí un nombre para el comprobante.'), `expected the handler message, got: ${status}`);
        assert.ok(!status.includes('Validation failed') && !status.includes('RecordService'), `no generic text or stack frame, got: ${status}`);

        // Modifying a saved record (id 1) → rejected with the handler's message.
        await page.fill('#id', '1');
        await page.locator('#id').blur();
        await page.waitForFunction(() => document.querySelector('#nombre')?.value === 'Comprobante Existente', null, { timeout: 5000 });
        await page.fill('#nombre', 'Comprobante Cambiado');
        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () => document.querySelector('.status-bar-message')?.textContent.includes('no se modifican'), null, { timeout: 5000 });
        status = await statusText();
        assert.ok(status.includes('Los comprobantes registrados no se modifican.'), `got: ${status}`);
        assert.ok(!status.includes('Validation failed') && !status.includes('RecordService'), `got: ${status}`);
    });

    it('23. An <output> report opens in a modal in the same view, and closing it ([X] or VOLVER) leaves a fully clean form', async () => {
        // Regression test (thym-pos, 2026-10-27): after ENVIAR the comprobante
        // opened in a background tab nobody noticed, and formEl.reset() only
        // half-cleared the form — native inputs emptied, but the catalog
        // select ("2 - Keyla") and the multifield rows stayed — so it looked
        // unsaved and invited a duplicate sale. Now the report renders in a
        // modal over the form (same backdrop pattern as SubformModal), shows
        // the saved N°, and closing it re-renders the form from its XML.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.waitForTimeout(300);

        async function saveAndOpenModal(nombre, monto) {
            await page.fill('#nombre', nombre);
            await page.click('#id_producto');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
            await page.waitForTimeout(300);
            await page.fill('#monto', String(monto));

            const pagesBefore = context.pages().length;
            await page.click('button[type="submit"]');
            await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
            await page.waitForFunction(
                n => document.querySelector('.report-modal-backdrop')?.textContent.includes(n), nombre, { timeout: 20000 });
            assert.equal(context.pages().length, pagesBefore, 'no new tab/popup for the comprobante');

            const title = await page.textContent('.report-modal-title');
            const idMatch = title.match(/N° (\d+)/);
            assert.ok(idMatch, `modal title must show the saved N°, got: ${title}`);
            return idMatch[1];
        }

        async function assertCleanForm(savedId) {
            await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
            await page.waitForSelector('#nombre', { timeout: 10000 });
            for (const id of ['id', 'nombre', 'id_producto', 'nombre_producto', 'monto']) {
                assert.equal(await page.inputValue(`#${id}`), '', `#${id} must be empty after closing the comprobante`);
            }
            const overlay = await page.locator('#id_producto ~ .autocomplete-display-overlay').evaluate(
                el => (el.hidden ? '' : el.textContent.trim()));
            assert.equal(overlay, '', 'the catalog select overlay must not keep the previous pick');
            const status = await page.textContent('.status-bar-message');
            assert.ok(status.includes(`N° ${savedId}`), `status bar must confirm the saved N°, got: ${status}`);
        }

        // 1. Save → modal with the comprobante → close with [X].
        const id1 = await saveAndOpenModal('Nuevo E2E', 250);
        const modalText = await page.textContent('.report-modal-backdrop');
        assert.ok(modalText.includes('COMPROBANTE FIXTURE') && modalText.includes('$250,00'), `comprobante content, got: ${modalText}`);
        await page.click('.report-modal-close');
        await assertCleanForm(id1);

        // 2. Save again → close with VOLVER.
        const id2 = await saveAndOpenModal('Otro E2E', 300);
        assert.equal(Number(id2), Number(id1) + 1, 'second save is a new record');
        await page.click('.report-modal-back');
        await assertCleanForm(id2);
    });
    it('24. Returning from a <subform> keeps what was typed in the parent and selects the record just created', async () => {
        // Regression test (thym-pos, 2026-10-27): "0 - Nueva clienta" in Venta
        // opens the clienta subform; on save, LayoutProcessor re-rendered the
        // parent from its XML — everything typed before was lost, and the new
        // clienta was not selected (had to scroll the list to find it). It
        // also invalidated the catalog under the *form* name, not the table.
        // See dev/form/subform_parent.xml + subform_marca_nueva.xml.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);

        const overlay = () => page.locator('#id_marca ~ .autocomplete-display-overlay')
            .evaluate(el => (el.hidden ? '' : el.textContent.trim()));
        async function openSubform() {
            await page.click('#id_marca');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
            await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
            await page.waitForSelector('#nombre', { timeout: 10000 });
        }

        await page.fill('#nota', 'Dato previo');

        // 1. Save in the subform → back to the parent, data kept, new marca selected.
        await openSubform();
        assert.equal(await page.locator('#nota').count(), 0, 'the parent form is out of the DOM while the subform is open');
        await page.fill('#nombre', 'Marca E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForFunction(() => document.querySelector('#id_marca')?.value === '2', null, { timeout: 10000 });

        assert.equal(await page.inputValue('#nota'), 'Dato previo', 'what was typed in the parent must survive the subform');
        await page.waitForFunction(
            () => document.querySelector('#id_marca ~ .autocomplete-display-overlay')?.textContent.includes('Marca E2E'),
            null, { timeout: 5000 });
        assert.equal(await overlay(), '2 - Marca E2E', 'the new record is selected, with its "key - name" overlay');
        assert.equal(await page.inputValue('#nombre_marca'), 'Marca E2E', '<copy> follows the new record');
        assert.equal(await page.locator('.subform-back-btn').count(), 0, 'subform gone');
        assert.equal(await page.locator('#nota').count(), 1, 'exactly one parent form (no duplicate ids)');
        const status = await page.textContent('.status-bar-message');
        assert.ok(status.includes('N° 2'), `status bar confirms the new record, got: ${status}`);

        // 2. Open it again and go back without saving → parent kept, and the
        // select back to what it had (the marca just created), not to the
        // trigger value (0) nor empty (#46).
        await openSubform();
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        assert.equal(await page.inputValue('#nota'), 'Dato previo');
        assert.equal(await page.inputValue('#id_marca'), '2', 'the previous pick, not the trigger value (0)');
        await page.waitForFunction(
            () => document.querySelector('#id_marca ~ .autocomplete-display-overlay')?.textContent.includes('Marca E2E'),
            null, { timeout: 5000 });
        assert.equal(await overlay(), '2 - Marca E2E', 'no "0 - Nueva marca" overlay left behind');
    });

    it('25. Save feedback says "N°" and stays visible; an expected handler rejection is logged as a warning, not an error', async () => {
        // UX recorrido thym-pos 2026-10-27: the button said "¡CREADO! (ID: 32)"
        // (jargon — everything else says N°), the "Registro N° X creado"
        // confirmation auto-hid after 4 s, and every expected validate()
        // rejection went to the console/server log as ERROR with a stack.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        const consoleErrors = [];
        const onConsole = msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
        page.on('console', onConsole);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector('#nombre', { timeout: 10000 });

            // Expected rejection → shown to the user, but not a console error.
            await page.click('button[type="submit"]');
            await page.waitForFunction(
                () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
            await page.waitForTimeout(300);
            const rejectionErrors = consoleErrors.filter(t => t.includes('Escribí un nombre'));
            assert.deepEqual(rejectionErrors, [], 'an expected validate() rejection must not be logged as a console error');

            // Successful save → button says N°, and the confirmation stays.
            await page.fill('#nombre', 'Feedback E2E');
            await page.click('button[type="submit"]');
            await page.waitForSelector('.report-modal-backdrop', { timeout: 20000 });
            const btn = await page.textContent('button[type="submit"]');
            assert.match(btn, /¡CREADO! \(N° \d+\)/, `button feedback, got: ${btn}`);
            const savedId = btn.match(/N° (\d+)/)[1];
            await page.click('.report-modal-back');
            await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
            await page.waitForTimeout(5000); // success messages used to auto-hide at 4 s
            assert.equal(await page.locator('.status-bar').isVisible(), true, 'the confirmation is still visible');
            const status = await page.textContent('.status-bar-message');
            assert.ok(status.includes(`N° ${savedId}`), `got: ${status}`);
        } finally {
            page.off('console', onConsole);
        }
    });
    it('26. While the <output> report loads, the modal says so and IMPRIMIR stays disabled', async () => {
        // UX recorrido thym-pos 2026-10-27 (13.2): the comprobante modal sat
        // empty for ~5 s while DuckDB loaded, with IMPRIMIR already clickable
        // (it opened report.html before there was anything to print). The
        // report's YAML is held here so the loading state can be observed.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        let release;
        const held = new Promise(resolve => { release = resolve; });
        const route = '**/reports/comprobante_fixture.yaml';
        // .catch: if an assert fails first, finally unroutes while this is still
        // pending, and continue() would reject unhandled (killing the runner).
        await page.route(route, async r => { await held; await r.continue().catch(() => {}); });
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector('#nombre', { timeout: 10000 });
            await page.fill('#nombre', 'Carga E2E');
            await page.click('button[type="submit"]');
            await page.waitForSelector('.report-modal-backdrop', { timeout: 20000 });

            assert.equal(await page.locator('.report-modal-loading').isVisible(), true, 'a loading message while the report loads');
            const print = page.locator('.report-modal-print');
            assert.equal(await print.getAttribute('aria-disabled'), 'true', 'IMPRIMIR disabled while loading');
            assert.equal(await print.evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).pointerEvents), 'none', 'IMPRIMIR not clickable while loading');
            assert.equal(await print.evaluate(el => el.tabIndex), -1, 'IMPRIMIR out of the Tab order while loading');

            release();
            await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
            assert.equal(await page.locator('.report-modal-loading').count(), 0, 'the loading message goes away');
            assert.equal(await print.getAttribute('aria-disabled'), null, 'IMPRIMIR enabled once loaded');
            assert.equal(await print.evaluate(el => el.tabIndex), 0, 'IMPRIMIR back in the Tab order');
            await page.click('.report-modal-back');
            await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
        } finally {
            release();
            await page.unroute(route);
        }
    });

    it('27. Showing a status message does not push the action buttons down', async () => {
        // UX recorrido thym-pos 2026-10-27 (13.4): the status bar sits between
        // the fields and ANT/SIG/ENVIAR and was display:none while empty, so
        // every message (and every auto-hide) made the buttons jump.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.waitForTimeout(300);

        // The row, not the button: the mouse stays over ENVIAR after the
        // click and its :hover nudges the button itself by ~1px.
        const submitTop = () => page.locator('button[type="submit"]').evaluate(
            el => el.parentElement.getBoundingClientRect().top);
        const before = await submitTop();
        assert.equal(await page.locator('.status-bar').isVisible(), false, 'no message yet');

        await page.click('button[type="submit"]'); // sin nombre → mensaje del handler
        await page.waitForFunction(
            () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
        assert.equal(await page.locator('.status-bar').isVisible(), true, 'the message is shown');
        assert.equal(await submitTop(), before, 'ENVIAR stays where it was');
    });
    it('28. A required field left empty is only marked red (the summary is in the status bar) — no text that pushes the buttons or splits a select', async () => {
        // UX recorrido thym-pos 2026-10-27: on ENVIAR with required fields
        // empty, "Este campo es obligatorio." was appended to the input's
        // parent — for a select that is the box between the input and its ▾,
        // so the control broke in two; for a catalog select the empty
        // "clave - nombre" overlay ([hidden] lost to display:flex) covered
        // both the red input and the message. Every message also pushed
        // ANT/SIG/ENVIAR down. See dev/form/validacion_fixture.xml.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);

        // Relative to the form: clicking ENVIAR may scroll the page.
        const rowTop = () => page.locator('button[type="submit"]').evaluate(
            el => el.parentElement.getBoundingClientRect().top - el.closest('form').getBoundingClientRect().top);
        const before = await rowTop();

        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
        const status = await page.textContent('.status-bar-message');
        assert.ok(status.includes('Faltan 4 datos: Nombre, Producto, Canal, Items.'), `summary, got: ${status}`);

        assert.equal(await page.locator('form .error-msg').count(), 0, 'no per-field text for an empty required field');
        assert.equal(await rowTop(), before, 'ENVIAR stays where it was');

        for (const id of ['nombre', 'id_producto', 'canal']) {
            // What the user actually sees at the field's center must be red,
            // not an overlay painted over it.
            const seen = await page.locator(`#${id}`).evaluate(el => {
                const r = el.getBoundingClientRect();
                const top = el.ownerDocument.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return { same: top === el, red: el.classList.contains('field-error'),
                    bg: el.ownerDocument.defaultView.getComputedStyle(el).backgroundColor };
            });
            assert.ok(seen.red, `#${id} marked as field-error`);
            assert.ok(seen.same, `#${id} is not covered by another element`);
            assert.equal(seen.bg, 'rgb(255, 235, 238)', `#${id} shows the error background`);
        }

        // Each select stays in one piece: its ▾ right next to the input box.
        const gaps = await page.$$eval('form .autocomplete-wrapper', ws => ws.map(w =>
            w.querySelector('.autocomplete-btn').getBoundingClientRect().left
            - w.querySelector('.autocomplete-input-box').getBoundingClientRect().right));
        for (const gap of gaps) assert.ok(Math.abs(gap) < 1, `▾ attached to its input, gap ${gap}px`);
    });

    it('29. A non-required error (out of range) shows its text below the whole control', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);

        // A catalog key that doesn't exist → "Valor no encontrado…": below
        // the whole select, not between its input and its ▾.
        await page.fill('#id_producto', '999');
        await page.press('#id_producto', 'Tab'); // like the user: Tab also closes the (filtered) list
        await page.waitForSelector('form .error-msg', { timeout: 5000 });
        const catalog = await page.locator('#id_producto').evaluate(el => {
            const wrapper = el.closest('.autocomplete-wrapper');
            const msg = el.closest('form').querySelector('.error-msg');
            return { text: msg.textContent, inside: wrapper.contains(msg), below: msg.getBoundingClientRect().top >= wrapper.getBoundingClientRect().bottom,
                gap: wrapper.querySelector('.autocomplete-btn').getBoundingClientRect().left
                    - wrapper.querySelector('.autocomplete-input-box').getBoundingClientRect().right };
        });
        assert.equal(catalog.text, '❌ No existe en la lista.', 'plain wording, not "Valor no encontrado en tabla …"');
        assert.equal(catalog.inside, false, 'the message is not inside the select');
        assert.ok(catalog.below, 'the message is below the select');
        assert.ok(Math.abs(catalog.gap) < 1, `▾ still attached, gap ${catalog.gap}px`);

        await page.fill('#nombre', 'Rango E2E');
        await page.click('#id_producto');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.click('#canal');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Local' }).first().click();
        await page.fill('#monto', '0');
        // Blur first: the blur-time message pushes ENVIAR down between
        // mousedown and mouseup, so a direct click would miss the button.
        await page.locator('#monto').blur();
        await page.waitForTimeout(300);
        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });

        const placed = await page.locator('#monto').evaluate(el => {
            const msg = [...el.closest('form').querySelectorAll('.error-msg')].find(m => m.textContent.includes('al menos'));
            return msg && { text: msg.textContent, below: msg.getBoundingClientRect().top >= el.getBoundingClientRect().bottom };
        });
        assert.ok(placed, 'the out-of-range message is shown');
        assert.ok(placed.text.length > 2, `with its text, got: ${placed.text}`);
        assert.ok(placed.below, 'below the control');
    });

    it('30. Tab stays inside an open modal (comprobante and multifield row)', async () => {
        // UX recorrido thym-pos 2026-10-27: with the comprobante open, Tab went
        // VOLVER → IMPRIMIR → body → the form's buttons behind the backdrop.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        const inside = sel => page.evaluate(s => !!document.activeElement?.closest(s), sel);
        async function assertTrapped(sel) {
            for (let i = 0; i < 6; i++) {
                await page.keyboard.press('Tab');
                assert.ok(await inside(sel), `Tab #${i + 1} left ${sel}`);
            }
            for (let i = 0; i < 6; i++) {
                await page.keyboard.press('Shift+Tab');
                assert.ok(await inside(sel), `Shift+Tab #${i + 1} left ${sel}`);
            }
        }

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.fill('#nombre', 'Foco E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
        await assertTrapped('.report-modal');
        await page.click('.report-modal-back');
        await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });

        // The multifield row modal ("+ AGREGAR PRODUCTO" in Venta) too.
        await page.click('.tree-node:has(span:text("MF Pedidos"))');
        await page.waitForSelector('#id', { timeout: 10000 });
        await page.click('text=+ AGREGAR ITEM');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        await page.focus('.mf-row-modal-cancel-btn');
        await assertTrapped('.mf-row-modal');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
    });

    it('31. The "N° X creado" confirmation goes away once the user starts entering the next record', async () => {
        // UX recorrido thym-pos 2026-10-27: after #25 made it sticky, "Registro
        // N° 35 creado" stayed under the next sale while it was being entered.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.fill('#nombre', 'Confirmación E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
        await page.click('.report-modal-back');
        await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.waitForTimeout(500);
        const shown = () => page.locator('.status-bar').isVisible();
        assert.equal(await shown(), true, 'confirmation shown after VOLVER');

        // Only a real value change counts — not clicking into a field or
        // opening a list (2nd Chrome round: it vanished on a click on Fecha).
        await page.click('#monto');
        await page.click('#id_producto');
        await page.waitForSelector('.autocomplete-item', { timeout: 5000 });
        assert.equal(await shown(), true, 'still shown after clicking a field and opening a list');

        // Picking from a select counts, not only typing.
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.waitForTimeout(200);
        assert.equal(await shown(), false, 'confirmation gone once a value is picked');

        // Typing counts too (new save to get the confirmation back).
        await page.fill('#nombre', 'Confirmación E2E 2');
        await page.click('button[type="submit"]');
        await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
        await page.click('.report-modal-back');
        await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.waitForTimeout(500);
        assert.equal(await shown(), true, 'confirmation shown again');
        await page.type('#monto', '5');
        await page.waitForTimeout(200);
        assert.equal(await shown(), false, 'confirmation gone once something is typed');
    });
    it('32. Picking a value clears a select\'s red mark, and the "Faltan…" summary goes once every marked field is filled', async () => {
        // 2nd Chrome round 2026-10-27: field-error was only cleared on 'input'
        // (typing); a pick from a list fires 'change', so Cómo pagó / Clienta /
        // De dónde vino stayed red with a value, under a stale summary.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);

        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
        const red = id => page.locator(`#${id}`).evaluate(el => el.classList.contains('field-error'));

        await page.click('#canal');
        await page.locator('.autocomplete-item', { hasText: 'Local' }).first().click();
        assert.equal(await red('canal'), false, 'static select cleared by a pick');
        await page.click('#id_producto');
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        assert.equal(await red('id_producto'), false, 'catalog select cleared by a pick');
        assert.equal(await page.locator('.status-bar').isVisible(), true, 'summary stays while Nombre/Items are missing');

        await page.click('text=+ AGREGAR ITEM');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        await page.fill('.mf-row-modal input[data-col-id="detalle"]', 'Una fila');
        await page.click('.mf-row-modal-save-btn');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
        assert.equal(await page.locator('.multifield-grid.field-error').count(), 0, 'multifield cleared once it has a row');

        await page.type('#nombre', 'Completo');
        await page.waitForTimeout(200);
        assert.equal(await red('nombre'), false);
        assert.equal(await page.locator('.status-bar').isVisible(), false, 'summary gone once nothing is marked');
    });

    it('33. "+ AGREGAR …" stays legible on hover', async () => {
        // 2nd Chrome round 2026-10-27: dark text on a dark hover background.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("MF Pedidos"))');
        await page.waitForSelector('.multifield-add-btn', { timeout: 10000 });
        await page.hover('.multifield-add-btn');
        await page.waitForTimeout(250); // transition
        const ratio = await page.locator('.multifield-add-btn').evaluate(el => {
            const cs = el.ownerDocument.defaultView.getComputedStyle(el);
            const lum = c => {
                const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
                    v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const [a, b] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
            return (a + 0.05) / (b + 0.05);
        });
        assert.ok(ratio >= 4.5, `text/background contrast on hover ${ratio.toFixed(2)} < 4.5`);
    });

    it('34. Closing a modal puts the focus back where the user continues', async () => {
        // 2nd Chrome round 2026-10-27: after VOLVER / Escape / ✕ the focus
        // was on <body>. Row modal → back on "+ AGREGAR …"; comprobante → the
        // first field to fill in the clean form (not the N° key).
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        const active = () => page.evaluate(() => {
            const a = document.activeElement;
            return a.id || a.className;
        });

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("MF Pedidos"))');
        await page.waitForSelector('.multifield-add-btn', { timeout: 10000 });
        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        await page.keyboard.press('Escape');
        assert.ok((await active()).includes('multifield-add-btn'), `after Escape, got: ${await active()}`);
        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        await page.click('.mf-row-modal-cancel-btn');
        assert.ok((await active()).includes('multifield-add-btn'), `after Volver, got: ${await active()}`);

        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#nombre', { timeout: 10000 });
        for (const close of ['.report-modal-back', '.report-modal-close', 'Escape']) {
            await page.fill('#nombre', `Foco ${close}`);
            await page.click('button[type="submit"]');
            await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
            if (close === 'Escape') await page.keyboard.press('Escape');
            else await page.click(close);
            await page.waitForSelector('.report-modal-backdrop', { state: 'detached', timeout: 5000 });
            await page.waitForFunction(() => document.activeElement?.id === 'nombre', null, { timeout: 5000 })
                .catch(() => {});
            assert.equal(await active(), 'nombre', `after ${close}, focus on the first field to fill`);
        }
    });

    it('35. A field disabled by <enabled-when> looks disabled', async () => {
        // 2nd Chrome round 2026-10-27: Costo de envío (disabled until "Envío")
        // was white like any other input — clicks did nothing, no hint why.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Conditional Fields"))');
        await page.waitForSelector('#envio_costo', { timeout: 10000 });
        await page.waitForTimeout(300);
        const look = () => page.locator('#envio_costo').evaluate(el => {
            const cs = el.ownerDocument.defaultView.getComputedStyle(el);
            return { disabled: el.disabled, bg: cs.backgroundColor, cursor: cs.cursor, border: cs.borderStyle };
        });
        const off = await look();
        assert.equal(off.disabled, true);
        assert.equal(off.cursor, 'not-allowed');
        assert.notEqual(off.bg, 'rgb(255, 255, 255)', 'not white like an enabled input');
        assert.equal(off.border, 'dashed', 'same dashed border as a read-only field');

        await page.click('#envio_retiro');
        await page.locator('.autocomplete-item', { hasText: 'Envío' }).first().click();
        await page.waitForTimeout(200);
        const on = await look();
        assert.equal(on.disabled, false);
        assert.notEqual(on.bg, off.bg, 'enabled again looks normal');
    });

    it('36. Read-only columns in the row modal are skipped by Tab', async () => {
        // 2nd Chrome round 2026-10-27: Tab stopped on Subtotal (read-only).
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('.multifield-add-btn', { timeout: 10000 });
        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        const seen = [];
        await page.focus('.mf-row-modal-cancel-btn');
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            seen.push(await page.evaluate(() => document.activeElement.dataset.colId || document.activeElement.className));
        }
        assert.ok(seen.includes('cantidad'), `Tab reaches the editable columns, went: ${seen.join(' → ')}`);
        assert.ok(!seen.includes('precio_total'), `Tab must skip the read-only Subtotal, went: ${seen.join(' → ')}`);
        await page.keyboard.press('Escape');
    });

    it('37. The [?] help shows the field label, not its internal id', async () => {
        // 2nd Chrome round 2026-10-27: the tooltip read "> HELP ID_CLIENTA".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });
        await page.click('.help-icon[data-field="clieno"]');
        const prompt = await page.textContent('.help-tooltip[data-field="clieno"] .help-prompt');
        assert.ok(prompt.includes('N° Cliente'), `label in the help, got: ${prompt}`);
        assert.ok(!prompt.includes('clieno'), `no internal id, got: ${prompt}`);
    });

    it('38. Typing in a select filters its list, even before the list was opened', async () => {
        // 2nd Chrome round 2026-10-27: typing "2" in Clienta listed everyone.
        // The list only filtered on 'input' while already open, and opening
        // is async (catalog load) — it then rendered unfiltered.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#id_producto', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.focus('#id_producto');
        await page.keyboard.type('Moch');
        await page.waitForSelector('#id_producto ~ .autocomplete-dropdown .autocomplete-item, .autocomplete-wrapper:has(#id_producto) .autocomplete-item',
            { timeout: 5000 });
        const items = await page.$$eval('.autocomplete-wrapper:has(#id_producto) .autocomplete-item', els => els.map(e => e.textContent.trim()));
        assert.deepEqual(items.map(t => t.includes('Mochila')), items.map(() => true), `only matching items, got: ${items.join(' | ')}`);
        assert.ok(items.length >= 1);

        // Click (opens, async) and type right away: the text must still filter.
        await page.click('#canal');
        await page.keyboard.type('Lo');
        await page.waitForTimeout(500);
        const canal = await page.$$eval('.autocomplete-wrapper:has(#canal) .autocomplete-item', els => els.map(e => e.textContent.trim()));
        assert.equal(canal.length, 1, `only "Local", got: ${canal.join(' | ')}`);
        assert.ok(canal[0].includes('Local'), `got: ${canal[0]}`);
    });

    it('39. A required multifield with no rows is in the "Faltan…" summary and marked red', async () => {
        // 2nd Chrome round 2026-10-27: a venta without products was only
        // caught by the server handler after ENVIAR.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        let posted = false;
        const onRequest = req => { if (req.method() === 'POST' && req.url().includes('/api/v1/records/')) posted = true; };
        page.on('request', onRequest);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Validacion Fixture"))');
            await page.waitForSelector('#canal', { timeout: 10000 });
            await page.waitForTimeout(300);
            await page.fill('#nombre', 'Sin filas');
            await page.click('#id_producto');
            await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
            await page.click('#canal');
            await page.locator('.autocomplete-item', { hasText: 'Local' }).first().click();
            await page.click('button[type="submit"]');
            await page.waitForFunction(
                () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
            assert.equal(await page.textContent('.status-bar-message'), '❌ Falta "Items".');
            assert.equal(await page.locator('.multifield-grid.field-error').count(), 1, 'the multifield is marked');
            assert.equal(posted, false, 'never reaches the server');
        } finally {
            page.off('request', onRequest);
        }
    });

    it('40. The save log line carries the real new N°, not "id=?"', async () => {
        // Chrome round 2026-10-27 (12): on a create the key is empty in the
        // form data, so the client log said "Guardado ok … id=?".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        const logs = [];
        const onRequest = req => {
            if (req.method() === 'POST' && req.url().endsWith('/api/v1/log')) logs.push(req.postData() ?? '');
        };
        page.on('request', onRequest);
        try {
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector('#nombre', { timeout: 10000 });
            await page.fill('#nombre', 'Log E2E');
            await page.click('button[type="submit"]');
            await page.waitForSelector('.report-modal-backdrop', { timeout: 20000 });
            const savedId = (await page.textContent('.report-modal-title')).match(/N° (\d+)/)[1];
            await page.waitForTimeout(500);
            const line = logs.find(l => l.includes('Guardado ok'));
            assert.ok(line, 'a "Guardado ok" log line was sent');
            assert.ok(line.includes(`id=${savedId} `), `log must carry id=${savedId}, got: ${line}`);
            await page.click('.report-modal-back');
        } finally {
            page.off('request', onRequest);
        }
    });
    it('41. The "Faltan…" summary is rewritten as fields are filled, not left naming completed ones', async () => {
        // 3rd Chrome round 2026-10-27: with 3 of 4 already filled it still
        // said "Faltan 4 campos: Clienta, Productos, Cómo pagó…".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);
        const status = () => page.textContent('.status-bar-message');

        await page.click('button[type="submit"]');
        await page.waitForFunction(
            () => document.querySelector('.status-bar')?.dataset.level === 'error', null, { timeout: 5000 });
        assert.equal(await status(), '❌ Faltan 4 datos: Nombre, Producto, Canal, Items.');

        await page.click('#canal');
        await page.locator('.autocomplete-item', { hasText: 'Local' }).first().click();
        assert.equal(await status(), '❌ Faltan 3 datos: Nombre, Producto, Items.');
        await page.type('#nombre', 'X');
        assert.equal(await status(), '❌ Faltan 2 datos: Producto, Items.');
        await page.click('#id_producto');
        await page.locator('.autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        assert.equal(await status(), '❌ Falta "Items".');
    });

    it('42. Escape closes a select\'s list even when it was opened with ▾', async () => {
        // 3rd Chrome round 2026-10-27: Escape was only handled on the input;
        // after clicking ▾ the list stayed open.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);
        const list = page.locator('.autocomplete-wrapper:has(#canal) .autocomplete-dropdown');

        await page.click('.autocomplete-wrapper:has(#canal) .autocomplete-btn');
        await page.waitForSelector('.autocomplete-wrapper:has(#canal) .autocomplete-item', { timeout: 5000 });
        await page.keyboard.press('Escape');
        assert.equal(await list.isVisible(), false, 'list closed by Escape after opening it with ▾');

        await page.click('#canal');
        await page.waitForSelector('.autocomplete-wrapper:has(#canal) .autocomplete-item', { timeout: 5000 });
        await page.keyboard.press('Escape');
        assert.equal(await list.isVisible(), false, 'and after opening it from the input');
    });

    it('43. Enter picks the only item left by the filter', async () => {
        // 3rd Chrome round 2026-10-27: "Zay" + Enter left the text "Zay" in
        // the field; it took ↓ then Enter.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#id_producto', { timeout: 10000 });
        await page.waitForTimeout(300);
        // Canal's fixed options (Web, Local): other tests add catalog rows,
        // so a catalog filter is not guaranteed to leave a single match.
        await page.focus('#canal');
        await page.keyboard.type('Lo');
        await page.waitForSelector('.autocomplete-wrapper:has(#canal) .autocomplete-item', { timeout: 5000 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        assert.equal(await page.inputValue('#canal'), 'Local', 'the single match is selected');
        await page.fill('#canal', '');
        await page.keyboard.press('Escape');

        // With several items (Web, Local), Enter alone picks nothing.
        await page.click('#canal');
        await page.waitForSelector('.autocomplete-wrapper:has(#canal) .autocomplete-item', { timeout: 5000 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        assert.equal(await page.inputValue('#canal'), '', 'Enter with more than one item does not guess');
    });

    it('44. Back from a <subform>: with a value picked → focus on the next field to fill; empty → on the select', async () => {
        // 3rd Chrome round 2026-10-27: after "0 - Nueva clienta" the focus was
        // left on <body>, unlike the modals. Saved: the new record is already
        // picked, so the user continues with the next field (focusing the
        // select itself would swap its "key - name" overlay for the raw key).
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        async function openSubform() {
            await page.click('#id_marca');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
            await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
            await page.waitForSelector('#nombre', { timeout: 10000 });
        }
        const activeId = () => page.evaluate(() => document.activeElement?.id);

        // Nothing picked before, back without saving → empty → the select.
        await openSubform();
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForFunction(() => document.activeElement?.id === 'id_marca', null, { timeout: 5000 }).catch(() => {});
        assert.equal(await activeId(), 'id_marca', 'empty select after going back');

        await openSubform();
        await page.fill('#nombre', 'Marca Foco E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForFunction(() => document.activeElement?.id === 'cantidad', null, { timeout: 5000 }).catch(() => {});
        assert.equal(await activeId(), 'cantidad', 'after saving: the next editable field (skips the read-only copy)');

        // Back without saving, the new marca restored (#46) → next field.
        await openSubform();
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForFunction(() => document.activeElement?.id === 'cantidad', null, { timeout: 5000 }).catch(() => {});
        assert.equal(await activeId(), 'cantidad', 'after going back without saving, with the previous pick restored');
    });

    it('45. The [?] help icons are not Tab stops', async () => {
        // 3rd Chrome round 2026-10-27: every [?] was a Tab stop — from N° to
        // Clienta took 6 Tabs. Still opens with a click.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Clientes"))');
        await page.waitForSelector('#clieno', { timeout: 10000 });
        const tabbable = await page.$$eval('.help-icon', els => els.filter(el => el.tabIndex >= 0).length);
        assert.equal(tabbable, 0, 'no [?] in the Tab order');
        await page.click('.help-icon[data-field="clieno"]');
        assert.equal(await page.locator('.help-tooltip[data-field="clieno"]').isVisible(), true, 'still opens with a click');
    });
    it('46. Going back from a <subform> without saving keeps the value the select had before', async () => {
        // 4th Chrome round 2026-10-27: with "15 - Validación Cinco" picked,
        // opening "0 - Nueva clienta" and going back left Clienta empty.
        // Leaving a modal/subform without saving must not clear anything.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        const overlay = () => page.locator('#id_marca ~ .autocomplete-display-overlay')
            .evaluate(el => (el.hidden ? '' : el.textContent.trim()));

        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item:has(.autocomplete-key:text-is("1"))').first().click();
        await page.click('#nota'); // the overlay only shows while the select has no focus
        await page.waitForTimeout(300);
        const before = { value: await page.inputValue('#id_marca'), overlay: await overlay(), copy: await page.inputValue('#nombre_marca') };
        assert.equal(before.value, '1');

        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
        await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);

        assert.ok(before.overlay.startsWith('1 - '), `overlay before: ${before.overlay}`);
        assert.equal(await page.inputValue('#id_marca'), before.value, 'the previous pick is back');
        assert.equal(await overlay(), before.overlay, 'with its "key - name" overlay');
        assert.equal(await page.inputValue('#nombre_marca'), before.copy, 'and its <copy> target');
    });

    it('47. A subform\'s "se guardó…" message goes away when another subform is opened', async () => {
        // 4th Chrome round 2026-10-27: "Clienta nueva: se guardó con el N° 15…"
        // was still in the bar after cancelling a second alta.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        async function openSubform() {
            await page.click('#id_marca');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
            await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
            await page.waitForSelector('#nombre', { timeout: 10000 });
        }

        await openSubform();
        await page.fill('#nombre', 'Marca Mensaje E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForFunction(() => document.querySelector('.status-bar-message')?.textContent.includes('se guardó'), null, { timeout: 5000 });

        await openSubform();
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        const status = await page.locator('.status-bar').isVisible() ? await page.textContent('.status-bar-message') : '';
        assert.ok(!status.includes('se guardó'), `stale "se guardó" message, got: ${status}`);
    });

    it('48. A report table with rowFooter has real <thead>/<tbody>/<tfoot>, footer labels next to the amounts', async () => {
        // 4th Chrome round 2026-10-27: PRODUCTOS / ENVÍO / TOTAL A PAGAR were
        // body rows, centered under PRODUCTO like product names.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/report.html?file=tabla_fixture&id=1`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.report-container table', { timeout: 20000 });
        const t = await page.$eval('.report-container table', table => ({
            head: table.tHead?.rows.length ?? 0,
            body: [...table.tBodies].reduce((n, b) => n + b.rows.length, 0),
            bodyHasFooter: [...table.tBodies].some(b => /TOTAL/.test(b.textContent)),
            bodyFirst: table.tBodies[0]?.rows[0]?.cells.length,
            foot: [...(table.tFoot?.rows ?? [])].map(r => ({
                cells: r.cells.length,
                label: r.cells[0].textContent.trim(),
                span: r.cells[0].colSpan,
                align: r.cells[0].ownerDocument.defaultView.getComputedStyle(r.cells[0]).textAlign,
            })),
        }));
        assert.equal(t.head, 1, 'one header row');
        assert.ok(t.body >= 2, `body = the products (other tests add some), got ${t.body}`);
        assert.equal(t.bodyHasFooter, false, 'no footer row left in the body');
        assert.equal(t.bodyFirst, 3, 'body cells untouched');
        assert.deepEqual(t.foot.map(f => f.label), ['SUBTOTAL', 'TOTAL']);
        for (const f of t.foot) {
            assert.equal(f.span, 2, `footer label spans the empty cells, got colspan ${f.span}`);
            assert.equal(f.cells, 2, 'label + amount');
            assert.equal(f.align, 'right', 'label next to its amount');
        }
    });

    it('49. Back from a <subform> with multifield rows loaded → focus on "+ AGREGAR", not a row\'s ✕', async () => {
        // 5th Chrome round 2026-10-27 (2b): in Venta, after "0 - Nueva clienta"
        // with products already loaded, the focus landed on the first row's ✕
        // — one Enter away from deleting it.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Items"))');
        await page.waitForSelector('#id_marca', { timeout: 10000 });
        await page.waitForTimeout(300);

        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
        await page.fill('.mf-row-modal [data-col-id="detalle"]', 'Fila foco');
        await page.fill('.mf-row-modal [data-col-id="cant"]', '2');
        await page.click('.mf-row-modal-save-btn');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
        assert.equal(await page.locator('.multifield-delete-btn').count(), 1, 'one row loaded');

        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
        await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
        await page.waitForSelector('#nombre', { timeout: 10000 });
        await page.fill('#nombre', 'Marca Filas E2E');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#id_marca', { timeout: 10000 });
        await page.waitForFunction(() => document.activeElement?.closest('.multifield-grid'), null, { timeout: 5000 }).catch(() => {});

        const focused = await page.evaluate(() => document.activeElement?.className);
        assert.ok(/\bmultifield-add-btn\b/.test(focused), `focus after going back, got: ${focused}`);
        assert.equal(await page.locator('.multifield-delete-btn').count(), 1, 'the row is still there');
    });

    it('50. Focusing a picked select with Tab keeps showing "key - name" until the user types or opens the list', async () => {
        // 5th Chrome round 2026-10-27: tabbing into Clienta swapped "3 - Flor"
        // for a bare "3".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Marca Uno' }).first().click();
        await page.waitForTimeout(300);

        const overlay = '#id_marca ~ .autocomplete-display-overlay';
        await page.focus('#nota');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'id_marca');
        assert.equal(await page.isVisible(overlay), true, 'overlay still shown with focus');
        assert.equal(await page.textContent(overlay), '1 - Marca Uno');

        // Typing replaces the key (it is selected) and shows the real input.
        await page.keyboard.type('Marca');
        assert.equal(await page.isVisible(overlay), false, 'overlay hidden once typing');
        assert.equal(await page.inputValue('#id_marca'), 'Marca', 'typed text replaces the key');
        await page.keyboard.press('Escape');

    });

    it('51. When the engine moves the focus (back from a <subform>), the focus ring is visible', async () => {
        // 6th Chrome round 2026-10-29: the focus was on "+ AGREGAR" but with
        // no outline — Chrome only draws :focus-visible after keyboard use.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Items"))');
        await page.waitForSelector('#id_marca', { timeout: 10000 });
        await page.waitForTimeout(300);
        // A marca picked, then the alta and back without saving: the pick is
        // restored and the focus moves on to "+ AGREGAR".
        const pick = async text => {
            await page.click('#id_marca');
            await page.waitForTimeout(300);
            await page.locator('.autocomplete-item', { hasText: text }).first().click();
        };
        await pick('Marca Uno');
        await page.waitForTimeout(300);
        await pick('Nueva marca');
        await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
        await page.click('.subform-back-btn');
        await page.waitForSelector('#id_marca', { timeout: 10000 });
        await page.waitForFunction(() => document.activeElement?.classList.contains('multifield-add-btn'), null, { timeout: 5000 });

        const ring = () => page.evaluate(() => {
            const cs = window.getComputedStyle(document.activeElement);
            return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        });
        assert.equal(await ring(), true, 'outline drawn on "+ AGREGAR"');

        // Only while it has the focus.
        await page.mouse.click(5, 5);
        const stale = await page.evaluate(() => {
            const cs = window.getComputedStyle(document.querySelector('.multifield-add-btn'));
            return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        });
        assert.equal(stale, false, 'no outline once the focus left');
    });

    it('52. Clicking a picked select keeps "key - name" while the list is open, with the current item marked', async () => {
        // 6th Chrome round 2026-10-29: the click showed a bare "2" and the
        // list did not show which one was picked.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Marca Uno' }).first().click();
        await page.waitForTimeout(300);

        const overlay = '#id_marca ~ .autocomplete-display-overlay';
        await page.click('#nota');
        await page.click('#id_marca');
        await page.waitForSelector('.autocomplete-item', { timeout: 3000 });
        await page.waitForTimeout(200);
        assert.equal(await page.isVisible(overlay), true, 'overlay still shown with the list open');
        assert.equal(await page.textContent(overlay), '1 - Marca Uno');
        const marked = await page.evaluate(() => {
            const dd = document.querySelector('#id_marca').closest('.autocomplete-wrapper').querySelector('.autocomplete-dropdown, [class*="dropdown"]');
            const item = dd?.querySelector('.autocomplete-item.highlighted');
            if (!item) return null;
            const a = item.getBoundingClientRect(), b = dd.getBoundingClientRect();
            return { key: item.dataset.key, visible: a.top >= b.top && a.bottom <= b.bottom };
        });
        assert.deepEqual(marked, { key: '1', visible: true }, 'the current item is highlighted and in view');

        await page.keyboard.type('Nueva');
        assert.equal(await page.isVisible(overlay), false, 'overlay hidden once typing');
        assert.equal(await page.inputValue('#id_marca'), 'Nueva', 'typed text replaces the key');
        await page.keyboard.press('Escape');
    });

    it('53. Computed (is=) top-level fields are not Tab stops', async () => {
        // 6th Chrome round 2026-10-29: Tab stopped on "Total productos" and
        // "A pagar", read-only.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('#total', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.focus('.multifield-add-btn');
        await page.keyboard.press('Tab');
        const id = await page.evaluate(() => document.activeElement?.id || document.activeElement?.className);
        assert.notEqual(id, 'total', 'Tab skips the read-only Total');
    });

    it('54. After ENVIAR with fields missing, the focused one shows a focus ring on top of its red mark', async () => {
        // 7th Chrome round 2026-10-29: the focus went to Clienta, but with
        // outline: none it looked like every other red field.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();

        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.waitForTimeout(300);
        const ringOn = sel => page.evaluate(sel => {
            const cs = window.getComputedStyle(document.querySelector(sel));
            return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        }, sel);

        // Text field.
        await page.click('button[type="submit"]');
        await page.waitForFunction(() => document.activeElement?.id === 'nombre', null, { timeout: 5000 });
        assert.equal(await ringOn('#nombre'), true, 'ring on the focused text field');

        // Select: the ring goes around the field and its ▾ together.
        await page.fill('#nombre', 'Con foco');
        await page.click('button[type="submit"]');
        await page.waitForFunction(() => document.activeElement?.id === 'id_producto', null, { timeout: 5000 });
        assert.equal(await page.evaluate(() => {
            const w = document.getElementById('id_producto').closest('.autocomplete-wrapper');
            const cs = window.getComputedStyle(w);
            return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        }), true, 'ring around the whole select');
        assert.equal(await ringOn('#nombre'), false, 'the previous field lost its ring');
    });

    describe('Unsaved changes (UX point 3)', () => {
        // UX recorrido thym-pos 2026-10-26, punto 3: typing an N°, ANT/SIG or
        // another explorer item discarded what was being entered, silently.
        const DIALOG = '.confirm-dialog';
        const openForm = async (page, label, waitFor) => {
            await page.click(`.tree-node:has(span:text("${label}"))`);
            await page.waitForSelector(waitFor, { timeout: 10000 });
            await page.waitForTimeout(300);
        };

        it('55. Leaving a form with unsaved data through the explorer asks first; untouched forms do not', async () => {
            const { page, baseUrl, context, loginAsOperador } = ctx;
            await context.clearCookies();
            await loginAsOperador();
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

            // Untouched → no question.
            await openForm(page, 'Comprobante Fixture', '#monto');
            await openForm(page, 'Validacion Fixture', '#canal');
            assert.equal(await page.locator(DIALOG).count(), 0, 'no dialog for an untouched form');

            // Typed something → asked; "Seguir cargando" keeps everything.
            await page.fill('#nombre', 'A medio cargar');
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            assert.match(await page.textContent(DIALOG), /Hay datos sin guardar/);
            assert.equal(await page.evaluate(() => document.activeElement?.className), 'confirm-dialog-keep focus-ring',
                'the safe choice has the focus');
            await page.click('.confirm-dialog-keep');
            await page.waitForSelector(DIALOG, { state: 'detached', timeout: 5000 });
            assert.equal(await page.inputValue('#nombre'), 'A medio cargar', 'still there');
            // 8th Chrome round: the focus was left on <body>.
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'nombre',
                'back to the field the user was in');
            assert.equal(await page.locator('#canal').count(), 1, 'still on the same form');
            assert.match(await page.textContent('.tree-node.active'), /Validacion Fixture/, 'explorer still marks this form');

            // Escape = keep.
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.keyboard.press('Escape');
            await page.waitForSelector(DIALOG, { state: 'detached', timeout: 5000 });
            assert.equal(await page.inputValue('#nombre'), 'A medio cargar');

            // "Descartar" goes on.
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.click('.confirm-dialog-discard');
            await page.waitForSelector('#monto', { timeout: 10000 });
            assert.match(await page.textContent('.tree-node.active'), /Comprobante Fixture/);

            // Only a multifield row → also unsaved.
            await openForm(page, 'Subform Items', '#id_marca');
            await page.click('.multifield-add-btn');
            await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
            await page.fill('.mf-row-modal [data-col-id="detalle"]', 'Fila sin guardar');
            await page.click('.mf-row-modal-save-btn');
            await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
            await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.click('.confirm-dialog-discard');
            await page.waitForSelector('#monto', { timeout: 10000 });
        });

        it('56. Typing an N° or using ANT/SIG with unsaved data asks first', async () => {
            const { page, baseUrl, context, loginAsOperador } = ctx;
            await context.clearCookies();
            await loginAsOperador();
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await openForm(page, 'Comprobante Fixture', '#monto');

            // N° with a new one half entered → keep: N° goes back to empty.
            await page.fill('#nombre', 'Nuevo sin guardar');
            await page.fill('#id', '1');
            await page.keyboard.press('Tab');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.click('.confirm-dialog-keep');
            await page.waitForSelector(DIALOG, { state: 'detached', timeout: 5000 });
            await page.waitForTimeout(300);
            assert.equal(await page.inputValue('#nombre'), 'Nuevo sin guardar');
            assert.equal(await page.inputValue('#id'), '', 'the N° typed is undone');
            assert.equal(await page.locator(DIALOG).count(), 0, 'asked only once');
            // 9th Chrome round: the focus was left on the page.
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'id', 'focus back on the N°');

            // Escape too.
            await page.fill('#id', '1');
            await page.keyboard.press('Tab');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.keyboard.press('Escape');
            await page.waitForSelector(DIALOG, { state: 'detached', timeout: 5000 });
            await page.waitForTimeout(300);
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'id', 'focus back on the N° (Escape)');

            // Again → discard: record 1 loads.
            await page.fill('#id', '1');
            await page.keyboard.press('Tab');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.click('.confirm-dialog-discard');
            await page.waitForFunction(() => document.getElementById('nombre')?.value === 'Comprobante Existente', null, { timeout: 5000 });

            // Freshly loaded → SIG does not ask.
            await page.click('button:has-text("SIG")');
            await page.waitForTimeout(500);
            assert.equal(await page.locator(DIALOG).count(), 0, 'a loaded record, untouched, does not ask');

            // Edited → SIG asks; keep leaves the edit and the record.
            await page.fill('#id', '1');
            await page.keyboard.press('Tab');
            await page.waitForFunction(() => document.getElementById('nombre')?.value === 'Comprobante Existente', null, { timeout: 5000 });
            await page.fill('#monto', '999');
            await page.click('button:has-text("SIG")');
            await page.waitForSelector(DIALOG, { timeout: 5000 });
            await page.click('.confirm-dialog-keep');
            await page.waitForSelector(DIALOG, { state: 'detached', timeout: 5000 });
            assert.equal(await page.inputValue('#monto'), '999');
            assert.equal(await page.inputValue('#id'), '1');
        });

        it('57. Closing or reloading the tab with unsaved data triggers the browser warning', async () => {
            const { page, baseUrl, context, loginAsOperador } = ctx;
            await context.clearCookies();
            await loginAsOperador();
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            await openForm(page, 'Comprobante Fixture', '#monto');
            const warns = () => page.evaluate(() => {
                const e = new Event('beforeunload', { cancelable: true });
                window.dispatchEvent(e);
                return e.defaultPrevented;
            });
            assert.equal(await warns(), false, 'untouched: no warning');
            await page.fill('#nombre', 'Sin guardar');
            assert.equal(await warns(), true, 'unsaved: warning');
        });
    });

    it('58. A row\'s ✕ deletes it right away — no question, no native confirm()', async () => {
        // Usuario 2026-10-29: the native confirm() blocked the page; 2026-10-31:
        // "que se elimine sin preguntar".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        const native = [];
        const onDialog = d => { native.push(d.message()); d.dismiss().catch(() => {}); };
        // After goto: leaving a previous test's unsaved form fires the
        // browser's beforeunload dialog (#57), which is not what this checks.
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        page.on('dialog', onDialog);
        try {
            await page.click('.tree-node:has(span:text("Subform Items"))');
            await page.waitForSelector('#id_marca', { timeout: 10000 });
            await page.waitForTimeout(300);
            for (const detalle of ['Fila A', 'Fila B']) {
                await page.click('.multifield-add-btn');
                await page.waitForSelector('.mf-row-modal', { timeout: 5000 });
                await page.fill('.mf-row-modal [data-col-id="detalle"]', detalle);
                await page.click('.mf-row-modal-save-btn');
                await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
            }
            const rows = () => page.locator('.multifield-delete-btn').count();
            assert.equal(await rows(), 2);

            await page.locator('.multifield-delete-btn').first().click();
            await page.waitForTimeout(300);
            assert.equal(await page.locator('.confirm-dialog').count(), 0, 'no question');
            assert.deepEqual(native, [], 'no native confirm()');
            assert.equal(await rows(), 1, 'deleted');
            assert.match(await page.textContent('.multifield-grid'), /Fila B/);
            assert.ok(!/Fila A/.test(await page.textContent('.multifield-grid')), 'the right row went');
            assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('multifield-add-btn')), true,
                'focus goes on to "+ AGREGAR", not <body>');
        } finally {
            page.off('dialog', onDialog);
        }
    });

    it('59. Deleting a row of a just-loaded record counts as unsaved', async () => {
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('#total', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.fill('#id', '1');
        await page.keyboard.press('Tab');
        await page.waitForSelector('.multifield-delete-btn', { timeout: 5000 });
        const warns = () => page.evaluate(() => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
        });
        assert.equal(await warns(), false, 'just loaded: clean');
        await page.locator('.multifield-delete-btn').first().click();
        await page.waitForTimeout(300);
        assert.equal(await warns(), true, 'a deleted row is an unsaved change');
    });

    it('60. Typing an N° and choosing "Seguir cargando" leaves the multifield as it was (no rows from the other record)', async () => {
        // 8th Chrome round 2026-10-29: in Venta, the handler's after('id')
        // ran on the N° change *before* the question and populated the grid
        // with venta 1's products; "Seguir cargando" kept them — saving would
        // have created a venta with someone else's products.
        // venta_draft record 1 has one row: product 1 (Tote Fixture).
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('#total', { timeout: 10000 });
        await page.waitForTimeout(300);

        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal [data-col-id="id_producto"]', { timeout: 5000 });
        await page.click('.mf-row-modal [data-col-id="id_producto"]');
        await page.waitForTimeout(300);
        await page.locator('.mf-row-modal .autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.click('.mf-row-modal-save-btn');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
        const grid = () => page.textContent('.multifield-grid tbody');
        const before = await grid();
        const totalBefore = await page.inputValue('#total');
        assert.match(before, /Mochila Fixture/);

        await page.fill('#id', '1');
        await page.keyboard.press('Tab');
        await page.waitForSelector('.confirm-dialog', { timeout: 5000 });
        await page.waitForTimeout(500); // anything racing the question would land here
        assert.equal(await grid(), before, 'the grid does not change while asking');
        await page.click('.confirm-dialog-keep');
        await page.waitForSelector('.confirm-dialog', { state: 'detached', timeout: 5000 });
        await page.waitForTimeout(500);
        assert.equal(await grid(), before, 'still only the row the user added');
        assert.equal(await page.inputValue('#total'), totalBefore);

        // A N° that does not exist does not touch the grid either.
        await page.fill('#id', '99999');
        await page.keyboard.press('Tab');
        await page.waitForSelector('.confirm-dialog', { timeout: 5000 });
        await page.click('.confirm-dialog-discard');
        await page.waitForTimeout(800);
        assert.match(await grid(), /Mochila Fixture/, 'no record 99999 → nothing replaced the rows');

        // Discard with a real N° → its rows.
        await page.fill('#id', '1');
        await page.keyboard.press('Tab');
        await page.click('.confirm-dialog-discard', { timeout: 5000 });
        await page.waitForFunction(() => /Tote Fixture/.test(document.querySelector('.multifield-grid tbody')?.textContent ?? ''), null, { timeout: 5000 });
        assert.ok(!/Mochila Fixture/.test(await grid()), 'record 1 rows only');
    });

    it('61. Changing the month while a report is still loading shows the last month picked, not whichever load finished last', async () => {
        // 2026-10-31, thym-pos "Ventas del mes": the first render (current
        // month) finished after the one for the month picked meanwhile and
        // replaced it — the report showed an empty month. Likely the cause of
        // #19 failing now and then.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Mes Fixture"))');
        const picker = page.locator('.month-picker-bar input[type="month"]');
        await picker.waitFor({ timeout: 15000 });
        await picker.fill('2026-06');
        await picker.fill('2026-07');
        await page.waitForFunction(() => document.querySelector('.terminal-window')?.textContent.includes('2026-07'), null, { timeout: 20000 });
        await page.waitForTimeout(6000); // let any stale load finish
        const text = await page.textContent('.terminal-window');
        assert.ok(text.includes('2026-07') && text.includes('$2.000,00'), `July, got: ${text}`);
        assert.ok(!text.includes('2026-06'), `no June, got: ${text}`);
        assert.equal(await page.locator('.terminal-window .report-container').count(), 1, 'one report, not two stacked');
        assert.equal(await page.locator('.month-picker-bar input[type="month"]').inputValue(), '2026-07');
    });

    describe('Wide report tables (2026-10-31, thym-pos "Ventas del mes")', () => {
        const openReport = async (page, label) => {
            await page.click(`.tree-node:has(span:text("${label}"))`);
            await page.waitForSelector('.terminal-window .report-container table', { timeout: 20000 });
            await page.waitForTimeout(300);
        };
        const login = async () => {
            const { page, baseUrl, context, loginAsOperador } = ctx;
            await context.clearCookies();
            await loginAsOperador();
            await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
            return page;
        };

        it('63. A table wider than its box scrolls by dragging it with the mouse', async () => {
            const page = await login();
            await page.setViewportSize({ width: 900, height: 700 });
            try {
                await openReport(page, 'Ancho Fixture');
                const box = '.report-lines-md:has(table)';
                const info = await page.evaluate(sel => {
                    const el = document.querySelector(sel);
                    return { overflow: el.scrollWidth > el.clientWidth, cursor: window.getComputedStyle(el).cursor };
                }, box);
                assert.equal(info.overflow, true, 'sanity: the fixture overflows at 900px');
                assert.equal(info.cursor, 'grab', 'it shows it can be dragged');

                const cell = await page.locator(`${box} tbody td`).nth(1).boundingBox(); // visible
                await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
                await page.mouse.down();
                await page.mouse.move(cell.x + cell.width / 2 - 250, cell.y + cell.height / 2, { steps: 10 });
                await page.mouse.up();
                const left = await page.evaluate(sel => document.querySelector(sel).scrollLeft, box);
                assert.ok(left >= 200, `dragged 250px to the left → scrolled ${left}px`);

                // A table that fits is not draggable.
                await openReport(page, 'Mes Fixture');
                assert.notEqual(await page.evaluate(() => window.getComputedStyle(document.querySelector('.report-lines-md:has(table)')).cursor), 'grab',
                    'no grab cursor when there is nothing to scroll');
            } finally {
                await page.setViewportSize({ width: 1280, height: 720 });
            }
        });

        it('64. Scrolled sideways, the first column stays in view', async () => {
            const page = await login();
            await page.setViewportSize({ width: 900, height: 700 });
            try {
                await openReport(page, 'Ancho Fixture');
                const pos = await page.evaluate(() => {
                    const box = document.querySelector('.report-lines-md:has(table)');
                    box.scrollLeft = 300;
                    const left = box.getBoundingClientRect().left;
                    const firstCells = [...box.querySelectorAll('tr > :first-child')];
                    return firstCells.map(c => Math.round(c.getBoundingClientRect().left - left));
                });
                assert.ok(pos.length > 1 && pos.every(d => Math.abs(d) <= 2), `first column offsets from the box: ${pos}`);
            } finally {
                await page.setViewportSize({ width: 1280, height: 720 });
            }
        });

        it('65. The month picker keeps the focus between changes, so arrow keys keep moving the month', async () => {
            const page = await login();
            await page.click('.tree-node:has(span:text("Mes Fixture"))');
            const picker = page.locator('.month-picker-bar input[type="month"]');
            await picker.waitFor({ timeout: 15000 });
            await picker.fill('2026-06');
            await page.waitForFunction(() => document.querySelector('.terminal-window')?.textContent.includes('2026-06'), null, { timeout: 20000 });
            await picker.focus();
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(1500);
            await page.keyboard.press('ArrowUp');
            await page.waitForFunction(() => document.querySelector('.terminal-window table')?.textContent.includes('2026-08')
                || document.querySelector('#month-picker-input')?.value === '2026-08', null, { timeout: 20000 }).catch(() => {});
            assert.equal(await page.evaluate(() => document.getElementById('month-picker-input')?.value), '2026-08');
            assert.equal(await page.evaluate(() => document.activeElement?.id), 'month-picker-input', 'focus stays on the picker');
            assert.equal(await page.locator('.month-picker-bar').count(), 1, 'one picker');
        });

        it('66. A report header can show the month picked ("junio 2026")', async () => {
            const page = await login();
            await page.click('.tree-node:has(span:text("Mes Fixture"))');
            const picker = page.locator('.month-picker-bar input[type="month"]');
            await picker.waitFor({ timeout: 15000 });
            await picker.fill('2026-06');
            await page.waitForFunction(() => document.querySelector('.terminal-window table')?.textContent.includes('2026-06'), null, { timeout: 20000 });
            assert.equal((await page.textContent('.report-container h1')).trim(), 'MES FIXTURE — junio 2026');
        });

        it('67. Dragging up/down with the hand scrolls the page, too', async () => {
            const page = await login();
            await page.setViewportSize({ width: 900, height: 220 });
            try {
                await openReport(page, 'Ancho Fixture');
                const scroller = () => page.evaluate(() => document.getElementById('workspace').scrollTop);
                assert.ok(await page.evaluate(() => {
                    const w = document.getElementById('workspace');
                    return w.scrollHeight > w.clientHeight;
                }), 'sanity: the workspace scrolls at this height');
                const cell = await page.locator('.report-lines-md:has(table) tbody td').nth(1).boundingBox();
                await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
                await page.mouse.down();
                await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2 - 100, { steps: 10 });
                await page.mouse.up();
                assert.ok(await scroller() >= 60, `dragged 100px up → page scrolled ${await scroller()}px`);
            } finally {
                await page.setViewportSize({ width: 1280, height: 720 });
            }
        });

        it('68. A table that continues sideways shows it: a shade on the edge with more, gone at the end', async () => {
            // Usuario 2026-10-31: no más ancho — que se intuya que se desplaza.
            const page = await login();
            await page.setViewportSize({ width: 900, height: 700 });
            try {
                await openReport(page, 'Ancho Fixture');
                const shades = () => page.evaluate(() => {
                    const frame = document.querySelector('.report-scroll-frame');
                    const op = pseudo => Number(window.getComputedStyle(frame, pseudo).opacity);
                    return { left: op('::before'), right: op('::after') };
                });
                await page.waitForTimeout(400);
                assert.deepEqual(await shades(), { left: 0, right: 1 }, 'at the start: more to the right');
                await page.evaluate(() => {
                    const box = document.querySelector('.report-lines-md:has(table)');
                    box.scrollLeft = 120;
                });
                await page.waitForTimeout(400);
                assert.deepEqual(await shades(), { left: 1, right: 1 }, 'in the middle: both');
                await page.evaluate(() => {
                    const box = document.querySelector('.report-lines-md:has(table)');
                    box.scrollLeft = box.scrollWidth;
                });
                await page.waitForTimeout(400);
                assert.deepEqual(await shades(), { left: 1, right: 0 }, 'at the end: only to the left');
            } finally {
                await page.setViewportSize({ width: 1280, height: 720 });
            }
        });

        it('69. Report tables use the multifield header look and alternate row shades', async () => {
            // Usuario 2026-10-31: "me gusta el header de productos de ventas".
            const page = await login();
            await page.click('.tree-node:has(span:text("Venta Draft"))');
            await page.waitForSelector('.multifield-table thead', { timeout: 10000 });
            const mf = await page.evaluate(() => {
                const cs = window.getComputedStyle(document.querySelector('.multifield-table thead'));
                return { bg: cs.backgroundColor, color: cs.color };
            });
            await openReport(page, 'Ancho Fixture');
            const rep = await page.evaluate(() => {
                const t = document.querySelector('.report-lines-md table');
                const cs = window.getComputedStyle(t.tHead.rows[0].cells[0]);
                const rows = [...t.tBodies[0].rows].map(r => window.getComputedStyle(r.cells[1]).backgroundColor);
                return { bg: cs.backgroundColor, color: cs.color, rows };
            });
            assert.deepEqual({ bg: rep.bg, color: rep.color }, mf, 'same header as the multifield');
            assert.ok(rep.rows.length >= 2 && rep.rows[0] !== rep.rows[1], `alternating rows: ${rep.rows}`);
        });

        it('70. In dark mode the month picker calendar icon is light, and "Cargando" shows its dots', async () => {
            const page = await login();
            await page.evaluate(() => document.body.classList.add('dark-mode'));
            await page.click('.tree-node:has(span:text("Mes Fixture"))');
            const picker = page.locator('.month-picker-bar input[type="month"]');
            await picker.waitFor({ timeout: 15000 });
            assert.equal(await picker.evaluate(el => window.getComputedStyle(el).colorScheme), 'dark',
                'dark color-scheme → the native calendar icon is drawn light');
            const dots = await page.evaluate(async () => {
                const el = document.createElement('div');
                el.className = 'report-loading';
                el.textContent = 'Cargando';
                document.body.appendChild(el);
                const widths = [];
                for (let i = 0; i < 6; i++) {
                    widths.push(window.getComputedStyle(el, '::after').width);
                    await new Promise(r => setTimeout(r, 250));
                }
                el.remove();
                return widths;
            });
            assert.ok(new Set(dots).size > 1, `the dots move: ${dots}`);
            await page.evaluate(() => document.body.classList.remove('dark-mode'));
        });
    });

    it('71. A fixed-option select whose value and text are the same shows it once ("Local", not "Local - Local")', async () => {
        // UX recorrido thym-pos 2026-10-26, punto 18: "Transferencia - Transferencia".
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#canal', { timeout: 10000 });
        await page.click('#canal');
        await page.waitForSelector('.autocomplete-item', { timeout: 3000 });
        const items = await page.$$eval('.autocomplete-item', els => els.filter(e => e.offsetParent).map(e => e.textContent.trim()));
        assert.deepEqual(items, ['Web', 'Local']);
        // Catalogs keep "key - name".
        await page.keyboard.press('Escape');
        await page.click('#id_producto');
        await page.waitForTimeout(400);
        const cat = await page.$$eval('.autocomplete-item', els => els.filter(e => e.offsetParent).map(e => e.textContent.trim()));
        assert.ok(cat.some(t => / - Mochila Fixture$/.test(t)), `catalog items: ${cat}`);
    });

    it('72. New record: SIG is disabled, ANT opens the last record, and NUEVO starts a new one (asking if unsaved)', async () => {
        // UX recorrido thym-pos 2026-10-26, puntos 9 y 10: ANT/SIG answered
        // "Cargá un registro primero", and there was no way back to a blank
        // form except clicking the explorer again.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Comprobante Fixture"))');
        await page.waitForSelector('#monto', { timeout: 10000 });
        await page.waitForTimeout(300);
        const sig = page.locator('button:has-text("SIG")');
        const nuevo = page.locator('button:has-text("NUEVO")');
        assert.equal(await sig.isDisabled(), true, 'SIG disabled on a new record');
        assert.equal(await nuevo.count(), 1, 'there is a NUEVO button');
        // 10th Chrome round: it looked exactly like an enabled one.
        const look = await page.evaluate(() => {
            const [ant, sig] = ['ANT', 'SIG'].map(t => [...document.querySelectorAll('.actions-nav button')].find(b => b.textContent.includes(t)));
            const cs = el => window.getComputedStyle(el);
            return { cursor: cs(sig).cursor, sameColor: cs(sig).color === cs(ant).color && cs(sig).backgroundColor === cs(ant).backgroundColor };
        });
        assert.equal(look.cursor, 'not-allowed');
        assert.equal(look.sameColor, false, 'SIG disabled looks different from ANT');

        await page.click('button:has-text("ANT")');
        await page.waitForFunction(() => document.getElementById('id')?.value !== '', null, { timeout: 5000 });
        const last = Number(await page.inputValue('#id'));
        assert.ok(last >= 1, `ANT from a new record opens the last one, got N° ${last}`);
        assert.equal(await sig.isDisabled(), false, 'SIG enabled once a record is loaded');
        await page.click('button:has-text("SIG")');
        await page.waitForTimeout(500);
        assert.equal(Number(await page.inputValue('#id')), last, 'it really was the last one');

        // NUEVO on an untouched record → blank, no question.
        await nuevo.click();
        await page.waitForFunction(() => document.getElementById('id')?.value === '' && document.getElementById('nombre')?.value === '', null, { timeout: 5000 });
        assert.equal(await page.locator('.confirm-dialog').count(), 0);
        assert.equal(await sig.isDisabled(), true);

        // NUEVO with unsaved data → asks.
        await page.fill('#nombre', 'A medio cargar');
        await nuevo.click();
        await page.waitForSelector('.confirm-dialog', { timeout: 5000 });
        await page.click('.confirm-dialog-keep');
        assert.equal(await page.inputValue('#nombre'), 'A medio cargar');
        await nuevo.click();
        await page.click('.confirm-dialog-discard', { timeout: 5000 });
        await page.waitForFunction(() => document.getElementById('nombre')?.value === '', null, { timeout: 5000 });

        // After saving, NUEVO does not bring back "Registro N° X creado".
        await page.fill('#nombre', 'Para NUEVO');
        await page.click('button[type="submit"]');
        await page.waitForSelector('.report-modal-back', { timeout: 15000 });
        await page.click('.report-modal-back');
        await page.waitForFunction(() => /creado/.test(document.querySelector('.status-bar-message')?.textContent ?? ''), null, { timeout: 5000 });
        await page.click('button:has-text("ANT")');
        await page.waitForFunction(() => document.getElementById('id')?.value !== '', null, { timeout: 5000 });
        await nuevo.click();
        await page.waitForFunction(() => document.getElementById('id')?.value === '', null, { timeout: 5000 });
        await page.waitForTimeout(300);
        const status = await page.locator('.status-bar').isVisible() ? await page.textContent('.status-bar-message') : '';
        assert.ok(!/creado/.test(status), `stale message after NUEVO: "${status}"`);

        // Phone width: ANT / NUEVO / SIG on one row.
        await page.setViewportSize({ width: 371, height: 700 });
        try {
            await page.waitForTimeout(300);
            const tops = await page.$$eval('.actions-nav .nav-btn', bs => bs.map(b => Math.round(b.getBoundingClientRect().top)));
            assert.equal(new Set(tops).size, 1, `nav buttons on one row at 371px, tops: ${tops}`);
        } finally {
            await page.setViewportSize({ width: 1280, height: 720 });
        }
    });

    it('73. Number fields take "1.500,50" whatever the browser language; money fields show "$1.500,50" when not focused', async () => {
        // UX recorrido thym-pos 2026-10-26, puntos 2 y 14: in an English
        // browser <input type="number"> turned "1.500,50" into 1.50050 (and
        // "-1500,50" into -150050); the form showed 35000 while reports said
        // $35.000,00.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Validacion Fixture"))');
        await page.waitForSelector('#monto', { timeout: 10000 });
        await page.waitForTimeout(300);

        assert.equal(await page.getAttribute('#monto', 'inputmode'), 'decimal', 'numeric keyboard on phones');
        assert.notEqual(await page.getAttribute('#monto', 'type'), 'number', 'not left to the browser locale');
        const overlay = '#monto ~ .number-display-overlay';
        const cases = [
            ['1.500,50', '1500.5', '$1.500,50'],
            ['1500,5', '1500.5', '$1.500,50'],
            ['1500.50', '1500.5', '$1.500,50'],
            ['35.000', '35000', '$35.000,00'],
            ['35000', '35000', '$35.000,00'],
        ];
        // Como una persona: entrar al campo, seleccionar todo y escribir.
        // (page.fill selecciona ANTES del foco, y el foco cambia "1500.5" por
        // "1500,5" — lo tipeado se agregaba. Con Tab o click no pasa.)
        const typeInto = async (sel, text) => {
            await page.click(sel, { clickCount: 3 });
            await page.keyboard.press('ControlOrMeta+a');
            await page.keyboard.type(text);
        };
        for (const [typed, stored, shown] of cases) {
            await typeInto('#monto', typed);
            await page.locator('#monto').blur();
            await page.waitForTimeout(150);
            assert.equal(await page.inputValue('#monto'), stored, `"${typed}" is stored as ${stored}`);
            assert.equal(await page.isVisible(overlay), true, 'formatted when not focused');
            assert.equal((await page.textContent(overlay)).trim(), shown);
        }
        await page.focus('#monto');
        assert.equal(await page.isVisible(overlay), false, 'the plain number while editing');

        // Editing shows the decimal comma, as typed; leaving without
        // changing it stores the number again.
        assert.equal(await page.inputValue('#monto'), '35000');
        await typeInto('#monto', '1.500,50');
        await page.locator('#monto').blur();
        await page.focus('#monto');
        assert.equal(await page.inputValue('#monto'), '1500,5', 'comma while editing (10th Chrome round)');
        await page.locator('#monto').blur();
        assert.equal(await page.inputValue('#monto'), '1500.5', 'stored with a dot');

        // Validation sees the real number: -1500,50 is below <min>1</min>.
        await typeInto('#monto', '-1500,50');
        await page.locator('#monto').blur();
        await page.waitForTimeout(300);
        assert.equal(await page.inputValue('#monto'), '-1500.5');
        assert.equal(await page.locator('#monto.field-error').count(), 1, 'out of range');
        // 10th Chrome round: the message went inside the box and the
        // formatted amount was drawn over it.
        const placed = await page.evaluate(() => {
            const input = document.getElementById('monto');
            const box = input.closest('.number-input-box');
            const overlay = box.querySelector('.number-display-overlay');
            return {
                msgInBox: !!box.querySelector('.error-msg'),
                overlayH: Math.round(overlay.getBoundingClientRect().height),
                inputH: Math.round(input.getBoundingClientRect().height),
            };
        });
        assert.equal(placed.msgInBox, false, 'the message goes below the box');
        assert.equal(placed.overlayH, placed.inputH, 'the formatted amount stays on the field');
    });

    it('74. Opening a <subform> and coming back without saving leaves the form as it was: no "unsaved", same red marks and summary', async () => {
        // 10th Chrome round 2026-10-31: after "0 - Nueva clienta" + VOLVER on
        // an empty Venta, leaving it asked "Hay datos sin guardar", and the
        // "Faltan…" summary no longer named Clienta.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Subform Parent"))');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.click('#id_marca');
        await page.waitForTimeout(300);
        await page.locator('.autocomplete-item', { hasText: 'Nueva marca' }).first().click();
        await page.waitForSelector('.subform-back-btn', { timeout: 10000 });
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        await page.waitForTimeout(300);
        const warns = await page.evaluate(() => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
        });
        assert.equal(warns, false, 'nothing unsaved: it was empty before');
        await page.click('.tree-node:has(span:text("Mes Fixture"))');
        await page.waitForTimeout(500);
        assert.equal(await page.locator('.confirm-dialog').count(), 0, 'leaves without asking');
    });

    it('75. Escape with a list open inside the row modal closes only the list; a second Escape closes the modal', async () => {
        // 12th Chrome round 2026-10-31: Escape on the price list closed the
        // whole "Editar producto" modal — a changed quantity would be lost.
        const { page, baseUrl, context, loginAsOperador } = ctx;
        await context.clearCookies();
        await loginAsOperador();
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
        await page.click('.tree-node:has(span:text("Venta Draft"))');
        await page.waitForSelector('.multifield-add-btn', { timeout: 10000 });
        await page.waitForTimeout(300);
        await page.click('.multifield-add-btn');
        await page.waitForSelector('.mf-row-modal [data-col-id="id_producto"]', { timeout: 5000 });
        await page.click('.mf-row-modal [data-col-id="id_producto"]');
        await page.waitForTimeout(300);
        await page.locator('.mf-row-modal .autocomplete-item', { hasText: 'Mochila Fixture' }).first().click();
        await page.fill('.mf-row-modal [data-col-id="cantidad"]', '3');

        await page.click('.mf-row-modal [data-col-id="precio_unitario"]');
        await page.waitForSelector('.mf-row-modal .autocomplete-item:visible', { timeout: 3000 });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.mf-row-modal .autocomplete-item:visible').count(), 0, 'the list closed');
        assert.equal(await page.locator('.mf-row-modal').count(), 1, 'the modal is still open');
        assert.equal(await page.inputValue('.mf-row-modal [data-col-id="cantidad"]'), '3', 'nothing lost');

        await page.keyboard.press('Escape');
        await page.waitForSelector('.mf-row-modal-backdrop', { state: 'detached', timeout: 5000 });
    });
});
