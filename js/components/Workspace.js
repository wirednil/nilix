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
            await this.renderReport(item.target);
        } else {
            logger.warn('Workspace', `Tipo de item desconocido: "${item.type}"`);
            this.showError(`Tipo de item desconocido: "${item.type}"`);
        }
    }

    /**
     * Reportes del menú se renderizan en el cuerpo del workspace, igual que
     * un form — antes abrían una tarjeta con QR/link público pensada para
     * compartir hacia afuera (la "carta"/factura de una venta), pero esa se
     * abre siempre por el redirect post-submit de SubmitManager.js, nunca
     * por acá — hoy nada que pase por el menú (Tablero mensual, Por canal)
     * necesita esa tarjeta.
     */
    async renderReport(target) {
        // target es la ruta absoluta del filesystem (igual que item.target
        // para forms, ver loadItem → getFile) — no una URL relativa, así
        // que se pide por el mismo endpoint autenticado que usan los forms,
        // no un fetch directo.
        const yamlContent = await getFile(target);
        if (!yamlContent) {
            logger.error('Workspace', `No se pudo cargar el reporte: ${target}`);
            this.showError('No se pudo cargar el reporte');
            return;
        }

        const { ReportEngine } = await import('./report/ReportEngine.js');
        const { YamlParser } = await import('./report/parsers/YamlParser.js');
        const { resolveReportParams, buildMonthPickerBar } = await import('./report/reportParamHelpers.js');

        let schema;
        try {
            schema = await new YamlParser().parse(yamlContent);
        } catch (err) {
            logger.error('Workspace', `YAML inválido para ${target}`, err);
            this.showError('El reporte tiene un YAML inválido');
            return;
        }

        const windowDiv = document.createElement('div');
        windowDiv.className = 'terminal-window';
        this.container.appendChild(windowDiv);

        const { params, monthParamName } = resolveReportParams(schema, {});

        // Reinstancia ReportEngine en cada cambio de mes a propósito:
        // DataSourceManager cachea por nombre de dataSource dentro de la
        // misma instancia — reusar el engine dejaría pegado el filtro del
        // primer mes elegido.
        const renderWith = async (currentParams) => {
            windowDiv.innerHTML = '';
            if (monthParamName) {
                windowDiv.appendChild(buildMonthPickerBar(currentParams[monthParamName], (newValue) => {
                    renderWith({ ...currentParams, [monthParamName]: newValue });
                }));
            }
            try {
                const engine = new ReportEngine();
                await engine.load(target, yamlContent, this.empresa, currentParams);
                windowDiv.appendChild(await engine.render());
            } catch (err) {
                logger.error('Workspace', `Error renderizando reporte ${target}`, err);
                const errEl = document.createElement('div');
                errEl.className = 'report-error';
                errEl.innerHTML = `<h2>Error al cargar el reporte</h2><p>${err.message}</p>`;
                windowDiv.appendChild(errEl);
            }
        };

        await renderWith(params);
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
