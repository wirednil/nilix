/**
 * @file authService.js
 * @description Login logic with defense-in-depth security practices.
 *
 * Security design:
 *   - Input validated BEFORE any DB access
 *   - Internal errors are granular (for server logs / audit)
 *   - External errors are deliberately generic (prevent user enumeration)
 *   - Blocked check runs BEFORE password comparison (fail-fast, no bcrypt waste)
 *   - Failed attempts tracked; account auto-blocked after MAX_FAILED_ATTEMPTS
 *   - Password comparison always via bcrypt (timing-safe)
 *
 * @module services/authService
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initAuthDatabase, getAuthDatabase, saveAuthDatabase } = require('./authDatabase');

// ─── Internal error codes (server logs only — never sent to client) ──────────
const LoginError = Object.freeze({
    INVALID_INPUT:   'INVALID_INPUT',   // malformed usuario or password
    USER_NOT_FOUND:  'USER_NOT_FOUND',  // no row matched
    USER_BLOCKED:    'USER_BLOCKED',    // activo = 0
    WRONG_PASSWORD:  'WRONG_PASSWORD',  // bcrypt mismatch
    DB_ERROR:        'DB_ERROR'         // unexpected DB exception
});

// Generic message returned to the client for NOT_FOUND and WRONG_PASSWORD.
// Both cases produce the same text → attacker cannot enumerate valid usernames.
const MSG_BAD_CREDENTIALS = 'Usuario o contraseña incorrectos';
const MSG_BLOCKED          = 'Cuenta bloqueada. Contacte al administrador';
const MSG_INTERNAL         = 'Error interno del servidor';

const MAX_FAILED_ATTEMPTS = 5;

// ─── Input validators ────────────────────────────────────────────────────────

/**
 * Alphanumeric + underscore, 3-30 characters.
 * Matches the same constraint enforced by the DB UNIQUE index.
 */
function isValidUsuario(usuario) {
    return typeof usuario === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(usuario);
}

/**
 * Minimum 8 characters. Complexity rules can be tightened here without
 * touching any other layer.
 */
function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function incrementFailedAttempts(db, id, currentCount) {
    const newCount = currentCount + 1;
    const shouldBlock = newCount >= MAX_FAILED_ATTEMPTS;

    if (shouldBlock) {
        db.run(
            "UPDATE usuarios SET failed_attempts = ?, activo = 0, updated_at = datetime('now') WHERE id = ?",
            [newCount, id]
        );
    } else {
        db.run(
            "UPDATE usuarios SET failed_attempts = ?, updated_at = datetime('now') WHERE id = ?",
            [newCount, id]
        );
    }

    saveAuthDatabase();
    return { shouldBlock };
}

function resetFailedAttempts(db, id) {
    db.run(
        "UPDATE usuarios SET failed_attempts = 0, updated_at = datetime('now') WHERE id = ?",
        [id]
    );
    saveAuthDatabase();
}

// ─── Main login function ─────────────────────────────────────────────────────

/**
 * @param {string} usuario
 * @param {string} password  plain text
 * @returns {{ ok: boolean, errorCode?: string, error?: string, session?: object }}
 *
 * errorCode is for internal use (logging). The `error` field is safe to send to the client.
 */
async function login(usuario, password) {

    // 1. Validate input format — reject before touching DB
    if (!isValidUsuario(usuario) || !isValidPassword(password)) {
        return {
            ok: false,
            errorCode: LoginError.INVALID_INPUT,
            error: MSG_BAD_CREDENTIALS   // generic — don't hint which field failed
        };
    }

    // 2. Query DB
    let db;
    let rows;
    try {
        db = await initAuthDatabase();
        rows = db.exec(
            `SELECT id, empresa_id, nombre, usuario, password_hash, rol, activo, failed_attempts
             FROM usuarios WHERE usuario = ? LIMIT 1`,
            [usuario]
        );
    } catch (e) {
        console.error('[AUTH] DB error during login:', e.message);
        return { ok: false, errorCode: LoginError.DB_ERROR, error: MSG_INTERNAL };
    }

    // 3. User not found → generic message (prevent enumeration)
    if (!rows.length || !rows[0].values.length) {
        return { ok: false, errorCode: LoginError.USER_NOT_FOUND, error: MSG_BAD_CREDENTIALS };
    }

    const [id, empresa_id, nombre, usr, password_hash, rol, activo, failed_attempts] =
        rows[0].values[0];

    // Get empresa public_token for public URLs
    let publicToken = null;
    try {
        const empRows = db.exec('SELECT public_token FROM empresas WHERE id = ? LIMIT 1', [empresa_id]);
        if (empRows.length && empRows[0].values.length) publicToken = empRows[0].values[0][0];
    } catch { /* no public_token column in old schema */ }

    // 4. Blocked check — before bcrypt (fast fail, no CPU waste)
    if (!activo) {
        return { ok: false, errorCode: LoginError.USER_BLOCKED, error: MSG_BLOCKED };
    }

    // 5. Password comparison (timing-safe via bcrypt)
    const match = await bcrypt.compare(password, password_hash);

    if (!match) {
        const { shouldBlock } = incrementFailedAttempts(db, id, failed_attempts ?? 0);
        // If auto-blocked, tell the user — this is not information leakage
        // because the block itself is visible (they can try again and get MSG_BLOCKED).
        return {
            ok: false,
            errorCode: LoginError.WRONG_PASSWORD,
            error: shouldBlock ? MSG_BLOCKED : MSG_BAD_CREDENTIALS
        };
    }

    // 6. Success — reset counter, sign JWT
    resetFailedAttempts(db, id);

    const secret = process.env.NIL_JWT_SECRET;
    const expiry = process.env.NIL_JWT_EXPIRY || '8h';
    const jti = crypto.randomUUID();
    const token = jwt.sign(
        { usuarioId: id, empresaId: empresa_id, nombre, usuario: usr, rol, publicToken, jti },
        secret,
        { expiresIn: expiry }
    );

    return { ok: true, token };
}

function addToBlacklist(jti, expiresAt) {
    try {
        const db = getAuthDatabase();
        db.run('INSERT OR IGNORE INTO token_blacklist (jti, expires_at) VALUES (?, ?)', [jti, expiresAt]);
        saveAuthDatabase();
    } catch (e) {
        console.error('[AUTH] Error adding to blacklist:', e.message);
    }
}

function isBlacklisted(jti) {
    try {
        const db = getAuthDatabase();
        const result = db.exec('SELECT jti FROM token_blacklist WHERE jti = ? LIMIT 1', [jti]);
        return result.length > 0 && result[0].values.length > 0;
    } catch (e) {
        return false;
    }
}

module.exports = { login, addToBlacklist, isBlacklisted, LoginError };
