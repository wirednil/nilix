/**
 * @file usersRoutes.js
 * @description User management routes — admin only except /me/password,
 *   tenant-scoped. Mounted at /api/users (after verifyToken middleware).
 *
 * Endpoints:
 *   GET    /api/users              → list users for req.empresaId
 *   POST   /api/users              → create user in req.empresaId
 *   PUT    /api/users/me/password  → self-service password change (any rol)
 *   PUT    /api/users/:id          → update user fields
 *   PUT    /api/users/:id/permisos → replace user's menu permissions
 *   PUT    /api/users/:id/password → admin/wizard password reset (rank-checked)
 *
 * /me/password MUST be registered before /:id/password — Express matches
 * routes in registration order, and /:id/password would otherwise swallow
 * it first with id="me".
 */

const express = require('express');
const router = express.Router();
const {
    listUsers, createUser, updateUser, setUserPermisos,
    changeOwnPassword, resetUserPassword,
} = require('../controllers/usersController');

function requireAdmin(req, res, next) {
    if (!['admin', 'wizard'].includes(req.rol)) {
        return res.status(403).json({ error: 'Se requiere rol admin' });
    }
    next();
}

router.get('/',                requireAdmin, listUsers);
router.post('/',               requireAdmin, createUser);
router.put('/me/password',     changeOwnPassword);
router.put('/:id',             requireAdmin, updateUser);
router.put('/:id/permisos',    requireAdmin, setUserPermisos);
router.put('/:id/password',    requireAdmin, resetUserPassword);

module.exports = router;
