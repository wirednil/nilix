"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginError = void 0;
exports.login = login;
exports.addToBlacklist = addToBlacklist;
exports.isBlacklisted = isBlacklisted;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const authDatabase_1 = require("./authDatabase");
const logger_1 = __importDefault(require("./logger"));
// ─── Internal error codes (server logs only — never sent to client) ──────────
var LoginError;
(function (LoginError) {
    LoginError["INVALID_INPUT"] = "INVALID_INPUT";
    LoginError["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    LoginError["USER_BLOCKED"] = "USER_BLOCKED";
    LoginError["WRONG_PASSWORD"] = "WRONG_PASSWORD";
    LoginError["DB_ERROR"] = "DB_ERROR";
})(LoginError || (exports.LoginError = LoginError = {}));
// Generic message returned to the client for NOT_FOUND and WRONG_PASSWORD.
const MSG_BAD_CREDENTIALS = 'Usuario o contraseña incorrectos';
const MSG_BLOCKED = 'Cuenta bloqueada. Contacte al administrador';
const MSG_INTERNAL = 'Error interno del servidor';
const MAX_FAILED_ATTEMPTS_DEFAULT = 5;
const MIN_PASSWORD_LENGTH_DEFAULT = 8;
// ─── Input validators ────────────────────────────────────────────────────────
function isValidUsuario(usuario) {
    return typeof usuario === 'string' && /^[a-zA-Z0-9_-]{3,30}$/.test(usuario);
}
function isValidPassword(password, empresaId = null) {
    if (typeof password !== 'string')
        return false;
    const minLen = empresaId !== null
        ? parseInt((0, authDatabase_1.getNilConfigValue)(empresaId, 'min_largo_password', MIN_PASSWORD_LENGTH_DEFAULT), 10) || MIN_PASSWORD_LENGTH_DEFAULT
        : MIN_PASSWORD_LENGTH_DEFAULT;
    return password.length >= minLen;
}
// ─── DB helpers ──────────────────────────────────────────────────────────────
function incrementFailedAttempts(db, id, currentCount, maxAttempts = MAX_FAILED_ATTEMPTS_DEFAULT) {
    const newCount = currentCount + 1;
    const shouldBlock = newCount >= maxAttempts;
    if (shouldBlock) {
        db.run("UPDATE usuarios SET failed_attempts = ?, activo = 0, updated_at = datetime('now') WHERE id = ?", [newCount, id]);
    }
    else {
        db.run("UPDATE usuarios SET failed_attempts = ?, updated_at = datetime('now') WHERE id = ?", [newCount, id]);
    }
    (0, authDatabase_1.saveAuthDatabase)();
    return { shouldBlock };
}
function resetFailedAttempts(db, id) {
    db.run("UPDATE usuarios SET failed_attempts = 0, updated_at = datetime('now') WHERE id = ?", [id]);
    (0, authDatabase_1.saveAuthDatabase)();
}
// ─── Main login function ─────────────────────────────────────────────────────
async function login(usuario, password) {
    // 1. Validate input format — reject before touching DB
    if (!isValidUsuario(usuario) || !isValidPassword(password, null)) {
        return {
            ok: false,
            errorCode: LoginError.INVALID_INPUT,
            error: MSG_BAD_CREDENTIALS
        };
    }
    // 2. Query DB
    let db;
    let rows;
    try {
        db = await (0, authDatabase_1.initAuthDatabase)();
        rows = db.exec(`SELECT id, empresa_id, nombre, usuario, password_hash, rol, activo, failed_attempts, permisos
             FROM usuarios WHERE usuario = ? LIMIT 1`, [usuario]);
    }
    catch (e) {
        logger_1.default.error({ err: e }, '[AUTH] DB error during login');
        return { ok: false, errorCode: LoginError.DB_ERROR, error: MSG_INTERNAL };
    }
    // 3. User not found → generic message (prevent enumeration)
    if (!rows.length || !rows[0].values.length) {
        return { ok: false, errorCode: LoginError.USER_NOT_FOUND, error: MSG_BAD_CREDENTIALS };
    }
    const [id, empresa_id, nombre, usr, password_hash, rol, activo, failed_attempts, permisos] = rows[0].values[0];
    // 4. Blocked check — before bcrypt (fast fail, no CPU waste)
    if (!activo) {
        return { ok: false, errorCode: LoginError.USER_BLOCKED, error: MSG_BLOCKED };
    }
    // Get empresa config values (public_token, max_failed_attempts)
    let publicToken = null;
    try {
        const empRows = db.exec('SELECT public_token FROM empresas WHERE id = ? LIMIT 1', [empresa_id]);
        if (empRows.length && empRows[0].values.length)
            publicToken = empRows[0].values[0][0];
    }
    catch { /* no public_token column in old schema */ }
    const maxFailedAttempts = parseInt((0, authDatabase_1.getNilConfigValue)(empresa_id, 'max_intentos_fallidos', MAX_FAILED_ATTEMPTS_DEFAULT), 10) || MAX_FAILED_ATTEMPTS_DEFAULT;
    // 5. Password comparison (timing-safe via bcrypt)
    const match = await bcryptjs_1.default.compare(password, password_hash);
    if (!match) {
        const { shouldBlock } = incrementFailedAttempts(db, id, failed_attempts ?? 0, maxFailedAttempts);
        return {
            ok: false,
            errorCode: LoginError.WRONG_PASSWORD,
            error: shouldBlock ? MSG_BLOCKED : MSG_BAD_CREDENTIALS
        };
    }
    // 6. Success — reset counter, record last login, sign JWT
    resetFailedAttempts(db, id);
    db.run("UPDATE usuarios SET last_login = datetime('now','localtime') WHERE id = ?", [id]);
    (0, authDatabase_1.saveAuthDatabase)();
    const secret = process.env.NIL_JWT_SECRET;
    const expiry = process.env.NIL_JWT_EXPIRY || '8h';
    const jti = crypto_1.default.randomUUID();
    const token = jsonwebtoken_1.default.sign({ usuarioId: id, empresaId: empresa_id, nombre, usuario: usr, rol, permisos: permisos ?? 'RADU', publicToken, jti }, secret, { expiresIn: expiry });
    return { ok: true, token };
}
function addToBlacklist(jti, expiresAt) {
    try {
        const db = (0, authDatabase_1.getAuthDatabase)();
        db.run('INSERT OR IGNORE INTO token_blacklist (jti, expires_at) VALUES (?, ?)', [jti, expiresAt]);
        (0, authDatabase_1.saveAuthDatabase)();
    }
    catch (e) {
        logger_1.default.error({ err: e }, '[AUTH] Error adding to blacklist');
    }
}
function isBlacklisted(jti) {
    try {
        const db = (0, authDatabase_1.getAuthDatabase)();
        const result = db.exec('SELECT jti FROM token_blacklist WHERE jti = ? LIMIT 1', [jti]);
        return result.length > 0 && result[0].values.length > 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=authService.js.map