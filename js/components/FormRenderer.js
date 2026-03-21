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

        const { formNode, messagesNode, layoutNode } = xmlParser.parseFormXml(xmlString);

        // 1. Create context
        const ctx = new FormContext(formNode, messagesNode, layoutNode);
        ctx.container = container;
        ctx.permissions = options.permissions || null;
        ctx.formPath = options.formPath || null;
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
        container.innerHTML = '';
        const windowDiv = createElement('div', 'terminal-window');

        windowDiv.appendChild(
            uiComponents.createHeader({
                title: ctx.title,
                database: ctx.database
            })
        );

        const formEl = createElement('form', 'form-vertical');
        layoutProcessor.processLayout(ctx.layoutNode, formEl);
        submitManager.addFormActions(formEl);

        windowDiv.appendChild(formEl);
        container.appendChild(windowDiv);

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
    }
}

export default FormRenderer;
