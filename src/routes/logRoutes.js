/**
 * @file logRoutes.js
 * @description POST /api/log — recibe eventos del frontend y los escribe a stdout.
 *
 * Montado DESPUÉS de verifyToken → req.usuarioId está disponible.
 * Rate limit simple: máx 30 peticiones por IP por minuto (sin npm).
 */

'use strict';

const express = require('express');
const router  = express.Router();
const logger  = require('../services/logger');

// ── Rate limiter en memoria ────────────────────────────────────────────────────
const _counts = new Map(); // ip → { count, resetAt }
const LIMIT   = 30;
const WINDOW  = 60_000; // 1 minuto

function _isRateLimited(ip) {
    const now = Date.now();
    let entry = _counts.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + WINDOW };
        _counts.set(ip, entry);
    }
    entry.count++;
    return entry.count > LIMIT;
}

// Limpieza periódica para evitar leak de IPs antiguas
setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of _counts) {
        if (now > e.resetAt) _counts.delete(ip);
    }
}, 300_000).unref();

// ── Endpoint ──────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (_isRateLimited(ip)) {
        return res.status(429).json({ error: 'rate_limited' });
    }

    const { level, component, message } = req.body ?? {};

    const validLevels = new Set(['INFO', 'WARN', 'ERROR']);
    const lvl  = validLevels.has(level) ? level : 'INFO';
    const comp = String(component ?? 'client').slice(0, 64);
    const msg  = String(message ?? '').slice(0, 1024);

    const ts      = new Date().toISOString();
    const usuario = req.usuarioId ?? 'anon';
    const empresa = req.empresaId ?? '-';

    const logFn = lvl === 'ERROR' ? 'error' : lvl === 'WARN' ? 'warn' : 'info';
    logger[logFn]({ usuario, empresa, component: comp, ts }, `[CLIENT] ${msg}`);

    res.json({ ok: true });
});

module.exports = router;
