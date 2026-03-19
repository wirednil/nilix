/**
 * @file tests/authService.test.js
 * @description Tests unitarios para authService.login()
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { setupAuthDb } = require('./helpers/db');

// Hash pre-computado con cost 4 (rápido para tests) para "password1234"
const PASS       = 'password1234';
const PASS_HASH  = bcrypt.hashSync(PASS, 4);
const WRONG_PASS = 'wrongpassword99';

// JWT secret mínimo para tests
process.env.NIL_JWT_SECRET  = 'test-secret-for-tests-only-32bytes!!';
process.env.NIL_JWT_EXPIRY  = '1h';

let cleanup;
let login;
let LoginError;

describe('authService.login()', async () => {

    before(async () => {
        const result = await setupAuthDb([
            // Usuario normal
            { usuario: 'admin',   passwordHash: PASS_HASH, activo: 1, failedAttempts: 0 },
            // Usuario bloqueado (activo = 0)
            { usuario: 'blocked', passwordHash: PASS_HASH, activo: 0, failedAttempts: 5 },
            // Usuario casi bloqueado (4 intentos fallidos, se bloquea en el 5to)
            { usuario: 'almostblocked', passwordHash: PASS_HASH, activo: 1, failedAttempts: 4 },
        ]);
        cleanup = result.cleanupAuthDb;

        // Requerir DESPUÉS de que setupAuthDb haya seteado NIL_AUTH_DB
        const svc = require('../src/services/authService');
        login      = svc.login;
        LoginError = svc.LoginError;
    });

    after(() => cleanup());

    // ── Input validation ──────────────────────────────────────────────────────

    it('rechaza usuario con formato inválido (caracteres especiales)', async () => {
        const res = await login('adm!n', PASS);
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.INVALID_INPUT);
    });

    it('rechaza usuario demasiado corto (< 3 chars)', async () => {
        const res = await login('ab', PASS);
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.INVALID_INPUT);
    });

    it('rechaza contraseña demasiado corta (< 8 chars)', async () => {
        const res = await login('admin', 'short');
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.INVALID_INPUT);
    });

    it('input inválido usa el mismo mensaje genérico que credenciales incorrectas (anti-enumeración)', async () => {
        const resInvalid  = await login('adm!n', PASS);        // formato inválido
        const resNotFound = await login('noexiste99', PASS);    // usuario no existe
        // Ambos deben devolver el mismo mensaje para no filtrar información
        assert.equal(resInvalid.error, resNotFound.error, 'el mensaje debe ser idéntico en ambos casos');
    });

    // ── User not found ────────────────────────────────────────────────────────

    it('rechaza usuario inexistente con mensaje genérico', async () => {
        const res = await login('noexiste', PASS);
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.USER_NOT_FOUND);
        // El mensaje debe ser idéntico al de contraseña incorrecta (anti-enumeración)
        const resWrong = await login('admin', WRONG_PASS);
        assert.equal(res.error, resWrong.error);
    });

    // ── Wrong password ────────────────────────────────────────────────────────

    it('rechaza contraseña incorrecta', async () => {
        const res = await login('admin', WRONG_PASS);
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.WRONG_PASSWORD);
    });

    // ── Blocked account ───────────────────────────────────────────────────────

    it('rechaza usuario con activo=0 (bloqueado manualmente)', async () => {
        const res = await login('blocked', PASS);
        assert.equal(res.ok, false);
        assert.equal(res.errorCode, LoginError.USER_BLOCKED);
    });

    it('bloquea cuenta en el 5to intento fallido', async () => {
        // 'almostblocked' ya tiene 4 intentos fallidos → el 5to bloquea
        const res = await login('almostblocked', WRONG_PASS);
        assert.equal(res.ok, false);
        // Debe retornar mensaje de bloqueado (no de credenciales incorrectas)
        assert.ok(res.error.toLowerCase().includes('bloqueada') || res.error.toLowerCase().includes('administrador'));
    });

    // ── Successful login ──────────────────────────────────────────────────────

    it('login exitoso retorna ok:true y token', async () => {
        const res = await login('admin', PASS);
        assert.equal(res.ok, true);
        assert.ok(res.token, 'debe haber un token JWT');
    });

    it('JWT contiene los campos esperados en el payload', async () => {
        const res = await login('admin', PASS);
        assert.ok(res.token);

        const jwt = require('jsonwebtoken');
        const payload = jwt.decode(res.token);

        assert.ok(payload.usuarioId,  'payload.usuarioId presente');
        assert.ok(payload.empresaId,  'payload.empresaId presente');
        assert.ok(payload.usuario,    'payload.usuario presente');
        assert.ok(payload.rol,        'payload.rol presente');
        assert.ok(payload.jti,        'payload.jti presente (para blacklist)');
        assert.equal(payload.usuario, 'admin');
    });

    it('JWT incluye publicToken en el payload', async () => {
        const res = await login('admin', PASS);
        const jwt = require('jsonwebtoken');
        const payload = jwt.decode(res.token);
        // publicToken puede ser null si la empresa no tiene token, pero el campo debe existir
        assert.ok('publicToken' in payload, 'payload.publicToken debe estar presente');
    });

});
