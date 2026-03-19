/**
 * @file schemaService.js
 * @description Dynamic schema validation - no hardcoded tables
 * @module services/schemaService
 */

const { getDatabase } = require('./database');

function tableExists(tableName) {
    const db = getDatabase();
    const stmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    );
    stmt.bind([tableName]);
    const exists = stmt.step();
    stmt.free();
    return exists;
}

function getAllTables() {
    const db = getDatabase();
    const stmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tables = [];
    while (stmt.step()) {
        tables.push(stmt.getAsObject().name);
    }
    stmt.free();
    return tables;
}

function getTableInfo(tableName) {
    if (!tableExists(tableName)) {
        return null;
    }
    const db = getDatabase();
    const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
    const columns = [];
    while (stmt.step()) {
        columns.push(stmt.getAsObject());
    }
    stmt.free();
    return columns;
}

function getPrimaryKey(tableName) {
    const columns = getTableInfo(tableName);
    if (!columns) return null;
    
    const pk = columns.find(c => c.pk === 1);
    return pk ? pk.name : null;
}

function hasColumn(tableName, columnName) {
    const columns = getTableInfo(tableName);
    if (!columns) return false;
    return columns.some(c => c.name === columnName);
}

const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const BLOCKED_TABLES = new Set(['sqlite_master', 'sqlite_sequence', 'sqlite_stat1']);

function isTableAllowed(tableName) {
    return TABLE_NAME_RE.test(tableName) && !BLOCKED_TABLES.has(tableName);
}

function isColumnAllowed(tableName, columnName) {
    if (!TABLE_NAME_RE.test(columnName)) return false;
    const columns = getTableInfo(tableName);
    if (!columns) return false;
    return columns.some(c => c.name === columnName);
}

module.exports = {
    tableExists,
    getAllTables,
    getTableInfo,
    getPrimaryKey,
    hasColumn,
    isTableAllowed,
    isColumnAllowed
};
