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

    // Audit log (migration-safe)
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            ts         TEXT    NOT NULL DEFAULT (datetime('now')),
            usuario_id INTEGER,
            empresa_id INTEGER,
            method     TEXT    NOT NULL,
            path       TEXT    NOT NULL,
            status     INTEGER NOT NULL,
            ms         INTEGER,
            ip         TEXT
        )
    `);
    // Prune entries older than 90 days on startup
    db.run(`DELETE FROM audit_log WHERE ts < datetime('now', 'localtime', '-90 days')`);

    // nil_config — key-value system config per empresa (migration-safe)
    db.run(`
        CREATE TABLE IF NOT EXISTS nil_config (
            empresa_id INTEGER NOT NULL,
            clave      TEXT    NOT NULL,
            valor      TEXT,
            PRIMARY KEY (empresa_id, clave)
        )
    `);

    // Extra columns on empresas (migration-safe)
    try { db.run(`ALTER TABLE empresas ADD COLUMN telefono TEXT`); }   catch { /* exists */ }
    try { db.run(`ALTER TABLE empresas ADD COLUMN cuit     TEXT`); }   catch { /* exists */ }
    try { db.run(`ALTER TABLE empresas ADD COLUMN horario  TEXT`); }   catch { /* exists */ }

    // Ensure usuario_permisos table exists (added in v2.4.x — migration-safe)
    db.run(`
        CREATE TABLE IF NOT EXISTS usuario_permisos (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            empresa_id INTEGER NOT NULL REFERENCES empresas(id),
            target     TEXT    NOT NULL,
            perms      TEXT    NOT NULL,
            UNIQUE(usuario_id, target)
        )
    `);

    // Ensure permisos column exists on usuarios (migration-safe for existing DBs)
    try { db.run(`ALTER TABLE usuarios ADD COLUMN permisos TEXT NOT NULL DEFAULT 'RADU'`); } catch { /* already exists */ }

    // Extended usuarios columns (migration-safe)
    try { db.run(`ALTER TABLE usuarios ADD COLUMN estado       TEXT    NOT NULL DEFAULT 'activo'`); } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN force_change INTEGER NOT NULL DEFAULT 0`);        } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN never_exp    INTEGER NOT NULL DEFAULT 1`);        } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN exp_days     INTEGER`);                           } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN pass_from    TEXT`);                             } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN pass_to      TEXT`);                             } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN warn_date    TEXT`);                             } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN warn_days    INTEGER`);                          } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN allow_change TEXT    NOT NULL DEFAULT 'always'`); } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN creator_id   INTEGER`);                          } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN modifier_id  INTEGER`);                          } catch { /* exists */ }
    try { db.run(`ALTER TABLE usuarios ADD COLUMN last_login   TEXT`);                             } catch { /* exists */ }
    // Prune expired tokens on startup
    db.run(`DELETE FROM token_blacklist WHERE expires_at < ${Math.floor(Date.now() / 1000)}`);

    // Scheduled cleanup every hour — .unref() so it doesn't block process exit
    setInterval(() => {
        db.run(`DELETE FROM token_blacklist WHERE expires_at < ${Math.floor(Date.now() / 1000)}`);
    }, 60 * 60 * 1000).unref();

    // Periodic flush for audit_log (every 5 minutes)
    setInterval(() => { saveAuthDatabase(); }, 5 * 60 * 1000).unref();

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
 * Returns all nil_config entries for a given empresa as a plain object { clave: valor }.
 */
function getNilConfig(empresaId) {
    if (!db) return {};
    try {
        const rows = db.exec(
            'SELECT clave, valor FROM nil_config WHERE empresa_id = ?',
            [empresaId]
        );
        if (!rows.length || !rows[0].values.length) return {};
        return Object.fromEntries(rows[0].values.map(([k, v]) => [k, v ?? '']));
    } catch { return {}; }
}

/**
 * Upserts a single nil_config entry.
 */
function setNilConfig(empresaId, clave, valor) {
    if (!db) return;
    db.run(
        `INSERT INTO nil_config (empresa_id, clave, valor) VALUES (?, ?, ?)
         ON CONFLICT(empresa_id, clave) DO UPDATE SET valor = excluded.valor`,
        [empresaId, clave, valor ?? '']
    );
}

/**
 * Returns a single nil_config value, or defaultValue if not set.
 */
function getNilConfigValue(empresaId, clave, defaultValue = null) {
    const cfg = getNilConfig(empresaId);
    return clave in cfg ? cfg[clave] : defaultValue;
}

/**
 * Inserts one row into audit_log. Non-blocking — errors are silently swallowed.
 * The in-memory DB is flushed to disk every 5 minutes by the scheduled interval.
 */
function insertAuditLog({ usuarioId, empresaId, method, path, status, ms, ip }) {
    if (!db) return;
    try {
        db.run(
            `INSERT INTO audit_log (ts, usuario_id, empresa_id, method, path, status, ms, ip)
             VALUES (datetime('now','localtime'), ?, ?, ?, ?, ?, ?, ?)`,
            [usuarioId ?? null, empresaId ?? null, method, path, status, ms ?? null, ip ?? null]
        );
    } catch { /* non-critical */ }
}

/**
 * Returns the most recent audit_log rows for a given empresa.
 */
function queryAuditLog(empresaId, { limit = 200, offset = 0 } = {}) {
    if (!db) return [];
    try {
        const rows = db.exec(
            `SELECT id, ts, usuario_id, empresa_id, method, path, status, ms, ip
             FROM audit_log WHERE empresa_id = ?
             ORDER BY id DESC LIMIT ? OFFSET ?`,
            [empresaId, limit, offset]
        );
        if (!rows.length || !rows[0].values.length) return [];
        const cols = rows[0].columns;
        return rows[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
    } catch { return []; }
}

/**
 * Returns all usuarios for a given empresa (for admin report).
 */
function queryUsuarios(empresaId) {
    if (!db) return [];
    try {
        const rows = db.exec(
            `SELECT id, nombre, usuario, email, rol, activo, created_at
             FROM usuarios WHERE empresa_id = ? ORDER BY nombre`,
            [empresaId]
        );
        if (!rows.length || !rows[0].values.length) return [];
        const cols = rows[0].columns;
        return rows[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
    } catch { return []; }
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
    getNilConfig,
    setNilConfig,
    getNilConfigValue,
    insertAuditLog,
    queryAuditLog,
    queryUsuarios,
    AUTH_DB_PATH
};
