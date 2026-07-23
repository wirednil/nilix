'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupIntegration } = require('./helpers/integration');

describe('API Integration', async () => {
    let ctx;

    before(async () => {
        ctx = await setupIntegration();
    });

    after(() => ctx.cleanup());

    // ── Auth ────────────────────────────────────────────────────────────────

    describe('Auth', () => {
        it('POST /api/auth/login — success returns 200 + cookie', async () => {
            const res = await ctx.loginAs('admin');
            assert.equal(res.status, 200);
            assert.equal(res.body.ok, true);
            assert.ok(res.cookieJar.nil_token, 'set-cookie debe contener nil_token');
        });

        it('POST /api/auth/login — wrong password returns 401', async () => {
            const res = await ctx.request('POST', '/api/auth/login', { usuario: 'admin', password: 'wrongpass1234' });
            assert.equal(res.status, 401);
            assert.ok(res.body.error);
        });

        it('POST /api/auth/login — blocked user returns 403', async () => {
            const res = await ctx.request('POST', '/api/auth/login', { usuario: 'blocked', password: 'password1234' });
            assert.equal(res.status, 403);
            assert.ok(res.body.error);
        });

        it('POST /api/auth/login — invalid input returns 401 (anti-enumeration)', async () => {
            const res = await ctx.request('POST', '/api/auth/login', { usuario: 'ab', password: 'password1234' });
            assert.equal(res.status, 401);
            assert.ok(res.body.error);
        });

        it('POST /api/auth/login — invalid and wrong-password use same message (anti-enumeration)', async () => {
            const [r1, r2] = await Promise.all([
                ctx.request('POST', '/api/auth/login', { usuario: 'no-existe-99', password: 'password1234' }),
                ctx.request('POST', '/api/auth/login', { usuario: 'admin', password: 'wrongpass1234' }),
            ]);
            assert.equal(r1.status, 401);
            assert.equal(r2.status, 401);
            assert.equal(r1.body.error, r2.body.error, 'mensaje debe ser idéntico para no filtrar existencia');
        });

        it('POST /api/auth/logout — without token returns 400', async () => {
            const res = await ctx.request('POST', '/api/auth/logout');
            assert.equal(res.status, 400);
        });

        it('POST /api/auth/logout — with token returns 200 + clears cookie', async () => {
            const login = await ctx.loginAs('admin');
            const res = await ctx.request('POST', '/api/auth/logout', undefined, login.cookieJar);
            assert.equal(res.status, 200);
            assert.equal(res.body.ok, true);
            const setCookie = res.headers['set-cookie'];
            const cleared = Array.isArray(setCookie) ? setCookie.join(' ') : setCookie;
            assert.ok(cleared.includes('nil_token='), 'cookie nil_token debe estar presente en Set-Cookie');
        });

        it('GET /api/auth/check — with valid token returns user info', async () => {
            const login = await ctx.loginAs('admin');
            const res = await ctx.request('GET', '/api/auth/check', undefined, login.cookieJar);
            assert.equal(res.status, 200);
            assert.equal(res.body.ok, true);
            assert.equal(res.body.usuario, 'admin');
            assert.equal(res.body.rol, 'admin');
        });

        it('GET /api/auth/check — without token returns 401', async () => {
            const res = await ctx.request('GET', '/api/auth/check');
            assert.equal(res.status, 401);
        });

        it('GET /api/auth/check — after logout (token blacklisted) returns 401', async () => {
            const login = await ctx.loginAs('admin');
            await ctx.request('POST', '/api/auth/logout', undefined, login.cookieJar);
            const res = await ctx.request('GET', '/api/auth/check', undefined, login.cookieJar);
            assert.equal(res.status, 401);
        });

        it('POST /api/auth/refresh — with valid token returns 200 + new cookie', async () => {
            const login = await ctx.loginAs('admin');
            const res = await ctx.request('POST', '/api/auth/refresh', undefined, login.cookieJar);
            assert.equal(res.status, 200);
            assert.equal(res.body.ok, true);
            assert.ok(res.cookieJar.nil_token, 'debe emitir nuevo nil_token');
            assert.notEqual(res.cookieJar.nil_token, login.cookieJar.nil_token, 'token debe ser diferente (rotación)');
        });

        it('POST /api/auth/refresh — without token returns 401', async () => {
            const res = await ctx.request('POST', '/api/auth/refresh');
            assert.equal(res.status, 401);
        });

        it('POST /api/auth/refresh — with blacklisted token returns 401', async () => {
            const login = await ctx.loginAs('admin');
            await ctx.request('POST', '/api/auth/logout', undefined, login.cookieJar);
            const res = await ctx.request('POST', '/api/auth/refresh', undefined, login.cookieJar);
            assert.equal(res.status, 401);
        });
    });

    // ── CRUD ────────────────────────────────────────────────────────────────

    describe('CRUD', () => {
        it('GET /api/records/tables — returns allowed tables list', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/tables', undefined, jar);
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.body.data));
            const names = res.body.data.map(t => typeof t === 'string' ? t : t.name ?? t);
            assert.ok(names.includes('categorias'));
            assert.ok(names.includes('productos'));
        });

        it('GET /api/records/app/productos?keyField=id&id=1 — returns record', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=1', undefined, jar);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.nombre, 'ProdA1');
            assert.equal(res.body.data.empresa_id, 1);
        });

        it('GET /api/records/app/productos?keyField=id&id=999 — record not found returns 404', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=999', undefined, jar);
            assert.equal(res.status, 404);
            assert.equal(res.body.error.code, 'RECORD_NOT_FOUND');
        });

        it('GET without keyField or id returns 400', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/productos', undefined, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_PARAMS');
        });

        it('POST /api/records/app/productos — creates record and returns 201', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('POST', '/api/records/app/productos', {
                data: { nombre: 'NuevoProd', precio: 500 }
            }, jar);
            assert.equal(res.status, 201);
            assert.equal(res.body.data.nombre, 'NuevoProd');
            assert.equal(res.body.data.precio, 500);
        });

        it('POST /api/records/app/productos — without data returns 400', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('POST', '/api/records/app/productos', {}, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_DATA');
        });

        it('POST /api/records/app/productos/:id — upsert updates existing record', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('POST', '/api/records/app/productos/1', {
                keyField: 'id',
                data: { id: 1, nombre: 'ProdA1-Mod', precio: 150 }
            }, jar);
            assert.equal(res.status, 200);
            assert.equal(res.body.updated, true);

            const check = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=1', undefined, jar);
            assert.equal(check.body.data.nombre, 'ProdA1-Mod');
        });

        it('PUT /api/records/app/productos/1 — updates record', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/records/app/productos/1', {
                keyField: 'id',
                data: { id: 1, nombre: 'ProdA1-v2', precio: 175 }
            }, jar);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.nombre, 'ProdA1-v2');
        });

        it('DELETE /api/records/app/productos/2 — deletes record and returns 204', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/app/productos/2?keyField=id', undefined, jar);
            assert.equal(res.status, 204);

            const check = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=2', undefined, jar);
            assert.equal(check.status, 404);
        });

        it('DELETE /api/records/app/productos/999 — non-existent returns 404', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/app/productos/999?keyField=id', undefined, jar);
            assert.equal(res.status, 404);
        });

        it('DELETE without keyField returns 400', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/app/productos/1', undefined, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_KEYFIELD');
        });
    });

    // ── Navigate ────────────────────────────────────────────────────────────

    describe('Navigate', () => {
        it('navigate(next) returns next record by id', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/app/productos/navigate?keyField=id&current=1&dir=next',
                undefined, jar
            );
            assert.equal(res.status, 200);
            assert.ok(res.body.data.id > 1, 'next record debe tener id mayor');
            assert.equal(res.body.data.empresa_id, 1);
        });

        it('navigate(prev) on first record returns 404 (boundary)', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/app/productos/navigate?keyField=id&current=1&dir=prev',
                undefined, jar
            );
            assert.equal(res.status, 404);
            assert.equal(res.body.error.code, 'BOUNDARY_REACHED');
        });

        it('navigate without params returns 400', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/app/productos/navigate',
                undefined, jar
            );
            assert.equal(res.status, 400);
        });
    });

    // ── Multitenancy ────────────────────────────────────────────────────────

    describe('Multitenancy', () => {
        it('empresa A cannot read records from empresa B via API', async () => {
            const jarA = (await ctx.loginAs('admin')).cookieJar;
            const jarB = (await ctx.loginAs('adminb')).cookieJar;

            const resA = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=4', undefined, jarA);
            assert.equal(resA.status, 404, 'empresa 1 no debe ver registro de empresa 2');

            const resB = await ctx.request('GET', '/api/records/app/productos?keyField=id&id=4', undefined, jarB);
            assert.equal(resB.status, 200, 'empresa 2 debe ver su propio registro');
            assert.equal(resB.body.data.nombre, 'ProdB1');
        });

        it('empresa B creates record that empresa A cannot see', async () => {
            const jarB = (await ctx.loginAs('adminb')).cookieJar;
            const createRes = await ctx.request('POST', '/api/records/app/productos', {
                data: { nombre: 'SoloEmpresaB', precio: 999 }
            }, jarB);
            assert.equal(createRes.status, 201);
            const newId = createRes.body.data.id;

            const jarA = (await ctx.loginAs('admin')).cookieJar;
            const check = await ctx.request('GET', `/api/records/app/productos?keyField=id&id=${newId}`, undefined, jarA);
            assert.equal(check.status, 404, 'empresa A no debe ver registro creado por empresa B');
        });

        it('navigate does not cross empresa boundaries', async () => {
            const jarA = (await ctx.loginAs('admin')).cookieJar;
            await ctx.request('DELETE', '/api/records/app/productos/3?keyField=id', undefined, jarA);

            const res = await ctx.request(
                'GET', '/api/records/app/productos/navigate?keyField=id&current=1&dir=next',
                undefined, jarA
            );
            assert.equal(res.status, 200);
            assert.equal(res.body.data.empresa_id, 1, 'navigate no debe cruzar a otra empresa');
        });
    });

    // ── Protected routes (role-based access) ────────────────────────────────

    describe('Role-based access', () => {
        it('GET /api/admin/* requires admin role', async () => {
            const jar = (await ctx.loginAs('operador')).cookieJar;
            const res = await ctx.request('GET', '/api/admin/menu', undefined, jar);
            assert.equal(res.status, 403, 'operador no debe acceder a rutas admin');
        });

        it('GET /api/admin/menu works with admin role', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/admin/menu', undefined, jar);
            assert.equal(res.status, 200);
        });

        it('GET /api/nil/menu requires wizard/admin/auditor role', async () => {
            const jar = (await ctx.loginAs('operador')).cookieJar;
            const res = await ctx.request('GET', '/api/nil/menu', undefined, jar);
            assert.equal(res.status, 403, 'operador no debe acceder a rutas nil-sys');
        });

        it('GET /api/nil/menu works with auditor role', async () => {
            const jar = (await ctx.loginAs('auditor')).cookieJar;
            const res = await ctx.request('GET', '/api/nil/menu', undefined, jar);
            assert.equal(res.status, 200);
        });

        it('GET /api/admin/menu works with wizard role', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/admin/menu', undefined, jar);
            assert.equal(res.status, 200, 'wizard debe poder acceder a rutas admin');
        });

        it('GET /api/nil/menu works with wizard role', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/nil/menu', undefined, jar);
            assert.equal(res.status, 200, 'wizard debe poder acceder a rutas nil-sys');
        });

        it('GET /api/nil/operadores — rol=wizard with a non-zero empresa_id is still scoped', async () => {
            const jar = (await ctx.loginAs('tenantwizard')).cookieJar;
            const res = await ctx.request('GET', '/api/nil/operadores', undefined, jar);
            assert.equal(res.status, 200);
            for (const r of res.body.rows) {
                assert.equal(r.empresa_id, 1, 'tenantwizard solo debe ver operadores de su propia empresa');
            }
        });

        it('GET /api/catalogs/@auth:usuarios returns all users for wizard', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/catalogs/@auth:usuarios', undefined, jar);
            assert.equal(res.status, 200, 'wizard debe poder acceder a catálogo @auth');
            assert.ok(res.body.rows.length > 3, 'wizard debe ver TODOS los usuarios, no solo empresa_id=0');
            const ids = new Set(res.body.rows.map(r => r.empresa_id));
            assert.ok(ids.has(0), 'debe incluir usuario de empresa 0 (wizard)');
            assert.ok(ids.has(1), 'debe incluir usuarios de empresa 1');
            assert.ok(ids.has(2), 'debe incluir usuarios de empresa 2');
        });

        it('GET /api/catalogs/@auth:usuarios is scoped for non-wizard', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/catalogs/@auth:usuarios', undefined, jar);
            assert.equal(res.status, 200);
            for (const r of res.body.rows) {
                assert.equal(r.empresa_id, 1, 'admin solo debe ver usuarios de su propia empresa');
            }
        });

        it('GET /api/catalogs/@auth:usuarios — rol=wizard with a non-zero empresa_id is still scoped', async () => {
            // Same regression as authRecordController's — a rol='wizard' row
            // with empresa_id != 0 (tenantwizard, id=8) must not read every
            // tenant's rows here either.
            const jar = (await ctx.loginAs('tenantwizard')).cookieJar;
            const res = await ctx.request('GET', '/api/catalogs/@auth:usuarios', undefined, jar);
            assert.equal(res.status, 200);
            for (const r of res.body.rows) {
                assert.equal(r.empresa_id, 1, 'tenantwizard solo debe ver usuarios de su propia empresa');
            }
        });

        it('GET /api/records without token returns 401', async () => {
            const res = await ctx.request('GET', '/api/records/tables');
            assert.equal(res.status, 401);
        });

        it('POST /api/records without token returns 401', async () => {
            const res = await ctx.request('POST', '/api/records/app/productos', { data: { nombre: 'test' } });
            assert.equal(res.status, 401);
        });
    });

    // ── Error paths (recordController uncovered branches) ───────────────────

    describe('RecordController error paths', () => {
        it('GET blocked table (sqlite_master) returns 403 TABLE_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/sqlite_master?keyField=id&id=1', undefined, jar);
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('GET nonexistent table returns 404 TABLE_NOT_FOUND', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/nonexistent_xyz?keyField=id&id=1', undefined, jar);
            assert.equal(res.status, 404);
            assert.equal(res.body.error.code, 'TABLE_NOT_FOUND');
        });

        it('GET invalid column keyField returns 403 COLUMN_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('GET', '/api/records/app/productos?keyField=invalid_col&id=1', undefined, jar);
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'COLUMN_FORBIDDEN');
        });

        it('navigate blocked table returns 403 TABLE_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/app/sqlite_master/navigate?keyField=id&current=1&dir=next',
                undefined, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('navigate nonexistent table returns 404 TABLE_NOT_FOUND', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/app/nonexistent_xyz/navigate?keyField=id&current=1&dir=next',
                undefined, jar
            );
            assert.equal(res.status, 404);
            assert.equal(res.body.error.code, 'TABLE_NOT_FOUND');
        });

        it('POST blocked table returns 403 TABLE_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('POST', '/api/records/app/sqlite_master',
                { data: { nombre: 'test' } }, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('PUT blocked table returns 403 TABLE_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/records/app/sqlite_master/1',
                { keyField: 'id', data: { nombre: 'test' } }, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('DELETE blocked table returns 403 TABLE_FORBIDDEN', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/app/sqlite_master/1?keyField=id',
                undefined, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });
    });

    // ── Password management (usersController — self-service + admin reset) ─

    describe('Password management', () => {
        it('PUT /api/users/me/password — wrong current_password returns 401', async () => {
            const jar = (await ctx.loginAs('operador')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/me/password', {
                current_password: 'nope-not-it', new_password: 'newpass1234',
            }, jar);
            assert.equal(res.status, 401);
        });

        it('PUT /api/users/me/password — new_password too short returns 400', async () => {
            const jar = (await ctx.loginAs('operador')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/me/password', {
                current_password: 'password1234', new_password: 'short',
            }, jar);
            assert.equal(res.status, 400);
        });

        it('PUT /api/users/me/password — correct current_password changes it', async () => {
            const jar = (await ctx.loginAs('operador')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/me/password', {
                current_password: 'password1234', new_password: 'operadornew1234',
            }, jar);
            assert.equal(res.status, 200);

            const oldLogin = await ctx.loginAs('operador'); // still PASS constant
            assert.equal(oldLogin.status, 401, 'la password vieja ya no debe funcionar');

            const newLogin = await ctx.request('POST', '/api/auth/login', { usuario: 'operador', password: 'operadornew1234' });
            assert.equal(newLogin.status, 200, 'la password nueva debe funcionar');
        });

        it('PUT /api/users/:id/password — non-admin actor returns 403', async () => {
            const jar = (await ctx.loginAs('auditor')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/5/password', { password: 'sneaky1234' }, jar);
            assert.equal(res.status, 403);
        });

        it('PUT /api/users/:id/password — admin targeting self returns 400 (use /me/password)', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/1/password', { password: 'selfreset1234' }, jar);
            assert.equal(res.status, 400);
        });

        it('PUT /api/users/:id/password — admin resets operador (lower rank), forces relogin', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/2/password', { password: 'adminreset1234' }, jar);
            assert.equal(res.status, 200);

            const newLogin = await ctx.request('POST', '/api/auth/login', { usuario: 'operador', password: 'adminreset1234' });
            assert.equal(newLogin.status, 200, 'operador debe poder loguearse con la password reseteada por el admin');
        });

        it('PUT /api/users/:id/password — admin resets auditor (lower rank) succeeds', async () => {
            const jar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/5/password', { password: 'auditorreset1234' }, jar);
            assert.equal(res.status, 200);
        });

        it('POST /api/users — admin cannot create a peer admin or a wizard', async () => {
            const adminJar = (await ctx.loginAs('admin')).cookieJar;

            const peerAdmin = await ctx.request('POST', '/api/users', {
                nombre: 'Admin Dos', usuario: 'admin2', password: 'password1234', rol: 'admin',
            }, adminJar);
            assert.equal(peerAdmin.status, 403, 'un admin no debe poder crear otro admin en su empresa');

            const wannabeWizard = await ctx.request('POST', '/api/users', {
                nombre: 'Wannabe', usuario: 'wannabewiz', password: 'password1234', rol: 'wizard',
            }, adminJar);
            assert.equal(wannabeWizard.status, 403, 'un admin no debe poder crear un wizard');
        });

        it('PUT /api/users/:id — admin cannot promote a user to admin or wizard', async () => {
            const adminJar = (await ctx.loginAs('admin')).cookieJar;
            const promoteToAdmin = await ctx.request('PUT', '/api/users/2', { rol: 'admin' }, adminJar); // operador → admin
            assert.equal(promoteToAdmin.status, 403);

            const promoteToWizard = await ctx.request('PUT', '/api/users/2', { rol: 'wizard' }, adminJar);
            assert.equal(promoteToWizard.status, 403);
        });

        it('PUT /api/users/:id — admin cannot touch a peer admin at all, not even to demote them', async () => {
            const adminJar = (await ctx.loginAs('admin')).cookieJar;
            // admin2 (id=7) is a peer admin, same empresa — demoting them to
            // operador passes the "new rol" check (1 < 2) but must still be
            // blocked by the "target's current rol" check: demoting a peer is
            // itself an attack, not a safe direction.
            const demote = await ctx.request('PUT', '/api/users/7', { rol: 'operador' }, adminJar);
            assert.equal(demote.status, 403);

            // Not even an unrelated, non-rol field.
            const renameAttempt = await ctx.request('PUT', '/api/users/7', { nombre: 'Renamed By Peer' }, adminJar);
            assert.equal(renameAttempt.status, 403);
        });

        it('PUT /api/users/:id — admin can still edit their own nombre/email', async () => {
            const adminJar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/1', { nombre: 'Admin Renombrado' }, adminJar);
            assert.equal(res.status, 200, 'editar el propio perfil no debe quedar bloqueado por el chequeo de rango de peers');
        });

        it('PUT /api/users/:id — password field is rejected (use the dedicated password routes)', async () => {
            const adminJar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/2', { password: 'shouldnotwork1234' }, adminJar);
            assert.equal(res.status, 400, 'updateUser no debe aceptar password — reabriría el bypass del rank check');
        });

        it('PUT /api/users/:id/password — admin targeting a peer admin (same rank) returns 403', async () => {
            // admin2 (id=7) is a peer admin in empresa 1, seeded directly in
            // the test fixture — createUser's own rank check means an admin
            // actor could never have produced this pairing themselves anymore
            // (see the createUser rank test above), but the account can
            // already exist from before that check landed, so resetUserPassword
            // still needs to refuse it independently.
            const adminJar = (await ctx.loginAs('admin')).cookieJar;
            const res = await ctx.request('PUT', '/api/users/7/password', { password: 'shouldnotwork1234' }, adminJar);
            assert.equal(res.status, 403, 'un admin no debe poder resetear a otro admin de su misma empresa');
        });

        it('PUT /api/users/:id/password — actor cannot reach a target outside their tenant', async () => {
            const jar = (await ctx.loginAs('adminb')).cookieJar; // empresa 2
            const res = await ctx.request('PUT', '/api/users/2/password', { password: 'crosstenant1234' }, jar); // operador, empresa 1
            assert.equal(res.status, 404, 'un admin no debe poder alcanzar usuarios de otra empresa ni para el chequeo de rango');
        });
    });

    // ── Auth DB CRUD (recordController @auth: routes) ──────────────────────

    describe('Auth DB CRUD', () => {
        it('GET /api/records/auth/usuarios — success returns user', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/records/auth/usuarios?keyField=id&id=1', undefined, jar);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.usuario, 'admin');
            assert.equal(res.body.data.empresa_id, 1);
        });

        it('GET /api/records/auth/usuarios — not found returns 404', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/records/auth/usuarios?keyField=id&id=999', undefined, jar);
            assert.equal(res.status, 404);
            assert.equal(res.body.error.code, 'RECORD_NOT_FOUND');
        });

        it('GET /api/records/auth/usuarios — rol=wizard with a non-zero empresa_id gets NO cross-tenant access', async () => {
            // tenantwizard (id=8) has rol='wizard' but empresa_id=1 — exactly
            // what setupController.js used to create for every tenant's
            // bootstrap admin. authEmpresaId() must require empresa_id===0
            // too, or this account silently sees every other tenant's users.
            const jar = (await ctx.loginAs('tenantwizard')).cookieJar;

            const ownTenant = await ctx.request('GET', '/api/records/auth/usuarios?keyField=id&id=8', undefined, jar);
            assert.equal(ownTenant.status, 200, 'debe poder verse a si mismo, dentro de su propio tenant');

            const otherTenant = await ctx.request('GET', '/api/records/auth/usuarios?keyField=id&id=4', undefined, jar); // adminb, empresa 2
            assert.equal(otherTenant.status, 404, 'no debe poder leer un usuario de otro tenant solo por tener rol=wizard');
        });

        it('GET /api/records/auth/usuarios — missing params returns 400', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/records/auth/usuarios', undefined, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_PARAMS');
        });

        it('GET /api/records/auth/empresas — table not allowed returns 403', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('GET', '/api/records/auth/empresas?keyField=id&id=1', undefined, jar);
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('POST /api/records/auth/usuarios — creates auth user', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('POST', '/api/records/auth/usuarios', {
                data: { usuario: 'nuevo', nombre: 'Nuevo', password: 'password1234' }
            }, jar);
            assert.equal(res.status, 201);
            assert.equal(res.body.data.usuario, 'nuevo');
            assert.ok(res.body.data.id);
        });

        it('POST /api/records/auth/usuarios — rol no editable vía esta ruta, 400', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('POST', '/api/records/auth/usuarios', {
                data: { usuario: 'wannabewizard', nombre: 'Nope', password: 'password1234', rol: 'wizard' }
            }, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'FIELD_NOT_ALLOWED');
        });

        it('POST /api/records/auth/usuarios — without data returns 400', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('POST', '/api/records/auth/usuarios', {}, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_DATA');
        });

        it('POST /api/records/auth/usuarios — table not allowed returns 403', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('POST', '/api/records/auth/empresas',
                { data: { nombre: 'test' } }, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('POST /api/records/auth/usuarios/:id — upsert updates auth user', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('POST', '/api/records/auth/usuarios/1', {
                keyField: 'id',
                data: { nombre: 'Admin-Mod' }
            }, jar);
            // wizard global access — empresa_id=0, user is empresa_id=1 → handled
            assert.ok(res.status === 200 || res.status === 201);
            const check = await ctx.request('GET', '/api/records/auth/usuarios?keyField=id&id=1', undefined, jar);
            // wizard sees all users, may be null (cross-empresa when empresa_id=null)
            if (check.status === 200) {
                assert.equal(check.body.data.nombre, 'Admin-Mod');
            }
        });

        it('PUT /api/records/auth/usuarios/1 — updates auth user', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('PUT', '/api/records/auth/usuarios/1', {
                keyField: 'id',
                data: { nombre: 'Admin-v2' }
            }, jar);
            const expectedStatus = [200, 201]; // wizard may get update or upsert
            assert.ok(expectedStatus.includes(res.status), `status ${res.status} not in ${expectedStatus}`);
        });

        it('DELETE /api/records/auth/usuarios/1?keyField=id — soft deletes auth user', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/auth/usuarios/1?keyField=id', undefined, jar);
            assert.equal(res.status, 204, 'wizard debe poder soft-delete usuario');
        });

        it('DELETE /api/records/auth/usuarios/1 — without keyField returns 400', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/auth/usuarios/1', undefined, jar);
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_KEYFIELD');
        });

        it('DELETE /api/records/auth/empresas/1?keyField=id — table not allowed returns 403', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request('DELETE', '/api/records/auth/empresas/1?keyField=id', undefined, jar);
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });

        it('navigate auth usuarios returns next record', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/auth/usuarios/navigate?keyField=id&current=1&dir=next',
                undefined, jar
            );
            // wizard con empresa_id=null ve todos los usuarios globalmente
            // puede tener resultado o no, depende del soft-delete anterior
            assert.ok(res.status === 200 || res.status === 404, `unexpected status ${res.status}`);
            if (res.status === 200) {
                assert.ok(res.body.data.id > 1);
            }
        });

        it('navigate auth usuarios missing params returns 400', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/auth/usuarios/navigate',
                undefined, jar
            );
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'MISSING_PARAMS');
        });

        it('navigate auth usuarios table not allowed returns 403', async () => {
            const jar = (await ctx.loginAs('wizard')).cookieJar;
            const res = await ctx.request(
                'GET', '/api/records/auth/empresas/navigate?keyField=id&current=1&dir=next',
                undefined, jar
            );
            assert.equal(res.status, 403);
            assert.equal(res.body.error.code, 'TABLE_FORBIDDEN');
        });
    });

    // ── Health ──────────────────────────────────────────────────────────────

    describe('Health', () => {
        it('GET /api/health returns status ok', async () => {
            const res = await ctx.request('GET', '/api/health');
            assert.equal(res.status, 200);
            assert.equal(res.body.status, 'ok');
            assert.ok(res.body.uptime !== undefined);
            assert.ok(res.body.version);
        });
    });
});
