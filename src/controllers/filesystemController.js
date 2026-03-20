const path = require('path');
const fs = require('fs');
const { scanDirectory } = require('../services/filesystemService');
const menuService = require('../services/menuService');
const { getUserPermisos } = require('../services/authDatabase');
const logger = require('../services/logger');

/**
 * Controlador para obtener la estructura de archivos de la carpeta 'forms'.
 * NOTA: La carpeta 'reports' no se muestra en el explorador - es pública.
 */
const getTree = (req, res) => {
    const formsDir = path.join(__dirname, '../../forms');

    const tree = [];

    // Solo escanear forms/ (privado, explorador)
    if (fs.existsSync(formsDir)) {
        tree.push({
            name: 'forms',
            type: 'folder',
            expanded: true,
            children: scanDirectory(formsDir)
        });
    }

    res.json(tree);
};

/**
 * Lista reportes disponibles (para uso público)
 */
const getReports = (req, res) => {
    const reportsDir = path.join(__dirname, '../../reports');
    
    if (!fs.existsSync(reportsDir)) {
        return res.json({ reports: [] });
    }

    const reports = [];
    
    function scanReports(dir, prefix = '') {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanReports(fullPath, prefix ? `${prefix}/${file}` : file);
            } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                reports.push({
                    name: file.replace(/\.(yaml|yml)$/, ''),
                    file: prefix ? `${prefix}/${file}` : file,
                    path: `/reports/${prefix ? `${prefix}/` : ''}${file}`
                });
            }
        });
    }
    
    scanReports(reportsDir);
    res.json({ reports });
};

/**
 * Devuelve el árbol de menú definido en NIL_MENU_FILE (.env)
 */
const getMenu = (req, res) => {
    const menuFile = process.env.NIL_MENU_FILE;
    if (!menuFile || !fs.existsSync(menuFile)) {
        return res.status(404).json({ error: 'NIL_MENU_FILE not configured or not found' });
    }
    try {
        menuService.resetAuthorizedDirs();
        const tree = menuService.parseMenuFile(menuFile);

        // Admin role: full tree with permissions from menu.xml
        if (req.rol === 'admin') {
            return res.json(tree);
        }

        // Non-admin: filter tree using user's permisos string (e.g. 'RA', 'RADU')
        const userPerms = getUserPermisos(req.usuarioId);
        const filtered = menuService.filterMenuByRole(tree, userPerms);
        res.json(filtered);
    } catch (err) {
        logger.error({ err }, '[FS] Error parsing menu.xml');
        res.status(500).json({ error: 'Failed to parse menu file' });
    }
};

/**
 * Sirve el contenido de un archivo autorizado por el menú
 * GET /api/files/content?path=ENCODED_ABSOLUTE_PATH
 */
const getContent = (req, res) => {
    const requestedPath = req.query.path;
    if (!requestedPath) {
        return res.status(400).json({ error: 'Missing path parameter' });
    }

    const resolved = path.resolve(requestedPath);

    if (!menuService.isAuthorizedPath(resolved)) {
        return res.status(403).json({ error: 'Path not authorized' });
    }

    if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const content = fs.readFileSync(resolved, 'utf-8');
        res.type('text/plain').send(content);
    } catch (err) {
        logger.error({ err }, '[FS] Error reading file');
        res.status(500).json({ error: 'Failed to read file' });
    }
};

module.exports = {
    getTree,
    getReports,
    getMenu,
    getContent
};
