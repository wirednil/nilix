/**
 * @file handlerController.js
 * @description Controller for handler execution
 * @module controllers/handlerController
 */

const handlerService = require('../services/handlerService');
const { loadAuthHandler } = require('../services/authHandlerService');
const { getDatabase } = require('../services/database');
const { createScopedDb } = require('../services/scopedDb');
const logger = require('../services/logger');

function after(req, res) {
    try {
        const { handler: handlerName } = req.params;
        const { fieldId, value, data } = req.body;

        if (!handlerName || !fieldId) {
            return res.status(400).json({
                error: { code: 'MISSING_PARAMS', message: 'handler and fieldId are required' }
            });
        }

        // @auth: handlers — engine-internal, receive empresaId instead of db
        if (handlerName.startsWith('@auth:')) {
            const handler = loadAuthHandler(handlerName);
            if (!handler) {
                return res.status(404).json({
                    error: { code: 'HANDLER_NOT_FOUND', message: `Auth handler not found: ${handlerName}` }
                });
            }
            if (typeof handler.after !== 'function') return res.json({ result: null });
            const result = handler.after(fieldId, value, data || {}, req.empresaId);
            return res.json({ result });
        }

        // Regular app handler
        const handler = handlerService.loadHandler(handlerName);

        if (!handler) {
            return res.status(404).json({
                error: {
                    code: 'HANDLER_NOT_FOUND',
                    message: `Handler not found: ${handlerName}`
                }
            });
        }

        if (typeof handler.after !== 'function') {
            return res.json({ result: null });
        }

        const db = createScopedDb(getDatabase(), req.empresaId);
        const result = handler.after(fieldId, value, data || {}, db);

        res.json({ result });

    } catch (error) {
        logger.error({ err: error }, '[HANDLER_CTRL] Controller error');
        res.status(500).json({
            error: {
                code: 'HANDLER_ERROR',
                message: error.message
            }
        });
    }
}

function before(req, res) {
    try {
        const { handler: handlerName } = req.params;
        const { fieldId, data } = req.body;
        
        if (!handlerName || !fieldId) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'handler and fieldId are required'
                }
            });
        }
        
        const handler = handlerService.loadHandler(handlerName);
        
        if (!handler) {
            return res.status(404).json({
                error: {
                    code: 'HANDLER_NOT_FOUND',
                    message: `Handler not found: ${handlerName}`
                }
            });
        }
        
        if (typeof handler.before !== 'function') {
            return res.json({ result: { valid: true } });
        }
        
        const db = createScopedDb(getDatabase(), req.empresaId);
        const result = handler.before(fieldId, data || {}, db);

        res.json({ result });
        
    } catch (error) {
        logger.error({ err: error }, '[HANDLER_CTRL] Controller error');
        res.status(500).json({
            error: {
                code: 'HANDLER_ERROR',
                message: error.message
            }
        });
    }
}

function afterField(req, res) {
    try {
        const { handler: handlerName } = req.params;
        const { fieldId, value, data } = req.body;
        
        if (!handlerName || !fieldId) {
            return res.status(400).json({
                error: {
                    code: 'MISSING_PARAMS',
                    message: 'handler and fieldId are required'
                }
            });
        }
        
        const handler = handlerService.loadHandler(handlerName);
        
        if (!handler) {
            return res.status(404).json({
                error: {
                    code: 'HANDLER_NOT_FOUND',
                    message: `Handler not found: ${handlerName}`
                }
            });
        }
        
        if (typeof handler.afterField !== 'function') {
            return res.json({ result: null });
        }
        
        const db = createScopedDb(getDatabase(), req.empresaId);
        const result = handler.afterField(fieldId, value, data || {}, db);

        res.json({ result });
        
    } catch (error) {
        logger.error({ err: error }, '[HANDLER_CTRL] afterField error');
        res.status(500).json({
            error: {
                code: 'HANDLER_ERROR',
                message: error.message
            }
        });
    }
}

module.exports = {
    after,
    before,
    afterField
};
