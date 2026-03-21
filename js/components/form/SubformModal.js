/**
 * @file SubformModal.js
 * @description Abre un formulario XML existente dentro de un modal overlay (subformulario).
 *              Al guardar, dispara onSaved(data) y cierra el modal.
 */

import { authFetch } from '../../api/client.js';

export class SubformModal {
    constructor() {
        this._backdrop = null;
        this._renderer = null;
    }

    /**
     * @param {object} options
     * @param {string}   options.formPath  - Ruta absoluta del XML del subform
     * @param {Function} options.onSaved   - Callback(data) al guardar exitosamente
     * @param {Function} options.onCancel  - Callback al cerrar/cancelar sin guardar
     */
    async open({ formPath, onSaved, onCancel } = {}) {
        // Cargar XML del subform
        let xmlString;
        try {
            const res = await authFetch(`/api/files/content?path=${encodeURIComponent(formPath)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            xmlString = await res.text();
        } catch (err) {
            console.error('[SubformModal] No se pudo cargar el formulario:', formPath, err);
            alert(`No se pudo cargar el subformulario:\n${formPath}`);
            onCancel?.();
            return;
        }

        // Crear DOM del modal
        const backdrop = document.createElement('div');
        backdrop.className = 'subform-backdrop';

        const modal = document.createElement('div');
        modal.className = 'subform-modal';

        const closeFn = () => { this.close(); onCancel?.(); };

        // Contenedor del formulario
        const formContainer = document.createElement('div');
        modal.appendChild(formContainer);

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        // Renderizar el subform dentro del modal
        const FormRenderer = (await import('../FormRenderer.js')).default;
        const renderer = new FormRenderer();
        this._renderer = renderer;
        renderer.render(formContainer, xmlString, { formPath });

        // Insertar botón cerrar dentro del terminal-window renderizado
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'subform-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Cerrar');
        closeBtn.addEventListener('click', closeFn);

        const terminalWindow = formContainer.querySelector('.terminal-window');
        if (terminalWindow) {
            terminalWindow.style.position = 'relative';
            terminalWindow.appendChild(closeBtn);
        } else {
            modal.insertBefore(closeBtn, formContainer);
        }

        // Escuchar guardado exitoso (una sola vez)
        formContainer.addEventListener('sf:record-saved', (e) => {
            const { data } = e.detail;
            this.close();
            onSaved?.(data);
        }, { once: true });

        // Cerrar al hacer click en el fondo
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.close();
                onCancel?.();
            }
        });

        // Cerrar con Escape
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKeydown);
                this.close();
                onCancel?.();
            }
        };
        document.addEventListener('keydown', onKeydown);
    }

    close() {
        if (this._renderer) {
            this._renderer.destroy();
            this._renderer = null;
        }
        if (this._backdrop) {
            this._backdrop.remove();
            this._backdrop = null;
        }
    }
}

export default SubformModal;
