/**
 * @file tests/scopedDb.test.js
 * @description Tests unitarios para ScopedDb — inyección automática de empresa_id
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupAppDb } = require('./helpers/db');

let db1;  // ScopedDb para empresa 1
let db2;  // ScopedDb para empresa 2
let cleanupAppDb;

describe('ScopedDb', async () => {

    before(async () => {
        const result = await setupAppDb();
        cleanupAppDb = result.cleanupAppDb;

        // Requerir DESPUÉS de setupAppDb (NIL_DB_FILE ya seteado)
        const { createScopedDb } = require('../src/services/scopedDb');
        const { getDatabase }    = require('../src/services/database');
        const raw = getDatabase();

        db1 = createScopedDb(raw, 1);
        db2 = createScopedDb(raw, 2);

        // Seed: productos para empresa 1
        db1.insert('productos', { nombre: 'Pizza Mozzarella', precio: 1200 });
        db1.insert('productos', { nombre: 'Empanada',          precio: 300  });

        // Seed: producto para empresa 2
        db2.insert('productos', { nombre: 'Asado',             precio: 2500 });

        // Seed: categorías (tabla sin empresa_id)
        db1.insert('categorias', { nombre: 'Pizzas' });
        db1.insert('categorias', { nombre: 'Carnes' });
    });

    after(() => cleanupAppDb());

    // ── find() ────────────────────────────────────────────────────────────────

    it('find() en tabla tenant retorna solo registro de la empresa correcta', () => {
        const prod = db1.find('productos', { nombre: 'Pizza Mozzarella' });
        assert.ok(prod, 'debe encontrar el producto');
        assert.equal(prod.nombre, 'Pizza Mozzarella');
        assert.equal(prod.empresa_id, 1);
    });

    it('find() en tabla tenant no ve registros de otra empresa', () => {
        // empresa 2 busca "Pizza Mozzarella" que pertenece a empresa 1
        const prod = db2.find('productos', { nombre: 'Pizza Mozzarella' });
        assert.equal(prod, null, 'empresa 2 no debe ver productos de empresa 1');
    });

    it('find() en tabla sin empresa_id retorna resultado sin filtrar', () => {
        const cat = db1.find('categorias', { nombre: 'Pizzas' });
        assert.ok(cat, 'debe encontrar la categoría');
        assert.equal(cat.nombre, 'Pizzas');
    });

    it('find() retorna null cuando no hay resultados', () => {
        const prod = db1.find('productos', { nombre: 'NoExiste' });
        assert.equal(prod, null);
    });

    // ── findAll() ─────────────────────────────────────────────────────────────

    it('findAll() en tabla tenant retorna solo registros de la empresa', () => {
        const rows = db1.findAll('productos');
        assert.equal(rows.length, 2, 'empresa 1 tiene 2 productos');
        rows.forEach(r => assert.equal(r.empresa_id, 1));
    });

    it('findAll() de empresa 2 no incluye registros de empresa 1', () => {
        const rows = db2.findAll('productos');
        assert.equal(rows.length, 1, 'empresa 2 tiene 1 producto');
        assert.equal(rows[0].nombre, 'Asado');
    });

    it('findAll() en tabla global retorna todos los registros', () => {
        const rows = db1.findAll('categorias');
        assert.ok(rows.length >= 2, 'categorias es tabla global');
    });

    // ── insert() ──────────────────────────────────────────────────────────────

    it('insert() en tabla tenant inyecta empresa_id automáticamente', () => {
        const id = db1.insert('productos', { nombre: 'Fainá', precio: 150 });
        assert.ok(id, 'debe retornar el rowid');

        const prod = db1.find('productos', { nombre: 'Fainá' });
        assert.ok(prod, 'debe poder encontrar el producto recién insertado');
        assert.equal(prod.empresa_id, 1, 'empresa_id debe ser 1 (inyectado automáticamente)');
    });

    it('insert() en tabla tenant con empresa 2 asigna empresa_id=2', () => {
        db2.insert('productos', { nombre: 'Milanesa', precio: 800 });
        const prod = db2.find('productos', { nombre: 'Milanesa' });
        assert.ok(prod);
        assert.equal(prod.empresa_id, 2);

        // Empresa 1 no lo ve
        const invisible = db1.find('productos', { nombre: 'Milanesa' });
        assert.equal(invisible, null);
    });

    it('insert() en tabla sin empresa_id no agrega empresa_id', () => {
        const id = db1.insert('categorias', { nombre: 'Postres' });
        assert.ok(id);
        const cat = db1.find('categorias', { nombre: 'Postres' });
        assert.ok(cat);
        assert.equal(cat.empresa_id, undefined, 'categorias no tiene empresa_id');
    });

    // ── Aislamiento tenant ────────────────────────────────────────────────────

    it('empresa A no puede leer total de registros de empresa B', () => {
        const rowsA = db1.findAll('productos').length;
        const rowsB = db2.findAll('productos').length;
        const total = db1.exec('SELECT COUNT(*) FROM productos')[0].values[0][0];
        // El total global debe ser mayor que lo que cada empresa ve individualmente
        assert.ok(total >= rowsA + rowsB, 'existen registros de ambas empresas en la tabla');
        // Cada empresa solo ve los suyos
        db1.findAll('productos').forEach(r => assert.equal(r.empresa_id, 1));
        db2.findAll('productos').forEach(r => assert.equal(r.empresa_id, 2));
    });

    // ── escape hatches ────────────────────────────────────────────────────────

    it('exec() retorna resultado sin filtro de tenant (escape hatch)', () => {
        const result = db1.exec('SELECT COUNT(*) as total FROM productos');
        const total  = result[0].values[0][0];
        // Sin filtro → ve TODOS los productos de todas las empresas
        assert.ok(total > 2, 'exec() ve todos los registros sin filtro de tenant');
    });

});
