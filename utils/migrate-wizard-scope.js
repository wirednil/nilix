#!/usr/bin/env node
/**
 * @file utils/migrate-wizard-scope.js
 * @description One-time forensic + migration for the rol='wizard' cross-tenant
 *   leak: setupController.js used to create every new tenant's bootstrap admin
 *   with rol='wizard', and authRecordController.js's authEmpresaId() granted
 *   global (unscoped, cross-tenant) access to /api/records/auth/* based on
 *   rol alone, ignoring empresa_id. Together, every tenant onboarded through
 *   the public /nil-setup wizard got silent read/write access to every other
 *   tenant's usuarios and usuario_permisos rows — not an exploit, the default
 *   behavior of onboarding.
 *
 *   Both bugs are fixed in code (setupController.js now inserts rol='admin';
 *   authEmpresaId() now requires rol==='wizard' AND empresa_id===0). This
 *   script is the forensic + cleanup pass for rows created before that fix:
 *
 *     1. Prints every usuarios row with rol='wizard' AND empresa_id != 0 —
 *        this IS the incident record: which tenants had cross-tenant access,
 *        and since when (created_at).
 *     2. Downgrades them to rol='admin' (matching what setupController.js
 *        creates now), scoped back to their own tenant.
 *
 *   Idempotent — re-running finds zero matching rows once applied.
 *
 * Usage:
 *   node utils/migrate-wizard-scope.js            # dry run, no write
 *   node utils/migrate-wizard-scope.js --apply     # print + apply + save
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs  = require('fs');
const sql = require('sql.js');

const ROOT = path.join(__dirname, '..');
const AUTH_DB_PATH = process.env.NIL_AUTH_DB
    ? path.resolve(process.cwd(), process.env.NIL_AUTH_DB)
    : path.join(ROOT, 'data', 'auth.db');

const APPLY = process.argv.includes('--apply');

async function main() {
    if (!fs.existsSync(AUTH_DB_PATH)) {
        console.error(`No existe: ${AUTH_DB_PATH}`);
        process.exit(1);
    }

    const SQL = await sql.default();
    const db = new SQL.Database(fs.readFileSync(AUTH_DB_PATH));

    console.log(`Auth DB: ${AUTH_DB_PATH}\n`);

    const affected = db.exec(
        `SELECT id, usuario, empresa_id, created_at
         FROM usuarios
         WHERE rol = 'wizard' AND empresa_id != 0
         ORDER BY created_at`
    );

    if (!affected.length || !affected[0].values.length) {
        console.log('Sin filas afectadas — rol=\'wizard\' solo existe con empresa_id=0.');
        db.close();
        return;
    }

    const rows = affected[0].values;
    console.log(`${rows.length} cuenta(s) con rol='wizard' fuera de empresa_id=0 (acceso cross-tenant hasta este fix):\n`);
    console.log('id | usuario | empresa_id | created_at');
    for (const [id, usuario, empresaId, createdAt] of rows) {
        console.log(`${id} | ${usuario} | ${empresaId} | ${createdAt ?? '(sin fecha)'}`);
    }
    console.log();

    if (!APPLY) {
        console.log('Dry run — no se modificó nada. Volvé a correr con --apply para aplicar la migración.');
        db.close();
        return;
    }

    db.run(`UPDATE usuarios SET rol = 'admin', updated_at = datetime('now') WHERE rol = 'wizard' AND empresa_id != 0`);
    fs.writeFileSync(AUTH_DB_PATH, Buffer.from(db.export()));
    db.close();

    console.log(`Migrado: ${rows.length} cuenta(s) → rol='admin', scope restringido a su propio empresa_id.`);
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
