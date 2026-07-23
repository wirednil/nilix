import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { initAuthDatabase, getAuthDatabase, saveAuthDatabase, getNilConfigValue } from './authDatabase';
import logger from './logger';
import type { Database } from 'sql.js';

// ─── Internal error codes (server logs only — never sent to client) ──────────

export enum LoginError {
    INVALID_INPUT  = 'INVALID_INPUT',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    USER_BLOCKED   = 'USER_BLOCKED',
    WRONG_PASSWORD = 'WRONG_PASSWORD',
    DB_ERROR       = 'DB_ERROR'
}

// Generic message returned to the client for NOT_FOUND and WRONG_PASSWORD.
const MSG_BAD_CREDENTIALS = 'Usuario o contraseña incorrectos';
const MSG_BLOCKED         = 'Cuenta bloqueada. Contacte al administrador';
const MSG_INTERNAL        = 'Error interno del servidor';

const MAX_FAILED_ATTEMPTS_DEFAULT = 5;
const MIN_PASSWORD_LENGTH_DEFAULT = 8;

// ─── Login result types ──────────────────────────────────────────────────────

export type LoginSuccess = {
    ok: true;
    token: string;
};

export type LoginFailure = {
    ok: false;
    errorCode: LoginError;
    error: string;
};

export type LoginResult = LoginSuccess | LoginFailure;

// ─── Input validators ────────────────────────────────────────────────────────

function isValidUsuario(usuario: unknown): usuario is string {
    return typeof usuario === 'string' && /^[a-zA-Z0-9_-]{3,30}$/.test(usuario);
}

function isValidPassword(password: unknown, empresaId: number | null = null): password is string {
    if (typeof password !== 'string') return false;
    const minLen = empresaId !== null
        ? parseInt(getNilConfigValue(empresaId, 'min_largo_password', MIN_PASSWORD_LENGTH_DEFAULT), 10) || MIN_PASSWORD_LENGTH_DEFAULT
        : MIN_PASSWORD_LENGTH_DEFAULT;
    return password.length >= minLen;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function incrementFailedAttempts(db: Database, id: number, currentCount: number, maxAttempts: number = MAX_FAILED_ATTEMPTS_DEFAULT): { shouldBlock: boolean } {
    const newCount = currentCount + 1;
    const shouldBlock = newCount >= maxAttempts;

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

function resetFailedAttempts(db: Database, id: number): void {
    db.run(
        "UPDATE usuarios SET failed_attempts = 0, updated_at = datetime('now') WHERE id = ?",
        [id]
    );
    saveAuthDatabase();
}

// ─── Main login function ─────────────────────────────────────────────────────

export async function login(usuario: string, password: string): Promise<LoginResult> {
    // 1. Validate input format — reject before touching DB
    if (!isValidUsuario(usuario) || !isValidPassword(password, null)) {
        return {
            ok: false,
            errorCode: LoginError.INVALID_INPUT,
            error: MSG_BAD_CREDENTIALS
        };
    }

    // 2. Query DB
    let db: Database;
    let rows: { columns: string[]; values: unknown[][] }[];

    try {
        db = await initAuthDatabase();
        rows = db.exec(
            `SELECT id, empresa_id, nombre, usuario, password_hash, rol, activo, failed_attempts, permisos
             FROM usuarios WHERE usuario = ? LIMIT 1`,
            [usuario]
        );
    } catch (e) {
        logger.error({ err: e as Record<string, unknown> }, '[AUTH] DB error during login');
        return { ok: false, errorCode: LoginError.DB_ERROR, error: MSG_INTERNAL };
    }

    // 3. User not found → generic message (prevent enumeration)
    if (!rows.length || !rows[0].values.length) {
        return { ok: false, errorCode: LoginError.USER_NOT_FOUND, error: MSG_BAD_CREDENTIALS };
    }

    const [id, empresa_id, nombre, usr, password_hash, rol, activo, failed_attempts, permisos] =
        rows[0].values[0] as [number, number, string, string, string, string, number, number, string];

    // 4. Blocked check — before bcrypt (fast fail, no CPU waste)
    if (!activo) {
        return { ok: false, errorCode: LoginError.USER_BLOCKED, error: MSG_BLOCKED };
    }

    // Get empresa config values (public_token, max_failed_attempts)
    let publicToken: string | null = null;
    try {
        const empRows = db.exec('SELECT public_token FROM empresas WHERE id = ? LIMIT 1', [empresa_id]);
        if (empRows.length && empRows[0].values.length) publicToken = empRows[0].values[0][0] as string;
    } catch { /* no public_token column in old schema */ }

    const maxFailedAttempts = parseInt(
        getNilConfigValue(empresa_id, 'max_intentos_fallidos', MAX_FAILED_ATTEMPTS_DEFAULT), 10
    ) || MAX_FAILED_ATTEMPTS_DEFAULT;

    // 5. Password comparison (timing-safe via bcrypt)
    const match = await bcrypt.compare(password, password_hash);

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
    saveAuthDatabase();

    const secret = process.env.NIL_JWT_SECRET!;
    const expiry = process.env.NIL_JWT_EXPIRY || '8h';
    const jti = crypto.randomUUID();
    const token = jwt.sign(
        { usuarioId: id, empresaId: empresa_id, nombre, usuario: usr, rol, permisos: permisos ?? 'RADU', publicToken, jti },
        secret,
        { expiresIn: expiry } as SignOptions
    );

    return { ok: true, token };
}

export function addToBlacklist(jti: string, expiresAt: number): void {
    try {
        const db = getAuthDatabase();
        db.run('INSERT OR IGNORE INTO token_blacklist (jti, expires_at) VALUES (?, ?)', [jti, expiresAt]);
        saveAuthDatabase();
    } catch (e) {
        logger.error({ err: e as Record<string, unknown> }, '[AUTH] Error adding to blacklist');
    }
}

export function isBlacklisted(jti: string): boolean {
    try {
        const db = getAuthDatabase();
        const result = db.exec('SELECT jti FROM token_blacklist WHERE jti = ? LIMIT 1', [jti]);
        return result.length > 0 && result[0].values.length > 0;
    } catch {
        return false;
    }
}
