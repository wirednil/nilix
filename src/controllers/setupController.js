/**
 * @file setupController.js
 * @description First-run wizard endpoints. Only operative when auth.db has no empresas.
 *   POST /api/setup/init — creates the first empresa + admin user.
 *   Both routes are public (mounted before verifyToken in server.js).
 */

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getAuthDatabase, saveAuthDatabase } = require('../services/authDatabase');
const logger = require('../services/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken() {
    return Buffer.from(crypto.randomUUID().replace(/-/g, ''), 'hex').toString('base64url');
}

/**
 * Returns true if the system needs initial setup (no empresas in auth.db).
 * Handles the case where the empresas table doesn't exist yet (fresh DB).
 */
function isSetupNeeded() {
    try {
        const db = getAuthDatabase();
        const rows = db.exec('SELECT COUNT(*) FROM empresas');
        const count = rows[0]?.values[0]?.[0] ?? 0;
        return count === 0;
    } catch {
        return true; // table doesn't exist → setup needed
    }
}

/**
 * Ensures the core schema tables exist (empresas + usuarios).
 * Migration-safe: no-ops if they already exist.
 */
function ensureCoreSchema(db) {
    db.run(`
        CREATE TABLE IF NOT EXISTS empresas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre       TEXT    NOT NULL,
            public_token TEXT    NOT NULL UNIQUE,
            direccion    TEXT,
            email        TEXT,
            cuit         TEXT,
            telefono     TEXT,
            horario      TEXT,
            activo       INTEGER NOT NULL DEFAULT 1
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id      INTEGER NOT NULL REFERENCES empresas(id),
            nombre          TEXT    NOT NULL,
            usuario         TEXT    NOT NULL UNIQUE,
            email           TEXT,
            password_hash   TEXT    NOT NULL,
            rol             TEXT    NOT NULL DEFAULT 'operador',
            permisos        TEXT    NOT NULL DEFAULT 'RADU',
            activo          INTEGER NOT NULL DEFAULT 1,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    `);
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/setup/status
 * Returns { needed: true } if no empresas exist in auth.db.
 */
const getStatus = (req, res) => {
    try {
        res.json({ needed: isSetupNeeded() });
    } catch (err) {
        logger.error({ err }, '[SETUP] getStatus error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * POST /api/setup/init
 * Creates the first empresa and admin user. Locked after first successful call.
 *
 * Body: { empresa_nombre, empresa_cuit?, admin_nombre?, admin_usuario, admin_password }
 */
const initSetup = async (req, res) => {
    // Server-side guard — abort if already initialized
    if (!isSetupNeeded()) {
        return res.status(403).json({ error: 'El sistema ya está configurado' });
    }

    const {
        empresa_nombre,
        empresa_cuit,
        admin_nombre,
        admin_usuario,
        admin_password
    } = req.body ?? {};

    // Validate
    if (!empresa_nombre?.trim()) {
        return res.status(400).json({ error: 'Nombre de empresa requerido' });
    }
    if (!admin_usuario?.trim() || !/^[a-zA-Z0-9_-]{3,30}$/.test(admin_usuario)) {
        return res.status(400).json({ error: 'Usuario inválido (3-30 caracteres: letras, números, _ -)' });
    }
    if (/^nil-/i.test(admin_usuario)) {
        return res.status(400).json({ error: 'Nombre de usuario reservado (nil-)' });
    }
    if (!admin_password || admin_password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    try {
        const db = getAuthDatabase();
        ensureCoreSchema(db);

        // Insert empresa
        const token = makeToken();
        db.run(
            `INSERT INTO empresas (nombre, cuit, public_token) VALUES (?, ?, ?)`,
            [empresa_nombre.trim(), empresa_cuit?.trim() || null, token]
        );
        const empRows = db.exec('SELECT last_insert_rowid()');
        const empresaId = empRows[0].values[0][0];

        // Insert admin user
        const hash = await bcrypt.hash(admin_password, 10);
        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, permisos)
             VALUES (?, ?, ?, ?, 'wizard', 'RADU')`,
            [empresaId, admin_nombre?.trim() || admin_usuario.trim(), admin_usuario.trim(), hash]
        );

        saveAuthDatabase();

        logger.info({ empresaId, usuario: admin_usuario }, '[SETUP] Sistema inicializado via wizard');
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[SETUP] initSetup error');
        res.status(500).json({ error: 'Error al inicializar el sistema' });
    }
};

module.exports = { getStatus, initSetup };
