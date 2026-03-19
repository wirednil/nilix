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
            return isNaN(num) ? '' : `$${num.toFixed(2)}`;
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
                return d.toLocaleDateString();
            } catch {
                return value;
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
