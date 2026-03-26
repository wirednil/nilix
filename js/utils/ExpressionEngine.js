/**
 * @file ExpressionEngine.js
 * @description Motor de expresiones para validaciones de formularios
 * @module ExpressionEngine
 * @version 1.0.0
 */

console.log("🧮 ExpressionEngine.js: Cargando...");

/**
 * @class ExpressionEngine
 * @classdesc Evalúa expresiones de validación (check, between, in, etc)
 */
class ExpressionEngine {
    /**
     * Evalúa una expresión con un contexto dado
     * @param {string} expression - Expresión a evaluar
     * @param {Object} context - Contexto con valores de campos
     * @returns {boolean} Resultado de la evaluación
     */
    static evaluate(expression, context = {}) {
        try {
            // Limpiar espacios extra
            const expr = expression.trim();

            // 1. BETWEEN: valor between min and max
            if (this.isBetweenExpression(expr)) {
                return this.evaluateBetween(expr, context);
            }

            // 2. IN: valor in (val1, val2, val3)
            if (this.isInExpression(expr)) {
                return this.evaluateIn(expr, context);
            }

            // 3. OPERADORES RELACIONALES: >, <, >=, <=, ==, !=
            if (this.isRelationalExpression(expr)) {
                return this.evaluateRelational(expr, context);
            }

            // 4. OPERADORES LÓGICOS: and, or
            if (this.isLogicalExpression(expr)) {
                return this.evaluateLogical(expr, context);
            }

            // 5. EXPRESIÓN SIMPLE (solo un valor o variable)
            return this.evaluateSimple(expr, context);

        } catch (error) {
            console.error('❌ Error evaluando expresión:', expression, error);
            return false;
        }
    }

    /**
     * Evalúa una expresión BETWEEN
     * Ej: "edad between 18 and 65"
     * @private
     */
    static evaluateBetween(expr, context) {
        const match = expr.match(/(.+?)\s+between\s+(.+?)\s+and\s+(.+)/i);
        if (!match) return false;

        const [_, field, minExpr, maxExpr] = match;
        const value = this.resolveValue(field, context);
        const min = this.resolveValue(minExpr, context);
        const max = this.resolveValue(maxExpr, context);

        return value >= min && value <= max;
    }

    /**
     * Evalúa una expresión IN
     * Ej: "tipo in (1, 2, 3)"
     * @private
     */
    static evaluateIn(expr, context) {
        const match = expr.match(/(.+?)\s+in\s+\(([^)]+)\)/i);
        if (!match) return false;

        const [_, field, valuesStr] = match;
        const value = this.resolveValue(field, context);

        // Parsear lista de valores
        const values = valuesStr.split(',').map(v => this.parseValue(v.trim()));

        return values.includes(value);
    }

    /**
     * Evalúa una expresión con operadores relacionales
     * Ej: "edad >= 18", "precio * cantidad <= 1000"
     * @private
     */
    static evaluateRelational(expr, context) {
        // Detectar operador (orden importante: >= antes de >)
        const operators = ['>=', '<=', '==', '!=', '>', '<'];
        let operator = null;
        let parts = null;

        for (const op of operators) {
            if (expr.includes(op)) {
                operator = op;
                parts = expr.split(op).map(p => p.trim());
                break;
            }
        }

        if (!operator || !parts || parts.length !== 2) return false;

        const left = this.evaluateArithmetic(parts[0], context);
        const right = this.evaluateArithmetic(parts[1], context);

        switch (operator) {
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            case '==': return left == right; // == para comparación flexible
            case '!=': return left != right;
            default: return false;
        }
    }

    /**
     * Evalúa expresiones con AND/OR
     * Ej: "edad >= 18 and saldo > 100"
     * @private
     */
    static evaluateLogical(expr, context) {
        // AND tiene precedencia sobre OR
        if (expr.includes(' and ')) {
            const parts = expr.split(' and ');
            return parts.every(part => this.evaluate(part.trim(), context));
        }

        if (expr.includes(' or ')) {
            const parts = expr.split(' or ');
            return parts.some(part => this.evaluate(part.trim(), context));
        }

        return false;
    }

    /**
     * Evalúa una expresión aritmética simple
     * Ej: "precio * cantidad", "edad + 5"
     * @private
     */
    static evaluateArithmetic(expr, context) {
        expr = expr.trim();

        // Replace variable names with their numeric values
        const resolved = expr.replace(/[a-zA-Z_]\w*/g, token => {
            const val = parseFloat(context[token]);
            return isNaN(val) ? '0' : String(val);
        });

        // Safety check — only digits, spaces, and arithmetic operators
        if (!/^[\d\s+\-*/.()]+$/.test(resolved)) {
            console.warn('⚠️ ExpressionEngine: expresión aritmética inválida:', expr);
            return 0;
        }

        // Recursive descent parser — no eval/new Function (CSP-safe)
        try {
            const state = { src: resolved.replace(/\s+/g, ''), pos: 0 };
            return ExpressionEngine._parseExpr(state);
        } catch {
            return 0;
        }
    }

    static _parseExpr(state) {
        let result = ExpressionEngine._parseTerm(state);
        while (state.pos < state.src.length) {
            const op = state.src[state.pos];
            if (op !== '+' && op !== '-') break;
            state.pos++;
            const right = ExpressionEngine._parseTerm(state);
            result = op === '+' ? result + right : result - right;
        }
        return result;
    }

    static _parseTerm(state) {
        let result = ExpressionEngine._parseFactor(state);
        while (state.pos < state.src.length) {
            const op = state.src[state.pos];
            if (op !== '*' && op !== '/') break;
            state.pos++;
            const right = ExpressionEngine._parseFactor(state);
            result = op === '*' ? result * right : (right !== 0 ? result / right : 0);
        }
        return result;
    }

    static _parseFactor(state) {
        if (state.src[state.pos] === '(') {
            state.pos++;
            const result = ExpressionEngine._parseExpr(state);
            if (state.src[state.pos] === ')') state.pos++;
            return result;
        }
        if (state.src[state.pos] === '-') {
            state.pos++;
            return -ExpressionEngine._parseFactor(state);
        }
        const start = state.pos;
        while (state.pos < state.src.length && /[\d.]/.test(state.src[state.pos])) {
            state.pos++;
        }
        return parseFloat(state.src.slice(start, state.pos)) || 0;
    }

    /**
     * Resuelve un valor (variable, constante, o especial)
     * @private
     */
    static resolveValue(expr, context) {
        expr = expr.trim();

        // 0. Lado izquierdo vacío → valor actual del campo (this)
        if (expr === '') {
            return context.this ?? context._currentValue ?? 0;
        }

        // 1. Palabras clave especiales
        if (expr === 'today') {
            return new Date();
        }

        if (expr === 'this') {
            return context.this || context._currentValue;
        }

        // 2. String literal (entre comillas)
        if ((expr.startsWith('"') && expr.endsWith('"')) ||
            (expr.startsWith("'") && expr.endsWith("'"))) {
            return expr.slice(1, -1);
        }

        // 3. Número
        if (!isNaN(expr)) {
            return parseFloat(expr);
        }

        // 4. Variable del contexto
        if (context.hasOwnProperty(expr)) {
            return context[expr];
        }

        // 5. Fecha (formato dd/mm/yyyy o yyyy-mm-dd)
        if (this.isDateString(expr)) {
            return new Date(expr);
        }

        // Valor no encontrado
        console.warn(`⚠️ Valor no encontrado en contexto: ${expr}`);
        return null;
    }

    /**
     * Parsea un valor literal
     * @private
     */
    static parseValue(str) {
        str = str.trim();

        // String
        if ((str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }

        // Número
        if (!isNaN(str)) {
            return parseFloat(str);
        }

        // Boolean
        if (str === 'true') return true;
        if (str === 'false') return false;

        return str;
    }

    /**
     * Evalúa una expresión simple (solo un valor)
     * @private
     */
    static evaluateSimple(expr, context) {
        const value = this.resolveValue(expr, context);
        // En JavaScript, cualquier valor truthy es válido
        return !!value;
    }

    // ============================================
    // HELPERS DE DETECCIÓN
    // ============================================

    static isBetweenExpression(expr) {
        return /\s+between\s+.+\s+and\s+/i.test(expr);
    }

    static isInExpression(expr) {
        return /\s+in\s+\(/i.test(expr);
    }

    static isRelationalExpression(expr) {
        return /(>=|<=|==|!=|>|<)/.test(expr);
    }

    static isLogicalExpression(expr) {
        return /\s+(and|or)\s+/i.test(expr);
    }

    static isDateString(str) {
        // Detectar formato yyyy-mm-dd o dd/mm/yyyy
        return /^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{2}\/\d{2}\/\d{4}$/.test(str);
    }

    // ============================================
    // CAMPOS VIRTUALES (is= attribute)
    // ============================================

    /**
     * Detecta si una expresión es un agregado de multifield
     * Ej: "sum(precio)", "avg(cantidad)", "count(id)", "min(x)", "max(x)"
     */
    static isAggregateExpression(expr) {
        return /^\s*(sum|avg|count|min|max)\s*\(\s*\w+\s*\)\s*$/i.test(expr.trim());
    }

    /**
     * Evalúa una función de agregado sobre celdas de multifield
     * @param {string} fn - Función: sum, avg, count, min, max
     * @param {string} colId - ID de la columna en el multifield
     * @param {HTMLFormElement} formEl - Formulario contenedor
     * @returns {number}
     */
    static evaluateAggregate(fn, colId, formEl) {
        // Encuentra todos los inputs cuyo name contiene el patrón _colId_
        const inputs = Array.from(formEl.querySelectorAll(`input[name*="_${colId}_"]`));
        const values = inputs
            .filter(inp => !inp.closest('.multifield-action-cell'))
            .map(inp => parseFloat(inp.value) || 0);

        switch (fn.toLowerCase()) {
            case 'sum':   return values.reduce((a, b) => a + b, 0);
            case 'avg':   return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            case 'count': return values.filter(v => v !== 0 || true).length; // cuenta filas con valor
            case 'min':   return values.length > 0 ? Math.min(...values) : 0;
            case 'max':   return values.length > 0 ? Math.max(...values) : 0;
            default:      return 0;
        }
    }

    /**
     * Evalúa el valor de una expresión virtual (aritmética o agregado)
     * @param {string} expr - Expresión: "precio * cantidad" o "sum(precio)"
     * @param {HTMLFormElement} formEl - Formulario contenedor
     * @returns {number|string}
     */
    static evaluateValue(expr, formEl) {
        expr = expr.trim();
        if (this.isAggregateExpression(expr)) {
            const match = expr.match(/^\s*(\w+)\s*\(\s*(\w+)\s*\)\s*$/i);
            return this.evaluateAggregate(match[1], match[2], formEl);
        }
        const context = this.createContextFromForm(formEl);
        return this.evaluateArithmetic(expr, context);
    }

    /**
     * Retorna las dependencias de una expresión virtual
     * @param {string} expr - Expresión virtual
     * @returns {Array<{type: 'field'|'aggregate', fieldId?: string, colId?: string}>}
     */
    static getValueDependencies(expr) {
        expr = expr.trim();
        if (this.isAggregateExpression(expr)) {
            const match = expr.match(/^\s*\w+\s*\(\s*(\w+)\s*\)\s*$/i);
            return match ? [{ type: 'aggregate', colId: match[1] }] : [];
        }
        // Extrae nombres de variables de la expresión aritmética
        const varPattern = /\b([a-zA-Z_]\w*)\b/g;
        const keywords = new Set(['today', 'this']);
        const deps = [];
        let m;
        while ((m = varPattern.exec(expr)) !== null) {
            if (!keywords.has(m[1])) {
                deps.push({ type: 'field', fieldId: m[1] });
            }
        }
        return deps;
    }

    // ============================================
    // UTILIDADES PARA CONTEXTO
    // ============================================

    /**
     * Crea un contexto a partir de un formulario HTML
     * @param {HTMLFormElement} formEl - Elemento formulario
     * @param {string} currentFieldId - ID del campo actual
     * @returns {Object} Contexto con valores de campos
     */
    static createContextFromForm(formEl, currentFieldId = null) {
        const context = {
            today: new Date()
        };

        // Extraer valores de todos los campos
        const formData = new FormData(formEl);
        for (let [key, value] of formData.entries()) {
            const field = formEl.querySelector(`#${key}`);

            // Convertir según tipo
            if (field) {
                if (field.type === 'number') {
                    context[key] = parseFloat(value) || 0;
                } else if (field.type === 'date') {
                    context[key] = value ? new Date(value) : null;
                } else if (field.type === 'checkbox') {
                    context[key] = field.checked;
                } else {
                    context[key] = value;
                }
            } else {
                context[key] = value;
            }
        }

        // Valor actual del campo
        if (currentFieldId && context[currentFieldId]) {
            context.this = context[currentFieldId];
            context._currentValue = context[currentFieldId];
        }

        return context;
    }
}

export default ExpressionEngine;
