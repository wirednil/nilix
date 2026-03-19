/**
 * @file healthRoutes.js
 * @description GET /api/health — estado del proceso y las bases de datos.
 * Público (montado antes de verifyToken). Usado por balanceadores, monitores y ops.
 *
 * Respuestas:
 *   200 { status: 'ok',       version, uptime, db: 'ok',    authDb: 'ok'    }
 *   503 { status: 'degraded', version, uptime, db: 'error', authDb: 'error' }
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const { getDatabase }     = require('../services/database');
const { getAuthDatabase } = require('../services/authDatabase');
const { version }         = require('../../package.json');

router.get('/', (_req, res) => {
    let dbStatus     = 'ok';
    let authDbStatus = 'ok';

    try {
        getDatabase().exec('SELECT 1');
    } catch {
        dbStatus = 'error';
    }

    try {
        getAuthDatabase().exec('SELECT 1');
    } catch {
        authDbStatus = 'error';
    }

    const ok = dbStatus === 'ok' && authDbStatus === 'ok';

    res.status(ok ? 200 : 503).json({
        status:  ok ? 'ok' : 'degraded',
        version,
        uptime:  Math.floor(process.uptime()),
        db:      dbStatus,
        authDb:  authDbStatus,
    });
});

module.exports = router;
