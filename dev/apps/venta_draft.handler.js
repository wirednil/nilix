/**
 * @file venta_draft.handler.js
 * @description Fixture — replica el patrón insert-vs-update + after('id')-populate
 * de ventas.handler.js (thym-pos, no versionado en este repo) para poder
 * probarlo contra código real del motor (handlerController.js:afterLoad,
 * HandlerBridge, Multifield.populateRows) sin tocar datos de producción.
 * Ver tests/e2e.test.js y dev/form/venta_draft.xml.
 */

function readItems(data) {
    const idxs = Object.keys(data)
        .map(k => {
            const m = k.match(/^items_id_producto_(\d+)$/);
            return m ? m[1] : null;
        })
        .filter(Boolean);

    return idxs
        .map(i => ({
            id_producto: parseInt(data[`items_id_producto_${i}`], 10),
            cantidad: parseInt(data[`items_cantidad_${i}`], 10),
            precio_unitario: parseFloat(data[`items_precio_unitario_${i}`]) || 0,
        }))
        .filter(item => Number.isInteger(item.id_producto) && Number.isInteger(item.cantidad) && item.cantidad > 0);
}

module.exports = {
    table: 'venta_draft',
    keyField: 'id',

    validate(data) {
        const errors = [];
        if (readItems(data).length === 0) {
            errors.push('Agregá al menos un producto.');
        }
        return { valid: errors.length === 0, errors };
    },

    beforeSave(data, db) {
        const items = readItems(data);
        if (items.length === 0) return null;

        const header = {
            fecha: data.fecha,
            total: parseFloat(data.total) || 0,
        };

        const existingId = data.id ? parseInt(data.id, 10) : null;
        let ventaId;

        if (existingId) {
            const existing = db.find('venta_draft', { id: existingId });
            if (existing) {
                db.exec('UPDATE venta_draft SET fecha=?, total=? WHERE id=?', [header.fecha, header.total, existingId]);
                db.exec('DELETE FROM detalle_draft WHERE id_venta = ?', [existingId]);
                ventaId = existingId;
            }
        }

        if (!ventaId) {
            ventaId = db.insert('venta_draft', header);
        }

        for (const item of items) {
            db.insert('detalle_draft', {
                id_venta: ventaId,
                id_producto: item.id_producto,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.cantidad * item.precio_unitario,
            });
        }

        data.id = ventaId;
        return null;
    },

    after(fieldId, value, data, db) {
        if (fieldId !== 'id') return null;

        const ventaId = parseInt(value, 10);
        if (!Number.isInteger(ventaId)) return null;

        const lineas = db.findAll('detalle_draft', { id_venta: ventaId });
        const rows = lineas.map(l => {
            const producto = db.find('mf_productos', { id: l.id_producto });
            return {
                id_producto: l.id_producto,
                producto: producto?.nombre ?? '',
                cantidad: l.cantidad,
                precio_unitario: l.precio_unitario,
                precio_total: l.subtotal,
            };
        });

        return { populate: { field: 'items', rows } };
    },
};
