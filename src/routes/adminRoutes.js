/**
 * @file adminRoutes.js
 * @description Admin-only routes. Mounted at /api/admin (after verifyToken).
 *
 * Endpoints:
 *   GET /api/admin/menu        → admin menu items (also authorizes admin dirs)
 *   GET /api/admin/audit-log   → recent audit log for req.empresaId
 *   GET /api/admin/usuarios    → user list for req.empresaId (read-only)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { getAdminMenu, getAuditLog, getUsuarios, getEmpresa, updateEmpresa } = require('../controllers/adminController');

function requireAdmin(req, res, next) {
    if (!['admin', 'wizard'].includes(req.rol)) {
        return res.status(403).json({ error: 'Se requiere rol admin' });
    }
    next();
}

router.use(requireAdmin);

router.get('/menu',      getAdminMenu);
router.get('/audit-log', getAuditLog);
router.get('/usuarios',  getUsuarios);
router.get('/empresa',   getEmpresa);
router.post('/empresa',  updateEmpresa);

module.exports = router;
