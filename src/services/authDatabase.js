/**
 * @file authDatabase.js
 * @description Manages the auth database (empresas + usuarios).
 *   Path resolved from NIL_AUTH_DB env var; defaults to data/auth.db.
 *   This DB is owned by the nilix, NOT by the client app.
 * @module services/authDatabase
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const AUTH_DB_PATH = process.env.NIL_AUTH_DB
    ? path.resolve(process.cwd(), process.env.NIL_AUTH_DB)
    : path.join(__dirname, '../../data/auth.db');

let db = null;
let SQL = null;

async function initAuthDatabase() {
    if (db) return db;

    SQL = await initSqlJs();

    const dbDir = path.dirname(AUTH_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    if (fs.existsSync(AUTH_DB_PATH)) {
        const buffer = fs.readFileSync(AUTH_DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Ensure token_blacklist table exists (migration-safe)
    db.run(`
        CREATE TABLE IF NOT EXISTS token_blacklist (
            jti        TEXT    PRIMARY KEY,
            expires_at INTEGER NOT NULL
        )
    `);

    // Ensure permisos column exists on usuarios (migration-safe for existing DBs)
    try { db.run(`ALTER TABLE usuarios ADD COLUMN permisos TEXT NOT NULL DEFAULT 'RADU'`); } catch (_) { /* already exists */ }
    // Prune expired tokens on startup
    db.run(`DELETE FROM token_blacklist WHERE expires_at < ${Math.floor(Date.now() / 1000)}`);

    // Scheduled cleanup every hour — .unref() so it doesn't block process exit
    setInterval(() => {
        db.run(`DELETE FROM token_blacklist WHERE expires_at < ${Math.floor(Date.now() / 1000)}`);
    }, 60 * 60 * 1000).unref();

    return db;
}

function getAuthDatabase() {
    if (!db) {
        throw new Error('Auth database not initialized. Call initAuthDatabase() first.');
    }
    return db;
}

function saveAuthDatabase() {
    if (!db) return;
    const data = db.export();
    fs.writeFileSync(AUTH_DB_PATH, Buffer.from(data));
}

function closeAuthDatabase() {
    if (db) {
        saveAuthDatabase();
        db.close();
        db = null;
    }
}

/**
 * Returns the permisos string (e.g. 'RADU', 'RA', 'R') for a given usuario.
 * Used by menuService to filter the menu tree for non-admin users.
 * @param {number} usuarioId
 * @returns {string}
 */
function getUserPermisos(usuarioId) {
    const db = getAuthDatabase();
    const rows = db.exec(
        'SELECT permisos FROM usuarios WHERE id = ?',
        [Number(usuarioId)]
    );
    if (!rows.length || !rows[0].values.length) return 'R';
    return rows[0].values[0][0] ?? 'R';
}

module.exports = {
    initAuthDatabase,
    getAuthDatabase,
    saveAuthDatabase,
    closeAuthDatabase,
    getUserPermisos,
    AUTH_DB_PATH
};
