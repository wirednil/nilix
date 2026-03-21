/**
 * ExpressionEvaluator.js
 * Evaluate expressions in zones
 */

export class ExpressionEvaluator {
    evaluate(expression, context, accumulators = null, breakLevel = null) {
        if (expression === null || expression === undefined) {
            return '';
        }

        if (typeof expression === 'string') {
            return this.evaluateString(expression, context);
        }

        if (typeof expression === 'object' && expression.aggregate) {
            return this.evaluateAggregate(expression, accumulators, breakLevel);
        }

        return expression;
    }

    evaluateString(expr, context) {
        // Check for separator
        if (expr === '---' || expr.trim() === '---') {
            return '---SEPARATOR---';
        }
        
        if (!expr.includes('{')) {
            return expr;
        }

        return expr.replace(/\{([^}]+)\}/g, (match, fieldPath) => {
            const parts = fieldPath.split(':');
            const fieldName = parts[0].trim();
            const format = parts[1] ? parts[1].trim() : null;

            let value = context[fieldName];
            
            // Try alternate field names
            if (value === undefined || value === null) {
                const alternates = [
                    fieldName.replace('prod_', ''),
                    fieldName.replace('cat_', ''),
                    `prod_${fieldName}`,
                    `cat_${fieldName}`
                ];
                for (const alt of alternates) {
                    if (context[alt] !== undefined) {
                        value = context[alt];
                        break;
                    }
                }
            }
            
            if (value === undefined || value === null) {
                value = '';
            }

            if (format) {
                value = this.formatValue(value, format);
            }

            return String(value);
        });
    }

    formatValue(value, format) {
        if (value === '' || value === null || value === undefined) {
            return '';
        }
        
        if (format === 'currency') {
            const num = parseFloat(value);
            if (isNaN(num)) return '';
            const abs = Math.abs(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return num < 0 ? `-$${abs}` : `$${abs}`;
        }

        if (format === 'upper') {
            return String(value).toUpperCase();
        }

        if (format === 'lower') {
            return String(value).toLowerCase();
        }

        if (format === 'date') {
            try {
                const d = new Date(value);
                if (isNaN(d.getTime())) return String(value);
                return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
            } catch {
                return String(value);
            }
        }

        if (format === 'dayname') {
            try {
                const d = new Date(value);
                if (isNaN(d.getTime())) return String(value);
                const weekday = d.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' });
                const date    = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
                return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date}`;
            } catch {
                return String(value);
            }
        }

        if (format.match(/^\d+(\.\d+)?$/)) {
            const num = parseFloat(value);
            const decimals = parseInt(format.split('.')[1]) || 0;
            return isNaN(num) ? value : num.toFixed(decimals);
        }

        return value;
    }

    evaluateAggregate(expr, accumulators, breakLevel) {
        if (!accumulators || !expr.aggregate) {
            return 0;
        }

        const func = expr.aggregate;
        const fieldName = expr.argument;

        return accumulators.evaluate(func, fieldName, breakLevel);
    }

    // ── Formula: if(condition, trueVal, falseVal) ────────────────────────────

    evaluateFormula(formula, context) {
        const f = formula.trim();
        const ifMatch = f.match(/^if\((.+)\)$/is);
        if (ifMatch) {
            const parts = this._splitArgs(ifMatch[1]);
            if (parts.length === 3) {
                const [condStr, trueStr, falseStr] = parts;
                const result = this._evalCond(condStr.trim(), context);
                return result
                    ? this._resolveVal(trueStr.trim(), context)
                    : this._resolveVal(falseStr.trim(), context);
            }
        }
        return '';
    }

    _splitArgs(str) {
        const parts = [];
        let depth = 0, inQuote = false, quoteChar = '', current = '';
        for (const ch of str) {
            if (inQuote) {
                current += ch;
                if (ch === quoteChar) inQuote = false;
            } else if (ch === "'" || ch === '"') {
                inQuote = true; quoteChar = ch; current += ch;
            } else if (ch === '(') { depth++; current += ch;
            } else if (ch === ')') { depth--; current += ch;
            } else if (ch === ',' && depth === 0) {
                parts.push(current); current = '';
            } else { current += ch; }
        }
        if (current) parts.push(current);
        return parts;
    }

    _evalCond(condStr, context) {
        const s = condStr.trim();

        // Direct comparison parser: fieldName op 'value' | fieldName op value
        // Supports: ==  !=  >=  <=  >  <
        const m = s.match(/^(\w+)\s*(===?|!==?|>=|<=|>|<)\s*(['"])(.*?)\3$/) ||
                  s.match(/^(\w+)\s*(===?|!==?|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
        if (m) {
            const fieldVal = String(context[m[1]] ?? '');
            const op       = m[2].replace('===', '==').replace('!==', '!=');
            const cmpVal   = m[4] ?? m[3];   // string group or numeric group
            const numL = parseFloat(fieldVal), numR = parseFloat(cmpVal);
            switch (op) {
                case '==': return fieldVal === cmpVal;
                case '!=': return fieldVal !== cmpVal;
                case '>':  return numL > numR;
                case '<':  return numL < numR;
                case '>=': return numL >= numR;
                case '<=': return numL <= numR;
            }
        }

        // Fallback: safe Function-based eval (for compound conditions)
        if (!this.isConditionSafe(s)) return false;
        let expr = s;
        for (const [key, value] of Object.entries(context)) {
            if (this.isSafeIdentifier(key)) {
                expr = expr.replace(new RegExp(`\\b${this.escapeRegex(key)}\\b`, 'g'), JSON.stringify(value));
            }
        }
        try { return new Function(`return (${expr})`)(); } catch { return false; }
    }

    _resolveVal(valStr, context) {
        if ((valStr.startsWith("'") && valStr.endsWith("'")) ||
            (valStr.startsWith('"') && valStr.endsWith('"'))) {
            return valStr.slice(1, -1);
        }
        if (context[valStr] !== undefined) return context[valStr];
        const n = parseFloat(valStr);
        return isNaN(n) ? valStr : n;
    }

    evaluateCondition(condition, context) {
        if (!condition) return true;

        if (!this.isConditionSafe(condition)) {
            console.warn('⚠️ Unsafe condition blocked:', condition);
            return true;
        }

        let expr = condition;

        for (const [key, value] of Object.entries(context)) {
            if (!this.isSafeIdentifier(key)) continue;
            const regex = new RegExp(`\\b${this.escapeRegex(key)}\\b`, 'g');
            expr = expr.replace(regex, JSON.stringify(value));
        }

        try {
            const fn = new Function('return (' + expr + ')');
            return fn();
        } catch (e) {
            console.warn('⚠️ Condition evaluation failed:', e.message);
            return true;
        }
    }

    isConditionSafe(expr) {
        const safePattern = /^[a-zA-Z0-9_\s"':.<>=!&|()]+$/;
        if (!safePattern.test(expr)) return false;
        
        const forbidden = ['eval', 'Function', 'window', 'document', 'fetch', 'import'];
        for (const word of forbidden) {
            if (expr.toLowerCase().includes(word.toLowerCase())) return false;
        }
        
        return true;
    }

    isSafeIdentifier(name) {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

export default ExpressionEvaluator;
