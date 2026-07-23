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

const VALID_ROLES   = ['wizard', 'admin', 'auditor', 'operador'];
const ROLE_PERMISOS = { wizard: 'RADU', admin: 'RAU', auditor: 'R', operador: 'RADU' };

// Relative rank for "can actor act on target" checks — used by
// resetUserPassword, and by createUser/updateUser's rol assignment below.
// Higher acts on strictly-lower only: an admin can reset an operador or
// auditor's password, or grant them a rol, but never touch another admin or
// a wizard (not even by granting a rol equal to their own — see the
// createUser/updateUser checks). Without gating rol assignment itself, the
// resetUserPassword rank check is cosmetic: an admin who can't reset a peer
// admin's password could just grant themselves rol='wizard' directly via
// updateUser and skip needing the password at all.
const ROLE_RANK = { wizard: 3, admin: 2, auditor: 1, operador: 1 };

function isValidUsuario(u) {
    return typeof u === 'string' && /^[a-zA-Z0-9_-]{3,30}$/.test(u);
}

function isReservedUsuario(u) {
    return typeof u === 'string' && /^nil-/i.test(u);
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
        return res.status(400).json({ error: 'usuario: solo letras, números, _ y - (3-30 caracteres)' });
    }
    if (isReservedUsuario(usuario)) {
        return res.status(400).json({ error: 'Nombre de usuario reservado (nil-)' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
    }

    const rolFinal = VALID_ROLES.includes(rol) ? rol : 'operador';

    const actorRank = ROLE_RANK[req.rol] ?? 0;
    if ((ROLE_RANK[rolFinal] ?? 0) >= actorRank) {
        return res.status(403).json({ error: `No podés crear un usuario de rol '${rolFinal}' (igual o superior al tuyo)` });
    }

    const permisosFinal = ROLE_PERMISOS[rolFinal];

    try {
        const db = getAuthDatabase();
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, email, password_hash, rol, permisos)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.empresaId, nombre.trim(), usuario.trim(), email ?? null, hash, rolFinal, permisosFinal]
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
 * Body: { nombre?, email?, rol?, activo? }
 * Updates a user that belongs to req.empresaId. Two independent rank checks,
 * both against ROLE_RANK, mirroring resetUserPassword:
 *   - the TARGET's current rol must be strictly below the actor's (an admin
 *     can't touch a peer or higher admin's account AT ALL, not even to
 *     demote them — demoting a peer is still an attack, not a mitigation)
 *   - the NEW rol being assigned (if any) must also be strictly below the
 *     actor's (an admin can't promote anyone, including themselves, to
 *     admin/wizard)
 * Both checks are skipped for self-edits (editing your own nombre/email is
 * normal; self-promotion and self-deactivation are still separately blocked
 * below and by the new-rol check, which apply regardless of target).
 * Password changes are NOT handled here — see PUT /api/users/:id/password.
 */
const updateUser = async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'id inválido' });

    const { nombre, email, rol, activo, password } = req.body ?? {};
    const actorRank = ROLE_RANK[req.rol] ?? 0;

    // Safety: can't deactivate your own account
    if (activo === false && userId === req.usuarioId) {
        return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
    }

    try {
        const db = getAuthDatabase();

        // Verify user belongs to this empresa
        const check = db.exec(
            'SELECT id, rol FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1',
            [userId, req.empresaId]
        );
        if (!check.length || !check[0].values.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const [, targetCurrentRol] = check[0].values[0];

        if (userId !== req.usuarioId && actorRank <= (ROLE_RANK[targetCurrentRol] ?? 0)) {
            return res.status(403).json({ error: 'No podés modificar un usuario de rol igual o superior al tuyo' });
        }

        const updates = [];
        const params = [];

        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre.trim()); }
        if (email  !== undefined) { updates.push('email = ?');  params.push(email); }
        if (rol !== undefined && VALID_ROLES.includes(rol)) {
            if ((ROLE_RANK[rol] ?? 0) >= actorRank) {
                return res.status(403).json({ error: `No podés asignar el rol '${rol}' (igual o superior al tuyo)` });
            }
            updates.push('rol = ?');      params.push(rol);
            updates.push('permisos = ?'); params.push(ROLE_PERMISOS[rol]);
        }
        if (activo !== undefined) {
            updates.push('activo = ?'); params.push(activo ? 1 : 0);
            if (activo) { updates.push('failed_attempts = ?'); params.push(0); }
        }
        // password is NOT handled here — it used to be (no rank check, no
        // self-target guard), which meant it silently bypassed
        // resetUserPassword's ROLE_RANK check entirely: an admin blocked from
        // resetting a peer admin's password there could just PUT it here
        // instead. Use PUT /api/users/:id/password (rank-checked) or
        // PUT /api/users/me/password (self-service, current-password
        // verified). Empty/absent is a no-op, matching the "vacío = no
        // cambiar" convention elsewhere; non-empty is rejected loudly instead
        // of silently ignored.
        if (password) {
            return res.status(400).json({ error: 'Para cambiar contraseñas usá PUT /api/users/:id/password (u /me/password para la propia)' });
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

/**
 * PUT /api/users/me/password
 * Body: { current_password, new_password }
 * Self-service password change — any authenticated user, any rol, any tenant.
 * Requires the current password to already be correct, so a hijacked session
 * or an XSS'd fetch can't turn into a permanent, silent account takeover just
 * by knowing it has write access.
 */
const changeOwnPassword = async (req, res) => {
    const { current_password, new_password } = req.body ?? {};

    if (typeof current_password !== 'string' || !current_password) {
        return res.status(400).json({ error: 'current_password es requerida' });
    }
    if (typeof new_password !== 'string' || new_password.length < 8) {
        return res.status(400).json({ error: 'new_password debe tener al menos 8 caracteres' });
    }

    try {
        const db = getAuthDatabase();
        const rows = db.exec('SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1', [req.usuarioId]);
        if (!rows.length || !rows[0].values.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const currentHash = rows[0].values[0][0];

        const matches = await bcrypt.compare(current_password, currentHash);
        if (!matches) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
        db.run(
            `UPDATE usuarios SET password_hash = ?, force_change = 0, updated_at = datetime('now') WHERE id = ?`,
            [newHash, req.usuarioId]
        );
        saveAuthDatabase();

        logger.info({ usuarioId: req.usuarioId }, '[USERS] Password propio cambiado');
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[USERS] changeOwnPassword error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * PUT /api/users/:id/password
 * Body: { password }
 * Admin/wizard-only reset of ANOTHER user's password, within the actor's own
 * tenant. Refuses same-or-higher-ranked targets (ROLE_RANK) — an admin can't
 * silently take over a peer admin or a wizard by resetting their password,
 * which would otherwise recreate full escalation one step removed (reset →
 * that account's own wizard-assignment power, see updateUser's rol handling).
 * Refuses self-target entirely: resetting your own password without knowing
 * it defeats the point of changeOwnPassword's current-password check, so
 * self always goes through PUT /api/users/me/password instead.
 * Forces force_change=1 so the target must set their own password next login.
 */
const resetUserPassword = async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'id inválido' });

    if (userId === req.usuarioId) {
        return res.status(400).json({ error: 'Para tu propia cuenta usá /api/users/me/password' });
    }

    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'password debe tener al menos 8 caracteres' });
    }

    try {
        const db = getAuthDatabase();

        const rows = db.exec(
            'SELECT rol FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1',
            [userId, req.empresaId]
        );
        if (!rows.length || !rows[0].values.length) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const targetRol = rows[0].values[0][0];

        const actorRank  = ROLE_RANK[req.rol] ?? 0;
        const targetRank = ROLE_RANK[targetRol] ?? 0;
        if (actorRank <= targetRank) {
            return res.status(403).json({ error: 'No podés resetear la contraseña de un usuario de rol igual o superior al tuyo' });
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        db.run(
            `UPDATE usuarios SET password_hash = ?, force_change = 1, updated_at = datetime('now') WHERE id = ? AND empresa_id = ?`,
            [hash, userId, req.empresaId]
        );
        saveAuthDatabase();

        logger.info({ targetId: userId, targetRol, actorId: req.usuarioId, actorRol: req.rol }, '[USERS] Password reset por admin');
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[USERS] resetUserPassword error');
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = { listUsers, createUser, updateUser, setUserPermisos, changeOwnPassword, resetUserPassword };
