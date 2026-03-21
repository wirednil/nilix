console.log("🖥️ Workspace.js: Cargando imports...");

import { getFile } from '../api/client.js';
import FormRenderer from './FormRenderer.js';
import logger from '../utils/clientLogger.js';

console.log("✅ Workspace.js: Imports listos.");


const CONFIG = {
    ROOT_PATH: '/opt/user/home/progs/'
};

class Workspace {
    constructor(container, empresa = null) {
        console.log("🖥️ Workspace: Instancia creada.");
        this.container = container;
        this.formRenderer = new FormRenderer();
        this.empresa = empresa;
    }

    /**
     * Carga un item del menú (type=form o type=report)
     * @param {{ type: string, target: string, label: string, permissions: string }} item
     */
    async loadItem(item) {
        logger.info('Workspace', `loadItem type=${item.type} label=${item.label}`);
        this.container.innerHTML = '';

        const pathDisplay = document.createElement('div');
        pathDisplay.className = 'path-display';
        pathDisplay.textContent = `> ${item.target}`;
        this.container.appendChild(pathDisplay);

        if (item.type === 'form') {
            const xmlContent = await getFile(item.target);
            if (xmlContent) {
                const formContainer = document.createElement('div');
                this.container.appendChild(formContainer);
                this.formRenderer.render(formContainer, xmlContent, { permissions: item.permissions, formPath: item.target });
            } else {
                logger.error('Workspace', `No se pudo cargar XML: ${item.target}`);
                this.showError("No se pudo cargar el XML");
            }
        } else if (item.type === 'report') {
            this.showYamlInfo(item.target);
        } else {
            logger.warn('Workspace', `Tipo de item desconocido: "${item.type}"`);
            this.showError(`Tipo de item desconocido: "${item.type}"`);
        }
    }

    // Legacy: kept for backward compatibility
    async loadFile(fileNode, fullPath) {
        console.log("🖥️ LoadFile: Cargando", fileNode.name);
        this.container.innerHTML = '';

        const pathDisplay = document.createElement('div');
        pathDisplay.className = 'path-display';
        pathDisplay.textContent = `> ${CONFIG.ROOT_PATH}${fullPath}`;
        this.container.appendChild(pathDisplay);

        if (fileNode.name.endsWith('.xml')) {
            console.log("🖥️ LoadFile: Es XML, solicitando contenido...");
            const xmlContent = await getFile(fullPath);
            if (xmlContent) {
                const formContainer = document.createElement('div');
                this.container.appendChild(formContainer);
                this.formRenderer.render(formContainer, xmlContent);
            } else {
                this.showError("No se pudo cargar el XML");
            }
        } else if (fileNode.name.endsWith('.yaml') || fileNode.name.endsWith('.yml')) {
            this.showYamlInfo(fullPath);
        } else {
            this.showError(`No viewer installed for extension ".${fileNode.name.split('.').pop()}".`);
        }
    }

    async showYamlInfo(fullPath) {
        const fileName = fullPath.split('/').pop().replace(/\.(yaml|yml)$/, '');

        // Resolver IP real de red (para QR útil fuera de localhost)
        let baseUrl = window.location.origin;
        try {
            const info = await fetch('/api/server-info').then(r => r.json());
            if (info.host) baseUrl = info.host;
        } catch { /* fallback a origin */ }

        const empresaParam = this.empresa != null ? `&t=${this.empresa}` : '';
        const publicUrl = `${baseUrl}/report.html?file=${fileName}${empresaParam}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}&format=png&margin=10`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'terminal-window';
        infoDiv.innerHTML = `
            <div class="window-header">
                <span class="window-title">📄 ${fileName}</span>
            </div>
            <div class="report-preview">
                <p>Enlace público${empresaParam ? ' (filtrado por empresa)' : ''}:</p>
                <div class="report-url-row">
                    <input type="text" class="report-url-input" value="${publicUrl}" readonly>
                    <button type="button" class="report-copy-btn">[ COPIAR ]</button>
                    <button type="button" class="report-preview-btn">[ PREVIEW ]</button>
                </div>
                <div class="report-copy-log"></div>
                <div class="report-actions">
                    <a href="${publicUrl}" target="_blank" class="report-link">
                        [ ABRIR ]
                    </a>
                </div>
                <div class="qr-container">
                    <img src="${qrApiUrl}" alt="QR ${fileName}" class="qr-image" width="200" height="200">
                    <button type="button" class="qr-download-btn">[ DESCARGAR QR ]</button>
                </div>
            </div>
        `;

        infoDiv.querySelector('.report-copy-btn').onclick = async () => {
            const logEl = infoDiv.querySelector('.report-copy-log');
            try {
                await navigator.clipboard.writeText(publicUrl);
                const btn = infoDiv.querySelector('.report-copy-btn');
                const original = btn.textContent;
                btn.textContent = '[ DONE ]';
                setTimeout(() => { btn.textContent = original; }, 1500);
                if (logEl) logEl.textContent = `> Link copied: ${publicUrl}`;
            } catch {
                infoDiv.querySelector('.report-url-input')?.select();
                if (logEl) logEl.textContent = '> Select and copy manually';
            }
        };

        infoDiv.querySelector('.report-preview-btn').onclick = () => {
            const existing = document.getElementById('report-preview-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'report-preview-modal';
            modal.className = 'report-preview-modal';
            modal.innerHTML = `
                <div class="preview-modal-backdrop"></div>
                <div class="preview-modal-frame">
                    <div class="preview-modal-header">
                        <span>PREVIEW — 375×812</span>
                        <button type="button" class="preview-close-btn">[ CERRAR ]</button>
                    </div>
                    <div class="preview-phone-shell">
                        <iframe src="${publicUrl}" class="preview-iframe" title="Preview ${fileName}"></iframe>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('.preview-close-btn').onclick = () => modal.remove();
            modal.querySelector('.preview-modal-backdrop').onclick = () => modal.remove();
        };

        infoDiv.querySelector('.qr-download-btn').onclick = async () => {
            try {
                const res = await fetch(qrApiUrl);
                const blob = await res.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `qr-${fileName}.png`;
                a.click();
                URL.revokeObjectURL(a.href);
            } catch {
                window.open(qrApiUrl, '_blank');
            }
        };

        this.container.appendChild(infoDiv);
    }

    showError(message) {
        console.error("🖥️ Error:", message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'terminal-window';
        errorDiv.innerHTML = `<pre>ERROR: ${message}</pre>`;
        this.container.appendChild(errorDiv);
    }
}

Workspace.ROOT_PATH = CONFIG.ROOT_PATH;

export default Workspace;
