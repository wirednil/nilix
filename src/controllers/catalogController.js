const catalogService = require('../services/catalogService');
const schemaService = require('../services/schemaService');
const authRecordService = require('../services/authRecordService');
const { getAuthDatabase } = require('../services/authDatabase');

const CACHE_TTL = 86400;

function assertTableAllowed(table, res) {
    if (!schemaService.isTableAllowed(table)) {
        res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Access to table '${table}' is not allowed` } });
        return false;
    }
    return true;
}

function getAuthRows(tableName, empresaId) {
    const db = getAuthDatabase();
    const result = db.exec(
        `SELECT * FROM ${tableName} WHERE empresa_id = ? ORDER BY id`,
        [empresaId]
    );
    if (!result.length || !result[0].values.length) return [];
    const { columns, values } = result[0];
    const hidden = new Set(['password_hash', 'failed_attempts']);
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => { if (!hidden.has(col)) obj[col] = row[i]; });
        return obj;
    });
}

function getTable(req, res) {
    try {
        const { table } = req.params;

        // @auth: prefix → serve from auth.db
        if (table.startsWith('@auth:')) {
            const tableName = table.slice(6);
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const rows = getAuthRows(tableName, req.empresaId);
            return res.json({ table, rows, count: rows.length, timestamp: Date.now(), ttl: CACHE_TTL });
        }

        if (!assertTableAllowed(table, res)) return;
        const rows = catalogService.getAll(table, req.empresaId);
        const serverCount = rows.length;
        const serverTimestamp = Date.now();
        
        const clientCount = req.headers['x-cache-count'] ? parseInt(req.headers['x-cache-count']) : null;
        
        if (clientCount !== null && clientCount === serverCount) {
            return res.status(304).json({
                table,
                unchanged: true,
                count: serverCount,
                timestamp: serverTimestamp
            });
        }
        
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
            table,
            rows,
            count: serverCount,
            timestamp: serverTimestamp,
            ttl: CACHE_TTL
        });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        console.error('CatalogController error:', error);
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function validateKey(req, res) {
    try {
        const { table, keyField, value } = req.params;
        if (!assertTableAllowed(table, res)) return;
        const row = catalogService.findByKey(table, keyField, value, req.empresaId);
        
        res.json({
            valid: !!row,
            row: row || null
        });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        console.error('CatalogController error:', error);
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function getAllowedTables(req, res) {
    try {
        const tables = schemaService.getAllTables();
        res.json({ data: tables });
    } catch (error) {
        console.error('CatalogController error:', error);
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

module.exports = {
    getTable,
    validateKey,
    getAllowedTables
};
