const path = require('path');
const fs = require('fs');
const catalogService = require('../services/catalogService');
const { getAuthDatabase } = require('../services/authDatabase');
const logger = require('../services/logger');

const PUBLIC_REGEX = /^\s*public:\s*true\s*$/m;

function isReportPublic(reportName) {
    const name = reportName.endsWith('.yaml') || reportName.endsWith('.yml')
        ? reportName
        : `${reportName}.yaml`;

    const searchDirs = [
        path.join(__dirname, '../../reports'),
    ];

    if (process.env.NIL_APP_DIR) {
        searchDirs.push(path.join(process.env.NIL_APP_DIR, 'reports'));
    }

    for (const dir of searchDirs) {
        const filePath = path.join(dir, name);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return PUBLIC_REGEX.test(content);
        }
    }

    return false;
}

function resolveEmpresaId(param) {
    if (param == null) return null;
    try {
        const authDb = getAuthDatabase();
        const rows = authDb.exec('SELECT id FROM empresas WHERE public_token = ? LIMIT 1', [param]);
        if (rows.length && rows[0].values.length) return rows[0].values[0][0];
    } catch { /* auth db not ready */ }
    return null;
}

function getTableData(req, res) {
    const { reportName, table } = req.params;

    if (!isReportPublic(reportName)) {
        return res.status(403).json({ error: 'Report is not public' });
    }

    try {
        const empresaId = resolveEmpresaId(req.query.t);
        if (empresaId === null) return res.json({ rows: [] });
        const rows = catalogService.getAll(table, empresaId);
        res.json({ rows });
    } catch (err) {
        if (err.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        logger.error({ err }, '[PUBLIC_REPORT] getTableData error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { getTableData };
