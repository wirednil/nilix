/**
 * @file focusRing.js
 * @description Foco puesto por el motor (volver de un subform, cerrar un
 *              modal, el primer campo con error) que se vea: Chrome solo
 *              dibuja :focus-visible si la usuaria venía usando el teclado,
 *              y después de un click el foco quedaba invisible. La clase
 *              .focus-ring (css/styles.css) dura hasta que el control pierde
 *              el foco.
 */

/** @param {HTMLElement|null|undefined} el */
export function focusWithRing(el) {
    if (!el) return;
    el.focus();
    if (document.activeElement !== el) return;
    el.classList.add('focus-ring');
    el.addEventListener('blur', () => el.classList.remove('focus-ring'), { once: true });
}
