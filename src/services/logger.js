/**
 * @file logger.js
 * @description Singleton pino logger.
 *
 * En TTY (dev): salida legible via pino-pretty.
 * Sin TTY (producción / piped): JSON estructurado a stdout.
 *
 * Nivel configurable con NIL_LOG_LEVEL (default: 'info').
 * Uso: const logger = require('./logger');
 *      logger.info({ empresaId }, 'mensaje');
 *      logger.error({ err }, 'fallo en X');
 */

'use strict';

const pino = require('pino');

const level = process.env.NIL_LOG_LEVEL ?? 'info';

const transport = process.stdout.isTTY
    ? {
        target: 'pino-pretty',
        options: {
            colorize:      true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore:        'pid,hostname',
        }
    }
    : undefined;

const logger = pino({ level, transport });

module.exports = logger;
