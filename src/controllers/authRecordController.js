const authRecordService = require('../services/authRecordService');
const logger = require('../services/logger');
const { loadAuthHandler } = require('../services/authHandlerService');

const GLOBAL_AUTH_ROLES = new Set(['wizard']);

function authEmpresaId(req) {
    return GLOBAL_AUTH_ROLES.has(req.rol) ? null : req.empresaId;
}

function getRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { keyField, id } = req.query;
        if (!keyField || !id) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField and id are required' } });
        const record = authRecordService.findById(tableName, keyField, id, authEmpresaId(req));
        if (!record) return res.status(404).json({ error: { code: 'RECORD_NOT_FOUND', message: 'Record not found' } });
        return res.json({ data: record });
    } catch (error) {
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

async function createRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { keyField, data, handler: handlerName } = req.body ?? {};
        if (!data) return res.status(400).json({ error: { code: 'MISSING_DATA', message: 'data is required' } });
        if (handlerName?.startsWith('@auth:')) {
            const authHandler = loadAuthHandler(handlerName);
            if (authHandler?.beforeSave) authHandler.beforeSave(data, authEmpresaId(req));
        }
        const result = await authRecordService.upsert(tableName, keyField ?? 'id', data, authEmpresaId(req), req.usuarioId);
        return res.status(201).json({ data: result });
    } catch (error) {
        if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'SELF_DEACTIVATION') {
            return res.status(400).json({ error: { code: error.code, message: error.message } });
        }
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

async function upsertRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { id } = req.params;
        const { keyField, data, handler: handlerName } = req.body ?? {};
        if (!keyField || !data) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField and data are required' } });
        if (handlerName?.startsWith('@auth:')) {
            const authHandler = loadAuthHandler(handlerName);
            if (authHandler?.beforeSave) authHandler.beforeSave(data, authEmpresaId(req));
        }
        data[keyField] = data[keyField] || id;
        const result = await authRecordService.upsert(tableName, keyField, data, authEmpresaId(req), req.usuarioId);
        return result.updated
            ? res.json({ data: result, updated: true })
            : res.status(201).json({ data: result, created: true });
    } catch (error) {
        if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'SELF_DEACTIVATION' || error.code === 'RECORD_NOT_FOUND') {
            return res.status(400).json({ error: { code: error.code, message: error.message } });
        }
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

async function updateRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { id } = req.params;
        const { keyField, data, handler: handlerName } = req.body ?? {};
        if (!keyField || !data) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField and data are required' } });
        if (handlerName?.startsWith('@auth:')) {
            const authHandler = loadAuthHandler(handlerName);
            if (authHandler?.beforeSave) authHandler.beforeSave(data, authEmpresaId(req));
        }
        data[keyField] = data[keyField] || id;
        const result = await authRecordService.upsert(tableName, keyField, data, authEmpresaId(req), req.usuarioId);
        return res.json({ data: result, updated: true });
    } catch (error) {
        if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'SELF_DEACTIVATION') {
            return res.status(400).json({ error: { code: error.code, message: error.message } });
        }
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

function deleteRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { id } = req.params;
        const { keyField } = req.body || req.query;
        if (!keyField) return res.status(400).json({ error: { code: 'MISSING_KEYFIELD', message: 'keyField is required' } });
        authRecordService.remove(tableName, keyField, id, authEmpresaId(req));
        return res.status(204).send();
    } catch (error) {
        if (error.code === 'RECORD_NOT_FOUND') {
            return res.status(404).json({ error: { code: 'RECORD_NOT_FOUND', message: error.message } });
        }
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

function navigateRecord(req, res) {
    try {
        const tableName = req.params.table;
        if (!authRecordService.tableAllowed(tableName)) {
            return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
        }
        const { keyField, current, dir } = req.query;
        if (!keyField || !current || !dir) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField, current and dir are required' } });
        const record = authRecordService.navigate(tableName, keyField, current, dir, authEmpresaId(req));
        if (!record) return res.status(404).json({ error: { code: 'BOUNDARY_REACHED', message: `No ${dir} record found` } });
        return res.json({ data: record });
    } catch (error) {
        logger.error({ err: error }, '[AUTH_RECORD] Controller error');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
}

module.exports = { getRecord, navigateRecord, createRecord, upsertRecord, updateRecord, deleteRecord };
