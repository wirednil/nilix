const fs = require('fs');
const path = require('path');

/**
 * Escanea recursivamente un directorio y devuelve su estructura en JSON.
 * @param {string} dir - Ruta absoluta del directorio.
 * @returns {Array} Estructura JSON del directorio.
 */
function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    const structure = [];

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            structure.push({
                name: file,
                type: 'folder',
                children: scanDirectory(fullPath)
            });
        } else {
            let action = null;
            if (file.endsWith('.xml')) action = 'renderForm';
            // Los .yaml se muestran pero con info de acceso público

            structure.push({
                name: file,
                type: 'file',
                action: action
            });
        }
    });

    return structure;
}

module.exports = {
    scanDirectory
};
