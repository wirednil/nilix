/**
 * @file comprobante_fixture.handler.js
 * @description Fixture — validate() con mensajes propios, como
 * ventas.handler.js de thym-pos (una venta registrada no se modifica). Sirve
 * para probar que el texto de un handler llega tal cual a la barra de estado,
 * y no el genérico "Validation failed". Sin beforeSave: el alta va por el
 * CRUD estándar. Ver tests/e2e.test.js #22-#23 y dev/form/comprobante_fixture.xml.
 */

module.exports = {
    table: 'comprobante_fixture',
    keyField: 'id',

    validate(data) {
        if (data.id) {
            return { valid: false, errors: ['Los comprobantes registrados no se modifican.'] };
        }
        if (!String(data.nombre ?? '').trim()) {
            return { valid: false, errors: ['Escribí un nombre para el comprobante.'] };
        }
        return { valid: true, errors: [] };
    },
};
