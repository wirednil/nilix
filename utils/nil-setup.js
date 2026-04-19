#!/usr/bin/env node
'use strict';

/**
 * @file nil-setup.js
 * @description First-run setup for nilix custom projects.
 *
 * Called by the project's thin setup.js wrapper:
 *   process.env.NIL_APP_DIR = __dirname;
 *   require('../nilix/utils/nil-setup.js');
 *
 * Or directly (dev):
 *   node utils/nil-setup.js /path/to/project
 *
 * Steps:
 *   1. Generates NIL_JWT_SECRET in .env if missing
 *   2. Runs the engine's init-auth.js (creates auth.db schema)
 *
 * The project's setup.js wrapper is responsible for running init-app.js
 * (app-specific DB schema) after this module returns.
 */

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── Resolve project dir ───────────────────────────────────────────────────────
const APP_DIR = process.env.NIL_APP_DIR
    ?? process.argv[2]
    ?? process.cwd();

const ENV_PATH = path.join(APP_DIR, '.env');

if (!fs.existsSync(ENV_PATH)) {
    console.error(`❌  .env not found in ${APP_DIR}`);
    process.exit(1);
}

// ── Parse .env ───────────────────────────────────────────────────────────────
const envLines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');

for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
}

// ── Resolve relative paths ───────────────────────────────────────────────────
const toAbs = key => {
    if (process.env[key] && !path.isAbsolute(process.env[key]))
        process.env[key] = path.resolve(APP_DIR, process.env[key]);
};
toAbs('NIL_ENGINE_PATH');
toAbs('NIL_AUTH_DB');
toAbs('NIL_DB_FILE');
toAbs('NIL_MENU_FILE');

const ENGINE_PATH = process.env.NIL_ENGINE_PATH ?? path.resolve(APP_DIR, '../nilix');

// ── Step 1: Generate NIL_JWT_SECRET if missing ───────────────────────────────
const hasSecret = envLines.some(l => l.trim().startsWith('NIL_JWT_SECRET=') && l.trim().length > 'NIL_JWT_SECRET='.length);

if (!hasSecret) {
    console.log('🔑  Generating NIL_JWT_SECRET...');
    const secret  = crypto.randomBytes(32).toString('hex');
    const updated = envLines.map(l =>
        l.trim().startsWith('NIL_JWT_SECRET=') ? `NIL_JWT_SECRET=${secret}` : l
    ).join('\n');
    fs.writeFileSync(ENV_PATH, updated);
    process.env.NIL_JWT_SECRET = secret;
    console.log('    Done.');
} else {
    console.log('🔑  NIL_JWT_SECRET already set.');
}

// ── Step 2: Initialize auth.db ───────────────────────────────────────────────
const initAuthPath = path.join(ENGINE_PATH, 'utils', 'init-auth.js');

if (!fs.existsSync(initAuthPath)) {
    console.error(`❌  init-auth.js not found at ${ENGINE_PATH}/utils/`);
    console.error('    Check NIL_ENGINE_PATH in .env');
    process.exit(1);
}

console.log('🗄️   Initializing auth.db...');
require(initAuthPath);
console.log('    Done.');
