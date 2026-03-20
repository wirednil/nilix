/**
 * @file cspReportRoutes.js
 * @description Public endpoint that receives CSP violation reports from browsers.
 *
 * IMPORTANT: Must be mounted BEFORE verifyToken in server.js.
 * Browsers send CSP reports without cookies — auth middleware would always reject them.
 *
 * Content-Type: application/csp-report  (browsers)
 * Content-Type: application/json        (testing tools)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const logger  = require('../services/logger');

/**
 * POST /api/security/csp-report
 * Receives a CSP violation report, logs it as a structured warning, responds 204.
 * No body is returned — browsers ignore the response body.
 */
router.post(
    '/',
    express.json({ type: ['application/json', 'application/csp-report'], limit: '50kb' }),
    (req, res) => {
        const report = req.body?.['csp-report'] ?? req.body ?? {};

        logger.warn({
            blockedUri:        report['blocked-uri']        ?? null,
            violatedDirective: report['violated-directive'] ?? null,
            effectiveDir:      report['effective-directive'] ?? null,
            documentUri:       report['document-uri']       ?? null,
            disposition:       report['disposition']        ?? null,
            // script-sample solo si viene (puede estar vacío)
            ...(report['script-sample'] ? { scriptSample: report['script-sample'] } : {})
        }, '[CSP] Violation reported');

        res.status(204).end();
    }
);

module.exports = router;
