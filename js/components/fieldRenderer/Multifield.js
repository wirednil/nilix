/**
 * @file Multifield.js
 * @description Módulo para renderizar multifields (textarea o grid/tabla)
 * @module fieldRenderer/Multifield
 */

import { createElement } from '../../utils/domUtils.js';
import { createLabel, createHelpTooltip } from './Label.js';
import { createFieldWrapper, createInputElement, renderInputField } from './InputField.js';
import { createAutocomplete, attachAutocompleteHandlers } from './Autocomplete.js';
import ExpressionEngine from '../../utils/ExpressionEngine.js';

// ============================================
// CONSTANTES
// ============================================

export const DEFAULTS = {
    ROWS: 100,
    DISPLAY: 10
};

/**
 * Detecta si un multifield es un textarea (1 solo campo hijo)
 */
export const isTextareaMultifield = (multifieldXml) => {
    const childFields = multifieldXml.querySelectorAll(':scope > field');
    return childFields.length === 1;
};

/**
 * Detecta si un multifield es un grid/tabla (múltiples campos hijos)
 */
export const isGridMultifield = (multifieldXml) => {
    const childFields = multifieldXml.querySelectorAll(':scope > field');
    return childFields.length > 1;
};

// ============================================
// HELPERS INTERNOS (GRID CRUD)
// ============================================

/**
 * Lee metadatos de columnas desde los <th> del thead
 */
function _getColumns(thead) {
    return Array.from(thead.querySelectorAll('th[data-field-id]')).map(th => {
        const lookupRaw = th.getAttribute('data-lookup');
        const choiceRaw = th.getAttribute('data-choice');
        return {
            id: th.getAttribute('data-field-id'),
            label: th.textContent.trim(),
            isCopyTarget: th.hidden,
            isSkip: th.getAttribute('data-skip') === 'true',
            isReadonly: th.getAttribute('data-readonly') === 'true',
            isUnique: th.getAttribute('data-unique') === 'true',
            type: th.getAttribute('data-type') || 'text',
            isExpr: th.getAttribute('data-is-expr') || null,
            check: th.getAttribute('data-check') || null,
            size:  parseInt(th.getAttribute('data-size')) || null,
            lookupConfig: lookupRaw ? JSON.parse(lookupRaw) : null,
            choiceConfig: choiceRaw ? JSON.parse(choiceRaw) : null,
            defaultValue: th.getAttribute('data-default') || null
        };
    });
}

/**
 * Convierte una check expression simple en un valor min para atributo HTML.
 * "> 0" → 1, ">= 1" → 1, "< 100" → null (no aplica a min), etc.
 */
function _parseMinFromCheck(checkExpr) {
    const gte = checkExpr.match(/^>=\s*([\d.]+)$/);
    if (gte) return parseFloat(gte[1]);
    const gt = checkExpr.match(/^>\s*([\d.]+)$/);
    if (gt) {
        const n = parseFloat(gt[1]);
        return Number.isInteger(n) ? n + 1 : +(n + 0.01).toFixed(2);
    }
    return null;
}

function _evaluateRowExpr(expr, rowEl) {
    const context = {};
    rowEl.querySelectorAll('.multifield-cell-input').forEach(inp => {
        if (inp.dataset.colId) context[inp.dataset.colId] = parseFloat(inp.value) || 0;
    });
    try {
        return ExpressionEngine.evaluateArithmetic(expr, context);
    } catch {
        return null;
    }
}

/**
 * Construye una celda stepper [▼ N ▲] para una columna type="stepper"
 */
function _buildStepperCell(multifieldId, col, rowData, absoluteIndex) {
    const size = col.size || 3;
    const implicitMax = Math.pow(10, size) - 1;
    const fmt = n => String(Math.max(0, n)).padStart(size, '0');

    const wrapper = createElement('div', 'stepper-wrapper');

    const decBtn = createElement('button', 'stepper-btn', '▼');
    const incBtn = createElement('button', 'stepper-btn', '▲');
    decBtn.type = 'button';
    incBtn.type = 'button';

    const input = createElement('input');
    input.type = 'number';
    input.readOnly = true;
    input.id    = `${multifieldId}_${col.id}_${absoluteIndex}`;
    input.name  = `${multifieldId}_${col.id}_${absoluteIndex}`;
    input.className = 'multifield-cell-input stepper-input';
    input.dataset.colId = col.id;
    input.max = String(implicitMax);
    input.style.width = `${size + 0.5}ch`;
    input.value = fmt(parseInt(rowData?.[col.id] ?? 1));

    if (col.isExpr) input.dataset.isExpr = col.isExpr;
    if (col.check) {
        input.dataset.check = col.check;
        const minVal = _parseMinFromCheck(col.check);
        if (minVal !== null) input.min = String(minVal);
    }

    function step(delta) {
        const current = parseInt(input.value) || 0;
        const minV = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const maxV = parseFloat(input.max);
        const next = current + delta;
        if (next < minV || next > maxV) return;
        input.value = fmt(next);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    decBtn.addEventListener('click', () => step(-1));
    incBtn.addEventListener('click', () => step(+1));

    wrapper.appendChild(decBtn);
    wrapper.appendChild(input);
    wrapper.appendChild(incBtn);
    return wrapper;
}

/**
 * Construye una celda catálogo (autocomplete buscable) para una columna
 * type="select" con <in-table> — reutiliza Autocomplete.js tal cual la usan
 * los campos normales del formulario. `rowEl` es la <tr> en construcción:
 * todavía puede no tener sus otras celdas anexadas en este punto, pero
 * attachAutocompleteHandlers solo la usa dentro de closures que corren en
 * una interacción futura del usuario (selectItem, etc.), momento en el que
 * la fila ya está completa — querySelector busca en el DOM vivo, no en una
 * foto de cuando se llamó.
 */
function _buildCatalogCell(multifieldId, col, rowData, absoluteIndex, rowEl) {
    const id = `${multifieldId}_${col.id}_${absoluteIndex}`;

    // copyFields del XML apuntan a un nombre de columna genérico (ej. "producto");
    // acá se traduce a la celda real de ESTA fila (ej. "items_producto_3").
    const rowLookupConfig = {
        ...col.lookupConfig,
        copyFields: (col.lookupConfig.copyFields || []).map(c => ({
            from: c.from,
            to: `${multifieldId}_${c.to}_${absoluteIndex}`
        }))
    };

    const { wrapper, inputEl } = createAutocomplete({
        id,
        size: col.size,
        isRequired: false,
        isSkip: false,
        lookupConfig: rowLookupConfig,
        selectOptions: null,
        defaultValue: null
    });

    inputEl.name = id;
    inputEl.classList.add('multifield-cell-input');
    inputEl.dataset.colId = col.id;
    if (rowData && rowData[col.id] != null) inputEl.value = rowData[col.id];

    const btnEl = wrapper.querySelector('.autocomplete-btn');
    const dropdownEl = wrapper.querySelector('.autocomplete-dropdown');
    attachAutocompleteHandlers(inputEl, btnEl, dropdownEl, rowLookupConfig, rowEl, null, {});

    return wrapper;
}

/**
 * Calcula las opciones type="choice" para esta fila, leyendo directo la
 * fila de catálogo que dejó la última selección de una columna vecina
 * type="select" (rowEl.dataset.catalogRow — lo pone Autocomplete.js, ver
 * "container.dataset.catalogRow" ahí). col.choiceConfig.options[].from es
 * el nombre de columna DE LA TABLA del catálogo (ej. "precio_mayor"), no el
 * id de un field del multifield — no hace falta ningún <copy> intermedio a
 * un field propio solo para que choice tenga de dónde leer.
 *
 * Devuelve filas {key, display, from} — la misma forma que espera el
 * catálogo interno de Autocomplete.js (ver loadCatalog() ahí).
 */
function _choiceOptionRows(col, rowEl, preferredValue) {
    let catalogRow = {};
    try { catalogRow = JSON.parse(rowEl.dataset.catalogRow || '{}'); } catch { catalogRow = {}; }

    const raw = (col.choiceConfig.options || [])
        .map(opt => ({ from: opt.from, suffix: opt.suffix || '', value: parseFloat(catalogRow[opt.from]) }))
        .filter(o => !isNaN(o.value));

    // Fila existente (editar un registro guardado): no hay catalogRow todavía
    // (no se re-selecciona el producto solo por cargar la fila — mismo límite
    // ya conocido de que el multifield no repuebla desde el catálogo al
    // editar), pero sí sabemos el valor guardado — mostrarlo como única
    // opción en vez de dejar el campo vacío.
    if (raw.length === 0 && preferredValue != null && preferredValue !== '') {
        const v = parseFloat(preferredValue);
        if (!isNaN(v)) raw.push({ from: null, suffix: '', value: v });
    }

    // El widget ya antepone la key (el precio) antes del " - " (ver
    // renderOptions() en Autocomplete.js) — el display acá no repite el
    // valor, solo el sufijo (ej. fila completa: "1500 - (x mayor)").
    return raw.map(o => ({
        key: String(o.value),
        display: o.suffix || String(o.value),
        from: o.from
    }));
}

/**
 * Elige qué fila de `rows` debería quedar seleccionada: el valor guardado
 * (preferredValue) si existe, si no lo que el usuario ya había elegido a
 * mano (dataset.touched + el "from" de la selección previa, guardado por
 * Autocomplete.js en dataset.selectedRow), si no el default-from del XML,
 * si no la primera opción.
 */
function _resolveChoiceTarget(rows, col, inputEl, preferredValue) {
    const touched = inputEl.dataset.touched === '1';
    let currentFrom = null;
    try { currentFrom = JSON.parse(inputEl.dataset.selectedRow || 'null')?.from ?? null; } catch { currentFrom = null; }

    let target = null;
    if (preferredValue != null) target = rows.find(r => r.key === String(preferredValue));
    if (!target && touched && currentFrom) target = rows.find(r => r.from === currentFrom);
    if (!target) target = rows.find(r => r.from === col.choiceConfig.defaultFrom);
    if (!target) target = rows[0] || null;
    return target;
}

function _applyChoiceSelection(inputEl, target) {
    if (target) {
        inputEl.value = target.key;
        inputEl.dataset.selectedKey = target.key;
        inputEl.dataset.selectedRow = JSON.stringify(target);
    } else {
        inputEl.value = '';
        delete inputEl.dataset.selectedKey;
        delete inputEl.dataset.selectedRow;
    }
}

/**
 * Construye una celda type="choice": el mismo widget "armado de cero"
 * (Autocomplete.js) que usan los campos <options> — sin depender del
 * <select> nativo del navegador. <choice> ES <options>, salvo que sus
 * opciones no salen de un value= literal en el XML sino que se recalculan
 * a partir de la fila de catálogo que trajo una columna vecina
 * type="select" (ver _choiceOptionRows).
 */
function _buildChoiceCell(multifieldId, col, rowData, absoluteIndex, rowEl) {
    const id = `${multifieldId}_${col.id}_${absoluteIndex}`;
    const preferred = rowData && rowData[col.id] != null ? rowData[col.id] : null;

    const rows = _choiceOptionRows(col, rowEl, preferred);
    const selectOptions = rows.map(r => ({ value: r.key, textContent: r.display, from: r.from }));

    const { wrapper, inputEl } = createAutocomplete({
        id, size: col.size, isRequired: false, isSkip: false,
        lookupConfig: null, selectOptions, defaultValue: null
    });
    inputEl.name = id;
    inputEl.classList.add('multifield-cell-input');
    inputEl.dataset.colId = col.id;

    const btnEl = wrapper.querySelector('.autocomplete-btn');
    const dropdownEl = wrapper.querySelector('.autocomplete-dropdown');
    attachAutocompleteHandlers(inputEl, btnEl, dropdownEl, null, rowEl, selectOptions, {});

    _applyChoiceSelection(inputEl, _resolveChoiceTarget(rows, col, inputEl, preferred));

    return wrapper;
}

/**
 * Recalcula las opciones de una celda type="choice" ya construida (cuando
 * la columna catálogo hermana cambia — ver _setupChangeTracking), empujando
 * el catálogo nuevo al widget vía el mismo evento sf:set-catalog que ya usa
 * HandlerBridge.js para refrescar catálogos server-driven.
 */
function _refreshChoiceCell(inputEl, rowEl, col, preferredValue) {
    const rows = _choiceOptionRows(col, rowEl, preferredValue);
    const target = _resolveChoiceTarget(rows, col, inputEl, preferredValue);

    inputEl.dispatchEvent(new CustomEvent('sf:set-catalog', { detail: { rows } }));
    _applyChoiceSelection(inputEl, target);
}

/**
 * Construye un <tr> completo para una fila con inputs y botón eliminar.
 * Usado exclusivamente dentro del modal de alta/edición (_openRowModal) —
 * el grid persistido usa _buildDisplayRow (solo lectura).
 */
function _buildRow(multifieldId, columns, rowData, absoluteIndex) {
    const row = createElement('tr');
    row.setAttribute('data-row-index', absoluteIndex);
    if (!rowData) row.dataset.empty = 'true';
    // Restaurar la fila de catálogo de la última selección (ver
    // _setupChangeTracking) — cada apertura del modal crea un <tr> nuevo,
    // así que sin esto una columna "choice" ya elegida se quedaría sin
    // opciones al reabrir para editar.
    if (rowData && rowData.__catalogRow) {
        row.dataset.catalogRow = JSON.stringify(rowData.__catalogRow);
    }

    columns.forEach(col => {
        const td = createElement('td');
        td.dataset.label = col.label;
        // col.isCopyTarget (ver _getColumns/renderGridFromMultifield): la
        // columna catálogo hermana ya muestra "clave - nombre" (overlay en
        // Autocomplete.js), mostrar esta también es redundante. No usar el
        // atributo `hidden`: el CSS de tarjeta del modal
        // (.mf-row-modal ... td:not(.multifield-action-cell) { display:flex })
        // tiene más especificidad que la regla implícita [hidden]{display:none}
        // del navegador y la pisa — con estilo inline no hay ese problema.
        if (col.isCopyTarget) td.style.display = 'none';

        if (col.type === 'stepper') {
            td.appendChild(_buildStepperCell(multifieldId, col, rowData, absoluteIndex));
        } else if (col.type === 'select' && col.lookupConfig) {
            td.appendChild(_buildCatalogCell(multifieldId, col, rowData, absoluteIndex, row));
        } else if (col.type === 'choice' && col.choiceConfig) {
            td.appendChild(_buildChoiceCell(multifieldId, col, rowData, absoluteIndex, row));
        } else {
            const input = createElement('input');
            input.type = col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text';
            if (col.type === 'number') input.step = 'any';
            input.id = `${multifieldId}_${col.id}_${absoluteIndex}`;
            input.name = `${multifieldId}_${col.id}_${absoluteIndex}`;
            input.className = 'multifield-cell-input';
            input.dataset.colId = col.id;
            // rowData es {} (truthy) para una fila nueva del modal de alta
            // (_openRowModal la inicializa así), no null — así que hay que
            // chequear la propiedad puntual, no la truthiness de todo
            // rowData. Con el chequeo viejo (rowData ? ... : default), una
            // fila nueva nunca aplicaba el default (probado en vivo:
            // "cantidad" quedaba en "0" en vez de "1", y precio_total se
            // calculaba con cantidad=0).
            input.value = (rowData && rowData[col.id] != null) ? rowData[col.id] : (col.defaultValue ?? '');

            if (col.isSkip || col.isReadonly) {
                input.readOnly = true;
                input.classList.add('readonly-field');
            }
            if (col.isExpr) input.dataset.isExpr = col.isExpr;
            if (col.check) {
                input.dataset.check = col.check;
                if (col.type === 'number') {
                    const min = _parseMinFromCheck(col.check);
                    if (min !== null) input.min = min;
                }
            }

            td.appendChild(input);
        }

        row.appendChild(td);
    });

    // Celda de acción: botón borrar
    const actionTd = createElement('td', 'multifield-action-cell');
    actionTd.dataset.label = '';
    const delBtn = createElement('button', 'multifield-delete-btn', '✕');
    delBtn.type = 'button';
    delBtn.title = 'Eliminar fila';
    delBtn.addEventListener('click', () => {
        if (!confirm('¿Eliminar este registro?')) return;
        const gridContainer = delBtn.closest('.multifield-grid');
        const rowEl = delBtn.closest('tr');
        const idx = parseInt(rowEl.getAttribute('data-row-index'));
        _deleteRow(gridContainer, idx);
    });
    actionTd.appendChild(delBtn);
    row.appendChild(actionTd);

    return row;
}

/**
 * Resuelve el valor legible de una columna para la fila compacta de solo
 * lectura. Para una columna catálogo (type="select" + lookupConfig), usa la
 * fila de catálogo que dejó la última selección (__catalogRow, ver
 * _setupChangeTracking) para mostrar el nombre en vez de la clave cruda —
 * si no hay __catalogRow (fila cargada sin volver a elegir el producto,
 * limitación ya conocida), cae al valor crudo.
 */
function _resolveDisplayValue(col, rowData) {
    if (!rowData) return '';
    if (col.type === 'select' && col.lookupConfig && rowData.__catalogRow) {
        const displayField = col.lookupConfig.displayField;
        if (displayField && rowData.__catalogRow[displayField] != null) {
            return rowData.__catalogRow[displayField];
        }
    }
    const v = rowData[col.id];
    return v != null ? v : '';
}

/**
 * Construye una fila compacta de solo lectura para el grid persistido.
 * Cada celda lleva un <input type="hidden"> con el mismo name que usaba el
 * input editable de antes — SubmitManager.js junta los datos del form con
 * `new FormData(formEl)`, no lee gridContainer.dataset.allRows directamente,
 * así que sin este hidden el valor de la fila no llegaría al submit.
 * Click en la fila (fuera del botón ✕) reabre el modal para editarla.
 */
function _buildDisplayRow(multifieldId, columns, rowData, absoluteIndex) {
    const row = createElement('tr');
    row.setAttribute('data-row-index', absoluteIndex);
    row.classList.add('multifield-display-row');

    columns.forEach(col => {
        const td = createElement('td');
        td.dataset.label = col.label;
        // Igual que en _buildRow: la columna catálogo hermana ya muestra
        // "clave - nombre", así que esta queda oculta — pero el hidden con
        // su valor se arma igual, sigue haciendo falta para el submit.
        if (col.isCopyTarget) td.style.display = 'none';

        const hidden = createElement('input');
        hidden.type = 'hidden';
        hidden.name = `${multifieldId}_${col.id}_${absoluteIndex}`;
        hidden.value = (rowData && rowData[col.id] != null) ? rowData[col.id] : '';
        td.appendChild(hidden);

        td.appendChild(createElement('span', 'multifield-display-value', String(_resolveDisplayValue(col, rowData))));
        row.appendChild(td);
    });

    const actionTd = createElement('td', 'multifield-action-cell');
    actionTd.dataset.label = '';
    const delBtn = createElement('button', 'multifield-delete-btn', '✕');
    delBtn.type = 'button';
    delBtn.title = 'Eliminar fila';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('¿Eliminar este registro?')) return;
        const gridContainer = delBtn.closest('.multifield-grid');
        const idx = parseInt(row.getAttribute('data-row-index'));
        _deleteRow(gridContainer, idx);
    });
    actionTd.appendChild(delBtn);
    row.appendChild(actionTd);

    row.addEventListener('click', (e) => {
        if (e.target.closest('.multifield-delete-btn')) return;
        const gridContainer = row.closest('.multifield-grid');
        const idx = parseInt(row.getAttribute('data-row-index'));
        const columnsNow = _getColumns(gridContainer.querySelector('thead'));
        const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
        _openRowModal(gridContainer, columnsNow, allRows[idx], idx);
    });

    return row;
}

/**
 * Re-renderiza el tbody (solo lectura, sin relleno) y el estado de los
 * botones de scroll ▲/▼.
 */
function _rerenderDisplayGrid(gridContainer) {
    const tbody = gridContainer.querySelector('tbody');
    const thead = gridContainer.querySelector('thead');
    if (!tbody || !thead) return;

    const multifieldId = gridContainer.getAttribute('data-multifield-id');
    const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
    const columns = _getColumns(thead);

    tbody.innerHTML = '';
    allRows.forEach((rowData, idx) => {
        tbody.appendChild(_buildDisplayRow(multifieldId, columns, rowData, idx));
    });

    gridContainer.dataset.totalRows = allRows.length;

    // Disparar evento para que campos virtuales (ej. sum() a nivel de form) se recalculen
    gridContainer.dispatchEvent(new CustomEvent('multifield-populated', { bubbles: true }));

    // Alto del contenedor con scroll = header (fijo, no cuenta como fila) +
    // altura real de una fila × `display` filas de REGISTROS visibles — se
    // mide en vivo (no un rem fijo) porque la altura de fila difiere mucho
    // entre la tabla desktop y la tarjeta mobile. El header queda sticky
    // (CSS) para no scrollear junto con las filas.
    const display = parseInt(gridContainer.getAttribute('data-display')) || DEFAULTS.DISPLAY;
    const scrollBox = gridContainer.querySelector('.multifield-scroll-box');
    const firstRow = tbody.querySelector('tr');
    if (scrollBox) {
        const headerHeight = thead.getBoundingClientRect().height;
        scrollBox.style.maxHeight = firstRow
            ? `${headerHeight + firstRow.getBoundingClientRect().height * display}px`
            : '';
    }

    _updateScrollControls(gridContainer);
}

/**
 * Habilita/deshabilita y muestra/oculta los botones ▲/▼ según haga falta
 * scroll o no, y según la posición actual del scroll.
 */
function _updateScrollControls(gridContainer) {
    const scrollBox = gridContainer.querySelector('.multifield-scroll-box');
    const upBtn = gridContainer.querySelector('.multifield-scroll-up');
    const downBtn = gridContainer.querySelector('.multifield-scroll-down');
    if (!scrollBox || !upBtn || !downBtn) return;

    const needsScroll = scrollBox.scrollHeight > scrollBox.clientHeight + 1;
    upBtn.hidden = !needsScroll;
    downBtn.hidden = !needsScroll;
    if (!needsScroll) return;

    upBtn.disabled = scrollBox.scrollTop <= 0;
    downBtn.disabled = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 1;
}

/**
 * Scrollea de a una fila (altura real de la primera fila) en la dirección dada.
 */
function _scrollGridBy(gridContainer, direction) {
    const scrollBox = gridContainer.querySelector('.multifield-scroll-box');
    if (!scrollBox) return;
    const firstRow = scrollBox.querySelector('tbody tr');
    const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : 32;
    scrollBox.scrollBy({ top: direction * rowHeight, behavior: 'smooth' });
}

/**
 * Configura tracking de cambios y validación unique via event delegation
 * Se llama una sola vez al crear el gridContainer.
 */
function _setupChangeTracking(gridContainer) {
    let _recomputing = false;

    function _recomputeRowExprs(rowEl, allRows, currentIdx) {
        const computed = rowEl.querySelectorAll('.multifield-cell-input[data-is-expr]');
        if (computed.length === 0) return;
        _recomputing = true;
        computed.forEach(cell => {
            const result = _evaluateRowExpr(cell.dataset.isExpr, rowEl);
            if (result !== null) {
                cell.value = Number.isInteger(result) ? String(result) : result.toFixed(2);
                if (allRows && currentIdx >= 0) allRows[currentIdx][cell.dataset.colId] = result;
                cell.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        _recomputing = false;
    }

    // input: recomputa is= en tiempo real (visual) sin esperar blur
    gridContainer.addEventListener('input', (e) => {
        if (_recomputing) return;
        const input = e.target.closest('.multifield-cell-input');
        if (!input || input.dataset.isExpr) return;
        const rowEl = input.closest('tr');
        if (rowEl) _recomputeRowExprs(rowEl, null, -1);
    });

    gridContainer.addEventListener('change', (e) => {
        if (_recomputing) return;
        const input = e.target.closest('.multifield-cell-input');
        if (!input || input.dataset.isExpr) return;

        const rowEl = input.closest('tr');
        if (!rowEl) return;

        const currentIdx = parseInt(rowEl.getAttribute('data-row-index'));
        const colId = input.dataset.colId;
        if (!colId || isNaN(currentIdx)) return;

        const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
        while (allRows.length <= currentIdx) allRows.push({});
        allRows[currentIdx][colId] = input.value;

        const multifieldId = gridContainer.getAttribute('data-multifield-id');
        const allColumns = _getColumns(gridContainer.querySelector('thead'));

        // Marcar esta celda "choice" como elegida a mano solo si el cambio lo
        // disparó el usuario (no el refresh programático de abajo, que se
        // identifica con dataset.autoSet — ver _refreshChoiceCell).
        const thisCol = allColumns.find(c => c.id === colId);
        if (thisCol && thisCol.type === 'choice') {
            if (input.dataset.autoSet === '1') delete input.dataset.autoSet;
            else input.dataset.touched = '1';
        }

        // Si la celda que cambió es ella misma una columna catálogo
        // (type="select" + lookupConfig), Autocomplete.js ya dejó la fila
        // completa en rowEl.dataset.catalogRow — reconstruir las <option> de
        // cualquier columna "choice" hermana con esos valores. Se persiste
        // en allRows (__catalogRow) para que sobreviva un re-render del grid
        // (agregar/borrar fila, paginar), que crea un <tr> nuevo y perdería
        // el dataset si no.
        if (thisCol && thisCol.type === 'select' && thisCol.lookupConfig) {
            try { allRows[currentIdx].__catalogRow = JSON.parse(rowEl.dataset.catalogRow || '{}'); }
            catch { /* dataset inválido, no persistir */ }

            allColumns.filter(c => c.type === 'choice' && c.choiceConfig).forEach(choiceCol => {
                const choiceInput = rowEl.querySelector(`#${multifieldId}_${choiceCol.id}_${currentIdx}`);
                if (choiceInput) {
                    _refreshChoiceCell(choiceInput, rowEl, choiceCol, null);
                    choiceInput.dataset.autoSet = '1';
                    choiceInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        _recomputeRowExprs(rowEl, allRows, currentIdx);
        gridContainer.dataset.allRows = JSON.stringify(allRows);

        // Validación de check expression
        if (input.dataset.check) {
            const val = parseFloat(input.value) || 0;
            const ok = ExpressionEngine.evaluate(input.dataset.check, {
                this: val, _currentValue: val, [colId]: val
            });
            if (!ok) {
                input.classList.add('field-error');
                input.title = input.title || `Debe cumplir: ${input.dataset.check}`;
            } else {
                input.classList.remove('field-error');
                input.title = '';
            }
        }

        // Validación de unicidad
        const thead = gridContainer.querySelector('thead');
        if (thead) {
            const colTh = thead.querySelector(`th[data-field-id="${colId}"]`);
            if (colTh && colTh.getAttribute('data-unique') === 'true') {
                const isDup = allRows.some((r, idx) =>
                    idx !== currentIdx && String(r[colId] ?? '') === String(input.value) && input.value !== ''
                );
                if (isDup) {
                    input.classList.add('field-error');
                    input.title = `Valor duplicado en columna "${colId}"`;
                } else {
                    input.classList.remove('field-error');
                    input.title = '';
                }
            }
        }
    });
}

/**
 * Abre el modal de alta/edición de un registro del multifield. `rowData` +
 * `absoluteIndex` null/null = alta; con valores = edición de esa fila.
 * Reusa _buildRow + _setupChangeTracking tal cual (no asumen vivir dentro
 * del grid real, ver nota en Autocomplete.js/attachAutocompleteHandlers) en
 * un mini-grid propio de 1 fila, así toda la lógica de catálogo/choice/is=/
 * check ya probada funciona sin cambios dentro del modal.
 */
function _openRowModal(gridContainer, columns, rowData, absoluteIndex) {
    const multifieldId = gridContainer.getAttribute('data-multifield-id');
    const isEdit = absoluteIndex != null;
    const itemLabel = gridContainer.dataset.itemLabel || 'REGISTRO';

    // Centrado sobre el form (.terminal-window), no sobre todo el navegador:
    // position:absolute anclado ahí en vez de fixed sobre document.body.
    // Fallback a body/fixed si por algún motivo no hay .terminal-window
    // (ej. el multifield vive en un layout distinto al habitual).
    const formContainer = gridContainer.closest('.terminal-window') || document.body;
    const anchoredToForm = formContainer !== document.body;
    if (anchoredToForm && getComputedStyle(formContainer).position === 'static') {
        formContainer.style.position = 'relative';
    }

    const backdrop = createElement('div', 'mf-row-modal-backdrop');
    backdrop.style.position = anchoredToForm ? 'absolute' : 'fixed';
    const modal = createElement('div', 'mf-row-modal');
    backdrop.appendChild(modal);

    // Mismo título que el botón que abre el modal (ver item-label en
    // renderGridFromMultifield), para que "AGREGAR PRODUCTO" del botón y el
    // título del modal digan exactamente lo mismo.
    const title = createElement('h3', 'mf-row-modal-title', `${isEdit ? 'EDITAR' : 'AGREGAR'} ${itemLabel}`);
    modal.appendChild(title);
    modal.appendChild(createElement('hr', 'mf-row-modal-divider'));

    // Sin caja propia alrededor de los campos: .multifield-grid ya trae su
    // propio borde+fondo+sombra (pensado para el grid real de la página) —
    // sumarle otro borde acá daba "2 recuadros anidados" con fondos
    // distintos. .mf-row-modal-grid anula esos estilos en el CSS.
    const miniGrid = createElement('div', 'multifield-grid mf-row-modal-grid');
    miniGrid.setAttribute('data-multifield-id', multifieldId);
    miniGrid.dataset.allRows = JSON.stringify([rowData ? { ...rowData } : {}]);
    const table = createElement('table', 'multifield-table');
    // _setupChangeTracking/_getColumns leen columnas vía gridContainer
    // .querySelector('thead') — clonar el thead real (ya tiene toda la
    // metadata data-lookup/data-choice/data-unique calculada una vez en
    // renderGridFromMultifield) en vez de reconstruirla.
    const thead = gridContainer.querySelector('thead').cloneNode(true);
    const tbody = createElement('tbody');
    tbody.appendChild(_buildRow(multifieldId, columns, rowData, 0));
    table.appendChild(thead);
    table.appendChild(tbody);
    miniGrid.appendChild(table);
    modal.appendChild(miniGrid);

    _setupChangeTracking(miniGrid);

    const errorEl = createElement('div', 'mf-row-modal-error');
    errorEl.hidden = true;
    modal.appendChild(errorEl);

    const footer = createElement('div', 'mf-row-modal-footer');
    const cancelBtn = createElement('button', 'mf-row-modal-cancel-btn', 'Volver');
    cancelBtn.type = 'button';
    const saveBtn = createElement('button', 'mf-row-modal-save-btn', 'Guardar');
    saveBtn.type = 'button';
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    const onKeydown = (e) => { if (e.key === 'Escape') close(); };

    function close() {
        backdrop.remove();
        document.removeEventListener('keydown', onKeydown);
    }

    document.addEventListener('keydown', onKeydown);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    cancelBtn.addEventListener('click', close);

    saveBtn.addEventListener('click', () => {
        const hasFieldError = !!miniGrid.querySelector('.field-error');

        // Se lee directo del DOM (no de miniGrid.dataset.allRows): el
        // catálogo dispara un 'change' anidado en su columna choice hermana
        // mientras el handler del catálogo todavía está corriendo — ese
        // 'change' anidado escribe el dataset con el valor nuevo, pero el
        // handler externo lo pisa después con su propia copia vieja al
        // terminar (mismo _setupChangeTracking que usa el grid real, donde
        // esto nunca importó porque el submit real lee FormData, no el
        // dataset). El DOM del input siempre tiene el valor correcto.
        const modalRowEl = miniGrid.querySelector('tbody tr');
        const rowResult = {};
        columns.forEach(col => {
            const inputEl = modalRowEl.querySelector(`[data-col-id="${col.id}"]`);
            if (inputEl) rowResult[col.id] = inputEl.value;
        });
        try { rowResult.__catalogRow = JSON.parse(modalRowEl.dataset.catalogRow || '{}'); } catch { /* sin catalogRow, no pasa nada */ }

        // Única validación "requerida" hoy: la columna catálogo principal
        // (type="select" + in-table) no puede quedar vacía — las columnas de
        // multifield no soportan <required> propio.
        const mainCatalogCol = columns.find(c => c.type === 'select' && c.lookupConfig);
        const missingMain = mainCatalogCol && !rowResult[mainCatalogCol.id];

        if (hasFieldError || missingMain) {
            errorEl.textContent = missingMain
                ? `Elegí un valor para "${mainCatalogCol.label}" antes de guardar.`
                : 'Revisá los campos marcados antes de guardar.';
            errorEl.hidden = false;
            return;
        }

        // El mini-grid del modal solo tiene esta fila — la unicidad hay que
        // chequearla a mano contra el resto de filas ya guardadas en el
        // grid real (_setupChangeTracking la resuelve mirando filas
        // hermanas del mismo contenedor, acá no hay hermanas).
        const realAllRows = JSON.parse(gridContainer.dataset.allRows || '[]');
        const thead = gridContainer.querySelector('thead');
        const uniqueCols = columns.filter(c => thead?.querySelector(`th[data-field-id="${c.id}"]`)?.getAttribute('data-unique') === 'true');
        const dupCol = uniqueCols.find(c =>
            realAllRows.some((r, idx) => idx !== absoluteIndex && r[c.id] !== '' && String(r[c.id] ?? '') === String(rowResult[c.id] ?? ''))
        );
        if (dupCol) {
            errorEl.textContent = `Valor duplicado en "${dupCol.label}".`;
            errorEl.hidden = false;
            return;
        }

        if (isEdit) {
            realAllRows[absoluteIndex] = rowResult;
        } else {
            realAllRows.push(rowResult);
        }
        gridContainer.dataset.allRows = JSON.stringify(realAllRows);
        _rerenderDisplayGrid(gridContainer);
        close();
    });

    formContainer.appendChild(backdrop);
    modal.querySelector('.autocomplete-wrapper input, input:not([type="hidden"])')?.focus();
}

/**
 * Elimina la fila en absoluteIndex del grid
 */
function _deleteRow(gridContainer, absoluteIndex) {
    const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
    if (absoluteIndex < 0 || absoluteIndex >= allRows.length) return;

    // Guardar fila eliminada (solo si tiene datos — no filas vacías añadidas por el usuario)
    const deletedRow = allRows[absoluteIndex];
    if (deletedRow && Object.keys(deletedRow).length > 0) {
        const multifieldId = gridContainer.getAttribute('data-multifield-id');
        const hiddenInput = gridContainer.querySelector(`input[name="${multifieldId}_deleted"]`);
        if (hiddenInput) {
            const deletedRows = JSON.parse(hiddenInput.value || '[]');
            deletedRows.push(deletedRow);
            hiddenInput.value = JSON.stringify(deletedRows);
        }
    }

    allRows.splice(absoluteIndex, 1);
    gridContainer.dataset.allRows = JSON.stringify(allRows);
    gridContainer.dataset.totalRows = allRows.length;

    _rerenderDisplayGrid(gridContainer);
}

// ============================================
// EXPORTS PRINCIPALES
// ============================================

/**
 * Renderiza un multifield como textarea (1 campo hijo)
 */
export const renderTextareaFromMultifield = (fieldXml, parentContainer, config, messages = {}) => {
    const childField = fieldXml.querySelector(':scope > field');
    const childId = childField.getAttribute('id') || 'texto';

    const rows = parseInt(fieldXml.getAttribute('rows')) || DEFAULTS.ROWS;
    const display = parseInt(fieldXml.getAttribute('display')) || DEFAULTS.DISPLAY;
    const displayOnly = childField.getAttribute('display-only') === 'true';
    const maxLength = rows * 80;

    const textareaConfig = {
        id: childId,
        labelTxt: config.labelTxt || fieldXml.getAttribute('label') || '',
        type: 'textarea',
        size: maxLength,
        isRequired: config.isRequired,
        isSkip: displayOnly,
        defaultValue: config.defaultValue,
        parentIsHorizontal: config.parentIsHorizontal,
        helpId: config.helpId,
        rows: display
    };

    console.log(`📝 Multifield → Textarea: ${childId} (${display} rows visible, max ${rows} lines)`);
    renderInputField(textareaConfig, messages, parentContainer);
};

/**
 * Renderiza un multifield como grid/tabla (múltiples campos hijos)
 */
export const renderGridFromMultifield = (fieldXml, parentContainer, config, messages = {}) => {
    const childFields = fieldXml.querySelectorAll(':scope > field');
    const rows = parseInt(fieldXml.getAttribute('rows')) || DEFAULTS.ROWS;
    const display = parseInt(fieldXml.getAttribute('display')) || DEFAULTS.DISPLAY;

    console.log(`📊 Multifield → Grid: ${config.id} (${childFields.length} columnas, ${display} filas visibles)`);

    const parentIsHorizontal = parentContainer.classList.contains('horizontal-container');
    const fieldWrapper = createFieldWrapper(parentIsHorizontal);

    if (config.labelTxt) {
        const labelEl = createLabel(config.id, config.labelTxt, config.isRequired, config.helpId, messages);
        fieldWrapper.appendChild(labelEl);
    }

    // Contenedor del grid con metadatos
    const tableContainer = createElement('div', 'multifield-grid');
    tableContainer.setAttribute('data-rows', rows);
    tableContainer.setAttribute('data-display', display);
    tableContainer.setAttribute('data-multifield-id', config.id);
    tableContainer.dataset.allRows = '[]';
    tableContainer.dataset.totalRows = '0';

    const table = createElement('table', 'multifield-table');
    const thead = createElement('thead');
    const tbody = createElement('tbody');

    // Columnas que son solo una copia de otra columna catálogo (ej.
    // "producto", copy target de "id_producto") — esa columna catálogo ya
    // muestra "clave - nombre" (ver overlay en Autocomplete.js), así que
    // mostrar el nombre dos veces es redundante. Se ocultan tanto el <th>
    // (acá abajo) como la celda compacta correspondiente (_buildDisplayRow)
    // y la del modal (_buildRow) — a diferencia de un skip/readonly
    // independiente como "precio_total", que sí tiene valor propio.
    const copyTargetIds = new Set();
    childFields.forEach(field => {
        field.querySelectorAll('validation in-table copy').forEach(c => {
            const to = c.getAttribute('to');
            if (to) copyTargetIds.add(to);
        });
    });

    // Encabezados de columna (con metadatos para reconstrucción)
    const headerRow = createElement('tr');
    childFields.forEach(field => {
        const fieldId = field.getAttribute('id');
        const isSkip = field.getAttribute('skip') === 'true';
        const isReadonly = field.getAttribute('readonly') === 'true';
        const isUnique = field.getAttribute('unique') === 'true';
        const fieldType = field.getAttribute('type') || 'text';
        const isExpr = field.getAttribute('is') || null;
        const th = createElement('th', '', field.getAttribute('label') || fieldId);
        th.setAttribute('data-field-id', fieldId);
        if (copyTargetIds.has(fieldId)) th.hidden = true;
        if (isSkip) th.setAttribute('data-skip', 'true');
        if (isReadonly) th.setAttribute('data-readonly', 'true');
        if (isUnique) th.setAttribute('data-unique', 'true');
        th.setAttribute('data-type', fieldType);
        if (isExpr) th.setAttribute('data-is-expr', isExpr);
        const checkExpr = field.querySelector('validation > check, check')?.textContent?.trim();
        if (checkExpr) th.setAttribute('data-check', checkExpr);
        const fieldSize = parseInt(field.getAttribute('size')) || null;
        if (fieldSize) th.setAttribute('data-size', String(fieldSize));
        // <default> como elemento hijo, misma convención que un <field> normal
        // (LayoutProcessor.js — no como atributo, ver AGENTS.md).
        const defaultVal = field.querySelector('default')?.textContent?.trim();
        if (defaultVal) th.setAttribute('data-default', defaultVal);

        // Columna catálogo: mismo <in-table> anidado en <validation> que usa
        // ValidationCoordinator.js para campos normales (ver AGENTS.md — el
        // hijo directo de <field> no lo lee nada, esto replica esa convención
        // a propósito, no por descuido).
        if (fieldType === 'select') {
            const inTableEl = field.querySelector('validation in-table');
            if (inTableEl) {
                const copyFields = Array.from(inTableEl.querySelectorAll('copy')).map(c => ({
                    from: c.getAttribute('from'),
                    to: c.getAttribute('to')
                }));
                th.setAttribute('data-lookup', JSON.stringify({
                    table: inTableEl.getAttribute('table') || null,
                    url: inTableEl.getAttribute('url') || null,
                    key: inTableEl.getAttribute('key'),
                    displayField: inTableEl.getAttribute('display') || inTableEl.getAttribute('key'),
                    copyFields
                }));
            }
        }

        // Columna "choice": mismo widget autocomplete que <options>, cuyas
        // opciones salen de la fila de catálogo que trajo una columna vecina
        // type="select" (ver _choiceOptionRows) — option.from es un nombre
        // de columna de ESA tabla, no el id de otro field del multifield.
        // Misma convención de anidar en <validation> que <in-table>.
        if (fieldType === 'choice') {
            const choiceEl = field.querySelector('validation choice');
            if (choiceEl) {
                const options = Array.from(choiceEl.querySelectorAll('option')).map(o => ({
                    from: o.getAttribute('from'),
                    suffix: o.getAttribute('suffix') || ''
                }));
                th.setAttribute('data-choice', JSON.stringify({
                    options,
                    defaultFrom: choiceEl.getAttribute('default-from') || (options[0] && options[0].from) || null
                }));
            }
        }

        headerRow.appendChild(th);
    });

    // Encabezado columna de acción
    const actionTh = createElement('th', 'multifield-action-header', '');
    headerRow.appendChild(actionTh);
    thead.appendChild(headerRow);

    table.appendChild(thead);
    table.appendChild(tbody);

    // Envolver la tabla en un contenedor con scroll + nav ▲/▼ (en vez de
    // paginación): `display` pasa a ser "cuántas filas se ven antes de
    // necesitar scroll", no "tamaño de página" — ver UX-UI-IMPROVEMENT-PLAN.md.
    const scrollRow = createElement('div', 'multifield-scroll-row');
    const scrollBox = createElement('div', 'multifield-scroll-box');
    scrollBox.appendChild(table);
    scrollRow.appendChild(scrollBox);

    const scrollNav = createElement('div', 'multifield-scroll-nav');
    const scrollUpBtn = createElement('button', 'multifield-scroll-up', '▲');
    const scrollDownBtn = createElement('button', 'multifield-scroll-down', '▼');
    scrollUpBtn.type = 'button';
    scrollDownBtn.type = 'button';
    scrollUpBtn.hidden = true;
    scrollDownBtn.hidden = true;
    scrollUpBtn.addEventListener('click', () => _scrollGridBy(tableContainer, -1));
    scrollDownBtn.addEventListener('click', () => _scrollGridBy(tableContainer, 1));
    scrollNav.appendChild(scrollUpBtn);
    scrollNav.appendChild(scrollDownBtn);
    scrollRow.appendChild(scrollNav);

    tableContainer.appendChild(scrollRow);
    scrollBox.addEventListener('scroll', () => _updateScrollControls(tableContainer));

    // Botón de alta — texto configurable desde el XML vía item-label, para
    // no hardcodear "PRODUCTO" en el motor (ej. item-label="producto" →
    // "+ AGREGAR PRODUCTO"; fallback genérico si el form no lo declara).
    const controls = createElement('div', 'multifield-controls');
    const itemLabel = (fieldXml.getAttribute('item-label') || 'registro').toUpperCase();
    tableContainer.dataset.itemLabel = itemLabel;
    const addBtn = createElement('button', 'multifield-btn multifield-add-btn', `+ AGREGAR ${itemLabel}`);
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => {
        const columnsNow = _getColumns(thead);
        _openRowModal(tableContainer, columnsNow, null, null);
    });
    controls.appendChild(addBtn);
    tableContainer.appendChild(controls);

    // Hidden input para tracking de filas eliminadas (recogido por FormData al enviar)
    const deletedInput = createElement('input');
    deletedInput.type = 'hidden';
    deletedInput.name = `${config.id}_deleted`;
    deletedInput.value = '[]';
    tableContainer.appendChild(deletedInput);

    // El grid arranca vacío (allRows=[]) — sin filas de relleno. Alta y
    // edición van por _openRowModal; el tbody real no tiene inputs propios,
    // por eso no hace falta _setupChangeTracking sobre tableContainer (esa
    // delegación ahora vive en el mini-grid de cada modal).

    fieldWrapper.appendChild(tableContainer);

    if (config.helpId && messages[config.helpId]) {
        const helpTooltip = createHelpTooltip(config.id, config.labelTxt || config.id, messages[config.helpId]);
        fieldWrapper.appendChild(helpTooltip);
    }

    parentContainer.appendChild(fieldWrapper);
};

/**
 * Renderiza un multifield (detecta automáticamente si es textarea o grid)
 */
export const renderMultifield = (fieldXml, parentContainer, config, messages = {}) => {
    if (isTextareaMultifield(fieldXml)) {
        renderTextareaFromMultifield(fieldXml, parentContainer, config, messages);
    } else if (isGridMultifield(fieldXml)) {
        renderGridFromMultifield(fieldXml, parentContainer, config, messages);
    } else {
        console.warn(`⚠️ Multifield sin campos hijos: ${config.id}`);
    }
};

/**
 * Agrega una fila al final de un multifield sin reemplazar las existentes (appendRow handler response)
 */
export const appendRowToGrid = (multifieldId, rowData, container) => {
    const gridContainer = container?.querySelector(`[data-multifield-id="${multifieldId}"]`);
    if (!gridContainer) {
        console.warn(`⚠️ appendRowToGrid: No se encontró multifield ${multifieldId}`);
        return;
    }

    const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
    allRows.push(rowData);
    gridContainer.dataset.allRows = JSON.stringify(allRows);

    _rerenderDisplayGrid(gridContainer);
};

/**
 * Pobla un multifield con datos externos (desde handler)
 */
export const populateRows = (multifieldId, rows, container) => {
    if (!rows || !Array.isArray(rows)) {
        console.warn(`⚠️ populateRows: rows no es un array válido`);
        return;
    }

    const gridContainer = container?.querySelector(`[data-multifield-id="${multifieldId}"]`);
    if (!gridContainer) {
        console.warn(`⚠️ populateRows: No se encontró multifield ${multifieldId}`);
        return;
    }

    gridContainer.dataset.allRows = JSON.stringify(rows);

    _rerenderDisplayGrid(gridContainer);

    console.log(`✅ populateRows: ${rows.length} filas cargadas en ${multifieldId}`);
};

export default {
    DEFAULTS,
    isTextareaMultifield,
    isGridMultifield,
    renderTextareaFromMultifield,
    renderGridFromMultifield,
    renderMultifield,
    populateRows
};
