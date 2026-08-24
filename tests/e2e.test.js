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
});
