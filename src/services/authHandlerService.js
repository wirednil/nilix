/**
 * @file authHandlerService.js
 * @description Loads engine-internal auth handlers from src/handlers/auth/.
 *   Auth handlers receive (fieldId, value, data, empresaId) — they manage
 *   their own auth.db access via getAuthDatabase(), unlike app handlers
 *   which receive a scopedDb from the app database.
 */

const path = require('path');
const fs   = require('fs');

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
        console.log(`✅ Auth handler loaded: ${name}`);
        return handler;
    } catch (error) {
        console.error(`❌ Error loading auth handler ${name}:`, error.message);
        return null;
    }
}

module.exports = { loadAuthHandler };
