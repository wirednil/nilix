#!/usr/bin/env node
/**
 * @file utils/create-wizard.js
 * @description Creates a system-wide wizard account (rol='wizard',
 *   empresa_id=0) — cross-tenant access to auth.db. Server-side only, never
 *   exposed over HTTP. Calls authRecordService.createSystemWizard(), the one
 *   place in the codebase allowed to set rol='wizard' — see that function's
 *   docstring for why this isn't a flag through the generic upsert() path.
 *
 * IMPORTANT — run this with the nilix server STOPPED. The server keeps
 * auth.db loaded in memory; if it's running, its next scheduled save (or its
 * own shutdown) overwrites whatever this script wrote, and the new wizard
 * disappears with no error anywhere. This script best-effort checks whether
 * something is listening on NIL_PORT and warns if so, but that's a heuristic,
 * not a guarantee — stop the server yourself before running this.
 *
 * Usage:
 *   node utils/create-wizard.js --usuario <usuario> --nombre "<nombre>" --password <password>
 *
 * Password on the command line is visible in shell history and process
 * lists (ps). Prefer running this interactively on a trusted machine.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const net = require('net');
const os  = require('os');

function parseArgs(argv) {
    const result = { usuario: null, nombre: null, password: null, help: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') result.help = true;
        else if (a === '--usuario')  result.usuario  = argv[++i];
        else if (a === '--nombre')   result.nombre   = argv[++i];
        else if (a === '--password') result.password = argv[++i];
    }
    return result;
}

function printHelp() {
    console.log(`
Uso:
  node utils/create-wizard.js --usuario <usuario> --nombre "<nombre>" --password <password>

Crea una cuenta wizard de sistema (rol='wizard', empresa_id=0) — acceso
cross-tenant a auth.db. Es la operación más privilegiada del sistema.

IMPORTANTE: correr con el servidor nilix DETENIDO (ver advertencia al arrancar).
`);
}

// Best-effort: ¿hay algo escuchando en el puerto del server? No es una
// garantía (podría estar en otra máquina, otro puerto, o algo más podría
// estar usando este puerto) — pero convierte un warning genérico en uno
// específico cuando sí detecta algo.
function checkPortInUse(port) {
    return new Promise(resolve => {
        const socket = net.createConnection({ port, host: '127.0.0.1', timeout: 500 });
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => resolve(false));
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.usuario || !args.nombre || !args.password) {
        printHelp();
        process.exit(args.help ? 0 : 1);
    }

    console.log('ADVERTENCIA: este script escribe directo a auth.db.');
    console.log('Si el servidor nilix está corriendo contra el mismo archivo, tiene su');
    console.log('propia copia en memoria — su próximo guardado sobrescribe este cambio');
    console.log('y el wizard nuevo desaparece sin ningún error visible.');
    console.log('Detené el servidor antes de continuar.\n');

    const port = Number(process.env.NIL_PORT ?? 3000);
    if (await checkPortInUse(port)) {
        console.log(`Hay algo escuchando en 127.0.0.1:${port} — probablemente el servidor nilix está corriendo.`);
        console.log('Detenelo antes de seguir, o este cambio se va a perder.\n');
    }

    const { initAuthDatabase, getAuthDatabase, closeAuthDatabase, insertAuditLog } = require('../src/services/authDatabase');
    const authRecordService = require('../src/services/authRecordService');

    await initAuthDatabase();

    let created;
    try {
        created = await authRecordService.createSystemWizard({
            nombre: args.nombre,
            usuario: args.usuario,
            password: args.password,
        });
    } catch (err) {
        console.error(`ERROR: ${err.message}`);
        closeAuthDatabase();
        process.exit(1);
    }

    console.log(`Wizard creado en memoria: id=${created.id}, usuario=${created.usuario}, empresa_id=${created.empresa_id}`);

    // Auditoría: quién corrió esto y cuándo. No hay sesión HTTP acá, así que
    // method/path son marcadores de que esto vino de este script en vez de
    // una request; ip lleva usuario del SO + hostname a falta de una IP real.
    const osUser = `${os.userInfo().username}@${os.hostname()}`;
    insertAuditLog({
        usuarioId: null,
        empresaId: 0,
        method: 'CLI',
        path: `utils/create-wizard.js usuario=${args.usuario}`,
        status: 201,
        ms: null,
        ip: osUser,
    });

    closeAuthDatabase(); // flushea usuarios + audit_log a disco

    // Verificación de ciclo completo: cerrar, reabrir desde disco, confirmar
    // que tanto el usuario como la entrada de auditoría persistieron de
    // verdad — no solo en la copia en memoria de este proceso.
    await initAuthDatabase();
    const db = getAuthDatabase();

    const userCheck = db.exec(
        'SELECT id, rol, empresa_id FROM usuarios WHERE usuario = ?', [args.usuario]
    );
    if (!userCheck.length || !userCheck[0].values.length) {
        console.error('ERROR: el usuario no está en disco después de reabrir la DB. El write no persistió.');
        closeAuthDatabase();
        process.exit(1);
    }
    const [id, rol, empresaId] = userCheck[0].values[0];
    if (rol !== 'wizard' || empresaId !== 0) {
        console.error(`ERROR: la fila persistida no tiene los valores esperados (rol=${rol}, empresa_id=${empresaId}).`);
        closeAuthDatabase();
        process.exit(1);
    }

    const auditCheck = db.exec(
        'SELECT id FROM audit_log WHERE path LIKE ? ORDER BY id DESC LIMIT 1',
        [`%create-wizard.js usuario=${args.usuario}%`]
    );
    const auditOk = auditCheck.length && auditCheck[0].values.length;

    console.log(`\nConfirmado en disco: id=${id}, usuario=${args.usuario}, rol=${rol}, empresa_id=${empresaId}, creado por ${osUser}`);
    console.log(auditOk ? 'Entrada de auditoría confirmada en disco.' : 'AVISO: no se pudo confirmar la entrada de auditoría (no bloqueante).');

    closeAuthDatabase();
}

main().catch(err => {
    console.error('ERROR INESPERADO:', err);
    process.exit(1);
});
