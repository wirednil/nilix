const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getTableData } = require('../controllers/publicReportController');

const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
});

router.get('/:reportName/:table', publicLimiter, getTableData);

module.exports = router;
