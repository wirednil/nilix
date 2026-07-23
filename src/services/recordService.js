"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findById = findById;
exports.insert = insert;
exports.update = update;
exports.upsert = upsert;
exports.remove = remove;
exports.navigate = navigate;
const database_1 = require("./database");
const schemaService_1 = __importDefault(require("./schemaService"));
function createError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}
function assertTableExists(tableName) {
    if (!schemaService_1.default.tableExists(tableName)) {
        throw createError('TABLE_NOT_FOUND', `Table not found: ${tableName}`);
    }
}
function assertColumnAllowed(tableName, columnName) {
    if (!schemaService_1.default.isColumnAllowed(tableName, columnName)) {
        throw createError('COLUMN_FORBIDDEN', `Column not allowed: ${columnName}`);
    }
}
function isTenantTable(tableName) {
    return schemaService_1.default.hasColumn(tableName, 'empresa_id');
}
function filterValidFields(tableName, data) {
    const tableInfo = schemaService_1.default.getTableInfo(tableName);
    if (!tableInfo)
        return {};
    const validColumns = new Set(tableInfo.map(col => col.name));
    const filtered = {};
    Object.keys(data).forEach(key => {
        if (validColumns.has(key)) {
            filtered[key] = data[key];
        }
    });
    return filtered;
}
// ─── Public API ──────────────────────────────────────────────────────────────
function findById(tableName, keyField, id, empresaId) {
    assertTableExists(tableName);
    assertColumnAllowed(tableName, keyField);
    const db = (0, database_1.getDatabase)();
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
function insert(tableName, data, empresaId) {
    assertTableExists(tableName);
    // Always enforce empresa_id from token — never trust client value
    if (empresaId != null && isTenantTable(tableName)) {
        data = { ...data, empresa_id: empresaId };
    }
    const filteredData = filterValidFields(tableName, data);
    const db = (0, database_1.getDatabase)();
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
        const pkCol = schemaService_1.default.getPrimaryKey(tableName);
        if (pkCol && filteredData[pkCol] == null) {
            const rowidRows = db.exec('SELECT last_insert_rowid()');
            const rowid = rowidRows[0]?.values[0]?.[0];
            if (rowid != null)
                filteredData[pkCol] = rowid;
        }
        (0, database_1.saveDatabase)();
        return { success: true, data: filteredData };
    }
    catch (error) {
        throw createError('INSERT_FAILED', `Insert failed: ${error.message}`);
    }
}
function update(tableName, keyField, id, data, empresaId) {
    assertTableExists(tableName);
    assertColumnAllowed(tableName, keyField);
    const existing = findById(tableName, keyField, id, empresaId);
    if (!existing) {
        throw createError('RECORD_NOT_FOUND', `Record not found: ${keyField}=${id}`);
    }
    const filteredData = filterValidFields(tableName, data);
    const db = (0, database_1.getDatabase)();
    const tenant = empresaId != null && isTenantTable(tableName);
    const fields = Object.keys(filteredData).filter(f => filteredData[f] !== undefined && f !== keyField && f !== 'empresa_id');
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
        (0, database_1.saveDatabase)();
        return findById(tableName, keyField, id, empresaId);
    }
    catch (error) {
        throw createError('UPDATE_FAILED', `Update failed: ${error.message}`);
    }
}
function upsert(tableName, keyField, data, empresaId) {
    assertTableExists(tableName);
    const keyValue = data[keyField];
    if (keyValue === undefined || keyValue === null || keyValue === '') {
        return { ...insert(tableName, data, empresaId), created: true };
    }
    const existing = findById(tableName, keyField, keyValue, empresaId);
    if (existing) {
        return { ...update(tableName, keyField, keyValue, data, empresaId), updated: true };
    }
    else {
        return { ...insert(tableName, data, empresaId), created: true };
    }
}
function remove(tableName, keyField, id, empresaId) {
    assertTableExists(tableName);
    assertColumnAllowed(tableName, keyField);
    const existing = findById(tableName, keyField, id, empresaId);
    if (!existing) {
        throw createError('RECORD_NOT_FOUND', `Record not found: ${keyField}=${id}`);
    }
    const db = (0, database_1.getDatabase)();
    const tenant = empresaId != null && isTenantTable(tableName);
    const sql = tenant
        ? `DELETE FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`
        : `DELETE FROM ${tableName} WHERE ${keyField} = ?`;
    try {
        const stmt = db.prepare(sql);
        stmt.bind(tenant ? [id, empresaId] : [id]);
        stmt.step();
        stmt.free();
        (0, database_1.saveDatabase)();
        return true;
    }
    catch (error) {
        throw createError('DELETE_FAILED', `Delete failed: ${error.message}`);
    }
}
function navigate(tableName, keyField, currentKey, dir, empresaId) {
    assertTableExists(tableName);
    assertColumnAllowed(tableName, keyField);
    const db = (0, database_1.getDatabase)();
    const tenant = empresaId != null && isTenantTable(tableName);
    let sql;
    if (dir === 'next') {
        sql = tenant
            ? `SELECT * FROM ${tableName} WHERE ${keyField} > ? AND empresa_id = ? ORDER BY ${keyField} ASC LIMIT 1`
            : `SELECT * FROM ${tableName} WHERE ${keyField} > ? ORDER BY ${keyField} ASC LIMIT 1`;
    }
    else {
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
//# sourceMappingURL=recordService.js.map