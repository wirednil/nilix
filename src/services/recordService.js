/**
 * @file recordService.js
 * @description CRUD operations for database records
 * @module services/recordService
 */

const { getDatabase, saveDatabase } = require('./database');
const schemaService = require('./schemaService');

function isTenantTable(tableName) {
    return schemaService.hasColumn(tableName, 'empresa_id');
}

function assertColumnAllowed(tableName, columnName) {
    if (!schemaService.isColumnAllowed(tableName, columnName)) {
        const error = new Error(`Column not allowed: ${columnName}`);
        error.code = 'COLUMN_FORBIDDEN';
        throw error;
    }
}

function findById(tableName, keyField, id, empresaId) {
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
    stmt.bind(tenant ? [id, empresaId] : [id]);

    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();

    return result;
}

function filterValidFields(tableName, data) {
    const tableInfo = schemaService.getTableInfo(tableName);
    if (!tableInfo) return {};
    
    const validColumns = tableInfo.map(col => col.name);
    const filtered = {};
    
    Object.keys(data).forEach(key => {
        if (validColumns.includes(key)) {
            filtered[key] = data[key];
        }
    });
    
    return filtered;
}

function insert(tableName, data, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }

    // Always enforce empresa_id from token — never trust client value
    if (empresaId != null && isTenantTable(tableName)) {
        data = { ...data, empresa_id: empresaId };
    }

    const filteredData = filterValidFields(tableName, data);
    
    const db = getDatabase();
    const fields = Object.keys(filteredData).filter(f => filteredData[f] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(f => filteredData[f]);
    
    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    
    try {
        const stmt = db.prepare(sql);
        stmt.bind(values);
        stmt.step();
        stmt.free();

        // Inject auto-generated PK back into result data
        const pkCol = schemaService.getPrimaryKey(tableName);
        if (pkCol && filteredData[pkCol] == null) {
            const rowidRows = db.exec('SELECT last_insert_rowid()');
            const rowid = rowidRows[0]?.values[0]?.[0];
            if (rowid != null) filteredData[pkCol] = rowid;
        }

        saveDatabase();

        return { success: true, data: filteredData };
    } catch (error) {
        const err = new Error(`Insert failed: ${error.message}`);
        err.code = 'INSERT_FAILED';
        throw err;
    }
}

function update(tableName, keyField, id, data, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }
    assertColumnAllowed(tableName, keyField);

    const existing = findById(tableName, keyField, id, empresaId);
    if (!existing) {
        const error = new Error(`Record not found: ${keyField}=${id}`);
        error.code = 'RECORD_NOT_FOUND';
        throw error;
    }

    const filteredData = filterValidFields(tableName, data);
    const db = getDatabase();
    const tenant = empresaId != null && isTenantTable(tableName);

    const fields = Object.keys(filteredData).filter(f =>
        filteredData[f] !== undefined && f !== keyField && f !== 'empresa_id'
    );

    if (fields.length === 0) {
        return existing;
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => filteredData[f]);
    const sql = tenant
        ? `UPDATE ${tableName} SET ${setClause} WHERE ${keyField} = ? AND empresa_id = ?`
        : `UPDATE ${tableName} SET ${setClause} WHERE ${keyField} = ?`;

    try {
        const stmt = db.prepare(sql);
        stmt.bind(tenant ? [...values, id, empresaId] : [...values, id]);
        stmt.step();
        stmt.free();

        saveDatabase();

        return findById(tableName, keyField, id, empresaId);
    } catch (error) {
        const err = new Error(`Update failed: ${error.message}`);
        err.code = 'UPDATE_FAILED';
        throw err;
    }
}

function upsert(tableName, keyField, data, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }

    const keyValue = data[keyField];
    if (keyValue === undefined || keyValue === null || keyValue === '') {
        return { ...insert(tableName, data, empresaId), created: true };
    }

    const existing = findById(tableName, keyField, keyValue, empresaId);

    if (existing) {
        return { ...update(tableName, keyField, keyValue, data, empresaId), updated: true };
    } else {
        return { ...insert(tableName, data, empresaId), created: true };
    }
}

function remove(tableName, keyField, id, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }
    assertColumnAllowed(tableName, keyField);

    const existing = findById(tableName, keyField, id, empresaId);
    if (!existing) {
        const error = new Error(`Record not found: ${keyField}=${id}`);
        error.code = 'RECORD_NOT_FOUND';
        throw error;
    }

    const db = getDatabase();
    const tenant = empresaId != null && isTenantTable(tableName);
    const sql = tenant
        ? `DELETE FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`
        : `DELETE FROM ${tableName} WHERE ${keyField} = ?`;

    try {
        const stmt = db.prepare(sql);
        stmt.bind(tenant ? [id, empresaId] : [id]);
        stmt.step();
        stmt.free();

        saveDatabase();

        return true;
    } catch (error) {
        const err = new Error(`Delete failed: ${error.message}`);
        err.code = 'DELETE_FAILED';
        throw err;
    }
}

function navigate(tableName, keyField, currentKey, dir, empresaId) {
    if (!schemaService.tableExists(tableName)) {
        const error = new Error(`Table not found: ${tableName}`);
        error.code = 'TABLE_NOT_FOUND';
        throw error;
    }
    assertColumnAllowed(tableName, keyField);

    const db = getDatabase();
    const tenant = empresaId != null && isTenantTable(tableName);

    let sql;
    if (dir === 'next') {
        sql = tenant
            ? `SELECT * FROM ${tableName} WHERE ${keyField} > ? AND empresa_id = ? ORDER BY ${keyField} ASC LIMIT 1`
            : `SELECT * FROM ${tableName} WHERE ${keyField} > ? ORDER BY ${keyField} ASC LIMIT 1`;
    } else {
        sql = tenant
            ? `SELECT * FROM ${tableName} WHERE ${keyField} < ? AND empresa_id = ? ORDER BY ${keyField} DESC LIMIT 1`
            : `SELECT * FROM ${tableName} WHERE ${keyField} < ? ORDER BY ${keyField} DESC LIMIT 1`;
    }

    const stmt = db.prepare(sql);
    stmt.bind(tenant ? [currentKey, empresaId] : [currentKey]);

    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();

    return result;
}

module.exports = {
    findById,
    insert,
    update,
    upsert,
    remove,
    navigate
};
