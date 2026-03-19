const { getDatabase } = require('./database');
const schemaService = require('./schemaService');

function assertColumnAllowed(tableName, columnName) {
    if (!schemaService.isColumnAllowed(tableName, columnName)) {
        const error = new Error(`Column not allowed: ${columnName}`);
        error.code = 'COLUMN_FORBIDDEN';
        throw error;
    }
}

function isTenantTable(tableName) {
    return schemaService.hasColumn(tableName, 'empresa_id');
}

function getAll(tableName, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }

    const db = getDatabase();
    const tenant = empresaId != null && isTenantTable(tableName);
    const sql = tenant
        ? `SELECT * FROM ${tableName} WHERE empresa_id = ?`
        : `SELECT * FROM ${tableName}`;

    const stmt = db.prepare(sql);
    if (tenant) stmt.bind([empresaId]);

    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();

    return results;
}

function findByKey(tableName, keyField, value, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }

    assertColumnAllowed(tableName, keyField);

    const db = getDatabase();
    const tenant = empresaId != null && isTenantTable(tableName);
    const sql = tenant
        ? `SELECT * FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`
        : `SELECT * FROM ${tableName} WHERE ${keyField} = ?`;

    const stmt = db.prepare(sql);
    stmt.bind(tenant ? [value, empresaId] : [value]);

    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();

    return result;
}

function findByCompositeKey(tableName, keyValues) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }
    
    const db = getDatabase();
    const keys = Object.keys(keyValues);
    const conditions = keys.map(k => `${k} = ?`).join(' AND ');
    const values = keys.map(k => keyValues[k]);
    
    const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE ${conditions}`);
    stmt.bind(values);
    
    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    
    return result;
}

function getTableInfo(tableName) {
    return schemaService.getTableInfo(tableName);
}

module.exports = {
    getAll,
    findByKey,
    findByCompositeKey,
    getTableInfo
};
