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
        this._buildDom();
    }

    _buildDom() {
        this.el = createElement('div', 'status-bar');
        this.el.hidden = true;
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');

        this._messageEl = createElement('span', 'status-bar-message');

        this._dismissBtn = document.createElement('button');
        this._dismissBtn.type = 'button';
        this._dismissBtn.className = 'status-bar-btn status-bar-dismiss-btn';
        this._dismissBtn.textContent = '×';
        this._dismissBtn.title = 'Descartar';
        this._dismissBtn.onclick = () => this._hideCurrent();

        this.el.append(this._messageEl, this._dismissBtn);
    }

    /**
     * @param {'error'|'warning'|'success'|'info'} level
     * @param {string} message
     */
    push(level, message) {
        if (!ICONS[level]) level = 'info';

        this.el.hidden = false;
        this.el.dataset.level = level;
        this._messageEl.textContent = `${ICONS[level]} ${message}`;

        clearTimeout(this._hideTimer);
        const hideAfter = AUTO_HIDE_MS[level];
        if (hideAfter) {
            this._hideTimer = setTimeout(() => this._hideCurrent(), hideAfter);
        }
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
