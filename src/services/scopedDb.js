"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScopedDb = createScopedDb;
const schemaService_1 = __importDefault(require("./schemaService"));
function isTenantTable(tableName) {
    return schemaService_1.default.hasColumn(tableName, 'empresa_id');
}
function createScopedDb(rawDb, empresaId) {
    return {
        find(table, conditions = {}) {
            const tenant = empresaId != null && isTenantTable(table);
            const all = tenant
                ? { ...conditions, empresa_id: empresaId }
                : { ...conditions };
            const keys = Object.keys(all);
            const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
            const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where} LIMIT 1`);
            if (keys.length)
                stmt.bind(keys.map(k => all[k]));
            let row = null;
            if (stmt.step())
                row = stmt.getAsObject();
            stmt.free();
            return row;
        },
        findAll(table, conditions = {}) {
            const tenant = empresaId != null && isTenantTable(table);
            const all = tenant
                ? { ...conditions, empresa_id: empresaId }
                : { ...conditions };
            const keys = Object.keys(all);
            const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
            const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where}`);
            if (keys.length)
                stmt.bind(keys.map(k => all[k]));
            const rows = [];
            while (stmt.step())
                rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
        },
        insert(table, data) {
            const tenant = empresaId != null && isTenantTable(table);
            const row = tenant
                ? { ...data, empresa_id: empresaId }
                : { ...data };
            const keys = Object.keys(row);
            const stmt = rawDb.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`);
            stmt.bind(keys.map(k => row[k]));
            stmt.step();
            stmt.free();
            const result = rawDb.exec("SELECT last_insert_rowid()");
            return result[0]?.values[0]?.[0];
        },
        exec(sql, params = []) {
            return rawDb.exec(sql, params);
        },
        prepare(sql) {
            return rawDb.prepare(sql);
        }
    };
}
//# sourceMappingURL=scopedDb.js.map