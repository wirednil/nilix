#!/usr/bin/env node
/**
 * @file scripts/setup.js
 * @description One-time setup after git clone.
 *   1. .env from .env.example + generated JWT secret
 *   2. npm install
 *   3. init-dev.js  (auth DB schema + empresa 99 + superdvlp + dev.db)
 *
 * Usage:
 *   node scripts/setup.js
 */

'use strict';

const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const { spawnSync } = require('child_process');

const ROOT        = path.join(__dirname, '..');
const ENV_FILE    = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const PLACEHOLDER = 'CHANGE_THIS_TO_A_RANDOM_256BIT_HEX_STRING';

console.log('>>> nilix setup\n');

// ── 1. .env ───────────────────────────────────────────────────────────────────

console.log('[1/3] .env');

const secret = crypto.randomBytes(32).toString('hex');

if (!fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_EXAMPLE, 'utf-8')
        .replace(PLACEHOLDER, secret);
    fs.writeFileSync(ENV_FILE, content);
    console.log('  ✓ .env creado desde .env.example con JWT secret generado');
} else {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    if (content.includes(PLACEHOLDER)) {
        fs.writeFileSync(ENV_FILE, content.replace(PLACEHOLDER, secret));
        console.log('  ✓ JWT secret generado en .env existente');
    } else {
        console.log('  ! .env ya existe con secret configurado — sin cambios');
    }
}
console.log();

// ── 2. npm install ────────────────────────────────────────────────────────────

console.log('[2/3] npm install --no-bin-links');
const install = spawnSync('npm', ['install', '--no-bin-links'], {
    cwd:   ROOT,
    stdio: 'inherit',
    shell: true,
});
if (install.status !== 0) {
    console.error('  ERROR: npm install falló');
    process.exit(1);
}
console.log('  ✓ dependencias instaladas\n');

// ── 3. init-dev.js ────────────────────────────────────────────────────────────

console.log('[3/3] init-dev.js');
const dev = spawnSync('node', ['utils/init-dev.js'], {
    cwd:   ROOT,
    stdio: 'inherit',
});
if (dev.status !== 0) {
    console.error('  ERROR: init-dev.js falló');
    process.exit(1);
}
console.log();

// ── Listo ─────────────────────────────────────────────────────────────────────

console.log('─'.repeat(52));
console.log('  Setup completo. Para iniciar:');
console.log();
console.log('    node server.js');
console.log();
console.log('  Usuario demo: superdvlp / devpass1234');
console.log('─'.repeat(52));
