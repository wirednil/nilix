/**
 * @file LayoutProcessor.js
 * @description Procesamiento recursivo de XML layout → DOM
 */

import { createElement } from '../../utils/domUtils.js';
import {
    renderInputField,
    renderCheckbox,
    renderMultifield
} from '../fieldRenderer/index.js';
import ExpressionEngine from '../../utils/ExpressionEngine.js';

export class LayoutProcessor {
    constructor(ctx, onFieldRendered) {
        this.ctx = ctx;
        this.onFieldRendered = onFieldRendered;
    }

    processLayout(layoutNode, parentContainer) {
        if (!layoutNode) return;

        Array.from(layoutNode.children).forEach(child => {
            this.processNode(child, parentContainer);
        });
    }

    processNode(xmlNode, parentContainer) {
        const tagName = xmlNode.tagName.toUpperCase();

        switch (tagName) {
            case 'CONTAINER':
                this.renderContainer(xmlNode, parentContainer);
                break;
            case 'BORDER':
                this.renderBorder(xmlNode, parentContainer);
                break;
            case 'FIELD':
                this.renderField(xmlNode, parentContainer);
                break;
            case 'BUTTON':
                this.renderButton(xmlNode, parentContainer);
                break;
            default:
                console.warn(`⚠️ Nodo desconocido: ${tagName}`);
        }
    }

    renderContainer(containerNode, parentContainer) {
        const type = containerNode.getAttribute('type');
        const wrapper = createElement('div',
            type === 'horizontal' ? 'horizontal-container' : 'vertical-container'
        );

        if (type === 'horizontal') {
            wrapper.style.gap = '0.5rem';
        }

        parentContainer.appendChild(wrapper);

        Array.from(containerNode.children).forEach(child => {
            this.processNode(child, wrapper);
        });
    }

    renderBorder(borderNode, parentContainer) {
        const borderBox = createElement('div', 'border-box');
        parentContainer.appendChild(borderBox);

        Array.from(borderNode.children).forEach(child => {
            this.processNode(child, borderBox);
        });
    }

    renderField(fieldXml, parentContainer) {
        const config = this.extractFieldConfig(fieldXml, parentContainer);

        if (config.type === 'multifield') {
            renderMultifield(fieldXml, parentContainer, config, this.ctx.messages);
            return;
        }

        if (config.type === 'checkbox') {
            renderCheckbox(config, parentContainer);
        } else {
            renderInputField(config, this.ctx.messages, parentContainer, this.ctx.container, { signal: this.ctx.signal });
        }

        // Register field in context
        setTimeout(() => {
            const el = document.getElementById(config.id);
            if (el) {
                this.ctx.registerField(config.id, el);
                if (config.isExpression) {
                    this.setupIsExpression(el, config.isExpression);
                }
                if (config.subformConfig) {
                    this.setupSubformTrigger(el, config.subformConfig);
                }
            }
            if (this.onFieldRendered) {
                this.onFieldRendered(fieldXml, config.id);
            }
        }, 0);
    }

    renderButton(btnNode, parentContainer) {
        const action = btnNode.getAttribute('action');
        const label  = btnNode.getAttribute('label') || btnNode.textContent.trim() || 'Acción';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'form-action-btn';
        btn.textContent = label;

        if (action === 'print-report') {
            const report = btnNode.getAttribute('report');
            const param  = btnNode.getAttribute('param');
            btn.addEventListener('click', () => {
                const formEl = btn.closest('form') || this.ctx.container?.querySelector('form');
                const paramEl = formEl?.querySelector(`[name="${param}"], #${param}`);
                const paramValue = paramEl?.value ?? this.ctx.currentKey ?? '';
                if (!paramValue) {
                    console.warn(`[LayoutProcessor] print-report: param "${param}" vacío`);
                    return;
                }
                const url = `/report.html?file=${encodeURIComponent(report)}&${encodeURIComponent(param)}=${encodeURIComponent(paramValue)}`;
                window.open(url, '_blank');
            });
        }

        parentContainer.appendChild(btn);
    }

    /**
     * Configura un campo virtual cuyo valor se computa desde una expresión is=
     * @param {HTMLInputElement} el - El elemento input del campo
     * @param {string} expr - Expresión aritmética o agregado (ej: "precio*cantidad", "sum(importe)")
     */
    setupIsExpression(el, expr) {
        el.readOnly = true;
        el.classList.add('computed-field');

        const formEl = el.closest('form');
        if (!formEl) return;

        const signal = this.ctx.signal;

        const recompute = () => {
            try {
                const context = {};
                formEl.querySelectorAll('input[name], select[name], textarea[name]').forEach(field => {
                    if (field === el) return;
                    context[field.name] = parseFloat(field.value) || 0;
                });
                const result = ExpressionEngine.evaluateArithmetic(expr, context);
                if (typeof result === 'number') {
                    el.value = Number.isInteger(result) ? String(result) : result.toFixed(2);
                } else {
                    el.value = String(result ?? '');
                }
            } catch (e) {
                console.error('❌ computed field error:', expr, e);
            }
        };

        formEl.addEventListener('input',  recompute, { signal });
        formEl.addEventListener('change', recompute, { signal });
        formEl.addEventListener('multifield-populated', recompute, { signal });

        // Cálculo inicial
        recompute();
    }

    extractFieldConfig(fieldXml, parentContainer) {
        try {
            const parentIsHorizontal = parentContainer.classList.contains('horizontal-container');
            const skipAttr = fieldXml.getAttribute('skip') || fieldXml.querySelector('attributes > skip')?.textContent;

            let helpId = fieldXml.querySelector('attributes help')?.textContent;
            if (!helpId) {
                helpId = fieldXml.querySelector('help')?.textContent;
            }

            let defaultValue = fieldXml.querySelector('attributes default')?.textContent;
            if (!defaultValue) {
                defaultValue = fieldXml.querySelector('default')?.textContent;
            }

            let type = fieldXml.getAttribute('type') || 'text';
            let selectOptions = null;
            let lookupConfig = null;

            const inTableEl = fieldXml.querySelector('validation in-table') ||
                             fieldXml.querySelector('in-table');

            if (type === 'select' && inTableEl) {
                const copyFields = inTableEl.querySelectorAll('copy');
                const isKeyField = fieldXml.getAttribute('key') === 'true' || fieldXml.getAttribute('keyField') === 'true';

                const filterBy    = inTableEl.getAttribute('filter-by') || null;
                const filterField = inTableEl.getAttribute('filter-field') || filterBy;

                lookupConfig = {
                    table: inTableEl.getAttribute('table'),
                    key: inTableEl.getAttribute('key'),
                    displayField: inTableEl.getAttribute('display') || inTableEl.getAttribute('key'),
                    copyFields: [],
                    isKeyField,
                    filterBy,
                    filterField
                };

                copyFields.forEach(copy => {
                    lookupConfig.copyFields.push({
                        from: copy.getAttribute('from'),
                        to: copy.getAttribute('to')
                    });
                });

                if (!this.ctx.tableConfig) {
                    this.ctx.tableConfig = {
                        table: lookupConfig.table,
                        keyField: lookupConfig.key
                    };
                } else if (isKeyField) {
                    // Field marked as keyField — update even if tableConfig already exists
                    this.ctx.tableConfig.keyField = lookupConfig.key;
                }

                type = 'dynamic-select';
            }
            else if (type === 'select') {
                const optionsXml = fieldXml.querySelectorAll('options > option');
                if (optionsXml.length > 0) {
                    selectOptions = Array.from(optionsXml).map(opt => ({
                        value: opt.getAttribute('value'),
                        textContent: opt.textContent.trim()
                    }));
                }
            }

            const subformEl = fieldXml.querySelector('subform');
            const subformConfig = subformEl ? {
                triggerValue: subformEl.getAttribute('trigger-value'),
                form: subformEl.getAttribute('form'),
                onSave: subformEl.getAttribute('on-save') || null,
                inherit: subformEl.getAttribute('inherit') || null
            } : null;

            return {
                id: fieldXml.getAttribute('id') || `field-${Date.now()}`,
                labelTxt: fieldXml.getAttribute('label') || '',
                type,
                size: fieldXml.getAttribute('size'),
                isRequired: fieldXml.querySelector('validation > required')?.textContent === 'true' ||
                           fieldXml.querySelector('validation')?.getAttribute('required') === 'true',
                isSkip: skipAttr === 'true',
                defaultValue,
                parentIsHorizontal,
                helpId,
                align: fieldXml.getAttribute('align'),
                rows: fieldXml.getAttribute('rows'),
                display: fieldXml.getAttribute('display'),
                selectOptions,
                lookupConfig,
                isExpression: fieldXml.getAttribute('is') || null,
                subformConfig
            };
        } catch (error) {
            console.error('❌ Error extrayendo configuración del campo:', error);
            throw new Error(`Campo XML mal formado: ${fieldXml.outerHTML}`);
        }
    }

    /**
     * Abre un subformulario modal cuando el campo toma un valor específico.
     * Al guardar en el subform, invalida el catálogo del padre y resetea el selector.
     */
    setupSubformTrigger(el, subformConfig) {
        const signal = this.ctx.signal;

        el.addEventListener('change', async () => {
            if (el.value !== subformConfig.triggerValue) return;

            // Recolectar valores a heredar del form padre
            const inheritedValues = {};
            if (subformConfig.inherit) {
                const parentForm = el.closest('form') || this.ctx.container;
                subformConfig.inherit.split(',').forEach(fieldId => {
                    const parentField = parentForm?.querySelector(`#${fieldId.trim()}`);
                    if (parentField?.value) inheritedValues[fieldId.trim()] = parentField.value;
                });
            }

            const formPath = this.ctx.formPath || '';
            const baseDir = formPath.replace(/\/[^/]+$/, '');
            const subformPath = baseDir
                ? `${baseDir}/${subformConfig.form}.xml`
                : `${subformConfig.form}.xml`;

            // Cargar XML del subform
            let xmlString;
            try {
                const { authFetch } = await import('../../api/client.js');
                const res = await authFetch(`/api/files/content?path=${encodeURIComponent(subformPath)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                xmlString = await res.text();
            } catch (err) {
                console.error('[LayoutProcessor] No se pudo cargar el subform:', err);
                if (el.options?.length > 0) el.value = el.options[0].value;
                return;
            }

            const workspaceContainer = this.ctx.container?.parentElement;
            if (!workspaceContainer) return;

            const { authFetch } = await import('../../api/client.js');
            const FormRenderer = (await import('../FormRenderer.js')).default;

            // Vuelve al formulario padre
            const restoreParent = async () => {
                workspaceContainer.innerHTML = '';
                try {
                    const res = await authFetch(`/api/files/content?path=${encodeURIComponent(formPath)}`);
                    const parentXml = await res.text();
                    const container = document.createElement('div');
                    workspaceContainer.appendChild(container);
                    new FormRenderer().render(container, parentXml, { formPath });
                } catch (err) {
                    console.error('[LayoutProcessor] No se pudo restaurar el formulario padre:', err);
                }
            };

            // Reemplazar workspace con el subform
            workspaceContainer.innerHTML = '';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'subform-back-btn';
            backBtn.textContent = '← Volver';
            backBtn.addEventListener('click', restoreParent);
            workspaceContainer.appendChild(backBtn);

            const subContainer = document.createElement('div');
            workspaceContainer.appendChild(subContainer);
            new FormRenderer().render(subContainer, xmlString, { formPath: subformPath });

            // Aplicar valores heredados después de que los campos se registren (setTimeout 0)
            if (Object.keys(inheritedValues).length > 0) {
                setTimeout(() => {
                    Object.entries(inheritedValues).forEach(([fieldId, value]) => {
                        const field = subContainer.querySelector(`#${fieldId}`);
                        if (field) {
                            field.value = value;
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                }, 0);
            }

            // Al guardar: invalidar catálogo y volver al padre tras el feedback
            subContainer.addEventListener('sf:record-saved', async () => {
                try {
                    const LookupService = (await import('../../services/LookupService.js')).default;
                    LookupService.invalidateCache(subformConfig.form);
                } catch (_) { /* sin cache, no importa */ }
                setTimeout(restoreParent, 1500);
            }, { once: true });

        }, signal ? { signal } : undefined);
    }
}

export default LayoutProcessor;
