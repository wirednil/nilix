/**
 * @file ConfirmDialog.js
 * @description Confirmación propia del motor, en lugar del confirm() nativo
 *              (bloquea la página y no se parece al resto). Usos:
 *              - confirmDiscard(): "Hay datos sin guardar. ¿Descartarlos?"
 *                antes de dejar un form con cambios (explorador, ANT/SIG,
 *                tipear un N°).
 *              - ✕ de una fila de multifield: "¿Eliminar esta fila?".
 *              Mismo backdrop que los otros modales. El foco va a la opción
 *              segura (un Enter apurado no borra nada); Escape y el click
 *              afuera también la eligen. Un solo diálogo a la vez: un segundo
 *              pedido mientras está abierto (blur + change del mismo N°)
 *              recibe la misma respuesta.
 */

import { trapFocus } from '../../utils/focusTrap.js';
import { focusWithRing } from '../../utils/focusRing.js';

let pending = null;

/**
 * @param {object} options
 * @param {string} options.message
 * @param {string} options.confirmLabel - La acción destructiva (ej. DESCARTAR)
 * @param {string} options.cancelLabel  - La opción segura, con el foco
 * @returns {Promise<boolean>} true = confirmó la acción
 */
export function confirmAction({ message, confirmLabel, cancelLabel }) {
    if (pending) return pending;
    const opener = document.activeElement;

    pending = new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'subform-backdrop confirm-dialog-backdrop';

        const modal = document.createElement('div');
        modal.className = 'subform-modal confirm-dialog';
        modal.setAttribute('role', 'alertdialog');
        modal.setAttribute('aria-modal', 'true');

        const text = document.createElement('p');
        text.className = 'confirm-dialog-message';
        text.id = 'confirm-dialog-message';
        text.textContent = message;
        modal.setAttribute('aria-describedby', text.id);

        const actions = document.createElement('div');
        actions.className = 'confirm-dialog-actions';
        const keepBtn = document.createElement('button');
        keepBtn.type = 'button';
        keepBtn.className = 'confirm-dialog-keep';
        keepBtn.textContent = cancelLabel;
        const discardBtn = document.createElement('button');
        discardBtn.type = 'button';
        discardBtn.className = 'confirm-dialog-discard';
        discardBtn.textContent = confirmLabel;
        actions.append(keepBtn, discardBtn);

        modal.append(text, actions);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        const releaseFocus = trapFocus(modal);

        const onKeydown = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        };
        function finish(discard) {
            document.removeEventListener('keydown', onKeydown, true);
            releaseFocus();
            backdrop.remove();
            pending = null;
            if (!discard && opener?.isConnected) opener.focus();
            resolve(discard);
        }
        document.addEventListener('keydown', onKeydown, true);
        keepBtn.addEventListener('click', () => finish(false));
        discardBtn.addEventListener('click', () => finish(true));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(false); });

        focusWithRing(keepBtn);
    });
    return pending;
}

/** @returns {Promise<boolean>} true = descartar y seguir; false = quedarse */
export function confirmDiscard() {
    return confirmAction({
        message: 'Hay datos sin guardar. ¿Descartarlos?',
        confirmLabel: 'DESCARTAR',
        cancelLabel: 'SEGUIR CARGANDO',
    });
}

export default confirmDiscard;
