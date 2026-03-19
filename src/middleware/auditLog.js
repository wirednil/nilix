/**
 * @file auditLog.js
 * @description Middleware de auditoría: registra cada request autenticado con
 *   timestamp, usuario, método, path y status HTTP de la respuesta.
 *
 * Montado DESPUÉS de verifyToken para tener acceso a req.usuarioId / req.rol.
 * Los logs van a stdout — redirigir en producción con PM2 / systemd journald.
 */

function auditLog(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const ms      = Date.now() - start;
        const usuario = req.usuarioId ?? 'anon';
        const empresa = req.empresaId ?? '-';
        const status  = res.statusCode;
        const method  = req.method;
        const path    = req.originalUrl;

        // En TTY (dev directo): solo escrituras y errores para reducir ruido.
        // Sin TTY (piped a archivo vía start.js): loguear todo para traza completa.
        const isTTY     = Boolean(process.stdout.isTTY);
        const shouldLog = !isTTY || method !== 'GET' || status >= 400;
        if (!shouldLog) return;

        const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
        console.log(`[AUDIT] ${level} | ${new Date().toISOString()} | u=${usuario} emp=${empresa} | ${method} ${path} → ${status} (${ms}ms)`);
    });

    next();
}

module.exports = auditLog;
