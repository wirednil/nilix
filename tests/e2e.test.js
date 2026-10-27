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
        // inline (.field-error/.error-msg, same as the existing blur-time
        // validation) and pushes a summary to the StatusBar — no native popup,
        // no silent submit with missing required data.
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
            const inlineMsg = await page.locator('.error-msg').first().textContent();
            assert.ok(inlineMsg.includes('obligatorio'), `expected inline "obligatorio" message, got: ${inlineMsg}`);
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

        // Load record 1 by typing its key — it belongs to Tote Fixture.
        await page.fill('#id', '1');
        await page.locator('#id').blur();
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

        // 2. Open it again and go back without saving → parent kept, trigger value cleared.
        await openSubform();
        await page.click('.subform-back-btn');
        await page.waitForSelector('#nota', { timeout: 10000 });
        assert.equal(await page.inputValue('#nota'), 'Dato previo');
        assert.equal(await page.inputValue('#id_marca'), '', 'the trigger value (0) is not left selected');
        assert.equal(await overlay(), '', 'no "0 - Nueva marca" overlay left behind');
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

            release();
            await page.waitForSelector('.report-modal-backdrop .report-container', { timeout: 20000 });
            assert.equal(await page.locator('.report-modal-loading').count(), 0, 'the loading message goes away');
            assert.equal(await print.getAttribute('aria-disabled'), null, 'IMPRIMIR enabled once loaded');
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
});
