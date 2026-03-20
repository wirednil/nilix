/**
 * @file authHandlerService.js
 * @description Loads engine-internal auth handlers from src/handlers/auth/.
 *   Auth handlers receive (fieldId, value, data, empresaId) — they manage
 *   their own auth.db access via getAuthDatabase(), unlike app handlers
 *   which receive a scopedDb from the app database.
 */

const path = require('path');
const fs   = require('fs');
const logger = require('./logger');

const AUTH_HANDLERS_DIR = path.join(__dirname, '../handlers/auth');
const handlerCache = new Map();

function loadAuthHandler(handlerRef) {
    const name = handlerRef.startsWith('@auth:') ? handlerRef.slice(6) : handlerRef;

    if (handlerCache.has(name)) return handlerCache.get(name);

    const handlerPath = path.join(AUTH_HANDLERS_DIR, `${name}.js`);
    if (!fs.existsSync(handlerPath)) return null;

    try {
        delete require.cache[require.resolve(handlerPath)];
        const handler = require(handlerPath);
        handlerCache.set(name, handler);
        logger.info({ handlerName: name }, '[AUTH_HANDLER] Loaded');
        return handler;
    } catch (error) {
        logger.error({ handlerName: name, err: error }, '[AUTH_HANDLER] Error loading');
        return null;
    }
}

module.exports = { loadAuthHandler };
