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
            }
            if (this.onFieldRendered) {
                this.onFieldRendered(fieldXml, config.id);
            }
        }, 0);
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
                const result = ExpressionEngine.evaluateValue(expr, formEl);
                if (typeof result === 'number') {
                    el.value = Number.isInteger(result) ? String(result) : result.toFixed(2);
                } else {
                    el.value = String(result ?? '');
                }
            } catch (e) {
                console.error('❌ computed field error:', expr, e);
            }
        };

        const deps = ExpressionEngine.getValueDependencies(expr);

        deps.forEach(dep => {
            if (dep.type === 'field') {
                const depEl = formEl.querySelector(`#${dep.fieldId}`);
                if (depEl) {
                    depEl.addEventListener('change', recompute, { signal });
                    depEl.addEventListener('input', recompute, { signal });
                }
            } else if (dep.type === 'aggregate') {
                // Escucha cambios en celdas de multifield via delegación en el form
                formEl.addEventListener('change', (e) => {
                    if (e.target.name && e.target.name.includes(`_${dep.colId}_`)) {
                        recompute();
                    }
                }, { signal });
                // También escucha el evento custom cuando se carga populateRows
                formEl.addEventListener('multifield-populated', recompute, { signal });
            }
        });

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

                lookupConfig = {
                    table: inTableEl.getAttribute('table'),
                    key: inTableEl.getAttribute('key'),
                    displayField: inTableEl.getAttribute('display') || inTableEl.getAttribute('key'),
                    copyFields: [],
                    isKeyField
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
                isExpression: fieldXml.getAttribute('is') || null
            };
        } catch (error) {
            console.error('❌ Error extrayendo configuración del campo:', error);
            throw new Error(`Campo XML mal formado: ${fieldXml.outerHTML}`);
        }
    }
}

export default LayoutProcessor;
