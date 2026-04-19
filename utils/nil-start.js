#!/usr/bin/env node
'use strict';

/**
 * @file nil-start.js
 * @description Canonical start script for nilix custom projects.
 *
 * Called by the project's thin start.js wrapper:
 *   process.env.NIL_APP_DIR = __dirname;
 *   require('../nilix/utils/nil-start.js');
 *
 * Or directly (dev):
 *   node utils/nil-start.js /path/to/project
 *
 * Behavior:
 *   1. Loads and parses the project's .env (no dotenv dependency)
 *   2. Resolves all NIL_* paths to absolute
 *   3. Spawns server.js from NIL_ENGINE_PATH with tee logging to logs/<date>.log
 *   4. Rotates logs older than 30 days
 */

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { spawn } = require('child_process');

// ── Resolve project dir ───────────────────────────────────────────────────────
// Priority: NIL_APP_DIR env var (set by wrapper) → CLI arg → cwd
const APP_DIR = process.env.NIL_APP_DIR
    ?? process.argv[2]
    ?? process.cwd();

const ENV_PATH = path.join(APP_DIR, '.env');

if (!fs.existsSync(ENV_PATH)) {
    console.error(`❌  .env not found in ${APP_DIR}`);
    console.error('    Run setup.js first, or set NIL_APP_DIR to the project directory.');
    process.exit(1);
}

// ── Parse .env (manual — no dotenv in project) ────────────────────────────────
for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
}

// ── Resolve relative paths to absolute (from APP_DIR) ────────────────────────
const toAbs = key => {
    if (process.env[key] && !path.isAbsolute(process.env[key]))
        process.env[key] = path.resolve(APP_DIR, process.env[key]);
};
toAbs('NIL_ENGINE_PATH');
toAbs('NIL_MENU_FILE');
toAbs('NIL_DB_FILE');
toAbs('NIL_AUTH_DB');

const ENGINE_PATH = process.env.NIL_ENGINE_PATH ?? path.resolve(APP_DIR, '../nilix');
const serverJs    = path.join(ENGINE_PATH, 'server.js');

if (!fs.existsSync(serverJs)) {
    console.error(`❌  server.js not found at ${ENGINE_PATH}`);
    console.error('    Check NIL_ENGINE_PATH in .env');
    process.exit(1);
}

// ── Log file setup with 30-day rotation ──────────────────────────────────────
const LOG_DIR  = path.join(APP_DIR, 'logs');
const LOG_DATE = new Date().toISOString().split('T')[0];
const LOG_FILE = path.join(LOG_DIR, `${LOG_DATE}.log`);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

for (const f of fs.readdirSync(LOG_DIR)) {
    if (!f.endsWith('.log')) continue;
    const full    = path.join(LOG_DIR, f);
    const ageDays = (Date.now() - fs.statSync(full).mtimeMs) / 86_400_000;
    if (ageDays > 30) fs.unlinkSync(full);
}

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const sep = '='.repeat(60);
logStream.write(`\n${sep}\nSession started: ${new Date().toISOString()}\n${sep}\n`);

// ── Launch ────────────────────────────────────────────────────────────────────
const projectName = path.basename(APP_DIR);
console.log(`🚀  ${projectName}`);
console.log(`    Engine : ${ENGINE_PATH}`);
console.log(`    Port   : ${process.env.NIL_PORT ?? 3000}`);
console.log(`    Menu   : ${process.env.NIL_MENU_FILE}`);
console.log(`    Log    : ${LOG_FILE}\n`);

const server = spawn('node', [serverJs], {
    cwd:   ENGINE_PATH,
    env:   process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
});

server.stdout.on('data', chunk => { process.stdout.write(chunk); logStream.write(chunk); });
server.stderr.on('data', chunk => { process.stderr.write(chunk); logStream.write(chunk); });

server.on('exit', code => {
    logStream.write(`\nSession ended: ${new Date().toISOString()} (code ${code ?? 0})\n`);
    logStream.end();
    process.exit(code ?? 0);
});
