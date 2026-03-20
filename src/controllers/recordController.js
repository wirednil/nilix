/**
 * @file recordController.js
 * @description Controller for CRUD operations
 * @module controllers/recordController
 */

const recordService = require('../services/recordService');
const logger = require('../services/logger');
const schemaService = require('../services/schemaService');
const handlerService = require('../services/handlerService');
const { getDatabase, saveDatabase } = require('../services/database');
const { createScopedDb } = require('../services/scopedDb');
const RADU = require('../utils/radu');
const { getTablePermissions } = require('../services/menuService');
const authRecordService = require('../services/authRecordService');
const { loadAuthHandler } = require('../services/authHandlerService');

// ─── @auth: prefix routing ────────────────────────────────────────────────────
// Forms with database="@auth:tableName" route CRUD to auth.db instead of app DB.
// Example: database="@auth:usuarios" → users are stored in auth.db, tenant-scoped.

function resolveTable(rawTable) {
    if (typeof rawTable === 'string' && rawTable.startsWith('@auth:')) {
        return { isAuth: true, tableName: rawTable.slice(6) };
    }
    return { isAuth: false, tableName: rawTable };
}

function assertTableAllowed(table, res) {
    if (!schemaService.isTableAllowed(table)) {
        res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Access to table '${table}' is not allowed` } });
        return false;
    }
    return true;
}

function assertOperationAllowed(table, operation, res) {
    const permString = getTablePermissions(table);
    if (permString === null) return true; // not in menu → deferred to assertTableAllowed
    if (!RADU(permString)[operation]()) {
        res.status(403).json({ error: { code: 'RADU_FORBIDDEN', message: `Operation not permitted on table '${table}'` } });
        return false;
    }
    return true;
}

function getRecord(req, res) {
    try {
        const { isAuth, tableName } = resolveTable(req.params.table);
        if (isAuth) {
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const { keyField, id } = req.query;
            if (!keyField || !id) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField and id are required' } });
            const record = authRecordService.findById(tableName, keyField, id, req.empresaId);
            if (!record) return res.status(404).json({ error: { code: 'RECORD_NOT_FOUND', message: `Record not found` } });
            return res.json({ data: record });
        }
        const table = req.params.table;
        if (!assertTableAllowed(table, res)) return;
        const { keyField, id } = req.query;
        
        if (!keyField || !id) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'keyField and id query parameters are required'
                }
            });
        }
        
        const record = recordService.findById(table, keyField, id, req.empresaId);
        
        if (!record) {
            return res.status(404).json({
                error: {
                    code: 'RECORD_NOT_FOUND',
                    message: `Record not found in table '${table}' with ${keyField}=${id}`
                }
            });
        }
        
        res.json({ data: record });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'COLUMN_FORBIDDEN') {
            return res.status(403).json({
                error: { code: 'COLUMN_FORBIDDEN', message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

async function createRecord(req, res) {
    try {
        const { isAuth, tableName } = resolveTable(req.params.table);
        if (isAuth) {
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const { keyField, data, handler: handlerName } = req.body ?? {};
            if (!data) return res.status(400).json({ error: { code: 'MISSING_DATA', message: 'data is required' } });
            if (handlerName?.startsWith('@auth:')) {
                const authHandler = loadAuthHandler(handlerName);
                if (authHandler?.beforeSave) authHandler.beforeSave(data, req.empresaId);
            }
            const result = await authRecordService.upsert(tableName, keyField ?? 'id', data, req.empresaId, req.usuarioId);
            return res.status(201).json({ data: result });
        }
        const { table } = req.params;
        if (!assertTableAllowed(table, res)) return;
        if (!assertOperationAllowed(table, 'canAdd', res)) return;
        const { data, handler: handlerName, crudMode } = req.body;
        
        if (!data) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_DATA',
                    message: 'data field is required in request body'
                }
            });
        }
        
        const useHandler = crudMode !== 'direct' && handlerName;
        const handler = useHandler ? handlerService.loadHandler(handlerName) : null;
        
        if (handler) {
            const validation = handlerService.validateWithHandler(handler, data);
            if (!validation.valid) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        errors: validation.errors
                    }
                });
            }
        }
        
        const db = createScopedDb(getDatabase(), req.empresaId);
        const transformedData = handler
            ? handlerService.transformWithHandler(handler, data, db)
            : data;

        if (handler) {
            saveDatabase();
        }

        // Handler devuelve null → manejó todo internamente, omitir CRUD estándar
        if (handler && transformedData === null) {
            handlerService.afterSaveWithHandler(handler, data, false);
            return res.json({ data: {}, updated: true });
        }

        const result = recordService.insert(table, transformedData, req.empresaId);

        if (handler) {
            handlerService.afterSaveWithHandler(handler, result.data, true);
        }

        res.status(201).json({ data: result.data });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'INSERT_FAILED') {
            return res.status(422).json({
                error: { code: 'INSERT_FAILED', message: error.message }
            });
        }
        if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'SELF_DEACTIVATION') {
            return res.status(400).json({
                error: { code: error.code, message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

async function upsertRecord(req, res) {
    try {
        const { isAuth, tableName } = resolveTable(req.params.table);
        if (isAuth) {
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const { keyField, data, handler: handlerName } = req.body ?? {};
            if (!keyField || !data) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField and data are required' } });
            if (handlerName?.startsWith('@auth:')) {
                const authHandler = loadAuthHandler(handlerName);
                if (authHandler?.beforeSave) authHandler.beforeSave(data, req.empresaId);
            }
            const result = await authRecordService.upsert(tableName, keyField, data, req.empresaId, req.usuarioId);
            return result.updated
                ? res.json({ data: result, updated: true })
                : res.status(201).json({ data: result, created: true });
        }
        const { table, id } = req.params;
        if (!assertTableAllowed(table, res)) return;
        const _upsertPerm = getTablePermissions(table);
        if (_upsertPerm !== null) {
            const perm = RADU(_upsertPerm);
            if (!perm.canAdd() && !perm.canUpdate()) {
                return res.status(403).json({ error: { code: 'RADU_FORBIDDEN', message: `Operation not permitted on table '${table}'` } });
            }
        }
        const { keyField, data, handler: handlerName, crudMode } = req.body;
        
        if (!keyField || !data) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'keyField and data are required in request body'
                }
            });
        }
        
        data[keyField] = data[keyField] || id;
        
        const useHandler = crudMode !== 'direct' && handlerName;
        const handler = useHandler ? handlerService.loadHandler(handlerName) : null;
        
        if (handler) {
            const validation = handlerService.validateWithHandler(handler, data);
            if (!validation.valid) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        errors: validation.errors
                    }
                });
            }
        }
        
        const db = createScopedDb(getDatabase(), req.empresaId);
        const transformedData = handler
            ? handlerService.transformWithHandler(handler, data, db)
            : data;

        if (handler) {
            saveDatabase();
        }

        // Handler devuelve null → manejó todo internamente, omitir CRUD estándar
        if (handler && transformedData === null) {
            handlerService.afterSaveWithHandler(handler, data, false);
            return res.json({ data: {}, updated: true });
        }

        const result = recordService.upsert(table, keyField, transformedData, req.empresaId);

        if (handler) {
            handlerService.afterSaveWithHandler(handler, result.data || result, !result.updated);
        }
        
        const invalidateTables = handler?.invalidateTables || [];
        // console.log(`🔄 [BACKEND] Handler: ${handlerName}`);
        // console.log(`🔄 [BACKEND] invalidateTables del handler:`, invalidateTables);
        // console.log(`🔄 [BACKEND] (ANTES: hardcodeado en FormRenderer.js)`);
        
        if (result.updated) {
            res.json({ data: result.data || result, updated: true, invalidateTables });
        } else {
            res.status(201).json({ data: result.data || result, created: true, invalidateTables });
        }
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'SELF_DEACTIVATION' || error.code === 'RECORD_NOT_FOUND') {
            return res.status(400).json({
                error: { code: error.code, message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function updateRecord(req, res) {
    try {
        const { table, id } = req.params;
        if (!assertTableAllowed(table, res)) return;
        if (!assertOperationAllowed(table, 'canUpdate', res)) return;
        const { keyField, data, handler: handlerName, crudMode } = req.body;
        
        if (!keyField || !data) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'keyField and data are required in request body'
                }
            });
        }
        
        const useHandler = crudMode !== 'direct' && handlerName;
        const handler = useHandler ? handlerService.loadHandler(handlerName) : null;
        
        if (handler) {
            const validation = handlerService.validateWithHandler(handler, data);
            if (!validation.valid) {
                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        errors: validation.errors
                    }
                });
            }
        }
        
        const db = createScopedDb(getDatabase(), req.empresaId);
        const transformedData = handler
            ? handlerService.transformWithHandler(handler, data, db)
            : data;

        if (handler) {
            saveDatabase();
        }

        // Handler devuelve null → manejó todo internamente, omitir CRUD estándar
        if (handler && transformedData === null) {
            handlerService.afterSaveWithHandler(handler, data, false);
            return res.json({ data: {}, updated: true });
        }

        const result = recordService.update(table, keyField, id, transformedData, req.empresaId);
        
        if (handler) {
            handlerService.afterSaveWithHandler(handler, result, false);
        }
        
        res.json({ data: result });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'RECORD_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'RECORD_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'UPDATE_FAILED') {
            return res.status(422).json({
                error: { code: 'UPDATE_FAILED', message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function deleteRecord(req, res) {
    try {
        const { isAuth, tableName } = resolveTable(req.params.table);
        if (isAuth) {
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const { id } = req.params;
            const { keyField } = req.body || req.query;
            if (!keyField) return res.status(400).json({ error: { code: 'MISSING_KEYFIELD', message: 'keyField is required' } });
            authRecordService.remove(tableName, keyField, id, req.empresaId);
            return res.status(204).send();
        }
        const { table, id } = req.params;
        if (!assertTableAllowed(table, res)) return;
        if (!assertOperationAllowed(table, 'canDelete', res)) return;
        const { keyField, handler: handlerName, crudMode } = req.body || req.query;
        
        if (!keyField) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_KEYFIELD',
                    message: 'keyField is required'
                }
            });
        }
        
        const useHandler = crudMode !== 'direct' && handlerName;
        const handler = useHandler ? handlerService.loadHandler(handlerName) : null;
        
        if (handler && !handlerService.beforeDeleteWithHandler(handler, id)) {
            return res.status(403).json({
                error: {
                    code: 'DELETE_FORBIDDEN',
                    message: 'Handler prevented deletion of this record'
                }
            });
        }
        
        recordService.remove(table, keyField, id, req.empresaId);
        
        if (handler) {
            handlerService.afterDeleteWithHandler(handler, id);
        }
        
        res.status(204).send();
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        if (error.code === 'RECORD_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'RECORD_NOT_FOUND', message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function navigateRecord(req, res) {
    try {
        const { isAuth, tableName } = resolveTable(req.params.table);
        if (isAuth) {
            if (!authRecordService.tableAllowed(tableName)) {
                return res.status(403).json({ error: { code: 'TABLE_FORBIDDEN', message: `Auth table not accessible: ${tableName}` } });
            }
            const { keyField, current, dir } = req.query;
            if (!keyField || !current || !dir) return res.status(400).json({ error: { code: 'MISSING_PARAMS', message: 'keyField, current and dir are required' } });
            const record = authRecordService.navigate(tableName, keyField, current, dir, req.empresaId);
            if (!record) return res.status(404).json({ error: { code: 'BOUNDARY_REACHED', message: `No ${dir} record found` } });
            return res.json({ data: record });
        }
        const { table } = req.params;
        if (!assertTableAllowed(table, res)) return;
        const { keyField, current, dir } = req.query;

        if (!keyField || !current || !dir) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'keyField, current and dir query parameters are required'
                }
            });
        }

        const record = recordService.navigate(table, keyField, current, dir, req.empresaId);

        if (!record) {
            return res.status(404).json({
                error: {
                    code: 'BOUNDARY_REACHED',
                    message: `No ${dir} record found in '${table}' from ${keyField}=${current}`
                }
            });
        }

        res.json({ data: record });
    } catch (error) {
        if (error.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({
                error: { code: 'TABLE_NOT_FOUND', message: error.message }
            });
        }
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

function getTables(req, res) {
    try {
        const tables = schemaService.getAllTables();
        res.json({ data: tables });
    } catch (error) {
        logger.error({ err: error }, '[RECORD] Controller error');
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
        });
    }
}

module.exports = {
    getRecord,
    navigateRecord,
    createRecord,
    upsertRecord,
    updateRecord,
    deleteRecord,
    getTables
};
