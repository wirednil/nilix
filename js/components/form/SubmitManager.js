/**
 * @file SubmitManager.js
 * @description Manejo de envío de formularios, persistencia y feedback
 */

import PersistenceService from '../../services/PersistenceService.js';
import uiComponents from '../uiComponents/index.js';
import { RADU } from '../../utils/RADU.js';
import logger from '../../utils/clientLogger.js';

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
        const { nav, resetBtn, submitBtn } = uiComponents.createActionButtons();

        if (this.ctx.tableConfig?.keyField) {
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

        resetBtn.onclick = () => formEl.reset();
        formEl.appendChild(nav);

        if (!radu.canWrite()) {
            submitBtn.remove();
            resetBtn.remove();
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

    attachSubmitHandler(formEl, submitBtn) {
        const signal = this.ctx.signal;

        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isValid = formEl.checkValidity();
            if (!isValid) {
                formEl.reportValidity();
                return;
            }

            const firstError = formEl.querySelector('.field-error');
            if (firstError) {
                firstError.focus();
                return;
            }

            const formData = new FormData(formEl);
            const data = {};

            for (let [key, value] of formData.entries()) {
                if (formEl.querySelector(`#${key}`)?.type === 'checkbox') {
                    data[key] = value === 'on';
                } else {
                    data[key] = value;
                }
            }

            // ── Custom action (e.g. login) ────────────────────────────────
            if (this.ctx.formAction) {
                await this._handleCustomAction(this.ctx.formAction, data, formEl, submitBtn);
                return;
            }

            try {
                if (this.ctx.tableConfig) {
                    const RecordService = (await import('../../services/RecordService.js')).default;
                    const LookupService = (await import('../../services/LookupService.js')).default;
                    const { table, keyField, handler } = this.ctx.tableConfig;
                    const keyValue = keyField ? data[keyField] : undefined;
                    logger.info('SubmitManager', `Submit tabla=${table} keyField=${keyField} keyValue=${keyValue ?? '(new)'} handler=${handler ?? 'none'}`);
                    console.log(`📦 Datos enviados:`, { ...data });
                    if (!keyField) {
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
                            handler: this.ctx.tableConfig.handler,
                            crudMode: this.ctx.tableConfig.crudMode
                        }
                    );
                    logger.info('SubmitManager', `Guardado ok tabla=${this.ctx.tableConfig.table} id=${data[this.ctx.tableConfig.keyField] ?? '?'} created=${result.created}`);

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
                    this.showSubmitFeedback(submitBtn, {
                        id: data[this.ctx.tableConfig.keyField],
                        created: isCreated,
                        updated: result.updated
                    });
                } else {
                    const submission = PersistenceService.save(this.ctx.formId, data);
                    console.log(`✅ Formulario guardado con ID: ${submission.id}`);
                    this.showSubmitFeedback(submitBtn, submission);
                }

                setTimeout(() => {
                    this.resetSubmitButton(submitBtn);
                    formEl.reset();
                }, 2000);

            } catch (error) {
                logger.error('SubmitManager', `Error guardando tabla=${this.ctx.tableConfig?.table ?? '?'}`, error);
                alert(`Error al guardar: ${error.message}`);
            }
        }, { signal });
    }

    showSubmitFeedback(submitBtn, submission = null) {
        const originalText = submitBtn.textContent;

        if (submission) {
            if (submission.created) {
                submitBtn.textContent = `¡CREADO! (ID: ${submission.id})`;
            } else if (submission.updated) {
                submitBtn.textContent = `¡ACTUALIZADO! (ID: ${submission.id})`;
            } else {
                const stats = PersistenceService.getStats(this.ctx.formId);
                submitBtn.textContent = `¡GUARDADO! (Total: ${stats.total})`;
            }
        } else {
            submitBtn.textContent = "¡ENVIADO!";
        }

        submitBtn.style.backgroundColor = "#4CAF50";
        submitBtn.style.borderColor = "#4CAF50";
        submitBtn.dataset.originalText = originalText;
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

        try {
            const res = await fetch(action, {
                method: 'POST',
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

            // Success — cookie set by server, redirect to app
            window.location.href = '/';

        } catch (err) {
            this._showFormError(formEl, 'Error de conexión con el servidor');
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'ENVIAR';
        }
    }

    /**
     * Shows an inline error message below the form (no alert()).
     * Reuses existing error element if present.
     */
    _showFormError(formEl, message) {
        let errorEl = formEl.querySelector('.form-action-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'form-action-error';
            errorEl.style.cssText = 'color: var(--error-color, #ff4444); margin-top: 0.5rem; font-family: inherit;';
            formEl.appendChild(errorEl);
        }
        errorEl.textContent = message;
    }
}

export default SubmitManager;
