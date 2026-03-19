/**
 * @file HandlerBridge.js
 * @description Comunicación con handlers del backend (after-field events)
 */

import { populateRows, appendRowToGrid } from '../fieldRenderer/index.js';
import { authFetch } from '../../api/client.js';
import logger from '../../utils/clientLogger.js';

export class HandlerBridge {
    constructor(ctx) {
        this.ctx = ctx;
    }

    async callAfter(fieldId, value) {
        if (!this.ctx.tableConfig || !this.ctx.tableConfig.handler) {
            return;
        }

        const formData = this.getFormData();

        try {
            const response = await authFetch(`/api/handler/${this.ctx.tableConfig.handler}/after`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId,
                    value,
                    data: formData
                })
            });

            if (!response.ok) return;

            const result = await response.json();

            if (result.result) {
                this._applyResult(result.result);
            }
        } catch (error) {
            logger.error('HandlerBridge', `callAfter field=${fieldId} handler=${this.ctx.tableConfig?.handler}`, error);
        }
    }

    _applyResult(result) {
        if (result.populate) {
            const { field: populateField, rows } = result.populate;
            populateRows(populateField, rows, this.ctx.container);
        }

        if (result.appendRow) {
            const { field, row } = result.appendRow;
            appendRowToGrid(field, row, this.ctx.container);
        }

        if (result.filterSelect) {
            const { field, rows } = result.filterSelect;
            const targetInput = this.ctx.container?.querySelector(`#${field}`);
            if (targetInput) {
                targetInput.dispatchEvent(new CustomEvent('sf:set-catalog', { detail: { rows } }));
            }
        }

        if (result.enableFields) {
            result.enableFields.forEach(id => this._setReadonly(id, false));
        }

        if (result.disableFields) {
            result.disableFields.forEach(id => this._setReadonly(id, true));
        }

        if (result.setValues) {
            Object.entries(result.setValues).forEach(([id, value]) => {
                const field = this.ctx.getField(id) || this.ctx.container?.querySelector(`#${id}`);
                if (field) {
                    field.value = value;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
    }

    _setReadonly(id, readonly) {
        const field = this.ctx.getField(id) || this.ctx.container?.querySelector(`#${id}`);
        if (!field) return;

        field.readOnly = readonly;
        if (readonly) {
            field.classList.add('readonly-field');
        } else {
            field.classList.remove('readonly-field');
        }
    }

    getFormData() {
        const formEl = this.ctx.container?.querySelector('form');
        if (!formEl) return {};

        const formData = new FormData(formEl);
        const data = {};

        for (let [key, value] of formData.entries()) {
            const field = formEl.querySelector(`#${key}`);
            if (field?.type === 'checkbox') {
                data[key] = value === 'on';
            } else {
                data[key] = value;
            }
        }

        return data;
    }
}

export default HandlerBridge;
