/**
 * @file tests/helpers/db.js
 * @description Helpers para crear bases de datos en memoria para tests.
 *
 * Cada helper retorna { db, cleanup }.
 * - db: instancia sql.js inicializada con schema y datos de test
 * - cleanup: función que cierra y elimina el archivo temporal
 *
 * Estrategia:
 *   Los módulos database.js / authDatabase.js usan singletons a nivel de módulo.
 *   Los tests limpian el require.cache antes de requerir los servicios para
 *   garantizar un estado fresco. Las env vars deben ser seteadas ANTES del require.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

/**
 * Rutas que forman el singleton de la app DB y sus dependientes.
 * Se borran del require.cache para forzar re-inicialización entre test files.
 */
const APP_DB_MODULES = [
    'src/services/database.js',
    'src/services/schemaService.js',
    'src/services/recordService.js',
    'src/services/scopedDb.js',
];

const AUTH_DB_MODULES = [
    'src/services/authDatabase.js',
    'src/services/authService.js',
];

const ROOT = path.resolve(__dirname, '../..');

function clearModules(relPaths) {
    for (const rel of relPaths) {
        const abs = path.join(ROOT, rel);
        delete require.cache[require.resolve(abs)];
    }
}

function tmpPath(prefix) {
    return path.join(os.tmpdir(), `${prefix}-${crypto.randomBytes(6).toString('hex')}.db`);
}

// ── App DB ────────────────────────────────────────────────────────────────────

/**
 * Inicializa la app DB en memoria con tablas de test.
 * Retorna { initDatabase, getDatabase, saveDatabase, closeDatabase, dbPath, cleanupAppDb }
 */
async function setupAppDb() {
    const dbPath = tmpPath('nilix-test-app');
    process.env.NIL_DB_FILE = dbPath;

    clearModules(APP_DB_MODULES);

    const { initDatabase, getDatabase, closeDatabase } = require('../../src/services/database');
    await initDatabase();
    const db = getDatabase();

    // Tabla con empresa_id (tenant)
    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre      TEXT    NOT NULL,
        precio      REAL    NOT NULL DEFAULT 0,
        empresa_id  INTEGER NOT NULL
    )`);

    // Tabla sin empresa_id (global)
    db.run(`CREATE TABLE IF NOT EXISTS categorias (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT    NOT NULL
    )`);

    function cleanupAppDb() {
        try { closeDatabase(); } catch {}
        try { fs.unlinkSync(dbPath); } catch {}
        clearModules(APP_DB_MODULES);
        delete process.env.NIL_DB_FILE;
    }

    return { getDatabase, closeDatabase, dbPath, cleanupAppDb };
}

// ── Auth DB ───────────────────────────────────────────────────────────────────

/**
 * Inicializa la auth DB en memoria con schema mínimo y usuarios de test.
 * @param {Array<{usuario, passwordHash, empresaId, activo, failedAttempts}>} users
 */
async function setupAuthDb(users = []) {
    const dbPath = tmpPath('nilix-test-auth');
    process.env.NIL_AUTH_DB = dbPath;

    clearModules(AUTH_DB_MODULES);

    const { initAuthDatabase, getAuthDatabase, closeAuthDatabase } = require('../../src/services/authDatabase');
    await initAuthDatabase();
    const db = getAuthDatabase();

    // Schema mínimo
    db.run(`CREATE TABLE IF NOT EXISTS empresas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT    NOT NULL,
        public_token TEXT    UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id      INTEGER NOT NULL,
        nombre          TEXT    NOT NULL,
        usuario         TEXT    NOT NULL UNIQUE,
        email           TEXT,
        password_hash   TEXT    NOT NULL,
        rol             TEXT    NOT NULL DEFAULT 'user',
        activo          INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        permisos        TEXT    NOT NULL DEFAULT 'RADU',
        created_at      TEXT    DEFAULT (datetime('now')),
        updated_at      TEXT    DEFAULT (datetime('now'))
    )`);

    // Empresa de test
    db.run(`INSERT OR IGNORE INTO empresas (id, nombre, public_token)
            VALUES (1, 'Test Empresa', 'test-token-abc123')`);

    // Insertar usuarios de test
    for (const u of users) {
        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, activo, failed_attempts)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                u.empresaId    ?? 1,
                u.nombre       ?? u.usuario,
                u.usuario,
                u.passwordHash,
                u.rol          ?? 'user',
                u.activo       ?? 1,
                u.failedAttempts ?? 0,
            ]
        );
    }

    function cleanupAuthDb() {
        try { closeAuthDatabase(); } catch {}
        try { fs.unlinkSync(dbPath); } catch {}
        clearModules(AUTH_DB_MODULES);
        delete process.env.NIL_AUTH_DB;
    }

    return { getAuthDatabase, closeAuthDatabase, dbPath, cleanupAuthDb };
}

module.exports = { setupAppDb, setupAuthDb, clearModules, APP_DB_MODULES, AUTH_DB_MODULES };
