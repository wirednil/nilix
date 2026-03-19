/**
 * @file scopedDb.js
 * @description ScopedDb — wrapper de sql.js con inyección automática de empresa_id
 *
 * El programador del handler no escribe filtros de tenant — el sistema los
 * aplica automáticamente en tablas que tienen columna empresa_id.
 *
 * API pública:
 *   db.find(table, conditions)     → row | null
 *   db.findAll(table, conditions)  → row[]
 *   db.insert(table, data)         → last_insert_rowid
 *   db.exec(sql, params)           → escape hatch (sin auto-filtering)
 *   db.prepare(sql)                → escape hatch (sin auto-filtering)
 */

const schemaService = require('./schemaService');

function isTenantTable(tableName) {
    return schemaService.hasColumn(tableName, 'empresa_id');
}

function createScopedDb(rawDb, empresaId) {
    return {
        /**
         * Busca una fila por condiciones. Auto-inyecta empresa_id en tablas tenant.
         * @param {string} table
         * @param {object} conditions - { campo: valor, ... }
         * @returns {object|null}
         */
        find(table, conditions = {}) {
            const tenant = empresaId != null && isTenantTable(table);
            const all = tenant ? { ...conditions, empresa_id: empresaId } : { ...conditions };
            const keys = Object.keys(all);
            const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
            const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where} LIMIT 1`);
            if (keys.length) stmt.bind(keys.map(k => all[k]));
            let row = null;
            if (stmt.step()) row = stmt.getAsObject();
            stmt.free();
            return row;
        },

        /**
         * Busca todas las filas por condiciones. Auto-inyecta empresa_id en tablas tenant.
         * @param {string} table
         * @param {object} conditions - { campo: valor, ... }
         * @returns {object[]}
         */
        findAll(table, conditions = {}) {
            const tenant = empresaId != null && isTenantTable(table);
            const all = tenant ? { ...conditions, empresa_id: empresaId } : { ...conditions };
            const keys = Object.keys(all);
            const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
            const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where}`);
            if (keys.length) stmt.bind(keys.map(k => all[k]));
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
        },

        /**
         * Inserta una fila. Auto-inyecta empresa_id en tablas tenant.
         * @param {string} table
         * @param {object} data - { campo: valor, ... }
         * @returns {number} last_insert_rowid
         */
        insert(table, data) {
            const tenant = empresaId != null && isTenantTable(table);
            const row = tenant ? { ...data, empresa_id: empresaId } : { ...data };
            const keys = Object.keys(row);
            const stmt = rawDb.prepare(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
            );
            stmt.bind(keys.map(k => row[k]));
            stmt.step();
            stmt.free();
            return rawDb.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
        },

        /**
         * Escape hatch para SQL complejo (JOINs, subqueries).
         * El programador es responsable del filtro de tenant en este caso.
         */
        exec(sql, params = []) {
            return rawDb.exec(sql, params);
        },

        /**
         * Escape hatch para prepared statements complejos.
         * El programador es responsable del filtro de tenant en este caso.
         */
        prepare(sql) {
            return rawDb.prepare(sql);
        }
    };
}

module.exports = { createScopedDb };
