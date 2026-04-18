'use strict';

const express = require('express');
const router  = express.Router();
const { getNilMenu } = require('../controllers/nilController');
const { listSysUsers, listOperadores } = require('../controllers/nilSysController');

const SYSTEM_ROLES = ['wizard', 'admin', 'auditor'];

function requireNilSys(req, res, next) {
    if (!SYSTEM_ROLES.includes(req.rol)) {
        return res.status(403).json({ error: 'Acceso restringido al sistema' });
    }
    next();
}

router.use(requireNilSys);

// Menu
router.get('/menu', getNilMenu);

// Catalog endpoints — feed <in-table url=...> selectors in system forms
// CRUD goes through /api/records/auth/usuarios (standard pipeline)
router.get('/usuarios',   listSysUsers);
router.get('/operadores', listOperadores);

module.exports = router;
