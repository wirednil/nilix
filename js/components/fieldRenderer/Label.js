/**
 * @file Label.js
 * @description Módulo para crear etiquetas (labels) e iconos de ayuda/tooltips
 * @module fieldRenderer/Label
 */

import { createElement } from '../../utils/domUtils.js';

/**
 * Crea el icono de ayuda estilo terminal [?]
 * @param {string} fieldId - ID del campo asociado
 * @returns {HTMLElement} Icono clickeable
 */
export const createHelpIcon = (fieldId) => {
    const icon = createElement('span', 'help-icon', '[?]');
    icon.setAttribute('data-field', fieldId);
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Mostrar ayuda');
    return icon;
};

/**
 * Crea el tooltip de ayuda estilo terminal
 * @param {string} fieldId - ID del campo
 * @param {string} fieldLabel - Label del campo
 * @param {string} helpText - Texto de ayuda
 * @returns {HTMLElement} Tooltip oculto
 */
export const createHelpTooltip = (fieldId, fieldLabel, helpText) => {
    const tooltip = createElement('div', 'help-tooltip');
    tooltip.setAttribute('data-field', fieldId);
    tooltip.style.display = 'none';

    // Prompt estilo terminal
    const prompt = createElement('div', 'help-prompt', `> help ${fieldId}`);
    const message = createElement('div', 'help-text', helpText);

    tooltip.appendChild(prompt);
    tooltip.appendChild(message);

    return tooltip;
};

/**
 * Maneja el toggle del tooltip de ayuda
 * @param {HTMLElement} icon - Icono clickeado
 */
export const toggleHelpTooltip = (icon) => {
    const fieldId = icon.getAttribute('data-field');
    const tooltip = document.querySelector(`.help-tooltip[data-field="${fieldId}"]`);

    if (!tooltip) {
        console.warn(`Tooltip no encontrado para campo: ${fieldId}`);
        return;
    }

    const isVisible = tooltip.style.display !== 'none' && tooltip.style.display !== '';

    // Cerrar todos los tooltips abiertos
    document.querySelectorAll('.help-tooltip').forEach(t => {
        t.style.display = 'none';
    });

    // Toggle del tooltip actual
    if (!isVisible) {
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    }
};

/**
 * Crea la etiqueta (label) para un campo
 * @param {string} id - ID del campo
 * @param {string} labelTxt - Texto del label
 * @param {boolean} isRequired - Si el campo es obligatorio
 * @param {string|null} helpId - ID del mensaje de ayuda (opcional)
 * @param {Object} messages - Objeto con mensajes de ayuda
 * @returns {HTMLElement} Elemento label con icono de ayuda si corresponde
 */
export const createLabel = (id, labelTxt, isRequired, helpId = null, messages = {}) => {
    // Si no hay texto de label, crear label vacío (invisible pero mantiene espacio)
    if (!labelTxt || labelTxt.trim() === '') {
        const labelEl = createElement('label', '', '\u00A0'); // Non-breaking space
        labelEl.setAttribute('for', id);
        labelEl.style.visibility = 'hidden';
        return labelEl;
    }

    // Label normal con texto
    const suffix = isRequired ? ' *:' : ':';
    const labelEl = createElement('label');
    labelEl.setAttribute('for', id);

    // Si hay mensaje de ayuda, agregar icono [?] ANTES del texto
    if (helpId && messages[helpId]) {
        // Crear wrapper para el icono (para posicionar el tooltip relativo a él)
        const iconWrapper = createElement('span', 'help-icon-wrapper');
        iconWrapper.style.position = 'relative';
        iconWrapper.style.display = 'inline-block';

        const helpIcon = createHelpIcon(id);
        iconWrapper.appendChild(helpIcon);

        // Crear y agregar tooltip al wrapper del icono (no al fieldWrapper)
        const helpTooltip = createHelpTooltip(id, labelTxt || id, messages[helpId]);
        iconWrapper.appendChild(helpTooltip);

        labelEl.appendChild(iconWrapper);
        labelEl.appendChild(document.createTextNode(' ')); // Espacio

        // Event listeners para el icono
        helpIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // CRÍTICO: evitar que el click llegue a document
            toggleHelpTooltip(helpIcon);
        });

        helpIcon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggleHelpTooltip(helpIcon);
            }
        });
    }

    // Agregar texto del label
    labelEl.appendChild(document.createTextNode(labelTxt + suffix));

    return labelEl;
};

export default {
    createHelpIcon,
    createHelpTooltip,
    toggleHelpTooltip,
    createLabel
};
