/**
 * @file FormRenderer.js
 * @description Orquestador delgado que coordina los módulos de formulario
 * @module FormRenderer
 * @version 3.0.0 (Modularizado)
 */

console.log("📝 FormRenderer.js: Cargando imports...");

import { createElement } from '../utils/domUtils.js';
import xmlParser from './xmlParser/index.js';
import uiComponents from './uiComponents/index.js';
import { FormContext } from './form/FormContext.js';
import { LayoutProcessor } from './form/LayoutProcessor.js';
import { ValidationCoordinator } from './form/ValidationCoordinator.js';
import { HandlerBridge } from './form/HandlerBridge.js';
import { SubmitManager } from './form/SubmitManager.js';
import { StatusBar } from './form/StatusBar.js';
import logger from '../utils/clientLogger.js';

class FormRenderer {
    constructor() {
        console.log("📝 FormRenderer: Instancia creada.");
        this.ctx = null;
        // Backward compat: expose these for external access
        this.messages = {};
        this.formId = null;
        this.container = null;
        this.tableConfig = null;
    }

    destroy() {
        if (this.ctx) {
            this.ctx.destroy();
            this.ctx = null;
        }
    }

    render(container, xmlString, options = {}) {
        // Clean up previous form if any
        this.destroy();

        // Build the outer shell first so parse/render errors below have
        // somewhere to be shown instead of failing silently.
        container.innerHTML = '';
        const windowDiv = createElement('div', 'terminal-window');
        container.appendChild(windowDiv);

        const statusBar = new StatusBar();

        try {
            const { formNode, messagesNode, layoutNode } = xmlParser.parseFormXml(xmlString);

            // 1. Create context
            const ctx = new FormContext(formNode, messagesNode, layoutNode);
            ctx.container = container;
            ctx.permissions = options.permissions || null;
            ctx.formPath = options.formPath || null;
            ctx.statusBar = statusBar;
            this.ctx = ctx;

            // Backward compat sync
            this.messages = ctx.messages;
            this.formId = ctx.formId;
            this.container = container;
            this.tableConfig = ctx.tableConfig;

            // 2. Create coordinators
            const validationCoord = new ValidationCoordinator(ctx);
            const handlerBridge = new HandlerBridge(ctx);
            const submitManager = new SubmitManager(ctx);
            submitManager.setCoordinator(validationCoord);

            // 3. Layout processor with field-rendered callback
            const layoutProcessor = new LayoutProcessor(ctx, (fieldXml, fieldId) => {
                validationCoord.attach(fieldXml, fieldId, handlerBridge);
            });

            // 4. Build DOM
            windowDiv.appendChild(
                uiComponents.createHeader({
                    title: ctx.title,
                    database: ctx.database
                })
            );

            // This form's WARN/ERROR logs surface in its own status bar until
            // the next render() (or workspace teardown) aborts ctx.signal.
            logger.setStatusSink((level, _component, message) => {
                statusBar.push(level === 'ERROR' ? 'error' : 'warning', message);
            });
            ctx.signal.addEventListener('abort', () => logger.clearStatusSink(), { once: true });

            const formEl = createElement('form', 'form-vertical');
            layoutProcessor.processLayout(ctx.layoutNode, formEl);
            // Between the fields and the action buttons (ANT/SIG/ENVIAR)
            formEl.appendChild(statusBar.el);
            submitManager.addFormActions(formEl);

            windowDiv.appendChild(formEl);

            // Pre-fill from load= URL (settings forms without keyField)
            if (ctx.formLoad) validationCoord.initLoad();

            // Sync tableConfig back (may have been set by extractFieldConfig)
            this.tableConfig = ctx.tableConfig;

            // Tooltip listeners tied to this form's lifecycle
            const signal = ctx.signal;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.help-icon') && !e.target.closest('.help-tooltip')) {
                    document.querySelectorAll('.help-tooltip').forEach(tooltip => {
                        tooltip.style.display = 'none';
                    });
                }
            }, { signal });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.help-tooltip').forEach(tooltip => {
                        tooltip.style.display = 'none';
                    });
                }
            }, { signal });
        } catch (err) {
            logger.error('FormRenderer', 'Error renderizando formulario', err);
            if (!statusBar.el.isConnected) windowDiv.appendChild(statusBar.el);
            statusBar.push('error', `No se pudo renderizar el formulario: ${err.message}`);
        }
    }
}

export default FormRenderer;
