/**
 * @file index.js
 * @description Módulo central de fieldRenderer - Exporta todos los renderers de campos
 * @module fieldRenderer
 */

// Label exports
export { 
    createLabel, 
    createHelpIcon, 
    createHelpTooltip, 
    toggleHelpTooltip 
} from './Label.js';

// InputField exports
export { 
    createInputElement, 
    createFieldWrapper, 
    assembleFieldComponents,
    renderInputField,
    DEFAULTS as INPUT_DEFAULTS
} from './InputField.js';

// Checkbox exports
export { 
    renderCheckbox 
} from './Checkbox.js';

// Multifield exports
export { 
    isTextareaMultifield,
    isGridMultifield,
    renderTextareaFromMultifield,
    renderGridFromMultifield,
    renderMultifield,
    populateRows,
    appendRowToGrid,
    DEFAULTS as MULTIFIELD_DEFAULTS
} from './Multifield.js';
