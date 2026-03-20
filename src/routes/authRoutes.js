/**
 * @file authRoutes.js
 * @description Public auth endpoints (no verifyToken middleware).
 *   Must be mounted in server.js BEFORE any protected routes.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const logger = require('../services/logger');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                   // máx 10 intentos por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de login. Intente de nuevo en 15 minutos.' }
});

function parseExpiry(str) {
    const m = str.match(/^(\d+)([smhd])$/);
    if (!m) return 28800;
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(m[1]) * (mult[m[2]] || 3600);
}

/**
 * POST /api/auth/login
 * Body: { usuario, password }
 * Response 200: { ok: true }  — sets HttpOnly cookie nil_token
 * Response 401: { error: string }
 * Response 403: { error: string }  (blocked)
 */
router.post('/login', loginLimiter, async (req, res) => {
    const { usuario, password } = req.body ?? {};

    const result = await authService.login(usuario ?? '', password ?? '');

    if (!result.ok) {
        logger.warn({ errorCode: result.errorCode, usuario }, '[AUTH] Login failed');
        const status = result.errorCode === authService.LoginError.USER_BLOCKED ? 403 : 401;
        return res.status(status).json({ error: result.error });
    }

    logger.info({ usuario }, '[AUTH] Login ok');
    const maxAge = parseExpiry(process.env.NIL_JWT_EXPIRY || '8h');
    res.cookie('nil_token', result.token, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: !!(process.env.NIL_TLS_CERT && process.env.NIL_TLS_KEY),
        maxAge: maxAge * 1000,
        path: '/'
    });
    res.json({ ok: true });
});

/**
 * POST /api/auth/logout
 * Revoca el token actual añadiéndolo a la blacklist y borra la cookie.
 */
router.post('/logout', (req, res) => {
    const token = req.cookies?.nil_token;
    if (!token) return res.status(400).json({ error: 'No hay sesión activa' });
    try {
        const payload = jwt.verify(token, process.env.NIL_JWT_SECRET);
        if (payload.jti) authService.addToBlacklist(payload.jti, payload.exp);
        logger.info({ usuario: payload.usuario }, '[AUTH] Logout');
    } catch { /* token inválido — igual limpiamos */ }
    res.clearCookie('nil_token', { path: '/' });
    res.json({ ok: true });
});

/**
 * GET /api/auth/check
 * Verifica si la cookie nil_token es válida sin pasar por verifyToken.
 * Response 200: { ok: true, usuario, rol }
 * Response 401: { ok: false }
 */
router.get('/check', (req, res) => {
    const token = req.cookies?.nil_token;
    if (!token) return res.status(401).json({ ok: false });
    try {
        const payload = jwt.verify(token, process.env.NIL_JWT_SECRET);
        if (payload.jti && authService.isBlacklisted(payload.jti)) {
            res.clearCookie('nil_token', { path: '/' });
            return res.status(401).json({ ok: false });
        }
        res.json({ ok: true, usuario: payload.usuario, rol: payload.rol, publicToken: payload.publicToken });
    } catch {
        res.clearCookie('nil_token', { path: '/' });
        res.status(401).json({ ok: false });
    }
});

module.exports = router;
