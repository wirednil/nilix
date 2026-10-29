/**
 * @file ReportModal.js
 * @description Muestra el/los reporte(s) de <output> de un form recién
 *              guardado (ej. el comprobante de una venta) en un modal sobre el
 *              mismo form — mismo backdrop que SubformModal.js. Antes se abría
 *              en una pestaña nueva, que el navegador dejaba en segundo plano
 *              y nadie veía. Al cerrar (✕, VOLVER, Escape o click en el fondo)
 *              llama onClose una sola vez — SubmitManager.js redibuja ahí el
 *              form limpio.
 */

import logger from '../../utils/clientLogger.js';
import { trapFocus } from '../../utils/focusTrap.js';
import { focusWithRing } from '../../utils/focusRing.js';

export class ReportModal {
    constructor() {
        this._backdrop = null;
        this._onKeydown = null;
        this._onClose = null;
        this._releaseFocus = null;
    }

    /**
     * @param {object}   options
     * @param {string}   options.title    - Encabezado del modal (ej. "Guardado — N° 31")
     * @param {Array<{report: string, params: object}>} options.reports
     *                                    - Reportes a mostrar, en orden (nombre sin .yaml)
     * @param {Function} options.onClose  - Se llama una vez al cerrar
     */
    async open({ title, reports, onClose } = {}) {
        this._onClose = onClose;

        const backdrop = document.createElement('div');
        backdrop.className = 'subform-backdrop report-modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'subform-modal report-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'subform-close-btn report-modal-close';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Cerrar');
        closeBtn.addEventListener('click', () => this.close());

        const heading = document.createElement('h3');
        heading.className = 'report-modal-title';
        heading.textContent = title;
        modal.setAttribute('aria-label', title);

        const body = document.createElement('div');
        body.className = 'report-modal-body';

        const actions = document.createElement('div');
        actions.className = 'report-modal-actions';

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'report-modal-back';
        backBtn.textContent = 'VOLVER';
        backBtn.addEventListener('click', () => this.close());
        actions.appendChild(backBtn);

        // Imprimir/PDF sigue disponible en report.html (botón propio + CSS de
        // impresión) — abierto por un click del usuario, no lo bloquea el
        // navegador como bloqueaba el window.open automático post-guardado.
        // Deshabilitado hasta que su reporte termina de cargar: la primera vez
        // DuckDB tarda varios segundos y no había nada para imprimir todavía.
        const printLinks = reports.map(({ report, params }) => {
            const query = new URLSearchParams({ file: report, ...params });
            const printLink = document.createElement('a');
            printLink.className = 'report-modal-print';
            printLink.href = `/report.html?${query}`;
            printLink.target = '_blank';
            printLink.rel = 'noopener';
            printLink.textContent = reports.length > 1 ? `IMPRIMIR ${report.toUpperCase()}` : 'IMPRIMIR';
            printLink.setAttribute('aria-disabled', 'true');
            printLink.tabIndex = -1;
            printLink.addEventListener('click', (e) => {
                if (printLink.getAttribute('aria-disabled') === 'true') e.preventDefault();
            });
            actions.appendChild(printLink);
            return printLink;
        });

        const loading = document.createElement('div');
        loading.className = 'report-loading report-modal-loading';
        loading.textContent = 'Cargando comprobante';
        body.appendChild(loading);

        modal.append(closeBtn, heading, body, actions);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.close();
        });
        this._onKeydown = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._onKeydown);
        this._releaseFocus = trapFocus(modal);

        focusWithRing(backBtn);

        const { ReportEngine } = await import('../report/ReportEngine.js');
        for (const [i, { report, params }] of reports.entries()) {
            const section = document.createElement('div');
            section.className = 'terminal-window';
            body.insertBefore(section, loading);
            try {
                const engine = new ReportEngine();
                await engine.load(`/reports/${report}.yaml`, null, null, params);
                if (!this._backdrop) return; // cerrado mientras cargaba
                section.appendChild(await engine.render());
                printLinks[i].removeAttribute('aria-disabled');
                printLinks[i].removeAttribute('tabindex');
            } catch (err) {
                logger.error('ReportModal', `No se pudo mostrar el reporte "${report}"`, err);
                const errEl = document.createElement('div');
                errEl.className = 'report-error';
                errEl.textContent = `No se pudo mostrar el comprobante: ${err.message}`;
                section.appendChild(errEl);
            }
        }
        loading.remove();
    }

    close() {
        if (!this._backdrop) return;
        document.removeEventListener('keydown', this._onKeydown);
        this._releaseFocus?.();
        this._backdrop.remove();
        this._backdrop = null;
        const onClose = this._onClose;
        this._onClose = null;
        onClose?.();
    }
}

export default ReportModal;
