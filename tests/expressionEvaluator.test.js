/**
 * @file tests/expressionEvaluator.test.js
 * @description Fórmulas de reportes (ExpressionEvaluator.evaluateFormula) sin
 * eval: la CSP de report.html bloquea new Function(), y una fórmula
 * aritmética ("total + envio_costo", comprobante de thym-pos) salía vacía.
 * Function se reemplaza por uno que tira, como lo haría la CSP.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

describe('ExpressionEvaluator — fórmulas bajo CSP (sin new Function)', () => {
    let evaluator;
    const RealFunction = globalThis.Function;

    before(async () => {
        const mod = await import(pathToFileURL(path.join(__dirname, '../js/components/report/ExpressionEvaluator.js')));
        evaluator = new mod.ExpressionEvaluator();
        globalThis.Function = function () { throw new EvalError('blocked by CSP (test)'); };
    });

    after(() => { globalThis.Function = RealFunction; });

    it('suma y resta campos', () => {
        assert.equal(evaluator.evaluateFormula('total + envio_costo', { total: 35000, envio_costo: 2500 }), 37500);
        assert.equal(evaluator.evaluateFormula('total - envio_costo', { total: '100', envio_costo: '0.5' }), 99.5);
    });

    it('respeta precedencia y paréntesis', () => {
        assert.equal(evaluator.evaluateFormula('a + b * c', { a: 1, b: 2, c: 3 }), 7);
        assert.equal(evaluator.evaluateFormula('(a + b) * c', { a: 1, b: 2, c: 3 }), 9);
        assert.equal(evaluator.evaluateFormula('-a + 10 / 4', { a: 1 }), 1.5);
    });

    it('un campo que no es número no se evalúa', () => {
        assert.equal(evaluator.evaluateFormula('total + nombre', { total: 1, nombre: 'Ana' }), '');
        assert.equal(evaluator.evaluateFormula('a + * b', { a: 1, b: 2 }), '');
    });

    it('if() sigue andando', () => {
        assert.equal(evaluator.evaluateFormula("if(envio_retiro == 'Retira', 'RETIRA', 'ENVÍO')", { envio_retiro: 'Retira' }), 'RETIRA');
    });
});
