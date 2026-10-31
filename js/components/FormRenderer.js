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

    /**
     * ctx.dirty = la usuaria cambió algo que no se guardó. Cuenta lo mismo
     * que descarta "N° X creado" (input/change de verdad, o sf:user-change de
     * un select o una fila de multifield), salvo el N°: tipearlo es navegar.
     * Lo limpian cargar un registro (ValidationCoordinator) y guardar
     * (SubmitManager). Workspace.js pregunta con esto antes de cambiar de
     * item y antes de cerrar o recargar la pestaña.
     */
    _trackUnsaved(ctx, formEl) {
        const keyField = ctx.tableConfig?.keyField;
        const markDirty = (e) => {
            if (e.type !== 'sf:user-change' && !e.isTrusted) return;
            if (keyField && e.target?.id === keyField) return;
            ctx.dirty = true;
        };
        ['input', 'change', 'sf:user-change'].forEach(type =>
            formEl.addEventListener(type, markDirty, { signal: ctx.signal }));
        // Último control usado: a donde vuelve el foco si la usuaria elige
        // quedarse (un click en el explorador lo dejaba en <body>).
        formEl.addEventListener('focusin', (e) => { ctx.lastFocused = e.target; }, { signal: ctx.signal });
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
            // Vuelve a dibujar este mismo form desde su XML — el form "limpio
            // completo" después de guardar (defaults, catálogos, multifield).
            // formEl.reset() nativo no alcanza: deja el valor/overlay de los
            // select de catálogo y las filas del multifield (ver SubmitManager.js).
            ctx.reload = (extra = {}) => this.render(container, xmlString, { ...options, ...extra });
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
                uiComponents.createHeader({ title: ctx.title })
            );

            // This form's WARN/ERROR logs surface in its own status bar until
            // the next render() (or workspace teardown) aborts ctx.signal.
            logger.setStatusSink((level, _component, message) => {
                statusBar.push(level === 'ERROR' ? 'error' : 'warning', message);
            });
            ctx.signal.addEventListener('abort', () => logger.clearStatusSink(), { once: true });

            const formEl = createElement('form', 'form-vertical');
            // Sin esto, un <button type="submit"> con campos required vacíos
            // nunca llega a disparar 'submit' — el navegador lo bloquea antes
            // y muestra su propio globito nativo. El resumen inline
            // (ValidationCoordinator.validateAll(), ver SubmitManager.js) lo
            // reemplaza, así que la validación nativa tiene que quedar afuera.
            formEl.noValidate = true;
            layoutProcessor.processLayout(ctx.layoutNode, formEl);
            this._trackUnsaved(ctx, formEl);
            // Between the fields and the action buttons (ANT/SIG/ENVIAR)
            formEl.appendChild(statusBar.el);
            submitManager.addFormActions(formEl);
            if (options.initialStatus) {
                const statusId = statusBar.push(options.initialStatus.level, options.initialStatus.message, { sticky: true });
                // "Registro N° X creado" se queda hasta que se empieza a cargar
                // el próximo registro (tipear o elegir en un campo) — si no,
                // quedaba colgado debajo de una venta que ya era otra.
                // Solo un cambio de valor cuenta — no un click en un campo ni
                // abrir una lista. isTrusted: los input/change que dispara el
                // propio render (defaults, copias de catálogo) no cuentan;
                // elegir en un select o agregar una fila de multifield avisan
                // con sf:user-change (Autocomplete.js, Multifield.js).
                const onUserEdit = (e) => {
                    if (e.type !== 'sf:user-change' && !e.isTrusted) return;
                    statusBar.dismiss(statusId);
                };
                ['input', 'change', 'sf:user-change'].forEach(type =>
                    formEl.addEventListener(type, onUserEdit, { signal: ctx.signal }));
            }
            // Después de guardar (SubmitManager._resetForm): el foco al primer
            // campo a completar del form limpio — vacío, editable y que no sea
            // la clave (N°). Si no, quedaba en <body> al cerrar el comprobante.
            if (options.focusFirst) {
                const keyField = ctx.tableConfig?.keyField;
                setTimeout(() => {
                    [...formEl.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), textarea')]
                        .find(el => !el.readOnly && !el.disabled && !el.value && el.id !== keyField && el.offsetParent !== null)
                        ?.focus();
                }, 0);
            }

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
