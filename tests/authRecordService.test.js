'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { setupAuthDb } = require('./helpers/db');

const PASS_HASH = bcrypt.hashSync('testpass1234', 4);

describe('authRecordService', async () => {
    let ctx;

    before(async () => {
        ctx = await setupAuthDb([
            { usuario: 'usr1',  passwordHash: PASS_HASH, empresaId: 1, rol: 'operador' },
            { usuario: 'usr2',  passwordHash: PASS_HASH, empresaId: 1, rol: 'operador' },
            { usuario: 'wizard', passwordHash: PASS_HASH, empresaId: 0, rol: 'wizard' },
            { usuario: 'admin0',passwordHash: PASS_HASH, empresaId: 0, rol: 'admin' },
        ]);
    });

    after(() => ctx.cleanupAuthDb());

    function getService() {
        delete require.cache[require.resolve('../src/services/authRecordService')];
        return require('../src/services/authRecordService');
    }

    // ── findById ────────────────────────────────────────────────────────────

    it('findById — existing record within empresa scope', () => {
        const svc = getService();
        const row = svc.findById('usuarios', 'id', 1, 1);
        assert.ok(row, 'debe encontrar el registro');
        assert.equal(row.usuario, 'usr1');
        assert.equal(row.empresa_id, 1);
    });

    it('findById — record from otra empresa returns null (tenant isolation)', () => {
        const svc = getService();
        const row = svc.findById('usuarios', 'id', 2, 0);
        assert.equal(row, null, 'empresa 0 no debe ver registro de empresa 1');
    });

    it('findById — global access (empresaId=null) bypasses empresa filter', () => {
        const svc = getService();
        const row = svc.findById('usuarios', 'id', 3, null);
        assert.ok(row, 'debe encontrar wizard con acceso global');
        assert.equal(row.usuario, 'wizard');
    });

    it('findById — record not found returns null', () => {
        const svc = getService();
        const row = svc.findById('usuarios', 'id', 999, null);
        assert.equal(row, null);
    });

    // ── upsert — INSERT ──────────────────────────────────────────────────────

    it('insert — creates new user with empresa_id from scope', async () => {
        const svc = getService();
        const result = await svc.upsert('usuarios', 'id', {
            usuario: 'nuevo1', nombre: 'Nuevo Uno', password: 'pass123456', permisos: 'R',
        }, 1);
        assert.ok(result.created, 'debe ser un INSERT');
        assert.equal(result.empresa_id, 1, 'empresa_id debe ser 1');
        assert.ok(!result.password_hash, 'password_hash no debe estar en respuesta');
    });

    it('insert — global wizard (empresaId=null) sets empresa_id=0', async () => {
        const svc = getService();
        const result = await svc.upsert('usuarios', 'id', {
            usuario: 'nuevo2', nombre: 'Nil User', password: 'pass123456', permisos: 'R',
        }, null);
        assert.ok(result.created);
        assert.equal(result.empresa_id, 0, 'wizard global crea usuario con empresa_id=0');
    });

    it('insert — empresa_id=0 explicitly passed preserved (guard fix)', async () => {
        const svc = getService();
        const result = await svc.upsert('usuarios', 'id', {
            usuario: 'nuevo3', nombre: 'Explicit Zero', password: 'pass123456',
            empresa_id: 0, permisos: 'R',
        }, null);
        assert.ok(result.created);
        assert.equal(result.empresa_id, 0, 'empresa_id=0 explícito debe preservarse');
    });

    it('insert — empresa_id=0 passed with empresaId=1 gets overwritten', async () => {
        const svc = getService();
        const result = await svc.upsert('usuarios', 'id', {
            usuario: 'nuevo4', nombre: 'Will Be One', password: 'pass123456',
            empresa_id: 0, permisos: 'R',
        }, 1);
        assert.ok(result.created);
        assert.equal(result.empresa_id, 1, 'empresa_id en INSERT debe venir de empresaId cuando es distinto de null');
    });

    it('insert — password menor a 8 chars rechazado', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', {
                usuario: 'shortpwd', nombre: 'Short', password: '123',
            }, 1),
            { code: 'PASSWORD_TOO_SHORT' }
        );
    });

    it('insert — rol no es editable vía esta ruta (requiere ruta dedicada con role check)', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', {
                usuario: 'wannabewizard', nombre: 'Nope', password: 'pass123456', rol: 'wizard',
            }, 1),
            { code: 'FIELD_NOT_ALLOWED', fields: ['rol'] }
        );
    });

    it('insert — permisos inválido rechazado', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', {
                usuario: 'badperms', nombre: 'Nope', password: 'pass123456', permisos: 'ALLPOWERFUL',
            }, 1),
            { code: 'INVALID_PERMISOS' }
        );
    });

    it('insert — password_hash crudo del cliente rechazado (no bypassea el hashing)', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', {
                usuario: 'stolenhash', nombre: 'Nope', password_hash: '$2a$10$stolenhashvalue',
            }, 1),
            { code: 'FIELD_NOT_ALLOWED', fields: ['password_hash'] }
        );
    });

    // ── upsert — UPDATE ──────────────────────────────────────────────────────

    it('update — modifica campos de usuario existente', async () => {
        const svc = getService();
        const result = await svc.upsert('usuarios', 'id', {
            id: 1, nombre: 'Usuario Modificado',
        }, 1);
        assert.ok(result.updated, 'debe ser UPDATE');
        assert.equal(result.nombre, 'Usuario Modificado');
    });

    it('update — record de otra empresa no encontrado', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', { id: 1, nombre: 'nope' }, 0),
            { code: 'RECORD_NOT_FOUND' }
        );
    });

    it('update — activo no es editable vía esta ruta (requiere ruta dedicada con role check)', async () => {
        const svc = getService();
        // activo (y por lo tanto la protección de auto-desactivación que antes
        // vivía acá) quedó fuera de esta ruta genérica por completo — ver
        // EDITABLE_FIELDS en authRecordService.js.
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', { id: 1, activo: 0 }, 1, 1),
            { code: 'FIELD_NOT_ALLOWED', fields: ['activo'] }
        );
    });

    it('update — failed_attempts no es editable vía esta ruta (previene reset de lockout)', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.upsert('usuarios', 'id', { id: 1, failed_attempts: 0 }, 1),
            { code: 'FIELD_NOT_ALLOWED', fields: ['failed_attempts'] }
        );
    });

    // ── navigate ─────────────────────────────────────────────────────────────

    it('navigate — next dentro de empresa', () => {
        const svc = getService();
        const row = svc.navigate('usuarios', 'id', 1, 'next', 1);
        assert.ok(row);
        assert.equal(row.usuario, 'usr2', 'siguiente usuario en empresa 1');
    });

    it('navigate — prev en primer registro retorna null (boundary)', () => {
        const svc = getService();
        const row = svc.navigate('usuarios', 'id', 1, 'prev', 1);
        assert.equal(row, null);
    });

    it('navigate — no cruza empresas', () => {
        const svc = getService();
        const next = svc.navigate('usuarios', 'id', 1, 'next', 0);
        if (next) {
            assert.equal(next.empresa_id, 0, 'navigate no debe cruzar a otra empresa');
        }
    });

    // ── remove ───────────────────────────────────────────────────────────────

    it('remove — soft delete para usuarios (activo=0)', () => {
        const svc = getService();
        const result = svc.remove('usuarios', 'id', 1, 1);
        assert.equal(result, true);

        const after = svc.findById('usuarios', 'id', 1, 1);
        assert.equal(after.activo, 0, 'usuario queda desactivado, no eliminado');
    });

    it('remove — record no existente lanza RECORD_NOT_FOUND', () => {
        const svc = getService();
        assert.throws(
            () => svc.remove('usuarios', 'id', 999, null),
            { code: 'RECORD_NOT_FOUND' }
        );
    });

    it('remove — no puede eliminar registro de otra empresa', () => {
        const svc = getService();
        assert.throws(
            () => svc.remove('usuarios', 'id', 1, 0),
            { code: 'RECORD_NOT_FOUND' }
        );
    });

    // ── createSystemWizard ──────────────────────────────────────────────────
    // La ruta de rol='wizard': no pasa por upsert()/EDITABLE_FIELDS en
    // absoluto. Cobertura de "empresa_id=0 ausente" está en el PoC manual de
    // utils/create-wizard.js (necesita una DB sin schema en absoluto, algo
    // que este helper compartido no puede representar porque siempre siembra
    // empresa_id=0).

    it('createSystemWizard — crea con rol=wizard y empresa_id=0 fijos', async () => {
        const svc = getService();
        const result = await svc.createSystemWizard({
            nombre: 'Nuevo Wizard', usuario: 'nuevowizard', password: 'password1234',
        });
        assert.equal(result.rol, 'wizard');
        assert.equal(result.empresa_id, 0);
        assert.equal(result.usuario, 'nuevowizard');
    });

    it('createSystemWizard — usuario duplicado rechazado', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.createSystemWizard({ nombre: 'X', usuario: 'wizard', password: 'password1234' }),
            { code: 'USUARIO_EXISTS' }
        );
    });

    it('createSystemWizard — password corta rechazada', async () => {
        const svc = getService();
        await assert.rejects(
            () => svc.createSystemWizard({ nombre: 'X', usuario: 'shortpw', password: '123' }),
            { code: 'PASSWORD_TOO_SHORT' }
        );
    });

    it('createSystemWizard — no acepta rol ni empresa_id del caller (no existen como parámetros)', async () => {
        const svc = getService();
        // Pasar campos extra no declarados en la firma no debe tener efecto —
        // createSystemWizard desestructura {nombre, usuario, password} y nada más.
        const result = await svc.createSystemWizard({
            nombre: 'Con Extras', usuario: 'conextras', password: 'password1234',
            rol: 'operador', empresa_id: 5,
        });
        assert.equal(result.rol, 'wizard');
        assert.equal(result.empresa_id, 0);
    });
});
