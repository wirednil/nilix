/**
 * @file clientLogger.js
 * @description Singleton logger: envía eventos al backend (POST /api/log)
 *   y simultáneamente llama console.* para que DevTools siga funcionando.
 *
 * Uso:
 *   import logger from '../utils/clientLogger.js';
 *   logger.info('SubmitManager', 'Guardando registro tabla=ordenes id=5');
 *   logger.warn('HandlerBridge', 'Respuesta handler sin result');
 *   logger.error('Workspace', 'No se pudo cargar XML', error);
 */

const _queue = [];
let _flushing = false;

async function _flush() {
    if (_flushing || _queue.length === 0) return;
    _flushing = true;

    while (_queue.length > 0) {
        const entry = _queue.shift();
        try {
            await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            });
        } catch {
            // fire-and-forget — never throw, never block UI
        }
    }

    _flushing = false;
}

function _send(level, component, message) {
    _queue.push({ level, component, message });
    // Micro-task flush to batch rapid calls
    Promise.resolve().then(_flush);
}

const logger = {
    info(component, message, _detail) {
        console.log(`[${component}] ${message}`, _detail !== undefined ? _detail : '');
        _send('INFO', component, message);
    },
    warn(component, message, _detail) {
        console.warn(`[${component}] ${message}`, _detail !== undefined ? _detail : '');
        _send('WARN', component, message);
    },
    error(component, message, err) {
        const detail = err instanceof Error
            ? `${err.message}${err.stack ? ' — ' + err.stack.split('\n')[1]?.trim() : ''}`
            : (err !== undefined ? String(err) : '');
        console.error(`[${component}] ${message}`, err !== undefined ? err : '');
        _send('ERROR', component, detail ? `${message} | ${detail}` : message);
    },
};

export default logger;
