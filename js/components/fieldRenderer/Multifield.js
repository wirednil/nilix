/**
 * @file Multifield.js
 * @description Módulo para renderizar multifields (textarea o grid/tabla)
 * @module fieldRenderer/Multifield
 */

import { createElement } from '../../utils/domUtils.js';
import { createLabel, createHelpTooltip } from './Label.js';
import { createFieldWrapper, createInputElement, renderInputField } from './InputField.js';
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
    return Array.from(thead.querySelectorAll('th[data-field-id]')).map(th => ({
        id: th.getAttribute('data-field-id'),
        label: th.textContent.trim(),
        isSkip: th.getAttribute('data-skip') === 'true',
        isUnique: th.getAttribute('data-unique') === 'true',
        type: th.getAttribute('data-type') || 'text',
        isExpr: th.getAttribute('data-is-expr') || null,
        check: th.getAttribute('data-check') || null,
        size:  parseInt(th.getAttribute('data-size')) || null
    }));
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
 * Construye un <tr> completo para una fila con inputs y botón eliminar
 */
function _buildRow(multifieldId, columns, rowData, absoluteIndex) {
    const row = createElement('tr');
    row.setAttribute('data-row-index', absoluteIndex);
    if (!rowData) row.dataset.empty = 'true';

    columns.forEach(col => {
        const td = createElement('td');
        td.dataset.label = col.label;

        if (col.type === 'stepper') {
            td.appendChild(_buildStepperCell(multifieldId, col, rowData, absoluteIndex));
        } else {
            const input = createElement('input');
            input.type = col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text';
            if (col.type === 'number') input.step = 'any';
            input.id = `${multifieldId}_${col.id}_${absoluteIndex}`;
            input.name = `${multifieldId}_${col.id}_${absoluteIndex}`;
            input.className = 'multifield-cell-input';
            input.dataset.colId = col.id;
            input.value = rowData ? (rowData[col.id] ?? '') : '';

            if (col.isSkip) {
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
 * Re-renderiza el tbody y actualiza controles de paginación
 */
function _rerenderGrid(gridContainer) {
    const tbody = gridContainer.querySelector('tbody');
    const thead = gridContainer.querySelector('thead');
    const controls = gridContainer.querySelector('.multifield-controls');
    if (!tbody || !thead) return;

    const multifieldId = gridContainer.getAttribute('data-multifield-id');
    const display = parseInt(gridContainer.getAttribute('data-display')) || 10;
    const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
    const totalRows = allRows.length;
    const currentPage = parseInt(gridContainer.dataset.currentPage) || 0;
    const columns = _getColumns(thead);
    const start = currentPage * display;

    tbody.innerHTML = '';

    for (let i = 0; i < display; i++) {
        const dataIndex = start + i;
        if (dataIndex < totalRows) {
            tbody.appendChild(_buildRow(multifieldId, columns, allRows[dataIndex], dataIndex));
        } else {
            // Fila vacía de relleno con inputs
            tbody.appendChild(_buildRow(multifieldId, columns, null, dataIndex));
        }
    }

    // Disparar evento para que campos virtuales se recalculen
    gridContainer.dispatchEvent(new CustomEvent('multifield-populated', { bubbles: true }));

    if (controls) {
        _updateControls(gridContainer, controls, totalRows, display, currentPage);
    }
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
 * Actualiza estado visual de controles de paginación
 */
function _updateControls(gridContainer, controls, totalRows, display, currentPage) {
    const totalPages = Math.ceil(totalRows / display) || 1;
    const prevBtn = controls.querySelector('.multifield-prev-btn');
    const nextBtn = controls.querySelector('.multifield-next-btn');
    const pageInfo = controls.querySelector('.multifield-page-info');

    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
    if (pageInfo) {
        const start = currentPage * display + 1;
        const end = Math.min((currentPage + 1) * display, totalRows);
        pageInfo.textContent = totalRows > 0
            ? `${start}-${end} de ${totalRows}`
            : '0 de 0';
    }
}

/**
 * Agrega una fila vacía al final del grid
 */
function _addRow(gridContainer) {
    const allRows = JSON.parse(gridContainer.dataset.allRows || '[]');
    allRows.push({});
    gridContainer.dataset.allRows = JSON.stringify(allRows);
    gridContainer.dataset.totalRows = allRows.length;

    const display = parseInt(gridContainer.getAttribute('data-display')) || 10;
    const lastPage = Math.max(0, Math.ceil(allRows.length / display) - 1);
    gridContainer.dataset.currentPage = lastPage;

    _rerenderGrid(gridContainer);
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

    const display = parseInt(gridContainer.getAttribute('data-display')) || 10;
    const totalPages = Math.ceil(allRows.length / display) || 1;
    let currentPage = parseInt(gridContainer.dataset.currentPage) || 0;
    if (currentPage >= totalPages) {
        currentPage = totalPages - 1;
        gridContainer.dataset.currentPage = currentPage;
    }

    _rerenderGrid(gridContainer);
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
    tableContainer.dataset.currentPage = '0';
    tableContainer.dataset.totalRows = '0';

    const table = createElement('table', 'multifield-table');
    const thead = createElement('thead');
    const tbody = createElement('tbody');

    // Encabezados de columna (con metadatos para reconstrucción)
    const headerRow = createElement('tr');
    childFields.forEach(field => {
        const fieldId = field.getAttribute('id');
        const isSkip = field.getAttribute('skip') === 'true';
        const isUnique = field.getAttribute('unique') === 'true';
        const fieldType = field.getAttribute('type') || 'text';
        const isExpr = field.getAttribute('is') || null;
        const th = createElement('th', '', field.getAttribute('label') || fieldId);
        th.setAttribute('data-field-id', fieldId);
        if (isSkip) th.setAttribute('data-skip', 'true');
        if (isUnique) th.setAttribute('data-unique', 'true');
        th.setAttribute('data-type', fieldType);
        if (isExpr) th.setAttribute('data-is-expr', isExpr);
        const checkExpr = field.querySelector('validation > check, check')?.textContent?.trim();
        if (checkExpr) th.setAttribute('data-check', checkExpr);
        const fieldSize = parseInt(field.getAttribute('size')) || null;
        if (fieldSize) th.setAttribute('data-size', String(fieldSize));
        headerRow.appendChild(th);
    });
    // Encabezado columna de acción
    const actionTh = createElement('th', 'multifield-action-header', '');
    headerRow.appendChild(actionTh);
    thead.appendChild(headerRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Controles de paginación y botón AGR
    const controls = createElement('div', 'multifield-controls');
    const prevBtn = createElement('button', 'multifield-btn multifield-prev-btn', '← Anterior');
    const nextBtn = createElement('button', 'multifield-btn multifield-next-btn', 'Siguiente →');
    const pageInfo = createElement('span', 'multifield-page-info', '0 de 0');
    const addBtn = createElement('button', 'multifield-btn multifield-add-btn', '+ AGR');

    prevBtn.type = 'button';
    nextBtn.type = 'button';
    addBtn.type = 'button';
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    prevBtn.addEventListener('click', () => {
        let currentPage = parseInt(tableContainer.dataset.currentPage) || 0;
        if (currentPage > 0) {
            tableContainer.dataset.currentPage = --currentPage;
            _rerenderGrid(tableContainer);
        }
    });

    nextBtn.addEventListener('click', () => {
        const allRows = JSON.parse(tableContainer.dataset.allRows || '[]');
        const totalPages = Math.ceil(allRows.length / display) || 1;
        let currentPage = parseInt(tableContainer.dataset.currentPage) || 0;
        if (currentPage < totalPages - 1) {
            tableContainer.dataset.currentPage = ++currentPage;
            _rerenderGrid(tableContainer);
        }
    });

    addBtn.addEventListener('click', () => _addRow(tableContainer));

    controls.appendChild(prevBtn);
    controls.appendChild(pageInfo);
    controls.appendChild(nextBtn);
    controls.appendChild(addBtn);
    tableContainer.appendChild(controls);

    // Hidden input para tracking de filas eliminadas (recogido por FormData al enviar)
    const deletedInput = createElement('input');
    deletedInput.type = 'hidden';
    deletedInput.name = `${config.id}_deleted`;
    deletedInput.value = '[]';
    tableContainer.appendChild(deletedInput);

    // Configurar tracking de cambios (una sola vez)
    _setupChangeTracking(tableContainer);

    // Filas vacías iniciales con inputs (misma apariencia que antes de Sprint 19)
    const columns = _getColumns(thead);
    for (let i = 0; i < display; i++) {
        tbody.appendChild(_buildRow(config.id, columns, null, i));
    }

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
    gridContainer.dataset.totalRows = allRows.length;

    const display = parseInt(gridContainer.getAttribute('data-display')) || 10;
    const lastPage = Math.max(0, Math.ceil(allRows.length / display) - 1);
    gridContainer.dataset.currentPage = lastPage;

    _rerenderGrid(gridContainer);
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
    gridContainer.dataset.totalRows = rows.length;
    gridContainer.dataset.currentPage = '0';

    _rerenderGrid(gridContainer);

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
