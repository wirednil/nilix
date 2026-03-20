/**
 * @file usersController.js
 * @description User management for tenant admins.
 *   All operations are scoped to req.empresaId — an admin cannot
 *   touch users from other companies.
 */

const bcrypt = require('bcryptjs');
const { getAuthDatabase, saveAuthDatabase } = require('../services/authDatabase');
const logger = require('../services/logger');

const SALT_ROUNDS = 10;

function isValidUsuario(u) {
    return typeof u === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(u);
}

/**
 * GET /api/users
 * Returns all users for req.empresaId with their permisos.
 */
const listUsers = (req, res) => {
    try {
        const db = getAuthDatabase();

        const userRows = db.exec(
            `SELECT id, nombre, usuario, email, rol, activo
             FROM usuarios WHERE empresa_id = ? ORDER BY nombre`,
            [req.empresaId]
        );

        const permRows = db.exec(
            `SELECT up.usuario_id, up.target, up.perms
             FROM usuario_permisos up
             JOIN usuarios u ON u.id = up.usuario_id
             WHERE u.empresa_id = ?`,
            [req.empresaId]
        );

        // Build permisos map: usuario_id → [{ target, perms }]
        const permsMap = new Map();
        if (permRows.length && permRows[0].values.length) {
            for (const [uid, target, perms] of permRows[0].values) {
                if (!permsMap.has(uid)) permsMap.set(uid, []);
                permsMap.get(uid).push({ target, perms });
            }
        }

        const users = [];
        if (userRows.length && userRows[0].values.length) {
            for (const [id, nombre, usuario, email, rol, activo] of userRows[0].values) {
                users.push({
                    id, nombre, usuario, email, rol,
                    activo: !!activo,
                    permisos: permsMap.get(id) ?? []
                });
            }
        }

        res.json(users);
    } catch (err) {
        logger.error({ err }, '[USERS] listUsers error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * POST /api/users
 * Body: { nombre, usuario, password, email?, rol? }
 * Creates a new user in req.empresaId.
 */
const createUser = async (req, res) => {
    const { nombre, usuario, password, email, rol } = req.body ?? {};

    if (!nombre || !usuario || !password) {
        return res.status(400).json({ error: 'nombre, usuario y password son requeridos' });
    }
    if (!isValidUsuario(usuario)) {
        return res.status(400).json({ error: 'usuario: solo letras, números y _ (3-30 caracteres)' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
    }

    const rolFinal = (rol === 'admin' || rol === 'operador') ? rol : 'operador';

    try {
        const db = getAuthDatabase();
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, email, password_hash, rol)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.empresaId, nombre.trim(), usuario.trim(), email ?? null, hash, rolFinal]
        );

        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        saveAuthDatabase();

        logger.info({ usuario, empresaId: req.empresaId, creadoPor: req.usuarioId }, '[USERS] Usuario creado');
        res.status(201).json({ id: newId, usuario, rol: rolFinal });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: `El usuario "${usuario}" ya existe` });
        }
        logger.error({ err }, '[USERS] createUser error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * PUT /api/users/:id
 * Body: { nombre?, email?, rol?, activo?, password? }
 * Updates a user that belongs to req.empresaId.
 */
const updateUser = async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'id inválido' });

    const { nombre, email, rol, activo, password } = req.body ?? {};

    // Safety: can't deactivate your own account
    if (activo === false && userId === req.usuarioId) {
        return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
    }

    try {
        const db = getAuthDatabase();

        // Verify user belongs to this empresa
        const check = db.exec(
            'SELECT id FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1',
            [userId, req.empresaId]
        );
        if (!check.length || !check[0].values.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = [];
        const params = [];

        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre.trim()); }
        if (email  !== undefined) { updates.push('email = ?');  params.push(email); }
        if (rol !== undefined && (rol === 'admin' || rol === 'operador')) {
            updates.push('rol = ?'); params.push(rol);
        }
        if (activo !== undefined) {
            updates.push('activo = ?'); params.push(activo ? 1 : 0);
            if (activo) { updates.push('failed_attempts = ?'); params.push(0); }
        }
        if (password !== undefined) {
            if (typeof password !== 'string' || password.length < 8) {
                return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
            }
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push('password_hash = ?'); params.push(hash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nada que actualizar' });
        }

        updates.push("updated_at = datetime('now')");
        params.push(userId);

        db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);
        saveAuthDatabase();

        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[USERS] updateUser error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * PUT /api/users/:id/permisos
 * Body: [{ target, perms }, ...]
 * Replaces ALL permisos for a user. Send empty array to remove all.
 */
const setUserPermisos = (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'id inválido' });

    const permisos = req.body;
    if (!Array.isArray(permisos)) {
        return res.status(400).json({ error: 'Body debe ser un array de { target, perms }' });
    }

    try {
        const db = getAuthDatabase();

        // Verify user belongs to this empresa
        const check = db.exec(
            'SELECT id FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1',
            [userId, req.empresaId]
        );
        if (!check.length || !check[0].values.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        db.run('DELETE FROM usuario_permisos WHERE usuario_id = ?', [userId]);

        for (const { target, perms } of permisos) {
            if (!target || !perms) continue;
            // Normalize perms to valid RADU chars only
            const normalized = [...'RADU'].filter(c => perms.includes(c)).join('');
            if (!normalized) continue;
            db.run(
                'INSERT INTO usuario_permisos (usuario_id, empresa_id, target, perms) VALUES (?, ?, ?, ?)',
                [userId, req.empresaId, target, normalized]
            );
        }

        saveAuthDatabase();
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[USERS] setUserPermisos error');
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = { listUsers, createUser, updateUser, setUserPermisos };
