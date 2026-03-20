/**
 * @file verifyToken.js
 * @description Express middleware: verifies JWT from HttpOnly cookie nil_token.
 *   On success: attaches req.empresaId, req.usuarioId, req.rol and calls next().
 *   On failure: responds 401 with a generic message (no token detail leaked).
 *
 *   Rolling sessions: if the token is within the last 25% of its lifetime,
 *   a new token is issued silently and the cookie is rotated. The client
 *   doesn't need to do anything — sessions stay alive as long as the user
 *   is active.
 *
 * Mount AFTER public routes (e.g. /api/auth) and BEFORE protected routes.
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { isBlacklisted } = require('../services/authService');
const logger = require('../services/logger');

function parseExpiry(str) {
    const m = (str ?? '').match(/^(\d+)([smhd])$/);
    if (!m) return 28800; // default 8h
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(m[1]) * (mult[m[2]] || 3600);
}

function verifyToken(req, res, next) {
    const token = req.cookies?.nil_token;

    if (!token) {
        return res.status(401).json({ error: 'Autenticación requerida' });
    }
    const secret = process.env.NIL_JWT_SECRET;

    try {
        const payload = jwt.verify(token, secret);

        if (payload.jti && isBlacklisted(payload.jti)) {
            logger.warn({ method: req.method, path: req.path }, '[AUTH] Token revocado (logout)');
            return res.status(401).json({ error: 'Sesión cerrada. Volvé a iniciar sesión.' });
        }

        req.empresaId = payload.empresaId;
        req.usuarioId = payload.usuarioId;
        req.rol       = payload.rol;
        req.jti       = payload.jti;

        // ─── Rolling sessions ────────────────────────────────────────────────
        // Refresh the token when < 25% of its lifetime remains.
        // Issues a new JWT + rotates cookie. Old token expires naturally
        // (not blacklisted) to avoid breaking concurrent in-flight requests.
        const expiry        = process.env.NIL_JWT_EXPIRY || '8h';
        const totalLifetime = parseExpiry(expiry);
        const threshold     = Math.floor(totalLifetime * 0.25);
        const now           = Math.floor(Date.now() / 1000);

        if (payload.exp - now < threshold) {
            const newJti  = crypto.randomUUID();
            const newToken = jwt.sign(
                {
                    usuarioId:   payload.usuarioId,
                    empresaId:   payload.empresaId,
                    nombre:      payload.nombre,
                    usuario:     payload.usuario,
                    rol:         payload.rol,
                    publicToken: payload.publicToken,
                    jti:         newJti
                },
                secret,
                { expiresIn: expiry }
            );
            res.cookie('nil_token', newToken, {
                httpOnly: true,
                sameSite: 'Lax',
                secure:   !!(process.env.NIL_TLS_CERT && process.env.NIL_TLS_KEY),
                maxAge:   totalLifetime * 1000,
                path:     '/'
            });
            req.jti = newJti;
            logger.info({ usuario: payload.usuario }, '[AUTH] Rolling session — token rotado');
        }

        next();
    } catch (err) {
        const expired = err.name === 'TokenExpiredError';
        logger.warn({ errName: err.name, method: req.method, path: req.path }, '[AUTH] Token rejected');
        return res.status(401).json({
            error: expired ? 'Sesión expirada, volvé a iniciar sesión' : 'Token inválido'
        });
    }
}

module.exports = verifyToken;
