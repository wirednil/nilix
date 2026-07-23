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
        assert.ok(body.includes('LIMPIAR'));
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
        await page.click('#rol + .autocomplete-btn');
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
});
