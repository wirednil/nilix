/**
 * @file UiComponents.js
 * @description Componentes reutilizables de interfaz de usuario (Header, ActionButtons)
 * @module uiComponents
 */

import { createElement } from '../../utils/domUtils.js';

/**
 * @namespace uiComponents
 * @description Componentes reutilizables de interfaz de usuario
 */
const uiComponents = {
    /**
     * Crea el encabezado de la ventana del formulario
     * @param {Object} formData - Datos del formulario
     * @param {string} formData.title - Título del formulario
     * @returns {HTMLElement} Elemento del encabezado
     */
    createHeader({ title }) {
        const header = createElement('div', 'window-header');
        
        const infoDiv = createElement('div', 'window-header-info', '', [
            createElement('span', 'window-title', title)
        ]);

        header.appendChild(infoDiv);

        return header;
    },

    /**
     * Crea la barra de acciones con botones
     * @returns {Object} Objeto con elementos y referencias
     */
    createActionButtons() {
        const nav = createElement('nav', 'actions-nav');

        const submitBtn = createElement('button', '', 'ENVIAR');
        submitBtn.type = 'submit';

        nav.appendChild(submitBtn);

        return { nav, submitBtn };
    }
};

export default uiComponents;
