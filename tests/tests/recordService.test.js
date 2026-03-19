/**
 * @file tests/recordService.test.js
 * @description Tests unitarios para recordService (CRUD + navigate + tenant isolation)
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupAppDb } = require('./helpers/db');

let recordService;
let cleanupAppDb;

const EMP_A = 1;
const EMP_B = 2;

describe('recordService', async () => {

    before(async () => {
        const result = await setupAppDb();
        cleanupAppDb = result.cleanupAppDb;

        // Requerir DESPUÉS de setupAppDb
        recordService = require('../src/services/recordService');

        // Seed inicial para navigate y findById
        // empresa A: 3 productos con ids consecutivos
        recordService.insert('productos', { nombre: 'Alpha', precio: 100 }, EMP_A);
        recordService.insert('productos', { nombre: 'Beta',  precio: 200 }, EMP_A);
        recordService.insert('productos', { nombre: 'Gamma', precio: 300 }, EMP_A);

        // empresa B: 1 producto
        recordService.insert('productos', { nombre: 'Delta', precio: 400 }, EMP_B);
    });

    after(() => cleanupAppDb());

    // ── insert() ──────────────────────────────────────────────────────────────

    it('insert() crea un nuevo registro y retorna success:true', () => {
        const res = recordService.insert('productos', { nombre: 'Nuevo', precio: 50 }, EMP_A);
        assert.equal(res.success, true);
        assert.ok(res.data.nombre === 'Nuevo');
    });

    it('insert() en tabla tenant inyecta empresa_id', () => {
        const res = recordService.insert('productos', { nombre: 'TenantTest', precio: 99 }, EMP_A);
        assert.equal(res.data.empresa_id, EMP_A);
    });

    it('insert() lanza TABLE_NOT_FOUND para tabla inexistente', () => {
        assert.throws(
            () => recordService.insert('no_existe', { nombre: 'x' }, EMP_A),
            err => err.code === 'TABLE_NOT_FOUND'
        );
    });

    // ── upsert() ─────────────────────────────────────────────────────────────

    it('upsert() sin keyValue hace INSERT (created:true)', () => {
        const res = recordService.upsert('productos', 'id', { nombre: 'Inserted', precio: 10 }, EMP_A);
        assert.equal(res.created, true);
        assert.ok(!res.updated);
    });

    it('upsert() con keyValue existente hace UPDATE (updated:true)', () => {
        recordService.insert('productos', { nombre: 'Original', precio: 100 }, EMP_A);
        // Obtener id real desde DB (insert no retorna autoincrement id)
        const row = recordService.findById('productos', 'nombre', 'Original', EMP_A);
        assert.ok(row, 'debe encontrar el registro recién insertado');
        const id = row.id;

        const res = recordService.upsert('productos', 'id', { id, nombre: 'Modificado', precio: 999 }, EMP_A);
        assert.equal(res.updated, true);
        assert.ok(!res.created);
    });

    it('upsert() update modifica el valor en DB', () => {
        recordService.insert('productos', { nombre: 'AntesUpdate', precio: 1 }, EMP_A);
        const row = recordService.findById('productos', 'nombre', 'AntesUpdate', EMP_A);
        const id  = row.id;

        recordService.upsert('productos', 'id', { id, nombre: 'DespuesUpdate', precio: 999 }, EMP_A);

        const updated = recordService.findById('productos', 'id', id, EMP_A);
        assert.equal(updated.nombre, 'DespuesUpdate');
        assert.equal(updated.precio, 999);
    });

    // ── findById() ────────────────────────────────────────────────────────────

    it('findById() retorna el registro correcto', () => {
        recordService.insert('productos', { nombre: 'FindMe', precio: 1 }, EMP_A);
        // findById por nombre para obtener el id real
        const byName = recordService.findById('productos', 'nombre', 'FindMe', EMP_A);
        assert.ok(byName, 'debe encontrar por nombre');

        const row = recordService.findById('productos', 'id', byName.id, EMP_A);
        assert.ok(row, 'debe encontrar el registro por id');
        assert.equal(row.nombre, 'FindMe');
    });

    it('findById() retorna null para registro de otra empresa (aislamiento tenant)', () => {
        recordService.insert('productos', { nombre: 'SoloDeA', precio: 1 }, EMP_A);
        const row = recordService.findById('productos', 'nombre', 'SoloDeA', EMP_A);
        assert.ok(row, 'empresa A debe ver su propio registro');

        // Empresa B intenta leerlo por id
        const invisible = recordService.findById('productos', 'id', row.id, EMP_B);
        assert.equal(invisible, null, 'empresa B no debe ver registro de empresa A');
    });

    // ── navigate() ───────────────────────────────────────────────────────────

    it('navigate(next) retorna el siguiente registro por id', () => {
        // Buscar el primer producto de empresa A (Alpha)
        const first = recordService.findById('productos', 'nombre', 'Alpha', EMP_A)
            ?? assert.fail('Alpha no encontrado');

        const next = recordService.navigate('productos', 'id', first.id, 'next', EMP_A);
        assert.ok(next, 'debe haber un siguiente registro');
        assert.ok(next.id > first.id, 'id del siguiente debe ser mayor');
        assert.equal(next.empresa_id, EMP_A, 'el siguiente debe ser de la misma empresa');
    });

    it('navigate(prev) retorna el registro anterior', () => {
        const gamma = recordService.findById('productos', 'nombre', 'Gamma', EMP_A)
            ?? assert.fail('Gamma no encontrado');

        const prev = recordService.navigate('productos', 'id', gamma.id, 'prev', EMP_A);
        assert.ok(prev, 'debe haber un registro anterior');
        assert.ok(prev.id < gamma.id);
        assert.equal(prev.empresa_id, EMP_A);
    });

    it('navigate(prev) en el primer registro retorna null (boundary)', () => {
        const alpha = recordService.findById('productos', 'nombre', 'Alpha', EMP_A)
            ?? assert.fail('Alpha no encontrado');

        const prev = recordService.navigate('productos', 'id', alpha.id, 'prev', EMP_A);
        assert.equal(prev, null, 'no debe haber registro anterior al primero');
    });

    it('navigate() no cruza registros de otras empresas', () => {
        // Delta pertenece a empresa B — navigate desde empresa A no debe verlo
        const gamma = recordService.findById('productos', 'nombre', 'Gamma', EMP_A)
            ?? assert.fail('Gamma no encontrado');

        const next = recordService.navigate('productos', 'id', gamma.id, 'next', EMP_A);
        // Si hay un siguiente, no debe ser de empresa B
        if (next !== null) {
            assert.equal(next.empresa_id, EMP_A);
        }
    });

    // ── remove() ─────────────────────────────────────────────────────────────

    it('remove() elimina el registro y retorna true', () => {
        recordService.insert('productos', { nombre: 'Borrame', precio: 1 }, EMP_A);
        const row = recordService.findById('productos', 'nombre', 'Borrame', EMP_A);
        assert.ok(row);

        const ok = recordService.remove('productos', 'id', row.id, EMP_A);
        assert.equal(ok, true);

        const gone = recordService.findById('productos', 'id', row.id, EMP_A);
        assert.equal(gone, null, 'registro debe haber sido eliminado');
    });

    it('remove() lanza RECORD_NOT_FOUND si no existe', () => {
        assert.throws(
            () => recordService.remove('productos', 'id', 99999, EMP_A),
            err => err.code === 'RECORD_NOT_FOUND'
        );
    });

    it('remove() no puede eliminar registro de otra empresa', () => {
        recordService.insert('productos', { nombre: 'SoloDeA2', precio: 1 }, EMP_A);
        const row = recordService.findById('productos', 'nombre', 'SoloDeA2', EMP_A);
        assert.ok(row);

        // Empresa B intenta eliminar por id real
        assert.throws(
            () => recordService.remove('productos', 'id', row.id, EMP_B),
            err => err.code === 'RECORD_NOT_FOUND'
        );

        // El registro sigue existiendo en empresa A
        const still = recordService.findById('productos', 'id', row.id, EMP_A);
        assert.ok(still, 'registro debe seguir existiendo en empresa A');
    });

});
