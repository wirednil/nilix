#!/usr/bin/env node
/**
 * @file scripts/check.js
 * @description Dev health check — valida entorno, tests unitarios y smoke tests HTTP.
 *
 * Usage:
 *   node scripts/check.js
 *   npm run check
 */

'use strict';

const path               = require('path');
const fs                 = require('fs');
const { spawnSync, spawn } = require('child_process');

const ROOT       = path.join(__dirname, '..');
const DEV_DIR    = path.join(ROOT, 'dev');
const CHECK_PORT = 3099;
const BASE_URL   = `http://localhost:${CHECK_PORT}`;

// ── Result tracking ───────────────────────────────────────────────────────────

const results = [];
let hasError  = false;

function pass(label) {
    results.push({ ok: true, label });
    console.log(`  ✓ ${label}`);
}

function warn(label) {
    console.log(`  ! ${label}`);
}

function fail(label, detail) {
    results.push({ ok: false, label, detail });
    hasError = true;
    console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
}

function section(title) {
    console.log(`\n[${title}]`);
}

// ── ENV ───────────────────────────────────────────────────────────────────────

function checkEnv() {
    section('ENV');

    const [major] = process.versions.node.split('.').map(Number);
    major >= 18
        ? pass(`Node ${process.versions.node}`)
        : fail(`Node ${process.versions.node}`, 'Se requiere Node ≥ 18');

    fs.existsSync(path.join(ROOT, 'node_modules'))
        ? pass('node_modules presente')
        : fail('node_modules ausente', 'Ejecutá: npm install --no-bin-links');

    fs.existsSync(path.join(ROOT, '.env'))
        ? pass('.env presente')
        : warn('.env no encontrado — el server usará defaults');
}

// ── Unit tests ────────────────────────────────────────────────────────────────

function runTests() {
    section('TEST');

    const result = spawnSync('node', [
        '--test',
        'tests/authService.test.js',
        'tests/scopedDb.test.js',
        'tests/recordService.test.js',
    ], { cwd: ROOT, encoding: 'utf-8' });

    // Parse pass/fail counts from TAP output
    const passMatch = result.stdout.match(/# pass\s+(\d+)/);
    const failMatch = result.stdout.match(/# fail\s+(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : '?';
    const failed = failMatch ? parseInt(failMatch[1]) : '?';

    result.status === 0
        ? pass(`Tests unitarios — ${passed} pass, ${failed} fail`)
        : fail('Tests unitarios', `${failed} fallos — corré npm test para ver detalle`);
}

// ── init-dev ──────────────────────────────────────────────────────────────────

function runInitDev() {
    section('DEV');

    const result = spawnSync('node', ['utils/init-dev.js'], {
        cwd: ROOT,
        encoding: 'utf-8',
    });

    result.status === 0
        ? pass('init-dev OK — empresa 99, superdvlp, dev.db')
        : fail('init-dev', result.stderr?.split('\n').find(l => l.includes('ERROR')) ?? '');
}

// ── HTTP smoke tests ──────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxMs = 8000) {
    const step = 250;
    let elapsed = 0;
    while (elapsed < maxMs) {
        try {
            const r = await fetch(`${BASE_URL}/api/health`);
            if (r.ok) return true;
        } catch { /* not ready yet */ }
        await sleep(step);
        elapsed += step;
    }
    return false;
}

async function runHttp() {
    section('HTTP');

    const devEnv = {
        ...process.env,
        NIL_PORT:      String(CHECK_PORT),
        NIL_DB_FILE:   path.join(DEV_DIR, 'dbase', 'dev.db'),
        NIL_MENU_FILE: path.join(DEV_DIR, 'menu.xml'),
    };

    const server = spawn('node', ['server.js'], {
        cwd: ROOT,
        env: devEnv,
        stdio: 'pipe',
    });

    let sessionCookie = null;

    try {
        const ready = await waitForServer();
        if (!ready) {
            fail('Server no arrancó en 8s');
            return;
        }
        pass('Server arrancado');

        // 1. Login
        const loginRes  = await fetch(`${BASE_URL}/api/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ usuario: 'superdvlp', password: 'devpass1234' }),
        });
        const loginData = await loginRes.json();

        if (!loginData.ok) {
            fail('Login superdvlp', loginData.error);
            return;
        }
        pass('Login superdvlp OK');
        sessionCookie = loginRes.headers.get('set-cookie');

        // 2. /api/auth/check
        const checkRes  = await fetch(`${BASE_URL}/api/auth/check`, {
            headers: { Cookie: sessionCookie },
        });
        const checkData = await checkRes.json();
        checkData.ok
            ? pass('/api/auth/check OK')
            : fail('/api/auth/check', JSON.stringify(checkData));

        // 3. /api/menu
        const menuRes  = await fetch(`${BASE_URL}/api/menu`, {
            headers: { Cookie: sessionCookie },
        });
        const menuData = await menuRes.json();
        const items    = Array.isArray(menuData) ? menuData : (menuData.items ?? []);
        items.length >= 3
            ? pass(`/api/menu OK — ${items.length} items`)
            : fail('/api/menu', `esperados ≥3, recibidos ${items.length}`);

        // 4. /api/catalogs/clientes
        const catRes  = await fetch(`${BASE_URL}/api/catalogs/clientes`, {
            headers: { Cookie: sessionCookie },
        });
        const catData = await catRes.json();
        const rows    = catData.rows ?? catData;
        Array.isArray(rows) && rows.length > 0
            ? pass(`/api/catalogs/clientes OK — ${rows.length} filas`)
            : fail('/api/catalogs/clientes', JSON.stringify(catData).slice(0, 80));

        // 5. /api/catalogs/ordenes
        const ordRes  = await fetch(`${BASE_URL}/api/catalogs/ordenes`, {
            headers: { Cookie: sessionCookie },
        });
        const ordData = await ordRes.json();
        const ordRows = ordData.rows ?? ordData;
        Array.isArray(ordRows) && ordRows.length > 0
            ? pass(`/api/catalogs/ordenes OK — ${ordRows.length} filas`)
            : fail('/api/catalogs/ordenes', JSON.stringify(ordData).slice(0, 80));

    } finally {
        server.kill();
        await sleep(200);
        pass('Server apagado');
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────

function summary() {
    const total  = results.length;
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    console.log('\n' + '─'.repeat(52));
    if (failed.length) {
        console.log(`  ${passed}/${total} OK — ${failed.length} FALLARON:`);
        failed.forEach(r => console.log(`    ✗ ${r.label}${r.detail ? ': ' + r.detail : ''}`));
    } else {
        console.log(`  ${passed}/${total} OK — todo en orden`);
    }
    console.log('─'.repeat(52));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('>>> nilix check\n');

    checkEnv();
    runTests();
    runInitDev();
    await runHttp();
    summary();

    process.exit(hasError ? 1 : 0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
