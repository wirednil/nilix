'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const PASS = 'password1234';
const PASS_HASH = bcrypt.hashSync(PASS, 4);

async function setupIntegration() {
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nilix-int-'));
    const appDbPath = path.join(dbDir, 'app.db');
    const authDbPath = path.join(dbDir, 'auth.db');

    process.env.NODE_ENV = 'test';
    process.env.NIL_DB_FILE = appDbPath;
    process.env.NIL_AUTH_DB = authDbPath;
    process.env.NIL_JWT_SECRET = 'int-test-secret-32bytes-not-for-prod!!';
    process.env.NIL_JWT_EXPIRY = '1h';
    delete process.env.NIL_MENU_FILE;

    const { app, initDatabase, initAuthDatabase, closeDatabase, closeAuthDatabase } = require('../../server');
    const { getDatabase } = require('../../src/services/database');
    const { getAuthDatabase } = require('../../src/services/authDatabase');

    await initDatabase();
    await initAuthDatabase();

    const appDb = getDatabase();
    appDb.run(`CREATE TABLE IF NOT EXISTS productos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre      TEXT    NOT NULL,
        precio      REAL    NOT NULL DEFAULT 0,
        empresa_id  INTEGER NOT NULL
    )`);
    appDb.run(`CREATE TABLE IF NOT EXISTS categorias (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT    NOT NULL
    )`);

    appDb.run("INSERT INTO productos (nombre, precio, empresa_id) VALUES ('ProdA1', 100, 1)");
    appDb.run("INSERT INTO productos (nombre, precio, empresa_id) VALUES ('ProdA2', 200, 1)");
    appDb.run("INSERT INTO productos (nombre, precio, empresa_id) VALUES ('ProdA3', 300, 1)");
    appDb.run("INSERT INTO productos (nombre, precio, empresa_id) VALUES ('ProdB1', 400, 2)");
    appDb.run("INSERT INTO categorias (nombre) VALUES ('Cat1')");
    appDb.run("INSERT INTO categorias (nombre) VALUES ('Cat2')");

    const authDb = getAuthDatabase();
    authDb.run(`CREATE TABLE IF NOT EXISTS empresas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT    NOT NULL,
        public_token TEXT    UNIQUE
    )`);
    authDb.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id      INTEGER NOT NULL,
        nombre          TEXT    NOT NULL,
        usuario         TEXT    NOT NULL UNIQUE,
        email           TEXT,
        password_hash   TEXT    NOT NULL,
        rol             TEXT    NOT NULL DEFAULT 'user',
        activo          INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        last_login      TEXT,
        permisos        TEXT    NOT NULL DEFAULT 'RADU',
        created_at      TEXT    DEFAULT (datetime('now')),
        updated_at      TEXT    DEFAULT (datetime('now'))
    )`);

    authDb.run("INSERT OR IGNORE INTO empresas (id, nombre, public_token) VALUES (0, 'Nilix System', 'token-0')");
    authDb.run("INSERT OR IGNORE INTO empresas (id, nombre, public_token) VALUES (1, 'Empresa Uno', 'token-1')");
    authDb.run("INSERT OR IGNORE INTO empresas (id, nombre, public_token) VALUES (2, 'Empresa Dos', 'token-2')");

    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, permisos)
         VALUES (1, 'Admin', 'admin', ?, 'admin', 1, 'RADU')`, [PASS_HASH]
    );
    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, permisos)
         VALUES (1, 'Operador', 'operador', ?, 'user', 1, 'RA')`, [PASS_HASH]
    );
    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, failed_attempts)
         VALUES (1, 'Bloqueado', 'blocked', ?, 'user', 0, 5)`, [PASS_HASH]
    );
    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, permisos)
         VALUES (2, 'AdminB', 'adminb', ?, 'admin', 1, 'RADU')`, [PASS_HASH]
    );
    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, permisos)
         VALUES (1, 'Auditor', 'auditor', ?, 'auditor', 1, 'R')`, [PASS_HASH]
    );
    // Wizard user with empresa_id=0 (nil-sys global access)
    authDb.run(
        `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, permisos)
         VALUES (0, 'Wizard', 'wizard', ?, 'wizard', 1, 'RADU')`, [PASS_HASH]
    );

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    function setCookies(setCookieHeaders, cookieJar) {
        if (!setCookieHeaders) return;
        for (const header of Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]) {
            const [cookieStr] = header.split(';');
            const eqIdx = cookieStr.indexOf('=');
            if (eqIdx > 0) {
                cookieJar[cookieStr.slice(0, eqIdx).trim()] = cookieStr.slice(eqIdx + 1).trim();
            }
        }
    }

    function request(method, urlPath, body, cookieJar = {}) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(urlPath, baseUrl);
            const hasBody = body !== undefined;
            const options = {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method,
                headers: hasBody ? { 'Content-Type': 'application/json' } : {},
            };

            const cookies = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
            if (cookies) options.headers['Cookie'] = cookies;

            const req = http.request(options, (res) => {
                const jar = {};
                setCookies(res.headers['set-cookie'], jar);
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsedBody;
                    try { parsedBody = JSON.parse(data); } catch { parsedBody = data; }
                    resolve({ status: res.statusCode, body: parsedBody, headers: res.headers, cookieJar: jar });
                });
            });
            req.on('error', reject);
            if (body !== undefined) req.write(JSON.stringify(body));
            req.end();
        });
    }

    async function loginAs(usuario) {
        return request('POST', '/api/auth/login', { usuario, password: PASS });
    }

    function cleanup() {
        server.close();
        try { closeDatabase(); } catch {}
        try { closeAuthDatabase(); } catch {}
        try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch {}
    }

    return { baseUrl, request, loginAs, cleanup, server, port };
}

module.exports = { setupIntegration };
