/**
 * @file ValidationCoordinator.js
 * @description Validación de campos y lógica de copy-fields centralizada
 */

import * as validator from '../../utils/validator.js';
import ExpressionEngine from '../../utils/ExpressionEngine.js';
import LookupService from '../../services/LookupService.js';

export class ValidationCoordinator {
    constructor(ctx) {
        this.ctx = ctx;
    }

    attach(fieldXml, fieldId, handlerBridge) {
        if (handlerBridge) this._handlerBridge = handlerBridge;

        const inputEl = this.ctx.getField(fieldId) || document.getElementById(fieldId);
        if (!inputEl) {
            console.warn(`⚠️ No se encontró el campo ${fieldId} para validar`);
            return;
        }

        const inTableConfig = this.extractInTableConfig(fieldXml);
        const isKeyField = fieldXml.getAttribute('key') === 'true' || fieldXml.getAttribute('keyField') === 'true';

        const signal = this.ctx.signal;

        inputEl.addEventListener('blur', async () => {
            if (inTableConfig && inputEl.value.trim()) {
                await this.validateInTable(fieldXml, inputEl, inTableConfig);
            } else if (isKeyField && inputEl.value.trim() && this.ctx.tableConfig) {
                await this.loadRecord(inputEl.value);
            } else {
                this.validateFieldValue(fieldXml, inputEl);
            }
        }, { signal });

        inputEl.addEventListener('input', () => {
            this.clearFieldError(fieldId);
        }, { signal });

        inputEl.addEventListener('change', async () => {
            // Skip handler calls during programmatic fillForm to avoid N×callAfter per load
            if (!this._filling && handlerBridge) {
                await handlerBridge.callAfter(fieldId, inputEl.value);
            }
            // Key field changed (e.g. user selected from dropdown) → fill the whole form
            // Guard: skip if value hasn't changed (prevents loop when fillForm re-dispatches change)
            if (isKeyField && inputEl.value.trim() && this.ctx.tableConfig &&
                String(inputEl.value) !== String(this.ctx.currentKey ?? '')) {
                await this.loadRecord(inputEl.value);
            }
        }, { signal });
    }

    extractInTableConfig(fieldXml) {
        const inTableEl = fieldXml.querySelector('validation in-table');
        if (!inTableEl) return null;

        const table = inTableEl.getAttribute('table');
        const key = inTableEl.getAttribute('key');
        if (!table || !key) return null;

        const copyElements = inTableEl.querySelectorAll('copy');
        const copyFields = Array.from(copyElements).map(copy => ({
            from: copy.getAttribute('from'),
            to: copy.getAttribute('to')
        }));

        const isKeyField = fieldXml.getAttribute('key') === 'true' || fieldXml.getAttribute('keyField') === 'true';

        return { table, key, copyFields, isKeyField };
    }

    async validateInTable(fieldXml, inputEl, inTableConfig) {
        const { table, key, copyFields, isKeyField } = inTableConfig;
        const value = inputEl.value.trim();

        try {
            const result = await LookupService.validateAndCopy(table, key, value, copyFields, isKeyField);

            if (!result.valid) {
                validator.showErrorOnField(inputEl.id, `Valor no encontrado en tabla ${table}`);
                inputEl.classList.add('field-error');
            } else if (result.copies) {
                this.applyFieldCopies(result.copies);
            }
        } catch (error) {
            console.error(`❌ Error validating in-table: ${error.message}`);
            this.validateFieldValue(fieldXml, inputEl);
        }
    }

    /**
     * Carga un registro por clave y puebla el formulario (DbToFm).
     * Si el registro no existe (404), no hace nada — el form queda vacío para INSERT.
     */
    async loadRecord(value) {
        const { table, keyField, db = 'app' } = this.ctx.tableConfig;
        if (!table) return;  // url-based form — navigation via dropdown only
        try {
            const { default: RecordService } = await import('../../services/RecordService.js');
            const record = await RecordService.load(table, keyField, value, db);
            if (record) {
                this.ctx.currentKey = value; // set BEFORE fillForm to prevent change-loop
                this.fillForm(record);
                // Single batched request: server runs after() for all fields and returns
                // aggregated enableFields/disableFields — avoids N individual requests
                if (this._handlerBridge) {
                    await this._handlerBridge.callAfterLoad(record);
                }
            }
        } catch {
            // 404 = registro no existe → modo INSERT, no es un error
        }
    }

    async navigateToAdjacent(dir) {
        if (!this.ctx.currentKey || !this.ctx.tableConfig) return;
        const { table, keyField, db = 'app' } = this.ctx.tableConfig;
        const { default: RecordService } = await import('../../services/RecordService.js');
        const record = await RecordService.navigate(table, keyField, this.ctx.currentKey, dir, db);
        if (!record) return; // boundary — noop silencioso
        this.ctx.currentKey = record[keyField]; // set before fillForm
        this.fillForm(record);
        if (this._handlerBridge) {
            await this._handlerBridge.callAfter(keyField, record[keyField]);
        }
    }

    /**
     * Si el form tiene atributo load=URL, lo fetcha y pre-rellena los campos.
     * Llamar después de que el DOM esté construido.
     */
    async initLoad() {
        if (!this.ctx.formLoad) return;
        try {
            const { authFetch } = await import('../../api/client.js');
            const res = await authFetch(this.ctx.formLoad);
            if (!res.ok) return;
            const data = await res.json();
            this.fillForm(data);
        } catch { /* silent — form opens empty if endpoint fails */ }
    }

    /**
     * Puebla todos los campos del formulario con los datos de un registro (DbToFm).
     */
    fillForm(record) {
        this._filling = true;
        try {
            Object.entries(record).forEach(([fieldId, value]) => {
                const field = this.ctx.getField(fieldId) || this.ctx.container?.querySelector(`#${fieldId}`);
                if (!field || value == null) return;
                if (field.type === 'checkbox') {
                    field.checked = value === 1 || value === true || value === '1';
                } else {
                    field.value = value;
                }
                field.dispatchEvent(new Event('change', { bubbles: true }));
            });
        } finally {
            this._filling = false;
        }
    }

    /**
     * Punto único para aplicar copy-fields al formulario
     */
    applyFieldCopies(copies) {
        if (!copies) return;

        Object.entries(copies).forEach(([fieldId, value]) => {
            const field = this.ctx.getField(fieldId) || this.ctx.container?.querySelector(`#${fieldId}`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value === 1 || value === true || value === '1';
                } else {
                    field.value = value;
                }
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    validateFieldValue(fieldXml, inputEl) {
        const formEl = inputEl.closest('form');
        const formContext = formEl ? ExpressionEngine.createContextFromForm(formEl, inputEl.id) : {};

        const result = validator.validateField(fieldXml, inputEl.value, formContext);

        if (!result.isValid && result.message) {
            validator.showErrorOnField(inputEl.id, result.message);
            inputEl.classList.add('field-error');
        }
    }

    clearFieldError(fieldId) {
        const inputEl = this.ctx.getField(fieldId) || document.getElementById(fieldId);
        if (!inputEl) return;

        const container = inputEl.parentElement;
        const errorMsg = container?.querySelector('.error-msg');
        if (errorMsg) errorMsg.remove();

        inputEl.classList.remove('field-error');
    }
}

export default ValidationCoordinator;
