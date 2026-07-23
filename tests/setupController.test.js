'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

// setupController.initSetup() used to create every tenant's bootstrap admin
// with rol='wizard', which authRecordController.js's authEmpresaId() then
// treated as global (cross-tenant) access based on rol alone. This test
// guards both sides of that fix: the row this creates must be rol='admin',
// and (separately, via authRecordController's own tests) rol='wizard' must
// require empresa_id=0 to mean anything global.
//
// Needs a genuinely empty auth.db — helpers/db.js's setupAuthDb() pre-seeds
// empresas 0 and 1, which would make isSetupNeeded() false immediately.

describe('setupController — initSetup()', async () => {
    const dbPath = path.join(os.tmpdir(), `nilix-test-setup-${crypto.randomBytes(6).toString('hex')}.db`);
    process.env.NIL_AUTH_DB = dbPath;

    const AUTH_DB_MODULES = [
        'src/services/authDatabase.js',
        'src/controllers/setupController.js',
    ];
    for (const rel of AUTH_DB_MODULES) {
        delete require.cache[require.resolve(path.join(__dirname, '..', rel))];
    }

    const { initAuthDatabase, getAuthDatabase, closeAuthDatabase } = require('../src/services/authDatabase');
    await initAuthDatabase();

    const setupController = require('../src/controllers/setupController');

    after(() => {
        try { closeAuthDatabase(); } catch { /* noop */ }
        try { fs.unlinkSync(dbPath); } catch { /* noop */ }
        delete process.env.NIL_AUTH_DB;
    });

    function jsonRes() {
        const res = { _status: 200 };
        res.status = c => { res._status = c; return res; };
        res.json = x => { res._body = x; };
        return res;
    }

    it('GET /api/setup/status reports needed=true on a fresh DB', () => {
        const res = jsonRes();
        setupController.getStatus({}, res);
        assert.equal(res._body.needed, true);
    });

    it('POST /api/setup/init creates the bootstrap user with rol=admin, not wizard', async () => {
        const res = jsonRes();
        await setupController.initSetup({
            body: {
                empresa_nombre: 'Tenant Test',
                admin_usuario: 'bootstrapadmin',
                admin_password: 'password1234',
            },
        }, res);
        assert.equal(res._status, 200);
        assert.equal(res._body.ok, true);

        const db = getAuthDatabase();
        const rows = db.exec(
            `SELECT rol, empresa_id FROM usuarios WHERE usuario = 'bootstrapadmin'`
        );
        assert.ok(rows.length && rows[0].values.length, 'el usuario debe existir');
        const [rol, empresaId] = rows[0].values[0];
        assert.equal(rol, 'admin', 'el admin inicial de un tenant NO debe ser wizard (acceso cross-tenant)');
        assert.notEqual(empresaId, 0, 'debe quedar en su propio tenant, no en el tenant de sistema');
    });

    it('GET /api/setup/status reports needed=false after init, and re-init is blocked', async () => {
        const statusRes = jsonRes();
        setupController.getStatus({}, statusRes);
        assert.equal(statusRes._body.needed, false);

        const reinitRes = jsonRes();
        await setupController.initSetup({
            body: { empresa_nombre: 'Otro', admin_usuario: 'otroadmin', admin_password: 'password1234' },
        }, reinitRes);
        assert.equal(reinitRes._status, 403);
    });
});
