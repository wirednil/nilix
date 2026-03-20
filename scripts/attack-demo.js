/**
 * attack-demo.js — Demostración de ausencia de rate limiting
 *
 * Vectores:
 *   1. GET /api/auth/check         — público, sin cookie
 *   2. GET /api/records/clientes   — autenticado, lectura de datos
 *   3. GET /api/public/report-data — público, tokens aleatorios
 *   4. POST /api/handler/noop/after — autenticado, handler inexistente (404 pero procesado)
 *   CONTROL: POST /api/auth/login  — protegido con rate limit real
 *
 * Uso: node scripts/attack-demo.js
 */

const BASE = 'http://localhost:3000';
const N = 100;     // valor base para endpoints con límite bajo (public: 60/min)
const N_API = 250; // supera el límite general de la API autenticada (200/min)

// ─── auth ─────────────────────────────────────────────────────────────────────

async function login() {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: 'superdvlp', password: 'devpass1234' })
    });
    const setCookie = res.headers.get('set-cookie');
    const match = setCookie?.match(/nil_token=([^;]+)/);
    if (!match) throw new Error(`Login fallido (HTTP ${res.status}) — ¿servidor corriendo con dev sandbox?`);
    return match[1];
}

// ─── flood — cuenta por status code HTTP explícito ───────────────────────────

/**
 * Dispara `n` requests concurrentes. Retorna:
 *   { codes: { 200: x, 401: y, 429: z, ... }, totalMs, rps }
 */
async function flood(n, fn) {
    const start = Date.now();
    const results = await Promise.allSettled(Array.from({ length: n }, fn));
    const totalMs = Date.now() - start;

    const codes = {};
    let netErrors = 0;
    for (const r of results) {
        if (r.status === 'rejected') {
            netErrors++;
        } else {
            const code = r.value;
            codes[code] = (codes[code] ?? 0) + 1;
        }
    }
    if (netErrors) codes['net_err'] = netErrors;

    return { codes, totalMs, rps: Math.round(n / (totalMs / 1000)) };
}

// ─── display ──────────────────────────────────────────────────────────────────

function printResult({ codes, totalMs, rps }, n) {
    const blocked429 = codes[429] ?? 0;
    const isVulnerable = blocked429 === 0;

    console.log(`  Completado en   : ${totalMs}ms  (~${rps} req/s)`);
    console.log(`  Requests totales: ${n}`);

    for (const [code, count] of Object.entries(codes).sort()) {
        const label =
            code === '200'     ? '200 OK (procesado)'    :
            code === '204'     ? '204 No Content'        :
            code === '400'     ? '400 Bad Request'       :
            code === '401'     ? '401 Unauthorized'      :
            code === '403'     ? '403 Forbidden'         :
            code === '404'     ? '404 Not Found'         :
            code === '429'     ? '429 Rate Limited  ← BLOQUEADO' :
            code === '500'     ? '500 Server Error'      :
            code === 'net_err' ? 'Error de red'          : code;
        console.log(`  ${label.padEnd(34)}: ${count}`);
    }

    if (isVulnerable) {
        console.log(`\n  ⚠  SIN RATE LIMIT — ningún request fue bloqueado (0 x 429)`);
    } else if (blocked429 === n) {
        console.log(`\n  ✅ PROTEGIDO — todos los requests excedentes bloqueados (${blocked429} x 429)`);
    } else {
        console.log(`\n  ✅ PROTEGIDO — ${blocked429}/${n} bloqueados por rate limit`);
    }
}

// ─── vectores ─────────────────────────────────────────────────────────────────

async function vector1() {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('VECTOR 1 — GET /api/auth/check  (público, sin credenciales)');
    console.log('Escenario: cualquier agente desde internet sin autenticarse.');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Disparando ${N} requests concurrentes...`);

    const result = await flood(N, async () => {
        const res = await fetch(`${BASE}/api/auth/check`);
        return res.status;
    });
    printResult(result, N);
}

async function vector2(cookie) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('VECTOR 2 — GET /api/catalogs/clientes  (JWT requerido)');
    console.log('Escenario: token comprometido o empleado con sesión activa.');
    console.log(`N=${N_API} para superar el límite de 200 req/min del apiLimiter.`);
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Disparando ${N_API} requests concurrentes...`);

    const result = await flood(N_API, async () => {
        const res = await fetch(`${BASE}/api/catalogs/clientes`, {
            headers: { Cookie: `nil_token=${cookie}` }
        });
        return res.status;
    });
    printResult(result, N_API);
}

async function vector3() {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('VECTOR 3 — GET /api/public/report-data  (público, sin auth)');
    console.log('Escenario: enumeración de tokens con tokens aleatorios inválidos.');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Disparando ${N} requests concurrentes...`);

    const makeToken = () =>
        Buffer.from(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))
            .toString('base64url');

    const result = await flood(N, async () => {
        const res = await fetch(`${BASE}/api/public/report-data?report=carta&t=${makeToken()}`);
        return res.status;
    });
    printResult(result, N);
}

async function vector4(cookie) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('VECTOR 4 — POST /api/handler/noop/after  (JWT requerido)');
    console.log('Handler "noop" no existe → 404, pero el servidor procesa cada');
    console.log('request: pasa por verifyToken + handlerService.loadHandler.');
    console.log('Con handler real: ejecuta lógica de negocio (DB writes, etc.).');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Disparando ${N} requests concurrentes...`);

    const result = await flood(N, async () => {
        const res = await fetch(`${BASE}/api/handler/noop/after`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `nil_token=${cookie}`
            },
            body: JSON.stringify({ fieldId: 'test', value: '1', data: {} })
        });
        return res.status;
    });
    printResult(result, N);
}

async function controlLogin() {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('CONTROL — POST /api/auth/login  (tiene rate limiting: 10/15min)');
    console.log('Referencia de cómo debe verse un endpoint correctamente limitado.');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Disparando ${N} requests concurrentes (credenciales erróneas)...`);

    const result = await flood(N, async () => {
        const res = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: 'x', password: 'x' })
        });
        return res.status;
    });
    printResult(result, N);
}

// ─── resumen ──────────────────────────────────────────────────────────────────

function printSummary(results) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('RESUMEN');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('  Endpoint                          429s / N    Estado');
    console.log('  ─────────────────────────────────────────────────────────');
    for (const { label, codes, n } of results) {
        const blocked = codes[429] ?? 0;
        const estado = blocked === 0 ? '❌ VULNERABLE' : '✅ PROTEGIDO';
        console.log(`  ${label.padEnd(34)} ${String(blocked).padStart(3)}/${n}    ${estado}`);
    }
    console.log('');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  NILIX — Demostración de rate limiting (v2, conteo exacto)  ║');
    console.log('║  Entorno: localhost:3000 · dev sandbox · N=100 por vector   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    let cookie;
    try {
        cookie = await login();
        console.log('\n  [AUTH] Login ok — cookie obtenida para vectores 2 y 4');
    } catch (e) {
        console.error(`\n  [ERROR] ${e.message}`);
        process.exit(1);
    }

    const summaryData = [];

    {
        await vector1();
        const r = await flood(N, async () => (await fetch(`${BASE}/api/auth/check`)).status);
        summaryData.push({ label: 'GET /api/auth/check', ...r, n: N });
    }
    {
        await vector2(cookie);
        const r = await flood(N_API, async () => {
            return (await fetch(`${BASE}/api/catalogs/clientes`, {
                headers: { Cookie: `nil_token=${cookie}` }
            })).status;
        });
        summaryData.push({ label: 'GET /api/catalogs/clientes', ...r, n: N_API });
    }
    {
        await vector3();
        const makeToken = () =>
            Buffer.from(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)))
                .toString('base64url');
        const r = await flood(N, async () =>
            (await fetch(`${BASE}/api/public/report-data?report=carta&t=${makeToken()}`)).status
        );
        summaryData.push({ label: 'GET /api/public/report-data', ...r, n: N });
    }
    {
        await vector4(cookie);
        const r = await flood(N, async () => {
            return (await fetch(`${BASE}/api/handler/noop/after`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Cookie: `nil_token=${cookie}` },
                body: JSON.stringify({ fieldId: 'test', value: '1', data: {} })
            })).status;
        });
        summaryData.push({ label: 'POST /api/handler/*/after', ...r, n: N });
    }
    {
        await controlLogin();
        const r = await flood(N, async () => {
            return (await fetch(`${BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: 'x', password: 'x' })
            })).status;
        });
        summaryData.push({ label: 'POST /api/auth/login  [CONTROL]', ...r, n: N });
    }

    printSummary(summaryData);
}

main().catch(console.error);
