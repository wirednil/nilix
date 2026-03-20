/**
 * Nilix — server entry point
 */
require('dotenv').config({ quiet: true });

const path = require('path');

// ─── Compat bridge: NIL_COMPAT_SPACE_FORM=1 maps SF_* → NIL_* ───────────────
// Temporary migration aid. Remove once all .env files use NIL_ prefix.
if (process.env.NIL_COMPAT_SPACE_FORM === '1') {
    const sfVars = [
        'SF_PORT', 'SF_DB_FILE', 'SF_AUTH_DB', 'SF_JWT_SECRET', 'SF_JWT_EXPIRY',
        'SF_MENU_FILE', 'SF_APP_DIR', 'SF_ALLOWED_ORIGIN', 'SF_TLS_CERT', 'SF_TLS_KEY'
    ];
    for (const sfKey of sfVars) {
        if (process.env[sfKey] !== undefined) {
            const nilKey = sfKey.replace(/^SF_/, 'NIL_');
            if (process.env[nilKey] === undefined) {
                process.env[nilKey] = process.env[sfKey];
                logger.warn({ sfKey, nilKey }, '[COMPAT] Rename env var to NIL_ prefix');
            }
        }
    }
}

// Derive NIL_APP_DIR from NIL_MENU_FILE if not explicitly set in .env
if (!process.env.NIL_APP_DIR && process.env.NIL_MENU_FILE) {
    process.env.NIL_APP_DIR = path.dirname(path.resolve(process.env.NIL_MENU_FILE));
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./src/services/logger');

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Endpoints públicos sin auth (auth/check, auth/logout, public reports)
const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente en un momento.' } }
});

// API general autenticada (records, catalogs, menu, files, etc.)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente en un momento.' } }
});

// Handlers — ejecutan lógica de negocio, más restrictivo
const handlerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente en un momento.' } }
});
const apiRoutes = require('./src/routes/apiRoutes');
const recordRoutes = require('./src/routes/recordRoutes');
const handlerRoutes = require('./src/routes/handlerRoutes');
const authRoutes = require('./src/routes/authRoutes');
const publicReportRoutes = require('./src/routes/publicReportRoutes');
const cspReportRoutes = require('./src/routes/cspReportRoutes');
const usersRoutes = require('./src/routes/usersRoutes');
const logRoutes    = require('./src/routes/logRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const verifyToken  = require('./src/middleware/verifyToken');
const auditLog = require('./src/middleware/auditLog');
const { initDatabase, closeDatabase } = require('./src/services/database');
const { initAuthDatabase, closeAuthDatabase } = require('./src/services/authDatabase');

const app = express();
const PORT = process.env.NIL_PORT ?? 3000;

app.disable('x-powered-by');

const useHttps = !!(process.env.NIL_TLS_CERT && process.env.NIL_TLS_KEY);
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:             ["'self'"],
            scriptSrc:              ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net", "https://esm.sh"],
            styleSrc:               ["'self'", "'unsafe-inline'"],
            imgSrc:                 ["'self'", "data:", "https://api.qrserver.com"],
            connectSrc:             ["'self'", "https://cdn.jsdelivr.net", "https://esm.sh"],
            workerSrc:              ["'self'", "blob:"],
            fontSrc:                ["'self'"],
            frameAncestors:         ["'none'"],
            baseUri:                ["'self'"],
            formAction:             ["'self'"],
            upgradeInsecureRequests: useHttps ? [] : null, // solo en HTTPS
            reportUri:              '/api/security/csp-report',
        }
    },
    hsts:                    useHttps,   // HSTS solo con HTTPS activo
    crossOriginOpenerPolicy: useHttps ? { policy: 'same-origin' } : false,
    originAgentCluster:      false,
}));
const allowedOrigin = process.env.NIL_ALLOWED_ORIGIN;
if (!allowedOrigin) {
    logger.warn('[CORS] NIL_ALLOWED_ORIGIN no configurado — CORS bloqueado para todos los orígenes externos.');
    logger.warn('[CORS] Definí NIL_ALLOWED_ORIGIN=http://tu-ip:puerto en .env para habilitar acceso desde otros orígenes.');
}
app.use(cors(allowedOrigin ? { origin: allowedOrigin, credentials: true } : { origin: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use('/api/health', healthRoutes);                                    // public — health check, sin rate limit (monitoring)
app.use('/api/auth', publicLimiter, authRoutes);                         // public — login ya tiene su propio limiter interno
app.use('/api/public/report-data', publicLimiter, publicReportRoutes);  // public — report data for public YAMLs
app.use('/api/security/csp-report', publicLimiter, cspReportRoutes);   // public — CSP violation reports (browsers no mandan cookies)

// public — devuelve la IP de red real del servidor (para QR codes)
const os = require('os');
const fs = require('fs');
const https = require('https');

app.get('/api/server-info', (req, res) => {
    const nets = os.networkInterfaces();
    let localIp = null;
    for (const iface of Object.values(nets)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
                break;
            }
        }
        if (localIp) break;
    }
    const proto = (process.env.NIL_TLS_CERT && process.env.NIL_TLS_KEY) ? 'https' : 'http';
    res.json({ host: localIp ? `${proto}://${localIp}:${PORT}` : null });
});
app.use('/api', verifyToken);                            // protected — all /api/* below this
app.use('/api', auditLog);                               // audit log — after token verification
app.use('/api/handler', handlerLimiter, handlerRoutes); // handlers primero — límite estricto (30/min)
app.use('/api', apiLimiter);                             // límite general para el resto de /api/*
app.use('/api', apiRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/log', logRoutes);
// App reports take priority over built-in reports
if (process.env.NIL_APP_DIR) {
    app.use('/reports', express.static(path.join(process.env.NIL_APP_DIR, 'reports')));
}
app.use(express.static(__dirname));

// Global error handler — catches unhandled errors from middleware and routes
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error({ err }, '[ERROR] Unhandled middleware error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

async function startServer() {
    try {
        await initDatabase();
        await initAuthDatabase();
        logger.info('Database initialized');

        const tlsCert = process.env.NIL_TLS_CERT;
        const tlsKey  = process.env.NIL_TLS_KEY;
        const useHttps = tlsCert && tlsKey;

        let server;
        if (useHttps) {
            const tlsOptions = {
                cert: fs.readFileSync(tlsCert),
                key:  fs.readFileSync(tlsKey),
                minVersion: 'TLSv1.2'
            };
            server = https.createServer(tlsOptions, app);
            logger.info('[TLS] HTTPS habilitado (TLS 1.2+)');
        } else {
            server = require('http').createServer(app);
        }

        const proto = useHttps ? 'https' : 'http';
        server.listen(PORT, () => {
            logger.info({ url: `${proto}://localhost:${PORT}` }, 'Nilix server started');
        });
        
        process.on('SIGINT', () => {
            closeDatabase();
            closeAuthDatabase();
            server.close();
            process.exit(0);
        });
    } catch (error) {
        logger.error({ err: error }, 'Failed to start server');
        process.exit(1);
    }
}

// Capturar crashes no manejados — van a stderr, capturados por start.js si se usa
process.on('uncaughtException', err => {
    logger.fatal({ err }, '[FATAL] uncaughtException');
    process.exit(1);
});

process.on('unhandledRejection', reason => {
    logger.fatal({ reason }, '[FATAL] unhandledRejection');
    process.exit(1);
});

startServer();
