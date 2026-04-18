/**
 * @file adminController.js
 * @description Admin-only endpoints: menu, audit log, user list.
 *   All handlers require rol='admin' (enforced in adminRoutes.js).
 *   Data comes from auth.db, not the app DB.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { queryAuditLog, queryUsuarios, getAuthDatabase, saveAuthDatabase, getNilConfig, setNilConfig } = require('../services/authDatabase');
const { parseMenuFile } = require('../services/menuService');
const logger = require('../services/logger');

const ADMIN_MENU_FILE = path.join(__dirname, '../../menu/admin.xml');

/**
 * GET /api/admin/menu
 * Returns the admin menu tree. Also registers admin dirs as authorized
 * so filesystemController can serve admin forms/reports.
 */
const getAdminMenu = (req, res) => {
    if (!fs.existsSync(ADMIN_MENU_FILE)) {
        return res.json([]);
    }
    try {
        const items = parseMenuFile(ADMIN_MENU_FILE);
        res.json(items);
    } catch (err) {
        logger.error({ err }, '[ADMIN] getAdminMenu error');
        res.status(500).json({ error: 'Error leyendo menú admin' });
    }
};

/**
 * GET /api/admin/audit-log?limit=200
 * Returns recent audit log entries for req.empresaId.
 */
const getAuditLog = (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    try {
        const rows = queryAuditLog(req.empresaId, { limit });
        res.json({ rows });
    } catch (err) {
        logger.error({ err }, '[ADMIN] getAuditLog error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * GET /api/admin/usuarios
 * Returns users for req.empresaId (for report — read only).
 */
const getUsuarios = (req, res) => {
    try {
        const rows = queryUsuarios(req.empresaId);
        res.json({ rows });
    } catch (err) {
        logger.error({ err }, '[ADMIN] getUsuarios error');
        res.status(500).json({ error: 'Error interno' });
    }
};

// nil_config keys that belong to this endpoint
const NIL_CONFIG_KEYS = [
    'max_intentos_fallidos', 'min_largo_password', 'expiry_sesion',
    'audit_activo', 'audit_mode',
    'titulo_reporte', 'subtitulo_reporte', 'pie_reporte'
];

const NIL_CONFIG_DEFAULTS = {
    max_intentos_fallidos: '5',
    min_largo_password:    '8',
    expiry_sesion:         '8h',
    audit_activo:          '1',
    audit_mode:            'todo',
    titulo_reporte:        '',
    subtitulo_reporte:     '',
    pie_reporte:           ''
};

/**
 * GET /api/admin/empresa
 * Returns all editable config fields (empresa + nil_config) as a flat object.
 */
const getEmpresa = (req, res) => {
    try {
        const db = getAuthDatabase();
        const rows = db.exec(
            'SELECT nombre, cuit, telefono, email, direccion, horario FROM empresas WHERE id = ? LIMIT 1',
            [req.empresaId]
        );
        if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Empresa no encontrada' });
        const [nombre, cuit, telefono, email, direccion, horario] = rows[0].values[0];

        const cfg = getNilConfig(req.empresaId);
        const result = {
            nombre:    nombre    ?? '',
            cuit:      cuit      ?? '',
            telefono:  telefono  ?? '',
            email:     email     ?? '',
            direccion: direccion ?? '',
            horario:   horario   ?? '',
        };
        for (const key of NIL_CONFIG_KEYS) {
            result[key] = key in cfg ? cfg[key] : NIL_CONFIG_DEFAULTS[key] ?? '';
        }
        res.json(result);
    } catch (err) {
        logger.error({ err }, '[ADMIN] getEmpresa error');
        res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * POST /api/admin/empresa
 * Saves empresa fields + nil_config keys from a flat body object.
 */
const updateEmpresa = (req, res) => {
    const body = req.body ?? {};
    const empresaCols = ['nombre', 'cuit', 'telefono', 'email', 'direccion', 'horario'];
    const updates = [];
    const params  = [];

    for (const col of empresaCols) {
        if (col in body) { updates.push(`${col} = ?`); params.push(body[col]); }
    }

    try {
        const db = getAuthDatabase();
        if (updates.length) {
            params.push(req.empresaId);
            db.run(`UPDATE empresas SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        for (const key of NIL_CONFIG_KEYS) {
            if (key in body) setNilConfig(req.empresaId, key, body[key]);
        }
        saveAuthDatabase();
        res.json({ ok: true });
    } catch (err) {
        logger.error({ err }, '[ADMIN] updateEmpresa error');
        res.status(500).json({ error: 'Error interno' });
    }
};

module.exports = { getAdminMenu, getAuditLog, getUsuarios, getEmpresa, updateEmpresa };
