/**
 * @file Checkbox.js
 * @description Módulo para renderizar campos checkbox
 * @module fieldRenderer/Checkbox
 */

import { createElement } from '../../utils/domUtils.js';
import { createFieldWrapper } from './InputField.js';

/**
 * Renderiza un campo de checkbox
 * @param {Object} config - Configuración del campo
 * @param {HTMLElement} parentContainer - Contenedor padre
 */
export const renderCheckbox = (config, parentContainer) => {
    const { id, labelTxt, defaultValue, parentIsHorizontal } = config;
    
    const fieldWrapper = createFieldWrapper(parentIsHorizontal);
    if (!parentIsHorizontal) fieldWrapper.classList.add('checkbox-row');
    
    const labelEl = createElement('label', '', '');
    labelEl.style.visibility = 'hidden';
    
    const wrapper = createElement('div', 'checkbox-wrapper');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.name = id;
    if (defaultValue === 'true' || defaultValue === '1') input.checked = true;

    const span = createElement('span', 'checkbox-label-text', labelTxt);
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    fieldWrapper.appendChild(labelEl);
    fieldWrapper.appendChild(wrapper);
    
    parentContainer.appendChild(fieldWrapper);
};

export default {
    renderCheckbox
};
