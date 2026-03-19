#!/usr/bin/env node
/**
 * @file utils/ndat.js
 * @description nil data utility — bidirectional TSV ↔ SQLite transfer.
 *
 * @usage
 *   node ndat.js exp <table> [--db=<path>]  > table.dat
 *   node ndat.js imp <table> [--db=<path>]  < table.dat
 *
 * Data flows through stdin/stdout; status messages go to stderr.
 * TSV format: first line = tab-separated column names, following lines = rows.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DEFAULT_DB = path.join(__dirname, '..', 'data', 'catalogs.db');

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const opts = { command: null, table: null, db: DEFAULT_DB };

    for (const arg of argv) {
        if (arg.startsWith('--db=')) {
            opts.db = path.resolve(arg.slice(5));
        } else if (!opts.command) {
            opts.command = arg;          // exp | imp
        } else if (!opts.table) {
            opts.table = arg;
        }
    }

    return opts;
}

function showHelp() {
    process.stderr.write(`
ndat — nil data utility

Usage:
  node ndat.js exp <table> [--db=<path>]  > table.dat
  node ndat.js imp <table> [--db=<path>]  < table.dat

Commands:
  exp    Export SQLite table → TSV with headers (stdout)
  imp    Import TSV with headers (stdin)  → SQLite table

Options:
  --db=<path>   SQLite database file  (default: data/catalogs.db)

Examples:
  node ndat.js exp clientes > clientes.dat
  node ndat.js imp clientes < clientes.dat
  node ndat.js exp clientes --db=dev/dbase/dev.db > clientes.dat
  node ndat.js imp clientes --db=dev/dbase/dev.db < clientes.dat
\n`);
}

// ── Type inference (imp only) ─────────────────────────────────────────────────

function inferType(sample) {
    if (/^-?\d+$/.test(sample))       return 'INTEGER';
    if (/^-?\d+\.\d+$/.test(sample))  return 'REAL';
    return 'TEXT';
}

/**
 * Walk all rows and pick the broadest type per column.
 * Precedence: INTEGER < REAL < TEXT
 */
function inferTypes(headers, rows) {
    const types = Object.fromEntries(headers.map(h => [h, 'INTEGER']));

    for (const row of rows) {
        for (const h of headers) {
            const v = row[h];
            if (v === '' || v === null) continue;
            const t = inferType(v);
            if (t === 'REAL'    && types[h] === 'INTEGER') types[h] = 'REAL';
            if (t === 'TEXT'    && types[h] !== 'TEXT')    types[h] = 'TEXT';
        }
    }

    return types;
}

// ── TSV parsing ───────────────────────────────────────────────────────────────

function parseTSV(content) {
    const lines = content.split('\n').filter(l => l.trim() !== '');

    if (lines.length === 0) throw new Error('Empty input');

    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const rows    = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row    = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] ?? '').trim();
        });
        rows.push(row);
    }

    return { headers, rows };
}

// ── exp: SQLite → TSV ─────────────────────────────────────────────────────────

function cmdExp(db, table, schema) {
    const pragma = db.exec(`PRAGMA table_info(${table})`);

    if (!pragma.length || !pragma[0].values.length) {
        throw new Error(`Table not found: ${schema}.${table}`);
    }

    // column name is at index 1 in PRAGMA table_info result
    const columns = pragma[0].values.map(r => r[1]);

    // header line
    process.stdout.write(columns.join('\t') + '\n');

    const result = db.exec(`SELECT * FROM ${table}`);
    const rowCount = result.length ? result[0].values.length : 0;

    if (result.length) {
        for (const row of result[0].values) {
            const line = row.map(v => (v === null || v === undefined) ? '' : String(v)).join('\t');
            process.stdout.write(line + '\n');
        }
    }

    process.stderr.write(`>>> ndat exp: ${table} — ${rowCount} rows exported\n`);
}

// ── imp: TSV → SQLite ─────────────────────────────────────────────────────────

async function cmdImp(db, table, dbPath) {
    // Read all stdin
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('utf-8');

    const { headers, rows } = parseTSV(content);
    const types = inferTypes(headers, rows);

    process.stderr.write(`>>> ndat imp: ${table} — ${rows.length} rows\n`);
    process.stderr.write(`    Columns: ${headers.map(h => `${h}(${types[h]})`).join(', ')}\n`);

    // Recreate table (DROP + CREATE = clean slate for backup/restore)
    const colDefs = headers.map(h => `${h} ${types[h]}`).join(',\n    ');
    db.run(`DROP TABLE IF EXISTS ${table}`);
    db.run(`CREATE TABLE ${table} (\n    ${colDefs}\n)`);

    // Insert with parameterized query (no string interpolation of data)
    const placeholders = headers.map(() => '?').join(', ');
    const stmt = db.prepare(
        `INSERT INTO ${table} (${headers.join(', ')}) VALUES (${placeholders})`
    );

    let inserted = 0;
    let errors   = 0;

    for (const row of rows) {
        const vals = headers.map(h => {
            const v = row[h];
            if (v === '' || v === null || v === undefined) return null;
            if (types[h] === 'INTEGER') return parseInt(v,  10);
            if (types[h] === 'REAL')    return parseFloat(v);
            return v;
        });

        try {
            stmt.run(vals);
            inserted++;
        } catch (e) {
            errors++;
            process.stderr.write(`    Row ${inserted + errors}: ${e.message}\n`);
        }
    }

    stmt.free();

    // Persist
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(db.export()));

    process.stderr.write(`    Inserted: ${inserted}  Errors: ${errors}\n`);
    process.stderr.write(`    Saved: ${dbPath}\n`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    const argv = process.argv.slice(2);

    if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    const opts = parseArgs(argv);

    if (!opts.command || !opts.table) {
        process.stderr.write('Error: Missing command or table.\n');
        showHelp();
        process.exit(1);
    }

    if (opts.command !== 'exp' && opts.command !== 'imp') {
        process.stderr.write(`Error: Unknown command "${opts.command}". Use exp or imp.\n`);
        process.exit(1);
    }

    const SQL = await initSqlJs();

    let db;

    if (fs.existsSync(opts.db)) {
        db = new SQL.Database(fs.readFileSync(opts.db));
    } else if (opts.command === 'imp') {
        db = new SQL.Database();   // create on imp if DB doesn't exist yet
    } else {
        process.stderr.write(`Error: Database not found: ${opts.db}\n`);
        process.exit(1);
    }

    try {
        if (opts.command === 'exp') {
            cmdExp(db, opts.table, opts.schema);
        } else {
            await cmdImp(db, opts.table, opts.db);
        }
    } catch (e) {
        process.stderr.write(`Error: ${e.message}\n`);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
