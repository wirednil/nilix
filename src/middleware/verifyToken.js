/**
 * @file verifyToken.js
 * @description Express middleware: verifies JWT from HttpOnly cookie nil_token.
 *   On success: attaches req.empresaId, req.usuarioId, req.rol and calls next().
 *   On failure: responds 401 with a generic message (no token detail leaked).
 *
 * Mount AFTER public routes (e.g. /api/auth) and BEFORE protected routes.
 */

const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../services/authService');
const logger = require('../services/logger');

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
