import * as themeService from '../services/themeService.js';
import ExpressionEngine from './ExpressionEngine.js';

/**
 * Valida un campo individual basándose en las reglas del XML.
 * @param {HTMLElement} fieldXmlNode - El nodo XML del campo.
 * @param {string} value - El valor actual del input.
 * @param {Object} formContext - Contexto del formulario (valores de otros campos)
 * @returns {Object} { isValid: boolean, message: string }
 */
export function validateField(fieldXmlNode, value, formContext = {}) {
    const validationNode = fieldXmlNode.querySelector('validation');

    // Si no hay regla de validación, es válido.
    if (!validationNode) return { isValid: true };

    // 1. Validación: max-days-ago (Lógica de Fechas)
    const maxDaysAgo = validationNode.getAttribute('max-days-ago');
    if (maxDaysAgo) {
        const fieldType = fieldXmlNode.getAttribute('type');
        if (fieldType === 'date') {
            const fieldId = fieldXmlNode.getAttribute('id');
            
            // Si el campo está vacío, HTML5 required se encarga, pero si no es required...
            if (!value) return { isValid: true }; 

            const inputDate = new Date(value);
            const limitDate = new Date();
            // Restamos los días
            limitDate.setDate(limitDate.getDate() - parseInt(maxDaysAgo));

            // Validar: La fecha no puede ser menor a (Hoy - 90 días)
            // Ej: Hoy es 30. Limite 30-90 = -60. Si pongo -70, es error.
            if (inputDate < limitDate) {
                return { 
                    isValid: false, 
                    message: `La fecha debe estar dentro de los últimos ${maxDaysAgo} días.` 
                };
            }
        }
    }

    // 2. Validación: type="lookup" (Simulación de DB)
    const lookupType = validationNode.getAttribute('type');
    if (lookupType === 'lookup') {
        // Aquí es donde harías la llamada real a la Base de Datos.
        // Por ahora, simulamos que si el campo es "prov", solo aceptamos "01" o "02".
        const fieldId = fieldXmlNode.getAttribute('id');

        if (fieldId === 'prov' && value && value !== '01' && value !== '02') {
             return {
                 isValid: false,
                 message: "Provincia inválida (Prueba '01' o '02' para el test)."
             };
        }
    }

    // 3. Validación: <min> y <max> (rangos numéricos)
    const messageNode = validationNode.querySelector('message');
    const customMessage = messageNode?.textContent?.trim();

    const minNode = validationNode.querySelector('min');
    if (minNode && value !== '') {
        const minVal = parseFloat(minNode.textContent);
        const numVal = parseFloat(value);
        if (isNaN(numVal) || numVal < minVal) {
            return {
                isValid: false,
                message: customMessage || `El valor debe ser al menos ${minVal}.`
            };
        }
    }

    const maxNode = validationNode.querySelector('max');
    if (maxNode && value !== '') {
        const maxVal = parseFloat(maxNode.textContent);
        const numVal = parseFloat(value);
        if (isNaN(numVal) || numVal > maxVal) {
            return {
                isValid: false,
                message: customMessage || `El valor no puede superar ${maxVal}.`
            };
        }
    }

    // 4. Validación: <pattern> (expresión regular)
    const patternNode = validationNode.querySelector('pattern');
    if (patternNode && value !== '') {
        const pattern = patternNode.textContent.trim();
        try {
            const regex = new RegExp(pattern);
            if (!regex.test(value)) {
                return {
                    isValid: false,
                    message: customMessage || `El valor no cumple el formato requerido.`
                };
            }
        } catch (e) {
            console.error('❌ Patrón de validación inválido:', pattern, e);
        }
    }

    // 5. Validación: <check>expresión</check> (Motor de Expresiones)
    const checkNode = validationNode.querySelector('check');
    if (checkNode) {
        const expression = checkNode.textContent.trim();
        const fieldId = fieldXmlNode.getAttribute('id');

        // Crear contexto con valores del formulario
        const context = {
            ...formContext,
            this: value,
            _currentValue: value,
            [fieldId]: value
        };

        try {
            const isValid = ExpressionEngine.evaluate(expression, context);

            if (!isValid) {
                return {
                    isValid: false,
                    message: customMessage || `Validación fallida: ${expression}`
                };
            }
        } catch (error) {
            console.error('❌ Error evaluando check expression:', expression, error);
            return {
                isValid: false,
                message: `Error en validación: ${error.message}`
            };
        }
    }

    // Pasa todas las validaciones
    return { isValid: true };
}

/**
 * Limpia los mensajes de error visuales de un formulario.
 */
export function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.remove());
}

/**
 * Muestra un mensaje de error debajo del input específico.
 */
export function showErrorOnField(fieldId, message) {
    const inputEl = document.getElementById(fieldId);
    if (!inputEl) return;

    // Buscar el padre .input-group o .simple-field para insertar el error
    let container = inputEl.parentElement;
    
    // Si estamos en un grupo horizontal (simple-field), ahí va el error.
    // Si estamos en vertical (input-group), ahí va el error.
    
    const errorEl = document.createElement('div');
    errorEl.className = 'error-msg';
    errorEl.textContent = `❌ ${message}`;
    
    container.appendChild(errorEl);
}
