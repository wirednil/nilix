/**
 * @file InputField.js
 * @description Módulo para renderizar campos de texto, número, fecha, etc.
 * @module fieldRenderer/InputField
 */

import { createElement } from '../../utils/domUtils.js';
import { createLabel } from './Label.js';
import { createAutocomplete, attachAutocompleteHandlers } from './Autocomplete.js';

// ============================================
// CONSTANTES
// ============================================

export const DEFAULTS = {
    TEXTAREA_ROWS: 3,
    DATE_WIDTH: '17ch',
    TIME_WIDTH: '12ch',
    NUMBER_WIDTH: '15ch',
    MIN_EFFECTIVE_SIZE: 8
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Crea el elemento input según el tipo
 * @param {Object} options - Opciones del input
 * @returns {HTMLElement} Elemento input, textarea o select
 */
export const createInputElement = ({ id, type, isRequired, size, isSkip, defaultValue, rows, selectOptions, lookupConfig }) => {
    let inputEl;

    if (type === 'textarea') {
        inputEl = createElement('textarea');
    } else {
        inputEl = createElement('input');
        inputEl.type = type;
        if (type === 'date') {
            inputEl.title = "Seleccione fecha";
        }
    }

    inputEl.id = id;
    inputEl.name = id;
    if (isRequired) inputEl.required = true;
    if (type === 'number') inputEl.step = 'any';

    // Configurar textarea
    if (inputEl.tagName === 'TEXTAREA') {
        inputEl.style.width = '100%';
        inputEl.style.maxWidth = '100%';
        inputEl.rows = rows || DEFAULTS.TEXTAREA_ROWS;

        // Si hay size (de multifield), usarlo como maxlength
        if (size) {
            const maxChars = parseInt(size);
            if (maxChars > 0) {
                inputEl.maxLength = maxChars;
            }
        }
    }
    // Configurar campos de fecha
    else if (type === 'date') {
        inputEl.style.width = DEFAULTS.DATE_WIDTH;
        inputEl.style.maxWidth = DEFAULTS.DATE_WIDTH;
    }
    // Configurar campos normales con size
    else if (size) {
        const sizeNum = parseInt(size);
        const effectiveSize = Math.max(sizeNum * 1.2, DEFAULTS.MIN_EFFECTIVE_SIZE);
        inputEl.style.width    = `${effectiveSize}ch`;
        inputEl.style.maxWidth = `${effectiveSize}ch`;
    }

    if (isSkip) {
        inputEl.readOnly = true;
        inputEl.classList.add('readonly-field');
    }
    
    // Solo asignar valor si defaultValue existe
    if (defaultValue) {
        if (defaultValue === 'today' && type === 'date') {
            inputEl.value = new Date().toISOString().split('T')[0];
        } else if (defaultValue !== 'today') {
            inputEl.value = defaultValue;
        }
    }
    
    return inputEl;
};

/**
 * Crea el contenedor wrapper para un campo
 * @param {boolean} isHorizontal - Si el contenedor padre es horizontal
 * @returns {HTMLElement} Elemento wrapper del campo
 */
export const createFieldWrapper = (isHorizontal) => {
    return createElement('div',
        isHorizontal ? 'field-block-horizontal' : 'field-row'
    );
};

/**
 * Ensambla los componentes del campo según el layout
 * @param {HTMLElement} wrapper - Wrapper del campo
 * @param {HTMLElement} label - Elemento label
 * @param {HTMLElement} inputGroup - Grupo de input
 */
export const assembleFieldComponents = (wrapper, label, inputGroup) => {
    wrapper.appendChild(label);
    wrapper.appendChild(inputGroup);
};

// ============================================
// RENDERER PRINCIPAL
// ============================================

/**
 * Renderiza un campo de texto o textarea
 * @param {Object} config - Configuración del campo
 * @param {Object} messages - Mensajes de ayuda
 * @param {HTMLElement} parentContainer - Contenedor padre
 */
export const renderInputField = (config, messages, parentContainer, formContainer = null, { signal } = {}) => {
    const {
        id, labelTxt, type, size, isRequired, isSkip,
        defaultValue, parentIsHorizontal, helpId, rows, align, selectOptions, lookupConfig
    } = config;

    const fieldWrapper = createFieldWrapper(parentIsHorizontal);

    if (align === 'right') {
        fieldWrapper.classList.add('field-align-right');
    } else if (align === 'center') {
        fieldWrapper.classList.add('field-align-center');
    }

    const labelEl = createLabel(id, labelTxt, isRequired, helpId, messages);

    const groupDiv = createElement('div', 'input-group');

    if (type === 'dynamic-select' || type === 'select') {
        const { wrapper, inputEl, btnEl, dropdownEl, defaultValue: dv } = createAutocomplete({
            id, size, isRequired, isSkip, lookupConfig, selectOptions, defaultValue
        });
        
        if (defaultValue && !lookupConfig) {
            inputEl.value = defaultValue;
        }
        
        groupDiv.appendChild(wrapper);
        assembleFieldComponents(fieldWrapper, labelEl, groupDiv);
        parentContainer.appendChild(fieldWrapper);
        
        attachAutocompleteHandlers(inputEl, btnEl, dropdownEl, lookupConfig, formContainer || parentContainer, selectOptions, { signal });
    } else {
        const inputEl = createInputElement({
            id, type, isRequired, size, isSkip, defaultValue, rows, selectOptions, lookupConfig
        });

        groupDiv.appendChild(inputEl);
        assembleFieldComponents(fieldWrapper, labelEl, groupDiv);
        parentContainer.appendChild(fieldWrapper);

        if (type !== 'textarea' && type !== 'date') {
            setTimeout(() => {
                const labelEl = fieldWrapper.querySelector('label');
                const inputEl = fieldWrapper.querySelector('input');

                if (labelEl && inputEl) {
                    const labelWidth = labelEl.offsetWidth;
                    const inputWidth = inputEl.offsetWidth;

                    if (labelWidth > inputWidth) {
                        inputEl.classList.add('expand-to-label');
                    }
                }
            }, 0);
        }
    }
};

export default {
    DEFAULTS,
    createInputElement,
    createFieldWrapper,
    assembleFieldComponents,
    renderInputField
};
