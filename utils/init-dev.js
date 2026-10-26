#!/usr/bin/env node
/**
 * @file utils/init-dev.js
 * @description Sets up the dev sandbox.
 *   - Auth DB: creates schema if needed + empresa 99 "Dev Sandbox" + usuario superdvlp (idempotent)
 *   - App DB:  dev/dbase/dev.db loaded from dev/data/*.dat (clean slate)
 *
 * Self-contained — does not require init-auth.js.
 *
 * Usage:
 *   node utils/init-dev.js
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs     = require('fs');
const sql    = require('sql.js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT     = path.join(__dirname, '..');
const DEV_DIR  = path.join(ROOT, 'dev');
const DEV_DB   = path.join(DEV_DIR, 'dbase', 'dev.db');
const DATA_DIR = path.join(DEV_DIR, 'data');
const NDAT     = path.join(ROOT, 'utils', 'ndat.js');

const AUTH_DB_PATH = process.env.NIL_AUTH_DB
    ? path.resolve(process.cwd(), process.env.NIL_AUTH_DB)
    : path.join(ROOT, 'data', 'auth.db');

const DEV_EMPRESA_ID = 99;
const DEV_USUARIO    = 'superdvlp';
const DEV_PASS       = 'devpass1234';

function makeToken() {
    return Buffer.from(crypto.randomUUID().replace(/-/g, ''), 'hex').toString('base64url');
}

// ── Auth DB ───────────────────────────────────────────────────────────────────

async function setupAuthDb() {
    console.log('\n── Auth DB ──────────────────────────────────────────────');

    const SQL = await sql.default();
    const dbDir = path.dirname(AUTH_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = fs.existsSync(AUTH_DB_PATH)
        ? new SQL.Database(fs.readFileSync(AUTH_DB_PATH))
        : new SQL.Database();

    // Crear schema si no existe (auth DB nueva)
    db.run(`CREATE TABLE IF NOT EXISTS empresas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT    NOT NULL,
        public_token TEXT    NOT NULL UNIQUE,
        direccion    TEXT,
        email        TEXT,
        activo       INTEGER NOT NULL DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id      INTEGER NOT NULL REFERENCES empresas(id),
        nombre          TEXT    NOT NULL,
        usuario         TEXT    NOT NULL UNIQUE,
        email           TEXT,
        password_hash   TEXT    NOT NULL,
        rol             TEXT    NOT NULL DEFAULT 'operador',
        permisos        TEXT    NOT NULL DEFAULT 'RADU',
        activo          INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS token_blacklist (
        jti        TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
    )`);

    // Empresa 99
    const emp = db.exec(`SELECT id FROM empresas WHERE id = ${DEV_EMPRESA_ID}`);
    if (emp.length && emp[0].values.length) {
        console.log(`  empresa ${DEV_EMPRESA_ID} ya existe — skipped`);
    } else {
        db.run(
            `INSERT INTO empresas (id, nombre, public_token) VALUES (?, ?, ?)`,
            [DEV_EMPRESA_ID, 'Dev Sandbox', makeToken()]
        );
        console.log(`  ✓ empresa ${DEV_EMPRESA_ID} "Dev Sandbox" creada`);
    }

    // superdvlp
    const usr = db.exec(`SELECT id FROM usuarios WHERE usuario = ?`, [DEV_USUARIO]);
    if (usr.length && usr[0].values.length) {
        console.log(`  usuario "${DEV_USUARIO}" ya existe — skipped`);
    } else {
        const hash = await bcrypt.hash(DEV_PASS, 10);
        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, permisos)
             VALUES (?, 'Dev Developer', ?, ?, 'admin', 'RADU')`,
            [DEV_EMPRESA_ID, DEV_USUARIO, hash]
        );
        console.log(`  ✓ usuario "${DEV_USUARIO}" creado — pass: ${DEV_PASS}`);
    }

    fs.writeFileSync(AUTH_DB_PATH, Buffer.from(db.export()));
    db.close();
    console.log(`  Guardado: ${AUTH_DB_PATH}`);
}

// ── Dev DB ────────────────────────────────────────────────────────────────────

function loadDat(table) {
    const datFile = path.join(DATA_DIR, `${table}.dat`);

    if (!fs.existsSync(datFile)) {
        console.log(`  SKIP: ${table}.dat no encontrado`);
        return;
    }

    const dbDir = path.dirname(DEV_DB);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const result = spawnSync(
        'node',
        [NDAT, 'imp', table, `--db=${DEV_DB}`],
        { input: fs.readFileSync(datFile), encoding: 'utf-8' }
    );

    if (result.stderr) process.stdout.write(result.stderr);
    if (result.status !== 0) {
        console.error(`  ERROR cargando ${table}`);
        if (result.error) console.error(result.error.message);
    }
}

// Fixture para el form/multifield_test.xml: catálogo con precio_mayor/menor
// (misma forma que productos.xml de thym-pos) + un pedido con un multifield
// que combina una columna catálogo (select+in-table) y una columna choice
// que lee ese catálogo — ver tests/e2e.test.js.
async function seedMultifieldFixture() {
    const SQL = await sql.default();
    const db = new SQL.Database(fs.readFileSync(DEV_DB));

    db.run(`CREATE TABLE IF NOT EXISTS mf_productos (
        empresa_id   INTEGER NOT NULL,
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT    NOT NULL,
        precio_mayor REAL,
        precio_menor REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mf_pedidos (
        empresa_id INTEGER NOT NULL,
        id         INTEGER PRIMARY KEY AUTOINCREMENT
    )`);

    // Fixture para venta_draft.xml/venta_draft.handler.js — replica el patrón
    // insert-vs-update + after('id')-populate de ventas.handler.js (thym-pos,
    // no versionado acá) para poder probarlo contra código real del motor
    // (handlerController.js afterLoad, HandlerBridge, Multifield.populateRows)
    // sin tocar datos de producción. Ver tests/e2e.test.js.
    db.run(`CREATE TABLE IF NOT EXISTS venta_draft (
        empresa_id INTEGER NOT NULL,
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha      TEXT,
        total      REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS detalle_draft (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        id_venta     INTEGER NOT NULL,
        id_producto  INTEGER NOT NULL,
        cantidad     REAL,
        precio_unitario REAL,
        subtotal     REAL
    )`);

    // Fixture para dev/reports/mes_fixture.yaml — prueba el render inline de
    // un reporte de menú (Workspace.js.renderReport) con un param type:
    // month real, contra el motor real, sin tocar reportes de producción.
    // Sin empresa_id a propósito: resumen_mensual (thym-pos) tampoco lo tiene.
    db.run(`CREATE TABLE IF NOT EXISTS resumen_fixture (
        mes   TEXT PRIMARY KEY,
        monto REAL NOT NULL DEFAULT 0
    )`);
    const existingFixtureMonth = db.exec(`SELECT mes FROM resumen_fixture WHERE mes = '2026-06'`);
    if (!existingFixtureMonth.length || !existingFixtureMonth[0].values.length) {
        db.run(`INSERT INTO resumen_fixture (mes, monto) VALUES ('2026-06', 1000)`);
        db.run(`INSERT INTO resumen_fixture (mes, monto) VALUES ('2026-07', 2000)`);
        console.log('  ✓ resumen_fixture (2 filas) creada');
    } else {
        console.log('  resumen_fixture ya existe — skipped');
    }

    const existing = db.exec(`SELECT id FROM mf_productos WHERE nombre = 'Tote Fixture'`);
    if (!existing.length || !existing[0].values.length) {
        db.run(`INSERT INTO mf_productos (empresa_id, nombre, precio_mayor, precio_menor) VALUES (${DEV_EMPRESA_ID}, 'Tote Fixture', 1500, 2500)`);
        db.run(`INSERT INTO mf_productos (empresa_id, nombre, precio_mayor, precio_menor) VALUES (${DEV_EMPRESA_ID}, 'Mochila Fixture', 3000, 4500)`);
        console.log('  ✓ mf_productos fixture (2 filas) creada');
    } else {
        console.log('  mf_productos fixture ya existe — skipped');
    }

    fs.writeFileSync(DEV_DB, Buffer.from(db.export()));
    db.close();
}

async function setupDevDb() {
    console.log('\n── Dev DB ───────────────────────────────────────────────');

    if (fs.existsSync(DEV_DB)) {
        fs.unlinkSync(DEV_DB);
        console.log('  dev.db eliminado — recargando...');
    }

    loadDat('items');     // tabla global (sin empresa_id)
    loadDat('clientes');  // tenant (empresa_id = 99)
    loadDat('ordenes');   // tenant (empresa_id = 99)

    await seedMultifieldFixture();
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('>>> init-dev');

    await setupAuthDb();
    await setupDevDb();

    console.log('\n>>> Completado');
    console.log(`    Usuario:  ${DEV_USUARIO} / ${DEV_PASS}`);
    console.log(`    App DB:   ${DEV_DB}`);
    console.log(`    Menu:     ${path.join(DEV_DIR, 'menu.xml')}`);
    console.log(`\n    Para usar en .env:`);
    console.log(`    NIL_DB_FILE=${DEV_DB}`);
    console.log(`    NIL_MENU_FILE=${path.join(DEV_DIR, 'menu.xml')}`);
}

main().catch(console.error);
