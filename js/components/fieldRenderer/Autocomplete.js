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
        inputEl.classList.add('readonly-field');
    }
    
    if (size) {
        const sizeNum = parseInt(size);
        const effectiveSize = Math.max(sizeNum * 1.2, 8);
        inputEl.style.width = `${effectiveSize}ch`;
    }
    
    const btnEl = createElement('button', 'autocomplete-btn');
    btnEl.type = 'button';
    btnEl.tabIndex = -1;
    btnEl.innerHTML = '&#9660;';
    btnEl.setAttribute('aria-label', 'Abrir lista');
    
    const dropdownEl = createElement('div', 'autocomplete-dropdown');
    dropdownEl.style.display = 'none';
    
    wrapper.appendChild(inputEl);
    wrapper.appendChild(btnEl);
    wrapper.appendChild(dropdownEl);
    
    return { wrapper, inputEl, btnEl, dropdownEl, defaultValue };
}

export function attachAutocompleteHandlers(inputEl, btnEl, dropdownEl, lookupConfig, container, selectOptions, { signal } = {}) {
    let catalogData = null;
    let catalogLoadTime = 0;
    let isOpen = false;
    let highlightedIndex = -1;
    
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
            catalogData = selectOptions.map(opt => ({
                key: opt.value || opt.textContent,
                display: opt.textContent
            }));
            catalogLoadTime = Date.now();
            return catalogData;
        }
        
        if (lookupConfig) {
            try {
                const catalog = await LookupService.getCatalog(lookupConfig.table);
                catalogData = catalog?.rows || [];
                catalogLoadTime = Date.now();
                // console.log(`🔍 Autocomplete loadCatalog: ${lookupConfig.table}, rows=${catalogData.length}`, catalogData);
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
        const filterLower = filter.toLowerCase();
        const filtered = catalogData.filter(row => {
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
            
            item.appendChild(keySpan);
            item.appendChild(document.createTextNode(' - '));
            item.appendChild(displaySpan);
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
        
        if (lookupConfig && lookupConfig.isKeyField) {
            loadAndCopyRecord(keyValue);
        } else if (lookupConfig && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            lookupConfig.copyFields.forEach(copy => {
                const targetField = container.querySelector(`#${copy.to}`);
                if (targetField && rowData[copy.from] !== undefined) {
                    targetField.value = rowData[copy.from];
                    targetField.readOnly = true;
                    targetField.classList.add('readonly-field');
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        closeDropdown();
        inputEl.focus();
        
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    async function loadAndCopyRecord(keyValue) {
        if (!lookupConfig || !lookupConfig.isKeyField) return null;
        
        const row = await LookupService.loadRecord(lookupConfig.table, lookupConfig.key, keyValue);
        
        if (row && lookupConfig.copyFields && lookupConfig.copyFields.length > 0) {
            lookupConfig.copyFields.forEach(copy => {
                const targetField = container.querySelector(`#${copy.to}`);
                if (targetField && row[copy.from] !== undefined) {
                    targetField.value = row[copy.from];
                    targetField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        return row;
    }
    
    function openDropdown() {
        if (inputEl.readOnly) return;

        loadCatalog().then(() => {
            renderOptions('');
            dropdownEl.style.display = 'block';
            isOpen = true;
            btnEl.innerHTML = '&#9650;';
        });
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
        toggleDropdown();
    }, listenerOpts);

    inputEl.addEventListener('focus', () => {
        if (!catalogData) {
            loadCatalog();
        }
    }, listenerOpts);

    inputEl.addEventListener('click', () => {
        if (!isOpen) {
            openDropdown();
        }
    }, listenerOpts);
    
    inputEl.addEventListener('input', () => {
        if (isOpen) {
            renderOptions(inputEl.value);
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
                        const match = catalogData.find(row => 
                            String(row[keyField]) === currentValue
                        );
                        
                        if (match) {
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
                        } else {
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
        closeDropdown();
    }, listenerOpts);
}

export default {
    createAutocomplete,
    attachAutocompleteHandlers
};
