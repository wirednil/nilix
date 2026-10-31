/**
 * @file numberInput.js
 * @description Campos numéricos con formato argentino, sin depender del idioma
 *              del navegador. Un <input type="number"> en un Chrome en inglés
 *              convertía "1.500,50" en 1.50050 y "-1500,50" en -150050
 *              (recorrido de UX thym-pos, punto 2). Acá el campo es de texto
 *              con teclado numérico (inputmode="decimal") y el valor se
 *              normaliza al confirmarlo: "1.500,50", "1500,5" y "1500.50"
 *              quedan como "1500.5" — lo que leen las fórmulas, la
 *              validación y el guardado.
 *
 *              Con format="currency" (XML), sin foco se ve "$1.500,50", igual
 *              que en los reportes (punto 14); con foco, el número para
 *              editarlo. El valor del input no cambia: es una capa encima.
 */

/**
 * "1.500,50" / "1500,5" / "1500.50" / "35.000" / "$ 35.000,00" → número.
 * Con coma, la coma es decimal y los puntos son miles. Sin coma, un punto
 * seguido de grupos de 3 dígitos ("35.000", "1.500.000") es de miles; si no,
 * es decimal ("1500.5").
 * @returns {number|null} null si está vacío o no es un número
 */
export function parseLocaleNumber(text) {
    let s = String(text ?? '').replace(/[\s$]/g, '');
    if (s === '') return null;
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, '');
    }
    if (!/^-?\d*\.?\d+$/.test(s)) return null;
    return Number(s);
}

/** 1500.5 → "$1.500,50" (mismo formato que format: currency de los reportes) */
export function formatCurrency(n) {
    const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-$${abs}` : `$${abs}`;
}

/** Texto canónico del valor: "1500.5", "35000" */
function canonical(n) {
    return String(Number.isInteger(n) ? n : Number(n.toFixed(2)));
}

/** Actualiza la capa "$1.500,50" (después de poner .value desde código, ej. un is=). */
export function refreshNumberDisplay(inputEl) {
    const box = inputEl.closest('.number-input-box');
    const overlay = box?.querySelector('.number-display-overlay');
    if (!overlay) return;
    const n = parseLocaleNumber(inputEl.value);
    const show = n !== null && document.activeElement !== inputEl;
    overlay.textContent = show ? formatCurrency(n) : '';
    overlay.hidden = !show;
    box.classList.toggle('show-formatted', show);
}

/**
 * Llamar con el input ya dentro de su contenedor (la capa de moneda lo envuelve).
 * @param {HTMLInputElement} inputEl
 * @param {{ currency?: boolean, signal?: AbortSignal }} options
 */
export function setupNumberInput(inputEl, { currency = false, signal } = {}) {
    inputEl.type = 'text';
    inputEl.inputMode = 'decimal';
    inputEl.autocomplete = 'off';
    inputEl.dataset.numeric = 'true';
    inputEl.removeAttribute('step');

    // capture: en el propio input corre antes que los otros 'change'
    // (validación, fórmulas, handler), que ya leen el número normalizado.
    inputEl.addEventListener('change', () => {
        const n = parseLocaleNumber(inputEl.value);
        if (n !== null) inputEl.value = canonical(n);
    }, { capture: true, signal });

    if (!currency) return;
    inputEl.dataset.currency = 'true';

    const box = document.createElement('span');
    box.className = 'number-input-box';
    inputEl.parentNode?.insertBefore(box, inputEl);
    box.appendChild(inputEl);
    const overlay = document.createElement('span');
    overlay.className = 'number-display-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    box.appendChild(overlay);

    const refresh = () => refreshNumberDisplay(inputEl);
    ['focus', 'blur', 'change', 'input'].forEach(type =>
        inputEl.addEventListener(type, refresh, { signal }));
    refresh();
}

export default { parseLocaleNumber, formatCurrency, setupNumberInput, refreshNumberDisplay };
