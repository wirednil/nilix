/**
 * @file nilController.js
 * @description System surface endpoints (nil-sys).
 *   Serves the nil-sys.xml menu filtered by the requesting user's permisos.
 *   Accessible to wizard, admin, auditor — NOT to operador.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { parseMenuFile } = require('../services/menuService');
const logger = require('../services/logger');

const NIL_SYS_MENU = path.join(__dirname, '../../sys/nil-sys.xml');

/**
 * Returns true if the user's permisos satisfy all chars in required.
 * e.g. hasPermisos('RAU', 'RADU') → false  (missing D)
 *      hasPermisos('RADU', 'RAU') → true
 *      hasPermisos('R', 'R')      → true
 */
function hasPermisos(userPerms, required) {
    if (!required) return true;
    return [...required.toUpperCase()].every(c => (userPerms ?? '').toUpperCase().includes(c));
}

/**
 * Recursively filter menu items by user permisos.
 * An item without permissions= is visible to all system users.
 */
function filterItems(items, userPerms) {
    return items.reduce((acc, item) => {
        if (item.permissions && !hasPermisos(userPerms, item.permissions)) return acc;
        if (item.children?.length) {
            const children = filterItems(item.children, userPerms);
            acc.push({ ...item, children });
        } else {
            acc.push(item);
        }
        return acc;
    }, []);
}

/**
 * GET /api/nil/menu
 * Returns nil-sys.xml items filtered by req.permisos.
 */
const getNilMenu = (req, res) => {
    if (!fs.existsSync(NIL_SYS_MENU)) {
        return res.json([]);
    }
    try {
        const items    = parseMenuFile(NIL_SYS_MENU);
        const filtered = filterItems(items, req.permisos ?? 'R');
        res.json(filtered);
    } catch (err) {
        logger.error({ err }, '[NIL] getNilMenu error');
        res.status(500).json({ error: 'Error leyendo menú de sistema' });
    }
};

module.exports = { getNilMenu };
