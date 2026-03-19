/**
 * @file handlerService.js
 * @description Loads and caches form handlers dynamically
 * @module services/handlerService
 */

const path = require('path');
const fs = require('fs');

// Fallback: handlers built into nilix (generic/shared handlers)
const coreHandlersDir = path.join(__dirname, '../../handlers');
const handlerCache = new Map();

/**
 * Resolves handler path. Search order:
 *   1. $NIL_APP_DIR/apps/<name>.handler.js
 *   2. $NIL_APP_DIR/apps/<name>.js
 *   3. nilix/handlers/<name>.handler.js  (core fallback)
 *   4. nilix/handlers/<name>.js          (core fallback)
 */
const HANDLER_NAME_RE = /^[a-zA-Z0-9_-]+$/;

function getHandlerPath(handlerName) {
    // Prevent path traversal via handler name (e.g. "../../etc/passwd")
    if (!HANDLER_NAME_RE.test(handlerName)) {
        console.warn(`[HANDLER] Nombre de handler rechazado (path traversal): "${handlerName}"`);
        return null;
    }

    const possibleNames = [
        `${handlerName}.handler.js`,
        `${handlerName}.js`
    ];

    // 1. App dir first (read at call time so NIL_APP_DIR is always current)
    const appDir = process.env.NIL_APP_DIR;
    if (appDir) {
        for (const name of possibleNames) {
            const appPath = path.join(appDir, 'apps', name);
            if (fs.existsSync(appPath)) return appPath;
        }
    }

    // 2. Core handlers fallback
    for (const name of possibleNames) {
        const corePath = path.join(coreHandlersDir, name);
        if (fs.existsSync(corePath)) return corePath;
    }

    return null;
}

function loadHandler(tableName) {
    if (handlerCache.has(tableName)) {
        return handlerCache.get(tableName);
    }
    
    const handlerPath = getHandlerPath(tableName);
    
    if (!handlerPath) {
        return null;
    }
    
    try {
        delete require.cache[require.resolve(handlerPath)];
        const handler = require(handlerPath);
        handlerCache.set(tableName, handler);
        console.log(`✅ Handler loaded: ${tableName}`);
        return handler;
    } catch (error) {
        console.error(`❌ Error loading handler for ${tableName}:`, error.message);
        return null;
    }
}

function validateWithHandler(handler, data) {
    if (!handler || typeof handler.validate !== 'function') {
        return { valid: true, errors: [] };
    }
    
    return handler.validate(data);
}

function transformWithHandler(handler, data, db) {
    if (!handler || typeof handler.beforeSave !== 'function') {
        return data;
    }

    return handler.beforeSave(data, db);
}

function afterSaveWithHandler(handler, data, isInsert) {
    if (!handler || typeof handler.afterSave !== 'function') {
        return;
    }
    
    try {
        handler.afterSave(data, isInsert);
    } catch (error) {
        console.error(`❌ Error in afterSave handler:`, error.message);
    }
}

function beforeDeleteWithHandler(handler, id) {
    if (!handler || typeof handler.beforeDelete !== 'function') {
        return true;
    }
    
    return handler.beforeDelete(id);
}

function afterDeleteWithHandler(handler, id) {
    if (!handler || typeof handler.afterDelete !== 'function') {
        return;
    }
    
    try {
        handler.afterDelete(id);
    } catch (error) {
        console.error(`❌ Error in afterDelete handler:`, error.message);
    }
}

function clearCache() {
    handlerCache.clear();
}

module.exports = {
    loadHandler,
    validateWithHandler,
    transformWithHandler,
    afterSaveWithHandler,
    beforeDeleteWithHandler,
    afterDeleteWithHandler,
    clearCache
};
