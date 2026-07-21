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

        it('GET /api/records without token returns 401', async () => {
            const res = await ctx.request('GET', '/api/records/tables');
            assert.equal(res.status, 401);
        });

        it('POST /api/records without token returns 401', async () => {
            const res = await ctx.request('POST', '/api/records/app/productos', { data: { nombre: 'test' } });
            assert.equal(res.status, 401);
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
