/**
 * @file reportParamHelpers.js
 * @description Ad-hoc, solo sabe de `type: month` — no es el ParamResolver
 * genérico que hace falta (ver docs/03-reference/NIL-REPORT.md §12,
 * "ParamResolver genérico"). Existe para no duplicar esta lógica entre
 * report.html (URL-driven) y Workspace.js (render inline en el menú).
 */

/**
 * Dado el schema ya parseado y los params existentes (de la URL o vacíos),
 * completa el param type: month con el mes actual si falta.
 * @returns {{ params: object, monthParamName: string|null }}
 */
export function resolveReportParams(schema, existingParams = {}) {
    const params = { ...existingParams };
    const monthParam = (schema.params || []).find(p => p.type === 'month');
    if (monthParam && !params[monthParam.name]) {
        params[monthParam.name] = new Date().toISOString().slice(0, 7);
    }
    return { params, monthParamName: monthParam?.name || null };
}

/**
 * Arma la barra con el <input type="month"> — el caller decide qué hacer
 * cuando cambia (recargar la URL en report.html, re-renderizar inline en
 * Workspace.js).
 */
export function buildMonthPickerBar(monthValue, onChange) {
    const bar = document.createElement('div');
    bar.className = 'month-picker-bar';
    bar.innerHTML = `
        <label for="month-picker-input">Mes:</label>
        <input type="month" id="month-picker-input" value="${monthValue}">
    `;
    bar.querySelector('#month-picker-input').addEventListener('change', (e) => {
        if (e.target.value) onChange(e.target.value);
    });
    return bar;
}

export default { resolveReportParams, buildMonthPickerBar };
