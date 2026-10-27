/**
 * @file SubmitManager.js
 * @description Manejo de envío de formularios, persistencia y feedback
 */

import PersistenceService from '../../services/PersistenceService.js';
import uiComponents from '../uiComponents/index.js';
import { RADU } from '../../utils/RADU.js';
import logger from '../../utils/clientLogger.js';
import ReportModal from './ReportModal.js';

export class SubmitManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.coordinator = null;
    }

    setCoordinator(vc) {
        this.coordinator = vc;
    }

    addFormActions(formEl) {
        const radu = new RADU(this.ctx.permissions);
        const { nav, submitBtn } = uiComponents.createActionButtons();

        if (this.ctx.tableConfig?.keyField && this.ctx.tableConfig?.table) {
            const antBtn = document.createElement('button');
            antBtn.type = 'button';
            antBtn.textContent = '< ANT';
            antBtn.onclick = () => this.coordinator?.navigateToAdjacent('prev');
            nav.insertBefore(antBtn, nav.firstChild);

            const sigBtn = document.createElement('button');
            sigBtn.type = 'button';
            sigBtn.textContent = 'SIG >';
            sigBtn.onclick = () => this.coordinator?.navigateToAdjacent('next');
            nav.appendChild(sigBtn);
        }

        formEl.appendChild(nav);

        if (!radu.canWrite()) {
            submitBtn.remove();
            setTimeout(() => {
                formEl.querySelectorAll('input, textarea, select').forEach(el => {
                    el.disabled = true;
                });
                // Ocultar botones de edición de multifield
                formEl.querySelectorAll('.multifield-add-btn, .multifield-delete-btn').forEach(el => {
                    el.style.display = 'none';
                });
            }, 0);
            return; // ANT/SIG quedan intactos
        }

        this.attachSubmitHandler(formEl, submitBtn);
    }

    /**
     * El resumen "Faltan…" se va solo cuando ya no queda ningún campo
     * marcado — si no, seguía nombrando campos ya completos. Corre en
     * burbujeo, después de que el propio campo limpió su marca
     * (ValidationCoordinator: 'input'/'change'; Multifield: al agregar fila).
     */
    _dismissSummaryWhenFixed(formEl, summaryId) {
        this._summaryWatch?.abort();
        const watch = this._summaryWatch = new AbortController();
        const signals = [watch.signal, this.ctx.signal].filter(Boolean);
        const opts = { signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0] };
        const check = () => {
            if (formEl.querySelector('.field-error')) return;
            this.ctx.statusBar?.dismiss(summaryId);
            watch.abort();
        };
        ['input', 'change', 'sf:user-change'].forEach(type => formEl.addEventListener(type, check, opts));
    }

    attachSubmitHandler(formEl, submitBtn) {
        const signal = this.ctx.signal;

        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Barrido de required + validaciones custom en un único resumen
            // (ValidationCoordinator.validateAll()) en vez de reportValidity()
            // nativo (un solo globo del navegador) — mismo estilo inline
            // (.error-msg/.field-error) que ya usa el resto del form.
            // formEl.noValidate=true (FormRenderer.js) es lo que permite que
            // este listener llegue a correr con campos required vacíos.
            const invalidFields = this.coordinator?.validateAll() ?? [];
            if (invalidFields.length > 0) {
                const summary = invalidFields.length === 1
                    ? `Falta "${invalidFields[0].label}".`
                    : `Faltan ${invalidFields.length} campos: ${invalidFields.map(f => f.label).join(', ')}.`;
                const summaryId = this.ctx.statusBar?.push('error', summary);
                this._dismissSummaryWhenFixed(formEl, summaryId);
                const first = invalidFields[0];
                (first.el?.querySelector('.multifield-add-btn') ?? document.getElementById(first.fieldId))?.focus();
                return;
            }

            const formData = new FormData(formEl);
            const data = {};

            for (let [key, value] of formData.entries()) {
                if (formEl.querySelector(`#${key}`)?.type === 'checkbox') {
                    // FormData only includes a checkbox when it IS checked — value is irrelevant
                    data[key] = true;
                } else {
                    data[key] = value;
                }
            }

            // FormData omits unchecked checkboxes — explicitly include them as false
            formEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (!(cb.name in data)) data[cb.name] = false;
            });

            // ── Custom action (e.g. login) ────────────────────────────────
            if (this.ctx.formAction) {
                await this._handleCustomAction(this.ctx.formAction, data, formEl, submitBtn);
                return;
            }

            // Mensaje de guardado ok — se vuelve a mostrar en el form redibujado.
            let savedMsg = null;
            // true cuando hay comprobante: el form se redibuja al cerrarlo, no a los 2s.
            let reportsShown = false;
            // Alta → form limpio para cargar el siguiente. Actualización → el
            // registro queda cargado (se sigue navegando desde él con ANT/SIG) y
            // solo vuelve el botón. Antes se reseteaba siempre, y eso corría
            // contra quien navegaba justo después de actualizar (e2e #6).
            let clearAfterSave = true;

            try {
                if (this.ctx.tableConfig) {
                    const RecordService = (await import('../../services/RecordService.js')).default;
                    const LookupService = (await import('../../services/LookupService.js')).default;
                    const { table, keyField, handler } = this.ctx.tableConfig;
                    const keyValue = keyField ? data[keyField] : undefined;
                    logger.info('SubmitManager', `Submit tabla=${table} keyField=${keyField} keyValue=${keyValue ?? '(new)'} handler=${handler ?? 'none'}`);
                    console.log(`📦 Datos enviados:`, { ...data });
                    if (!keyField && !handler) {
                        // Un form con handler puede legítimamente no declarar keyField
                        // del lado cliente — el handler arma su propio registro/ID a
                        // mano (ej. ventas.handler.js). Sin handler, en cambio, sí es
                        // casi siempre un key="true" olvidado en el XML.
                        console.warn(`⚠️  keyField es null — se intentará INSERT. ¿Falta key="true" en el XML?`);
                    }
                    if (!keyValue && keyField) {
                        console.warn(`⚠️  keyValue vacío para keyField="${keyField}" — se intentará INSERT.`);
                    }
                    const result = await RecordService.save(
                        this.ctx.tableConfig.table,
                        this.ctx.tableConfig.keyField,
                        data,
                        {
                            handler:  this.ctx.tableConfig.handler,
                            crudMode: this.ctx.tableConfig.crudMode,
                            db:       this.ctx.tableConfig.db ?? 'app'
                        }
                    );

                    if (this.ctx.tableConfig.handler) {
                        const invalidateTables = result.invalidateTables || [];

                        invalidateTables.forEach(table => {
                            LookupService.invalidateCache(table);
                        });
                        if (invalidateTables.length > 0) {
                            LookupService.forceRefreshOnNextLoad(invalidateTables[0]);
                        }
                    }

                    const isCreated = result.created;
                    clearAfterSave = !!isCreated;
                    const savedData = result.data || data;
                    // Sin keyField declarado client-side (form con handler que arma
                    // su propio ID, ej. ventas.handler.js: data.id = ventaId), 'id'
                    // es el fallback razonable — es la convención de nombre que ese
                    // caso ya usa.
                    const responseKeyField = this.ctx.tableConfig.keyField || 'id';
                    const savedId = savedData[responseKeyField] ?? data[responseKeyField];
                    // savedId, no data[keyField]: en un alta la clave del form
                    // está vacía y el log decía "id=?".
                    logger.info('SubmitManager', `Guardado ok tabla=${this.ctx.tableConfig.table} id=${savedId ?? '?'} created=${result.created}`);
                    savedMsg = this.showSubmitFeedback(submitBtn, {
                        id: savedId,
                        created: isCreated,
                        updated: result.updated
                    });

                    // Notify subform listeners and output reports
                    formEl.dispatchEvent(new CustomEvent('sf:record-saved', {
                        bubbles: true,
                        detail: { data: savedData, created: isCreated }
                    }));

                    // Comprobante(s) de <output>: en un modal sobre el form, no en
                    // otra pestaña. formEl desconectado = subform que ya se cerró
                    // con sf:record-saved (SubformModal/LayoutProcessor).
                    const reports = this._outputReports(result, isCreated);
                    if (reports.length > 0 && formEl.isConnected) {
                        reportsShown = true;
                        new ReportModal().open({
                            title: savedId != null ? `Guardado — N° ${savedId}` : 'Guardado',
                            reports,
                            onClose: () => this._resetForm(formEl, submitBtn, savedMsg),
                        });
                    }
                } else {
                    const submission = PersistenceService.save(this.ctx.formId, data);
                    console.log(`✅ Formulario guardado con ID: ${submission.id}`);
                    savedMsg = this.showSubmitFeedback(submitBtn, submission);
                }

                if (!reportsShown) {
                    setTimeout(() => (clearAfterSave
                        ? this._resetForm(formEl, submitBtn, savedMsg)
                        : this.resetSubmitButton(submitBtn)), 2000);
                }

            } catch (error) {
                // El logger lo registra (consola + log del server) y lo pasa a la
                // barra de estado; el push de abajo lo reemplaza por lo que tiene
                // que leer el usuario. Un rechazo del validate() del handler es
                // esperable (ej. "Las ventas registradas no se modifican") → warn,
                // sin stack; cualquier otra cosa sí es un error.
                const tabla = this.ctx.tableConfig?.table ?? '?';
                if (error.userFacing) {
                    logger.warn('SubmitManager', `Guardado rechazado por el handler tabla=${tabla}: ${error.message}`);
                } else {
                    logger.error('SubmitManager', `Error guardando tabla=${tabla}`, error);
                }
                this.ctx.statusBar?.push('error', error.userFacing
                    ? error.message
                    : `No se pudo guardar: ${error.message}`);
            }
        }, { signal });
    }

    /**
     * Deja el form limpio después de guardar: lo redibuja desde su XML
     * (FormRenderer ctx.reload) — defaults, select de catálogo y multifield
     * vacíos, como recién abierto — con el mensaje de guardado en la barra.
     * formEl.reset() nativo dejaba el valor/overlay de los catálogos y las
     * filas del multifield, y el form parecía no guardado.
     */
    _resetForm(formEl, submitBtn, savedMsg) {
        if (!formEl.isConnected) return; // subform ya cerrado/reemplazado
        if (this.ctx.reload) {
            this.ctx.reload({
                ...(savedMsg ? { initialStatus: { level: 'success', message: savedMsg } } : {}),
                focusFirst: true,
            });
            return;
        }
        this.resetSubmitButton(submitBtn);
        formEl.reset();
    }

    showSubmitFeedback(submitBtn, submission = null) {
        const originalText = submitBtn.textContent;
        let statusMsg;

        if (submission) {
            if (submission.created) {
                submitBtn.textContent = `¡CREADO! (N° ${submission.id})`;
                statusMsg = `Registro N° ${submission.id} creado`;
            } else if (submission.updated) {
                submitBtn.textContent = `¡ACTUALIZADO! (N° ${submission.id})`;
                statusMsg = `Registro N° ${submission.id} actualizado`;
            } else {
                const stats = PersistenceService.getStats(this.ctx.formId);
                submitBtn.textContent = `¡GUARDADO! (Total: ${stats.total})`;
                statusMsg = `Guardado (Total: ${stats.total})`;
            }
        } else {
            submitBtn.textContent = "¡ENVIADO!";
            statusMsg = 'Formulario enviado';
        }

        submitBtn.style.backgroundColor = "#4CAF50";
        submitBtn.style.borderColor = "#4CAF50";
        submitBtn.dataset.originalText = originalText;
        this.ctx.statusBar?.push('success', statusMsg);
        return statusMsg;
    }

    resetSubmitButton(submitBtn) {
        submitBtn.textContent = submitBtn.dataset.originalText || "ENVIAR";
        submitBtn.style.backgroundColor = "";
        submitBtn.style.borderColor = "";
    }

    /**
     * Handles forms with a custom `action` attribute (e.g. /api/auth/login).
     * Posts data as JSON, dispatches on response: success → store session + redirect.
     */
    async _handleCustomAction(action, data, formEl, submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '...';

        // Detect create vs update: if a keyField value exists → PUT /:id
        const keyField = this.ctx.tableConfig?.keyField;
        const keyValue = keyField ? data[keyField] : null;
        const isCrud   = !!keyField;

        let method = 'POST';
        let url    = action;
        if (isCrud && keyValue) {
            method = 'PUT';
            url    = `${action}/${encodeURIComponent(keyValue)}`;
        }

        try {
            const { authFetch } = await import('../../api/client.js');
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const json = await res.json();

            if (!res.ok) {
                this._showFormError(formEl, json.error || 'Error desconocido');
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || 'ENVIAR';
                return;
            }

            // CRUD response (has data property) → show feedback, stay on form
            if (json.data) {
                this.showSubmitFeedback(submitBtn, {
                    id: json.data[keyField],
                    created: json.created,
                    updated: json.updated
                });
                formEl.dispatchEvent(new CustomEvent('sf:record-saved', {
                    bubbles: true,
                    detail: { data: json.data, created: !!json.created }
                }));
                setTimeout(() => {
                    this.resetSubmitButton(submitBtn);
                    submitBtn.disabled = false;
                }, 2000);
                return;
            }

            // Login response → redirect based on rol
            const SYSTEM_ROLES = ['wizard', 'admin', 'auditor'];
            try {
                const check = await fetch('/api/v1/auth/check');
                const s = check.ok ? await check.json() : null;
                window.location.href = SYSTEM_ROLES.includes(s?.rol) ? '/nil-sys' : '/';
            } catch {
                window.location.href = '/';
            }

        } catch (err) {
            this._showFormError(formEl, 'Error de conexión con el servidor');
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'ENVIAR';
        }
    }

    // ── Output reports (post-save) ───────────────────────────────────────────

    /**
     * Reportes de salida de este guardado como [{ report, params }]: el hint
     * del handler (data.__output) tiene prioridad sobre las directivas
     * <output> del XML. Uno sin su parámetro en los datos guardados se omite.
     */
    _outputReports(result, isCreated) {
        const savedData = result.data || {};
        const hints = result.output
            ? [result.output]
            : this._matchOutputs(savedData, isCreated);

        return hints.flatMap(hint => {
            const paramValue = savedData[hint.param];
            if (paramValue == null || paramValue === '') {
                logger.warn('SubmitManager', `Reporte "${hint.report}": falta el parámetro "${hint.param}" en los datos guardados`);
                return [];
            }
            return [{ report: hint.report, params: { [hint.param]: String(paramValue) } }];
        });
    }

    _matchOutputs(data, isCreated) {
        const directives = this.ctx.outputDirectives || [];
        return directives.filter(d => {
            if (d.on === 'create' && !isCreated) return false;
            if (d.condition && !this._evalOutputCondition(d.condition, data)) return false;
            return true;
        });
    }

    _evalOutputCondition(condition, data) {
        if (!condition) return true;
        const m = condition.match(/^(\w+)\s*==\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?))$/);
        if (m) {
            const fieldVal = String(data[m[1]] ?? '');
            const cmpVal = m[2] ?? m[3];
            return fieldVal === cmpVal;
        }
        return true; // unknown condition → allow
    }

    /**
     * Shows an inline error for custom-action forms (e.g. login).
     */
    _showFormError(formEl, message) {
        this.ctx.statusBar?.push('error', message);
    }
}

export default SubmitManager;
