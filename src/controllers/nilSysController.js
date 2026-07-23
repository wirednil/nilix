'use strict';

/**
 * @file nilSysController.js
 * @description Catalog endpoints for nil-sys dropdowns.
 *   CRUD is handled by the standard record pipeline (database="auth" table="usuarios").
 *   These endpoints feed <in-table url=...> selectors in system forms.
 */

const { getAuthDatabase } = require('../services/authDatabase');
const logger = require('../services/logger');
const { isGlobalWizard, NIL_EMPRESA_ID } = require('../utils/authScope');

function toRows(result) {
    if (!result.length || !result[0].values.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((c, i) => { obj[c] = row[i]; });
        return obj;
    });
}

/**
 * GET /api/nil/usuarios
 * Catalog of system users (empresa_id=0) for <in-table url="/api/nil/usuarios">.
 */
const listSysUsers = (req, res) => {
    try {
        const db = getAuthDatabase();
        const rows = toRows(db.exec(
            `SELECT id, nombre, usuario, email, rol, permisos, activo, estado,
                    failed_attempts, force_change, never_exp, exp_days,
                    pass_from, pass_to, warn_date, warn_days, allow_change
             FROM usuarios
             WHERE empresa_id = ?
               AND rol IN ('wizard','admin','auditor')
             ORDER BY nombre`,
            [NIL_EMPRESA_ID]
        ));
        rows.forEach(r => { r.activo = r.activo ? 1 : 0; });
        res.json({ rows });
    } catch (err) {
        logger.error({ err }, '[NIL-SYS] listSysUsers error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * GET /api/nil/operadores
 * Catalog of operadores for <in-table url="/api/nil/operadores">.
 * wizard (rol='wizard' AND empresaId=0) sees all; admin sees only their empresa.
 */
const listOperadores = (req, res) => {
    try {
        const db = getAuthDatabase();
        const isWizard = isGlobalWizard(req);
        const rows = isWizard
            ? toRows(db.exec(
                `SELECT u.id, u.nombre, u.usuario, u.email, u.empresa_id,
                        COALESCE(e.nombre, '—') AS empresa_nombre,
                        u.permisos, u.activo, u.failed_attempts, u.last_login, u.created_at, u.updated_at
                 FROM usuarios u
                 LEFT JOIN empresas e ON e.id = u.empresa_id
                 WHERE u.rol = 'operador'
                 ORDER BY u.empresa_id, u.nombre`))
            : toRows(db.exec(
                `SELECT u.id, u.nombre, u.usuario, u.email, u.empresa_id,
                        COALESCE(e.nombre, '—') AS empresa_nombre,
                        u.permisos, u.activo, u.failed_attempts, u.last_login, u.created_at, u.updated_at
                 FROM usuarios u
                 LEFT JOIN empresas e ON e.id = u.empresa_id
                 WHERE u.rol = 'operador' AND u.empresa_id = ?
                 ORDER BY u.nombre`,
                [req.empresaId]));
        rows.forEach(r => { r.activo = r.activo ? 1 : 0; });
        res.json({ rows });
    } catch (err) {
        logger.error({ err }, '[NIL-SYS] listOperadores error');
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = { listSysUsers, listOperadores };
