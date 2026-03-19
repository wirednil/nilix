/**
 * @file usersRoutes.js
 * @description User management routes — admin only, tenant-scoped.
 *   Mounted at /api/users (after verifyToken middleware).
 *
 * Endpoints:
 *   GET    /api/users              → list users for req.empresaId
 *   POST   /api/users              → create user in req.empresaId
 *   PUT    /api/users/:id          → update user fields
 *   PUT    /api/users/:id/permisos → replace user's menu permissions
 */

const express = require('express');
const router = express.Router();
const { listUsers, createUser, updateUser, setUserPermisos } = require('../controllers/usersController');

function requireAdmin(req, res, next) {
    if (req.rol !== 'admin') {
        return res.status(403).json({ error: 'Se requiere rol admin' });
    }
    next();
}

router.get('/',                requireAdmin, listUsers);
router.post('/',               requireAdmin, createUser);
router.put('/:id',             requireAdmin, updateUser);
router.put('/:id/permisos',    requireAdmin, setUserPermisos);

module.exports = router;
