/**
 * @file Autocomplete.js
 * @description Custom autocomplete component for lookup fields and static selects
 * @module fieldRenderer/Autocomplete
 */

import { createElement } from '../../utils/domUtils.js';
import LookupService from '../../services/LookupService.js';

const DROPDOWN_MAX_HEIGHT = '200px';

export function createAutocomplete({ id, size, isRequired, isSkip, lookupConfig, selectOptions, defaultValue }) {
    const wrapper = createElement('div', 'autocomplete-wrapper');

    const inputEl = createElement('input');
    inputEl.type = 'text';
    inputEl.id = id;
    inputEl.name = id;
    inputEl.autocomplete = 'off';
    if (isRequired) inputEl.required = true;
    if (isSkip) {
        inputEl.readOnly = true;
        // Select-type skip: allow dropdown but block free typing.
        // Plain text skip: fully readonly, no interaction.
        const isSelectType = lookupConfig || (selectOptions && selectOptions.length > 0);
        if (isSelectType) {
            inputEl.dataset.skipSelect = 'true';
        } else {
            inputEl.classList.add('readonly-field');
        }
    }

    if (size) {
        const sizeNum = parseInt(size);
        const effectiveSize = Math.max(sizeNum * 1.2, 8);
        inputEl.style.width = `${effectiveSize}ch`;
    }

    // El valor real (la clave, lo que se guarda) sigue siendo inputEl.value
    // — sin tocar eso ningún caller existente se entera. Para catálogos
    // reales (lookupConfig) se agrega una capa visual encima que muestra
    // "clave - nombre"; al tipear para buscar de nuevo, se
    // oculta y se ve el input real (igual que siempre).
    const inputBox = createElement('span', 'autocomplete-input-box');
    inputBox.appendChild(inputEl);

    let overlayEl = null;
    if (lookupConfig) {
        overlayEl = createElement('span', 'autocomplete-display-overlay');
        overlayEl.hidden = true;
        inputBox.appendChild(overlayEl);
    }

    const btnEl = createElement('button', 'autocomplete-btn');
    btnEl.type = 'button';
    btnEl.tabIndex = -1;
    btnEl.innerHTML = '&#9660;';
    btnEl.setAttribute('aria-label', 'Abrir lista');

    const dropdownEl = createElement('div', 'autocomplete-dropdown');
    dropdownEl.style.display = 'none';

    wrapper.appendChild(inputBox);
    wrapper.appendChild(btnEl);
    wrapper.appendChild(dropdownEl);

    return { wrapper, inputEl, btnEl, dropdownEl, overlayEl, defaultValue };
}

export function attachAutocompleteHandlers(inputEl, btnEl, dropdownEl, lookupConfig, container, selectOptions, { signal } = {}) {
    let catalogData = null;
    let catalogLoadTime = 0;
    let isOpen = false;
    let highlightedIndex = -1;
    let parentFilterValue = null; // cascade: value of parent field (null = no filter applied)

    // Capa "clave - nombre" para catálogos reales — ver createAutocomplete().
    const overlayEl = lookupConfig ? inputEl.parentElement?.querySelector('.autocomplete-display-overlay') : null;

    function refreshOverlay() {
        if (!overlayEl) return;
        let text = '';
        try {
            const row = JSON.parse(inputEl.dataset.selectedRow || 'null');
            if (row) {
                const kf = getKeyField();
                const df = getDisplayField();
                text = row[df] != null ? `${row[kf]} - ${row[df]}` : '';
            }
        } catch { text = ''; }
        overlayEl.textContent = text;
        overlayEl.hidden = !text;
    }

    async function loadCatalog() {
        const invalidationTime = LookupService.getInvalidationTimestamp();
        // console.log(`🔍 Autocomplete loadCatalog: catalogLoadTime=${catalogLoadTime}, invalidationTime=${invalidationTime}`);
        
        if (catalogData && catalogLoadTime > invalidationTime) {
            // console.log(`🔍 Autocomplete: usando cache en memoria`);
            return catalogData;
        }
        
        // console.log(`🔍 Autocomplete: recargando datos`);
        catalogData = null;
        
        if (selectOptions && selectOptions.length > 0) {
            // Spread primero: preserva props extra que un caller le agregue a
            // cada opción (ej. choice cells en Multifield.js llevan `from`)
            // sin que loadCatalog() tenga que saber nada de ellas.
            catalogData = selectOptions.map(opt => ({
                ...opt,
                key: opt.value || opt.textContent,
                display: opt.textContent
            }));
            catalogLoadTime = Date.now();
            return catalogData;
        }
        
        if (lookupConfig) {
            try {
                const catalog = lookupConfig.url
                    ? await LookupService.getCatalogFromUrl(lookupConfig.url)
                    : await LookupService.getCatalog(lookupConfig.table);
                catalogData = catalog?.rows || [];
                catalogLoadTime = Date.now();
                return catalogData;
            } catch (error) {
                console.error(`Error loading catalog: ${error.message}`);
                return [];
            }
        }
        
        return [];
    }
    
    function getKeyField() {
        return lookupConfig ? lookupConfig.key : 'key';
    }
    
    function getDisplayField() {
        return lookupConfig ? lookupConfig.displayField : 'display';
    }
    
    function renderOptions(filter = '') {
        dropdownEl.innerHTML = '';
        
        if (!catalogData || catalogData.length === 0) {
            const emptyMsg = createElement('div', 'autocomplete-empty');
            emptyMsg.textContent = 'No hay opciones';
            dropdownEl.appendChild(emptyMsg);
            return;
        }
        
        const keyField = getKeyField();
        const displayField = getDisplayField();

        // Cascade filter: restrict rows to those matching the parent field value
        let rows = catalogData;
        if (lookupConfig?.filterBy && lookupConfig?.filterField && parentFilterValue != null) {
            rows = catalogData.filter(row =>
                String(row[lookupConfig.filterField] ?? '') === String(parentFilterValue)
            );
        }

        const filterLower = filter.toLowerCase();
        const filtered = rows.filter(row => {
            const key = String(row[keyField] || '');
            const display = String(row[displayField] || '');
            return key.toLowerCase().includes(filterLower) ||
                   display.toLowerCase().includes(filterLower);
        });
        
        if (filtered.length === 0) {
            const emptyMsg = createElement('div', 'autocomplete-empty');
            emptyMsg.textContent = 'Sin coincidencias';
            dropdownEl.appendChild(emptyMsg);
            return;
        }
        
        // console.log(`🔍 Autocomplete renderOptions: ${filtered.length} items`);
        
        filtered.forEach((row, idx) => {
            const item = createElement('div', 'autocomplete-item');
            item.dataset.index = idx;
            item.dataset.key = row[keyField];
            
            const keySpan = createElement('span', 'autocomplete-key');
            keySpan.textContent = row[keyField];
            
            const displaySpan = createElement('span', 'autocomplete-display');
            displaySpan.textContent = row[displayField] || '';
            
            // Opción fija con valor = texto ("Transferencia"): una sola vez,
            // no "Transferencia - Transferencia". Los catálogos siguen con
            // "clave - nombre".
            if (row.hideKey || String(row[keyField]) === String(row[displayField] ?? '')) {
                item.appendChild(displaySpan);
            } else {
                item.appendChild(keySpan);
                item.appendChild(document.createTextNode(' - '));
                item.appendChild(displaySpan);
            }
            item.dataset.rowData = JSON.stringify(row);
            
            item.addEventListener('click', () => selectItem(item));
            item.addEventListener('mouseenter', () => highlightItem(idx));
            
            dropdownEl.appendChild(item);
        });
        
        highlightedIndex = -1;
    }
    
    function highlightItem(index) {
        const items = dropdownEl.querySelectorAll('.autocomplete-item');
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
        highlightedIndex = index;
    }
    
    function selectItem(item) {
        const rowData = JSON.parse(item.dataset.rowData);
        const keyField = getKeyField();
        const keyValue = rowData[keyField];
        inputEl.value = keyValue;
        inputEl.dataset.selectedKey = keyValue;
        // Fila completa de la opción elegida, en el propio input — para que
        // un caller (ej. choice cells en Multifield.js) pueda leer props
        // extra (como `from`) sin colisionar con dataset.catalogRow, que es
        // específico de selects catálogo (ver abajo).
        inputEl.dataset.selectedRow = JSON.stringify(rowData);

        // Fila completa del catálogo disponible en el contenedor (la <tr> de
        // un multifield) — así una columna type="choice" hermana puede leer
        // cualquier campo de esa fila (ej. precio_mayor/precio_menor)
        // directo, sin necesitar un <copy> a un field intermedio solo para
        // pasarle el dato. Solo para selects catálogo (lookupConfig): un
        // select de opciones literales (<options>, o un type="choice" que
        // ahora reusa este mismo widget) no tiene catálogo que aportar acá,
        // y si comparte <tr> con una columna catálogo de verdad, pisaría su
        // fila guardada.
        if (lookupConfig && container && container.dataset) {
            container.dataset.catalogRow = JSON.stringify(rowData);
        }
        refreshOverlay();

        if (lookupConfig && lookupConfig.isKeyField) {
            loadAndCopyRecord(keyValue);
        } else if (lookupConfig && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            lookupConfig.copyFields.forEach(copy => {
                const targetField = container.querySelector(`#${copy.to}`);
                if (targetField && rowData[copy.from] !== undefined) {
                    if (targetField.type === 'checkbox') {
                        const v = rowData[copy.from];
                        targetField.checked = v === 1 || v === true || v === '1';
                    } else {
                        targetField.value = rowData[copy.from];
                        targetField.readOnly = true;
                        targetField.classList.add('readonly-field');
                    }
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        closeDropdown();
        inputEl.focus();

        // sf:user-change: distinguishes user selection from programmatic fill.
        // Cascade listeners use this to reset dependent fields only on user interaction.
        inputEl.dispatchEvent(new CustomEvent('sf:user-change', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    async function loadAndCopyRecord(keyValue) {
        if (!lookupConfig || !lookupConfig.isKeyField) return null;

        let row;
        if (lookupConfig.url) {
            // url-based: find the row in the already-fetched catalog data
            await loadCatalog();
            const keyField = getKeyField();
            row = (catalogData || []).find(r => String(r[keyField]) === String(keyValue)) ?? null;
        } else {
            row = await LookupService.loadRecord(lookupConfig.table, lookupConfig.key, keyValue, lookupConfig.db);
        }

        if (row && container && container.dataset) {
            container.dataset.catalogRow = JSON.stringify(row);
        }
        if (row) {
            // Ruta "tipear ID + Tab" (autorreferencia, ej. productos.xml):
            // selectItem() no corrió, así que dataset.selectedRow nunca se
            // seteó — sin esto la capa "clave - nombre" no tendría de dónde
            // sacar el nombre para este camino.
            inputEl.dataset.selectedRow = JSON.stringify(row);
            refreshOverlay();
        }

        if (row && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            lookupConfig.copyFields.forEach(copy => {
                const targetField = container.querySelector(`#${copy.to}`);
                if (targetField && row[copy.from] !== undefined) {
                    if (targetField.type === 'checkbox') {
                        const v = row[copy.from];
                        targetField.checked = v === 1 || v === true || v === '1';
                    } else {
                        targetField.value = row[copy.from];
                    }
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        return row;
    }
    
    // Se tipeó desde que se pidió abrir la lista: abrir es async (carga del
    // catálogo) y antes renderOptions('') pisaba lo tipeado mientras cargaba.
    let typedWhileOpening = false;

    function openDropdown() {
        if (inputEl.readOnly && !inputEl.dataset.skipSelect) return;

        typedWhileOpening = false;
        loadCatalog().then(() => {
            renderOptions(typedWhileOpening ? inputEl.value : '');
            dropdownEl.style.display = 'block';
            isOpen = true;
            btnEl.innerHTML = '&#9650;';
            markCurrentItem();
        });
    }
    
    // Con algo elegido, la lista abre marcando esa opción y mostrándola
    // (aunque sea la N° 500), y la clave queda seleccionada: lo que se
    // tipee la reemplaza. La capa "clave - nombre" sigue hasta tipear.
    function markCurrentItem() {
        if (!overlayEl || overlayEl.hidden) return;
        const key = String(inputEl.value ?? '').trim();
        const items = [...dropdownEl.querySelectorAll('.autocomplete-item')];
        const idx = items.findIndex(item => item.dataset.key === key);
        if (idx < 0) return;
        highlightItem(idx);
        items[idx].scrollIntoView({ block: 'nearest' });
        if (document.activeElement === inputEl) inputEl.select();
    }

    function closeDropdown() {
        dropdownEl.style.display = 'none';
        isOpen = false;
        highlightedIndex = -1;
        btnEl.innerHTML = '&#9660;';
    }
    
    function toggleDropdown() {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }
    
    const listenerOpts = signal ? { signal } : undefined;

    btnEl.addEventListener('click', (e) => {
        e.preventDefault();
        // El foco al input: el teclado (↑↓, Enter, Escape, tipear para
        // filtrar) se escucha ahí — abriendo con ▾, Escape no cerraba.
        if (!inputEl.readOnly || inputEl.dataset.skipSelect) inputEl.focus();
        toggleDropdown();
    }, listenerOpts);

    inputEl.addEventListener('focus', () => {
        if (!catalogData) {
            loadCatalog();
        }
        // La capa "clave - nombre" sigue con el foco (con Tab, "3 - Flor" no
        // pasa a ser un "3" pelado) y con la lista abierta; se oculta al tipear.
        // La clave queda seleccionada: lo que se tipee la reemplaza.
        if (overlayEl && !overlayEl.hidden) inputEl.select();
    }, listenerOpts);

    inputEl.addEventListener('blur', () => {
        refreshOverlay();
    }, listenerOpts);

    // Valor puesto desde afuera (ValidationCoordinator.fillForm al cargar un
    // registro por N° o ANT/SIG, el modal de un multifield reabriendo una
    // fila): solo cambia inputEl.value + dispara 'change', sin pasar por
    // selectItem() — así que dataset.selectedRow (y con él la capa "clave -
    // nombre" y los <copy>) seguía mostrando la última selección manual
    // aunque el input ya tuviera otra clave. Acá se re-resuelve la fila del
    // catálogo para la clave actual. Si selectedRow ya corresponde a esa
    // clave (selectItem/Tab acaban de setearla) no hace nada.
    async function syncSelectedRowToValue() {
        const value = String(inputEl.value ?? '').trim();
        const keyField = getKeyField();
        let current;
        try { current = JSON.parse(inputEl.dataset.selectedRow || 'null'); } catch { current = null; }
        if (current && String(current[keyField]) === value) return;

        if (!value) {
            delete inputEl.dataset.selectedKey;
            delete inputEl.dataset.selectedRow;
            refreshOverlay();
            return;
        }

        const rows = await loadCatalog();
        // El valor pudo cambiar otra vez mientras se cargaba el catálogo.
        if (String(inputEl.value ?? '').trim() !== value) return;

        const match = (rows || []).find(row => String(row[keyField]) === value);
        if (!match) {
            delete inputEl.dataset.selectedKey;
            delete inputEl.dataset.selectedRow;
            refreshOverlay();
            return;
        }

        inputEl.dataset.selectedKey = value;
        inputEl.dataset.selectedRow = JSON.stringify(match);
        if (container && container.dataset) {
            container.dataset.catalogRow = JSON.stringify(match);
        }
        if (lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            lookupConfig.copyFields.forEach(copy => {
                const targetField = container.querySelector(`#${copy.to}`);
                if (targetField && match[copy.from] !== undefined) {
                    targetField.value = match[copy.from];
                    targetField.readOnly = true;
                    targetField.classList.add('readonly-field');
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        refreshOverlay();
    }

    if (lookupConfig) {
        inputEl.addEventListener('change', () => { syncSelectedRowToValue(); }, listenerOpts);
        // Campo que ya llega con valor al conectarse (ej. Multifield.js
        // _buildCatalogCell reabriendo en el modal una fila cargada por un
        // handler): ese valor se puso antes de existir el listener de arriba.
        // Es async (loadCatalog), así que los <copy> encuentran las celdas
        // hermanas aunque la fila se termine de armar después de esta llamada.
        if (inputEl.value && !inputEl.dataset.selectedRow) syncSelectedRowToValue();
    }

    refreshOverlay();

    inputEl.addEventListener('click', () => {
        if (!isOpen) {
            openDropdown();
        }
    }, listenerOpts);
    
    inputEl.addEventListener('input', () => {
        if (overlayEl) overlayEl.hidden = true;
        if (isOpen) {
            renderOptions(inputEl.value);
        } else if (!inputEl.readOnly) {
            // Tipear sin haber abierto la lista (foco con Tab) también filtra.
            // Si ya se estaba abriendo (click + tipeo rápido), esto solo
            // vuelve a pedir la apertura; las dos terminan filtrando.
            openDropdown();
            typedWhileOpening = true;
        }

        if (lookupConfig && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            if (!inputEl.value.trim()) {
                lookupConfig.copyFields.forEach(copy => {
                    const targetField = container.querySelector(`#${copy.to}`);
                    if (targetField) {
                        targetField.value = '';
                        targetField.readOnly = true;
                        targetField.classList.add('readonly-field');
                    }
                });
            }
        }
    }, listenerOpts);

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            openDropdown();
            return;
        }
        
        if (e.key === 'Tab') {
            const currentValue = inputEl.value.trim();
            if (currentValue) {
                if (lookupConfig && lookupConfig.isKeyField) {
                    loadAndCopyRecord(currentValue);
                } else {
                    loadCatalog().then(() => {
                        const keyField = getKeyField();
                        const match = (catalogData || []).find(row =>
                            String(row[keyField]) === currentValue
                        );
                        
                        if (match) {
                            if (lookupConfig && container && container.dataset) {
                                container.dataset.catalogRow = JSON.stringify(match);
                            }
                            if (lookupConfig && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
                                lookupConfig.copyFields.forEach(copy => {
                                    const targetField = container.querySelector(`#${copy.to}`);
                                    if (targetField && match[copy.from] !== undefined) {
                                        targetField.value = match[copy.from];
                                        targetField.readOnly = true;
                                        targetField.classList.add('readonly-field');
                                        targetField.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                });
                            }
                            inputEl.dataset.selectedKey = currentValue;
                            inputEl.dataset.selectedRow = JSON.stringify(match);
                            refreshOverlay();
                        } else {
                            delete inputEl.dataset.selectedRow;
                            refreshOverlay();
                            if (lookupConfig && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
                                lookupConfig.copyFields.forEach(copy => {
                                    const targetField = container.querySelector(`#${copy.to}`);
                                    if (targetField) {
                                        targetField.value = '';
                                        targetField.readOnly = false;
                                        targetField.classList.remove('readonly-field');
                                    }
                                });
                            }
                        }
                    });
                }
            }
            closeDropdown();
            return;
        }
        
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                openDropdown();
            }
            return;
        }
        
        const items = dropdownEl.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(highlightedIndex + 1, items.length - 1);
            highlightItem(nextIndex);
            if (items[nextIndex]) {
                items[nextIndex].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = Math.max(highlightedIndex - 1, 0);
            highlightItem(prevIndex);
            if (items[prevIndex]) {
                items[prevIndex].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
                selectItem(items[highlightedIndex]);
            } else if (items.length === 1 && inputEl.value.trim()) {
                // El filtro dejó una sola: Enter la elige sin ↓ previo.
                // Con varias (o sin filtro) no adivina.
                selectItem(items[0]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeDropdown();
        }
    }, listenerOpts);

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !btnEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            closeDropdown();
        }
    }, listenerOpts);

    inputEl.addEventListener('sf:set-catalog', (e) => {
        catalogData = e.detail.rows || [];
        catalogLoadTime = Date.now();
        inputEl.value = '';
        delete inputEl.dataset.selectedKey;
        delete inputEl.dataset.selectedRow;
        refreshOverlay();
        closeDropdown();
    }, listenerOpts);

    // Cascade: watch parent field and filter options when it changes
    if (lookupConfig?.filterBy) {
        setTimeout(() => {
            const parentInput = container.querySelector(`#${lookupConfig.filterBy}`);
            if (!parentInput) return;

            // Seed filter from parent's current value (e.g. loading existing record)
            if (parentInput.value) parentFilterValue = parentInput.value;

            // Programmatic fill (form load): update filter but don't reset this field
            parentInput.addEventListener('change', () => {
                parentFilterValue = parentInput.value || null;
            }, listenerOpts);

            // User selection: update filter AND reset this dependent field
            parentInput.addEventListener('sf:user-change', () => {
                parentFilterValue = parentInput.value || null;
                inputEl.value = '';
                delete inputEl.dataset.selectedKey;
                delete inputEl.dataset.selectedRow;
                refreshOverlay();
                closeDropdown();
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }, listenerOpts);
        }, 0);
    }
}

export default {
    createAutocomplete,
    attachAutocompleteHandlers
};
