const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');

// Set of authorized base directories (populated while parsing the menu)
const authorizedDirs = new Set();

// Map of table name → permission string (populated while parsing form entries)
const tablePermissions = new Map();

function parseMenuFile(menuFilePath) {
    const menuDir = path.dirname(path.resolve(menuFilePath));
    authorizedDirs.add(menuDir);

    const raw = fs.readFileSync(menuFilePath, 'utf-8');
    // Strip DOCTYPE to prevent XXE injection (SEC-002)
    const content = raw.replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?>/gi, '');
    const doc = new DOMParser().parseFromString(content, 'text/xml');
    const menuEl = doc.documentElement;

    return parseMenuChildren(menuEl, menuDir);
}

function parseMenuChildren(menuEl, menuDir) {
    const items = [];
    const children = menuEl.childNodes;

    for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.nodeName !== 'option') continue;

        const type = node.getAttribute('type') || 'form';

        if (type === 'separator') {
            const label = node.getAttribute('label') || null;
            items.push({ type: 'separator', label });
            continue;
        }

        const label = node.getAttribute('label') || '';
        const target = node.getAttribute('target') || '';
        const permissions = node.getAttribute('permissions') || 'RADU';
        const resolvedTarget = path.resolve(menuDir, target);

        if (type === 'menu') {
            // Recursive sub-menu
            let children = [];
            if (fs.existsSync(resolvedTarget)) {
                children = parseMenuFile(resolvedTarget);
            }
            items.push({ label, type: 'menu', target: resolvedTarget, permissions, children });
        } else {
            // form or report — register the file's directory as authorized
            authorizedDirs.add(path.dirname(resolvedTarget));
            items.push({ label, type, target: resolvedTarget, permissions });

            if (type === 'form' && fs.existsSync(resolvedTarget)) {
                try {
                    const raw = fs.readFileSync(resolvedTarget, 'utf-8');
                    const formDoc = new DOMParser().parseFromString(raw, 'text/xml');
                    const dbName = formDoc.documentElement.getAttribute('database');
                    if (dbName) {
                        if (tablePermissions.has(dbName)) {
                            // Union: more permissive if multiple forms point to the same table
                            const existing = tablePermissions.get(dbName);
                            const merged = [...new Set([...existing, ...permissions])].join('');
                            tablePermissions.set(dbName, merged);
                        } else {
                            tablePermissions.set(dbName, permissions);
                        }
                    }
                } catch { /* form not readable — ignore */ }
            }
        }
    }

    return items;
}


/**
 * Filters a menu tree applying a single RADU permission string.
 * An item is visible only if the user's permisos covers ALL permissions the item requires.
 * Example: item="RA", userPerms="RA" → visible. item="RADU", userPerms="RA" → hidden.
 *
 * @param {Array}  items     — raw menu tree from parseMenuFile
 * @param {string} userPerms — RADU string from usuarios.permisos (e.g. 'RA', 'RADU')
 * @returns {Array}
 */
function filterMenuByRole(items, userPerms) {
    const result = [];
    for (const item of items) {
        if (item.type === 'separator') {
            result.push(item);
            continue;
        }
        if (item.type === 'menu') {
            const children = filterMenuByRole(item.children || [], userPerms);
            if (children.some(c => c.type !== 'separator')) {
                result.push({ ...item, children });
            }
            continue;
        }
        // Item visible only if user holds every permission the item requires
        if ([...item.permissions].every(c => userPerms.includes(c))) {
            result.push(item);
        }
    }
    return result;
}

function isAuthorizedPath(filePath) {
    const resolved = path.resolve(filePath);
    for (const dir of authorizedDirs) {
        if (resolved.startsWith(dir + path.sep) || resolved === dir) {
            return true;
        }
    }
    return false;
}

function resetAuthorizedDirs() {
    authorizedDirs.clear();
    tablePermissions.clear();
}

function getTablePermissions(tableName) {
    return tablePermissions.get(tableName) ?? null;
}

module.exports = { parseMenuFile, filterMenuByRole, isAuthorizedPath, resetAuthorizedDirs, getTablePermissions };
