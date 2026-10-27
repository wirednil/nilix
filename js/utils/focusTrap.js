/**
 * @file focusTrap.js
 * @description Mantiene Tab / Shift+Tab dentro de un modal abierto
 *              (ReportModal.js, modal de fila de Multifield.js). Sin esto el
 *              foco salía del modal hacia el body y el form de atrás.
 */

const FOCUSABLE = [
    'a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]',
].map(sel => `${sel}:not([disabled]):not([tabindex="-1"])`).join(',');

/**
 * @param {HTMLElement} container - El modal
 * @returns {Function} Quita el trap (llamar al cerrar)
 */
export function trapFocus(container) {
    const onKeydown = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = [...container.querySelectorAll(FOCUSABLE)]
            .filter(el => el.getClientRects().length > 0 && el.getAttribute('aria-disabled') !== 'true');
        if (focusable.length === 0) {
            e.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!container.contains(active)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
}

export default trapFocus;
