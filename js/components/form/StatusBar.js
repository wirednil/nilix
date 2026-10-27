/**
 * @file StatusBar.js
 * @description Barra de estado por formulario: muestra el último error,
 * warning o acción ejecutada (guardado, navegación, reportes, parser).
 */

import { createElement } from '../../utils/domUtils.js';

const ICONS = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️',
};

const AUTO_HIDE_MS = { success: 4000, info: 4000 };

export class StatusBar {
    constructor() {
        this._hideTimer = null;
        this._seq = 0;
        this._buildDom();
    }

    _buildDom() {
        this.el = createElement('div', 'status-bar');
        this.el.hidden = true;
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');

        this._messageEl = createElement('span', 'status-bar-message');

        this.el.append(this._messageEl);
    }

    /**
     * @param {'error'|'warning'|'success'|'info'} level
     * @param {string} message
     * @param {{ sticky?: boolean }} [options] - sticky: no se oculta solo (ej. la
     *   confirmación "Registro N° X creado": se queda hasta el próximo mensaje)
     * @returns {number} id del mensaje, para dismiss()
     */
    push(level, message, { sticky = false } = {}) {
        if (!ICONS[level]) level = 'info';
        this._current = ++this._seq;

        this.el.hidden = false;
        this.el.dataset.level = level;
        this._messageEl.textContent = `${ICONS[level]} ${message}`;

        clearTimeout(this._hideTimer);
        const hideAfter = sticky ? null : AUTO_HIDE_MS[level];
        if (hideAfter) {
            this._hideTimer = setTimeout(() => this._hideCurrent(), hideAfter);
        }
        return this._current;
    }

    /** Oculta el mensaje `id` si sigue siendo el que se muestra. */
    dismiss(id) {
        if (id === this._current && !this.el.hidden) this._hideCurrent();
    }

    _hideCurrent() {
        clearTimeout(this._hideTimer);
        this.el.hidden = true;
        this._messageEl.textContent = '';
        delete this.el.dataset.level;
    }

    destroy() {
        clearTimeout(this._hideTimer);
        this.el.remove();
    }
}

export default StatusBar;
