# 🗺️ ROADMAP - NILIX

**Plan de implementación de features faltantes**
**Priorizado por impacto y complejidad**

---

## 📈 MÉTRICAS DE PROGRESO

### 🚀 v1.0.0 — Release funcional — 2026-03-02

**Cobertura FDL:** ~95%

**Cobertura RDL:** ~45-50%

**Features Completados:** 38/38 ✅

**LOC (Lines of Code):** ~7,800

**Versiones completadas:**
- v0.12.0: type="select" estático ✅
- v0.13.0: SQLite + API catalogs + in-table validation ✅
- v0.14.0: Dynamic select con in-table ✅
- v0.14.1: Neobrutalismo híbrido ✅
- v0.14.2: CRT Effects ✅
- v0.14.3: The Monospace Web integration ✅
- v0.15.0: Autocomplete component ✅
- v0.16.0: CRUD Completo + exp utility ✅
- v0.18.0: Handler System + Multi-table CRUD ✅
- v0.18.1: Cache Inteligente ✅
- v0.19.0: Web Report Engine PoC ✅
- v0.20.0: DuckDB-WASM Integration ✅
- v0.22.0: Menu System + External App Architecture ✅
- v0.22.1: App Directory Structure ✅
- v0.25.0: Multi-tenant DB Schema ✅
- v0.26.0: Autenticación JWT ✅
- v0.27.0: ScopedDb — tenant-safe handler API ✅
- v0.27.1: AuthFetch — Bearer token en frontend ✅
- v0.28.0: Zona de Claves (key="true" → DbToFm) ✅
- v0.29.0: RADU Enforcement ✅
- v0.29.1: Public Reports (hotfix — Sprint 12-B merged) ✅
- v0.30.0: params schema en YamlParser (Sprint 17) ✅
- v0.31.0: PAG_SIG / PAG_ANT — navegación secuencial ANT/SIG (Sprint 10b) ✅
- v0.32.0: Multifield CRUD — add/delete filas, unique validation (Sprint 19) ✅
- v0.33.0: Campos Virtuales — atributo `is=`, aggregates sum/avg/count/min/max (Sprint 20) ✅
- v0.34.0: Inline Validators — `<min>`, `<max>`, `<pattern>`, `<message>` (Sprint 21) ✅
- **v1.0.0: 🚀 Release funcional completo — 2026-03-02** ✅

### ✅ Objetivo v1.0 — ALCANZADO

**Cobertura objetivo:** 95% ✅

**Features objetivo:** 38/38 ✅

**LOC final:** ~7,800

---

## 🎯 SPRINTS ACTUALIZADOS

### Sprint 1: Core Features ✅ COMPLETO
- [x] Multifield detection
- [x] Help tooltips
- [x] type="select"
- [x] Autocomplete component (v0.15.0)

### Sprint 2: Campos Virtuales ✅ COMPLETO (v0.33.0)
- [x] Atributo `is=` básico (aritmética inter-campo)
- [x] Funciones agregadas sobre multifield (sum, avg, count, min, max)
- [x] Recálculo automático en change/input + evento `multifield-populated`

### Sprint 3: Backend ✅ COMPLETO (v0.13.0 + v0.16.0)
- [x] SQLite con sql.js
- [x] API REST /api/catalogs
- [x] API REST /api/records (CRUD completo)
- [x] Validación dinámica (sqlite_master)
- [x] Utilitario exp.js (TSV → SQLite)

### Sprint 4: Validaciones Avanzadas ✅ COMPLETO (v0.34.0)
- [ ] `in (valores)` con menú estático ← post-1.0
- [x] `<max>`, `<min>`, `<pattern>`, `<message>` inline
- [ ] Cross-field validation ← post-1.0

### Sprint 5: Multifield Avanzado ✅ COMPLETO (v0.32.0)
- [x] Agregar filas (botón `+ AGR`)
- [x] Eliminar filas (botón `✕` por fila)
- [x] Validación unique (`unique="true"` en columna XML)

### Sprint 6: Lookups ✅ COMPLETO (v0.13.0 + v0.14.0 + v0.15.0)
- [x] `in-table` validación en blur
- [x] Select dinámico desde BD
- [x] Campos descripción con copy
- [x] Caché localStorage 24h TTL
- [x] Autocomplete con F1 (estilo terminal)
- [x] Tab validation + copy fields

### Sprint 7: UI/UX Polish ✅ COMPLETO (v0.14.1 + v0.14.2 + v0.14.3 + v0.15.0)
- [x] Neobrutalismo híbrido (hard shadows)
- [x] CRT Effects (scanlines, glow, cursor blink)
- [x] The Monospace Web integration
- [x] Responsive border-box móvil
- [x] Dark mode terminal puro (#000000)

### Sprint 8: CRUD Completo ✅ COMPLETO (v0.16.0)
- [x] schemaService.js - Validación dinámica
- [x] recordService.js - CRUD SQL
- [x] recordController.js - REST controller
- [x] recordRoutes.js - GET/POST/PUT/DELETE
- [x] RecordService.js frontend - Cliente API
- [x] FormRenderer submit a SQLite
- [x] filterValidFields (FmToDb equivalente)
- [x] exp.js utility (TSV → SQLite)

### Sprint 9: Handler System ✅ COMPLETO (v0.18.0)
- [x] Handler `after(fieldId, value, data, db)`
- [x] Handler `beforeSave(data, db)` multi-table
- [x] Cache invalidation global
- [x] `enableFields/disableFields/setValues`
- [x] Demo pizzería completo
- [x] `populateRows()` con paginación

### Sprint 10: Zona de Claves ✅ COMPLETO (v0.28.0 + v0.31.0)
- [x] Atributo `key="true"` en XML
- [x] READ completo (DbToFm — fillForm() en ValidationCoordinator)
- [x] Navegación PAG_SIG/PAG_ANT        ← Sprint 10b (v0.31.0)

### Sprint 11: Web Report Engine ✅ COMPLETO (v0.19.0 + v0.20.0)
- [x] YamlParser - Parsea YAML a ReportSchema
- [x] DataSourceManager - Construye queries desde dbRef
- [x] AccumulatorManager - Funciones de agregación
- [x] BreakDetector - Detección de control breaks
- [x] ExpressionEvaluator - Evaluación de expresiones
- [x] ReportRenderer - Renderizado de zonas a HTML
- [x] ReportEngine - Motor principal
- [x] Demo carta digital (carta.yaml)
- [x] Visor genérico `/report.html?file=nombre`
- [x] API `/api/reports` para listar reportes
- [x] Separación: forms/ (privado) vs reports/ (público)
- [x] DuckDBAdapter - Wrapper DuckDB-WASM con CDN lazy load
- [x] QueryBuilder - Compilador YAML → SQL
- [x] DataSourceManager v2.0 - Backend dual DuckDB/JS
- [x] ExpressionEvaluator safe parser - sin eval()
- [x] Fallback automático a JS si DuckDB falla
- [x] Badge visual de backend (DuckDB/JS)

### Sprint 12: Menu System + External App Architecture ✅ COMPLETO (v0.22.0)
- [x] `dotenv` + `@xmldom/xmldom` instalados
- [x] `server.js` carga `.env` al inicio, usa `NIL_PORT`
- [x] `menuService.js`: parsea `menu.xml` recursivamente, acumula `authorizedDirs`
- [x] `GET /api/menu`: devuelve árbol del `NIL_MENU_FILE`
- [x] `GET /api/files/content?path=`: sirve archivos con autorización por dirs
- [x] `FileExplorer.js`: renderiza items de menú (separator, form, report, menu anidado)
- [x] `Workspace.js`: `loadItem(item)` despacha por tipo
- [x] `main.js`: usa `getMenu()` en lugar de `getTree()`
- [x] `/opt/wc/pizzeria/menu.xml` creado

### Sprint 13: App Directory Structure ✅ COMPLETO (v0.22.1)
- [x] Corregir `menu.xml` targets: `form/precios.xml`, `form/producto_nuevo.xml`
- [x] `NIL_APP_DIR` derivado automáticamente de `dirname(NIL_MENU_FILE)` en `server.js`
- [x] `NIL_DB_FILE=/opt/wc/pizzeria/dbase/pizzeria.db` en `.env`
- [x] `database.js`: usa `NIL_DB_FILE` con fallback a `data/catalogs.db`
- [x] `handlerService.js`: resolución en `$NIL_APP_DIR/apps/` primero, core `handlers/` como fallback
- [x] `precios_handler.js` y `producto_nuevo.handler.js` movidos a `/opt/wc/pizzeria/apps/`
- [x] Convención `handler="none"` documentada en `GUIA-XML.md`
- [x] `/opt/wc/pizzeria/dbase/pizzeria.db` creado (migrado desde `data/catalogs.db`)
- [x] `init-pizzeria.js` usa `NIL_DB_FILE`

### Sprint 14: Multi-tenant DB Schema (v0.25.0) ✅ COMPLETO
- [x] `src/services/authDatabase.js`: conexión separada a `NIL_AUTH_DB` (misma api que database.js)
- [x] `utils/init-auth.js`: crea `empresas` + `usuarios` en auth.db + inserta empresa/usuario demo
- [x] `bcryptjs` instalado (`--no-bin-links` por filesystem exFAT)
- [x] `.env`: `NIL_AUTH_DB=data/auth.db`
- [x] `empresa_id INTEGER NOT NULL DEFAULT 1` en `demo_categorias` y `demo_productos`
- [x] `init-pizzeria.js`: seed data lleva `empresa_id=1`

### Sprint 15: Autenticación JWT (v0.26.0) ✅ COMPLETO
**Decisión de diseño:** auth.db es del MOTOR (nilix), no de la app.
- [x] `npm install jsonwebtoken` (+ `--no-bin-links` exFAT)
- [x] `NIL_JWT_SECRET`, `NIL_JWT_EXPIRY=8h` en `.env`
- [x] `src/services/authService.js`: `login(usuario, pass)` → bcrypt + jwt.sign; defensas anti-enumeración; bloqueo tras 5 intentos
- [x] `src/middleware/verifyToken.js`: verifica JWT → `req.empresaId`, `req.usuarioId`, `req.rol`; 401 genérico
- [x] `POST /api/auth/login`: endpoint público (antes de `verifyToken` en server.js)
- [x] `src/routes/authRoutes.js` + montado en `server.js` ANTES de `verifyToken`
- [x] `forms/login.xml`: form XML con `usuario` + `type="password"` + `action="/api/auth/login"`
- [x] `login.html`: página pública mínima, usa FormRenderer — login es parte del MOTOR
- [x] `js/api/client.js`: `authFetch()` inyecta `Authorization: Bearer`; redirige en 401
- [x] `main.js`: guard — `GET /api/auth/check` → !ok → redirect a `/login.html`
- [x] `usuarios` tabla: `usuario`, `failed_attempts`, `created_at`, `updated_at` agregados; `email` mantenido para app admin futura

### Sprint 16: API Tenant-aware ✅ COMPLETO (v0.27.0 + v0.27.1)
- [x] verifyToken middleware en todas las rutas /api/* (excepto /api/auth/login)
- [x] ScopedDb: createScopedDb(rawDb, empresaId) — auto-inyecta empresa_id en tablas tenant
- [x] db.find(), db.findAll(), db.insert() con filtro automático
- [x] handlerController: construye ScopedDb antes de llamar handlers
- [x] recordController: construye ScopedDb en create/upsert/update
- [x] handlerService.transformWithHandler(handler, data, db) — sin empresaId explícito
- [x] Handlers migrados a API scopeada (db.find, db.findAll, db.insert)
- [x] AuthFetch en RecordService, LookupService, HandlerBridge, DataSourceManager
- [x] schemaService.hasColumn() detecta tablas tenant dinámicamente

### Sprint 17: params schema ✅ COMPLETO (v0.30.0)
- [x] `YamlParser.buildParams(arr)` — `[{ name, type, source }]` en schema
- [x] `buildSchema()` agrega `params: this.buildParams(raw.params)`
- [ ] `DataSourceManager`: inyectar valores de params en queries (Sprint 19+)

### Sprint 18: RADU Enforcement ✅ COMPLETO (v0.29.0)
- [x] js/utils/RADU.js — canRead, canAdd, canDelete, canUpdate, canWrite
- [x] FormRenderer.render() acepta options.permissions
- [x] FormContext.permissions almacena el valor
- [x] SubmitManager: oculta botones + deshabilita inputs si !canWrite()
- [x] FileExplorer: badge [R] para items readonly

### Sprint 10b: Zona de Claves — Navegación ✅ COMPLETO (v0.31.0)
- [x] PAG_SIG / PAG_ANT — botones ANT/SIG navegan registro adyacente por keyField
- [ ] Atributo control="true" en XML (campo de navegación) ← post-1.0

### Sprint 19: Multifield CRUD ✅ COMPLETO (v0.32.0)
- [x] Botón `+ AGR` agrega fila vacía, navega a última página
- [x] Botón `✕` por fila elimina y re-renderiza con índices corregidos
- [x] `unique="true"` en columna XML → validación visual en tiempo real (`.field-error`)
- [x] Event delegation en gridContainer (una sola vez, sobrevive re-renders)
- [x] Botones AGR/✕ ocultos en modo solo-lectura (RADU)
- [x] `multifield-populated` custom event en cada re-render

### Sprint 20: Campos Virtuales ✅ COMPLETO (v0.33.0)
- [x] `ExpressionEngine.isAggregateExpression()` — detecta `fn(col)`
- [x] `ExpressionEngine.evaluateAggregate(fn, colId, formEl)` — sum/avg/count/min/max
- [x] `ExpressionEngine.evaluateValue(expr, formEl)` — dispatcher agregado vs aritmético
- [x] `ExpressionEngine.getValueDependencies(expr)` — deps field | aggregate
- [x] `LayoutProcessor.setupIsExpression(el, expr)` — readOnly + listeners + recompute
- [x] Escucha `multifield-populated` para recalcular tras `populateRows()`
- [x] Clase CSS `.computed-field` (itálica + fondo tenue)

### Sprint 21: Inline Validators ✅ COMPLETO (v0.34.0)
- [x] `<min>` — mínimo numérico con mensaje por defecto o `<message>`
- [x] `<max>` — máximo numérico con mensaje por defecto o `<message>`
- [x] `<pattern>` — regex con mensaje personalizable
- [x] `<message>` — mensaje compartido para `<pattern>` y `<check>`
- [x] Orden de evaluación: min → max → pattern → check

### Sprint 22: Stepper Visual (v1.7.0) ✅ COMPLETO
- [x] CSS especificidad: `.stepper-wrapper .stepper-input` gana sobre `.multifield-cell-input`
- [x] `border: none !important` + solo `border-left/right` como separadores internos
- [x] `data-size` en `<th>` desde atributo XML `size`
- [x] `_getColumns` lee `col.size`; `_buildStepperCell` usa size para ancho, max implícito, zero-pad
- [x] Resultado: `[▼ 001 ▲]` — borde exterior único, número padded

### Sprint 23: POS — Punto de Venta (v1.8.0) ✅ COMPLETO
- [x] `/opt/wc/pizzeria/form/pos.xml` — form XML completo con carrito multifield
- [x] `/opt/wc/pizzeria/apps/venta_handler.js` — `after()` + `beforeSave()`
- [x] `utils/init-pizzeria.js` — tablas `ventas` + `detalle_ventas` con `empresa_id`
- [x] `Multifield.appendRow(fieldId, rowData, formEl)` estático
- [x] `ValidationCoordinator` maneja `result.appendRow`
- [x] Flujo: seleccionar producto → appendRow → qty stepper → is= subtotal → sum(subtotal) → COBRAR

### Sprint 24: Mobile UX POS Responsive (v1.9.0) ✅ COMPLETO (2026-03-09)
- [x] Stack: `.horizontal-container` cubre todos los containers (no solo `.border-box`) — alinea POS
- [x] Cards multifield: `data-label` en `<td>`, `data-empty` en filler rows (JS Multifield.js)
- [x] Cards CSS: `td::before { flex: 0 0 33% }` — labels alineados en columna de 1/3
- [x] Sticky bottom: `.actions-nav { position: sticky; bottom: 0 }` — ENVIAR siempre visible
- [x] Stepper mobile: `button { width: 100% }` cancela con `width: auto` en `.stepper-btn` card context
- [x] Stepper mobile: `.stepper-wrapper { flex: 1 }` + `.stepper-input { flex: 1 }` → `|▼| 01 |▲|`

### Sprint 12-B: Reportes Públicos vs Privados ✅ COMPLETO (merged v0.29.1)
- [x] Atributo `public: true` en YAML
- [x] `publicReportController.js` + `publicReportRoutes.js`
- [x] `/api/public/report-data/:reportName/:table` sin verifyToken
- [x] `DataSourceManager.setPublicMode()` → bifurca fetch
- [x] `report.html`: guard condicional basado en flag public
- [x] `carta.yaml` marcado como `public: true`

---

## 🚀 CAMINO A v1.0.0

### Sprints bloqueantes para v1.0.0 (en orden)

| Sprint | Versión | Feature | Estado |
|--------|---------|---------|--------|
| Sprint 19 | v0.32.0 | **Multifield CRUD** — add/delete filas, validación unique | ✅ COMPLETO |
| Sprint 20 | v0.33.0 | **Campos Virtuales** — atributo `is=`, totales automáticos | ✅ COMPLETO |
| Sprint 21 | v0.34.0 | **Inline Validators** — `max`/`min`/`pattern`/`message` | ✅ COMPLETO |
| — | **v1.0.0** | 🚀 Release funcional completo — **LISTO PARA TAG** | ✅ |

### 🚨 NOTA CRÍTICA: Security Hardening Post-v1.0

Los sprints de seguridad (Seg-1 a Seg-4) se ejecutarán **después de v1.0.0** para no bloquear el desarrollo funcional. Sin embargo, el Sprint Seg-1 (Security Critical) es **bloqueante para deploy a producción**.

---

### 🔒 Roadmap de Seguridad Post-v1.0 (Reordenado)

| Sprint | Versión | Feature | Prioridad | Bloqueante Producción |
|--------|---------|---------|-----------|----------------------|
| Seg-1 | **v1.1.0** | **Security Critical** — JWT secret, helmet, rate limiting, CORS | Crítico | ✅ SÍ |
| Seg-2 | **v1.2.0** | **Input Validation** — XXE, SQLi fixes, path traversal | Alto | ❌ No |
| Seg-3 | **v1.3.0** | **Hardening** — CSP, HTTPS, token blacklist | Medio | ❌ No |
| Seg-4 | **v1.4.0** | **Advanced Security** — HttpOnly cookies, WAF | Bajo | ❌ No |

#### Timeline Recomendado

```
[v0.31.0] ──► [v0.32.0] ──► [v0.33.0] ──► [v0.34.0] ──► [v1.0.0] ──► [v1.1.0*] ──► [v1.2.0] ...
  ✅           ✅ Sprint 19   ✅ Sprint 20   ✅ Sprint 21   🚀 TAG     Seg-1 Crit    Seg-2
                                                      (funcional)   (prod-ready)
```

\* v1.1.0 (Seg-1) es el **primer release apto para producción**.

Basado en el [`Plan de Auditoría de Seguridad`](../plans/SECURITY-AUDIT-PLAN.md) (OWASP WSTG).

#### ✅ Sprint Seguridad 1 — Critical Fixes (v1.1.0) — COMPLETADO 2026-03-03

**Objetivo:** Remediar vulnerabilidades críticas identificadas en auditoría OWASP + best-practices skill (2026-03-02).

**Prioridad ordenada por impacto/esfuerzo:**

| # | Prioridad | Tarea | Archivo | Estado |
|---|-----------|-------|---------|--------|
| 1 | 🔴 Inmediato | `npm audit fix` — vuln conocida en `qs` (via Express) | `package.json` | ✅ |
| 2 | 🔴 Inmediato | `app.disable('x-powered-by')` — ocultar stack | `server.js` | ✅ |
| 3 | 🔴 Deploy | Restringir CORS vía `NIL_ALLOWED_ORIGIN` (no wildcard en prod) | `server.js` | ✅ |
| 4 | 🔴 Deploy | `helmet` — X-Frame-Options, X-Content-Type-Options, Referrer-Policy | `server.js` | ✅ |
| 5 | 🟠 Deploy | `express-rate-limit` en `/api/auth/login` (10 req / 15 min) | `authRoutes.js` | ✅ |
| 6 | 🟠 Deploy | JWT secret 256 bits aleatorio (reemplaza placeholder en .env) | `.env` | ✅ |
| 7 | 🟡 Producción | Validación de nombre de tabla: regex + blacklist sqlite_* | `recordController.js` | ✅ |

**Vulnerabilidades mitigadas:**
- ✅ DEP-001: `qs` 6.7.0 — arrayLimit bypass DoS
- ✅ SEC-001: JWT Secret débil en .env
- ✅ SEC-005: Missing security headers (helmet)
- ✅ SEC-006: No rate limiting en login
- ✅ SEC-007: CORS permisivo (wildcard)
- ✅ SEC-009: X-Powered-By expuesto (revela stack)

#### ✅ Sprint Seguridad 2 — Input Validation (v1.2.0) — COMPLETADO 2026-03-03

**Objetivo:** Prevenir inyección y traversal attacks.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Strip DOCTYPE para prevenir XXE | `menuService.js` | ✅ |
| 2 | Validar column names contra schema real de la tabla | `recordService.js`, `catalogService.js`, `schemaService.js` | ✅ |
| 3 | Path traversal en filesystemController | `filesystemController.js` | ✅ ya estaba mitigado (`isAuthorizedPath`) |
| 4 | Validación server-side de RADU | `recordController.js` | ⏳ diferido a Seg-3 (requiere diseño) |
| 5 | Whitelist de tablas centralizada en schemaService | `schemaService.js`, `catalogController.js` | ✅ |

**Vulnerabilidades mitigadas:**
- ✅ SEC-002: XXE en parsing XML
- ✅ SEC-003: SQL Injection via column names (keyField, keyValues)
- ✅ SEC-004: Path traversal (ya estaba mitigado)
- ✅ SEC-008: RADU server-side — v1.6.0

#### ✅ Sprint Seguridad 3 — Hardening (v1.3.0) — COMPLETADO 2026-03-03

| # | Tarea | Estado |
|---|-------|--------|
| 1 | XSS fix en SubmissionsViewer (textContent en lugar de innerHTML) | ✅ |
| 2 | CSP configurada via helmet (default-src self, img qrserver.com, unsafe-inline pendiente extracción) | ✅ |
| 3 | HTTPS opcional via NIL_TLS_CERT / NIL_TLS_KEY (TLS 1.2+) | ✅ |
| 4 | Token blacklist + `POST /api/auth/logout` + jti en JWT | ✅ |
| 5 | Audit logging middleware (escrituras + errores) | ✅ |

**Vulnerabilidades mitigadas:**
- ✅ SEC-008: XSS en SubmissionsViewer
- ✅ SEC-010: Logout real con token blacklist
- ✅ SEC-011: Audit log de operaciones

#### ✅ Sprint Seguridad 4 — Advanced (v1.4.0) — COMPLETADO PARCIAL 2026-03-03

| # | Tarea | Estado |
|---|-------|--------|
| 1 | Migrar JWT de LocalStorage a HttpOnly cookie | ✅ completado en Seg-5 (v1.5.0) |
| 2 | CSP report-only | ✅ ya implementado como CSP enforcement en Seg-3 |
| 3 | Path traversal en handler names (`handlerService`) | ✅ |
| 4 | WAF (modsecurity/nginx) | ⏳ infraestructura — fuera del scope de código |
| 5 | HSTS preload | ⏳ disponible al configurar HTTPS via NIL_TLS_CERT/NIL_TLS_KEY |

#### ✅ Sprint Seguridad 5 — JWT HttpOnly Cookie (v1.5.0) — COMPLETADO 2026-03-05

**Objetivo:** Migrar JWT de localStorage a HttpOnly cookie — token inaccesible a XSS.

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `npm install cookie-parser` | ✅ |
| 2 | `cookieParser()` middleware en server.js | ✅ |
| 3 | POST /login → `res.cookie('nil_token', ..., { httpOnly, sameSite: Lax })` | ✅ |
| 4 | POST /logout → lee cookie, blacklist, `clearCookie` | ✅ |
| 5 | GET /api/auth/check — nuevo endpoint sin verifyToken | ✅ |
| 6 | `verifyToken.js` → lee `req.cookies.nil_token` | ✅ |
| 7 | `client.js` — eliminar `getToken()`, `Authorization` header; simplificar `logout()` | ✅ |
| 8 | `SubmitManager.js` — eliminar token de localStorage (migrado a cookie) | ✅ |
| 9 | `main.js` — auth guard via `/api/auth/check` | ✅ |
| 10 | `login.html` — skip-if-logged via `/api/auth/check` | ✅ |

---

### Post-v1.0 Adicionales (no bloqueantes para producción)
- Test suite automatizado
- Performance optimization
- Documentación de API (OpenAPI/Swagger)
- `in (valores)` con menú estático en validaciones
- Cross-field validation
- Atributo `control="true"` en XML (campo de fin zona claves)

#### CDN-1 — Links de CDN configurables desde BD (no hardcodeados)

**Motivación:** Las URLs de librerías externas están actualmente hardcodeadas en el código fuente:
- `YamlParser.js`: `https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm`
- `DuckDBAdapter.js`: `https://esm.sh/@duckdb/duckdb-wasm@1.29.0`, URLs de workers y bundles MVP/EH

Esto significa que actualizar versiones requiere modificar código, y los dominios están duplicados entre el código JS y la CSP del servidor (`server.js`).

**Propuesta:**
- Almacenar las URLs en una tabla de configuración en la BD (o en `.env`) — ej. `sf_config(key, value)`
- El backend las expone vía `GET /api/config/cdn` (público, sin token)
- `YamlParser.js` y `DuckDBAdapter.js` las leen al inicializar
- La CSP se genera dinámicamente en `server.js` leyendo los dominios desde la misma config
- Ventaja: actualizar versión de js-yaml o duckdb-wasm = cambiar un registro en BD, sin tocar código

---

### 📊 Análisis a Futuro — Core Web Vitals (2026-03-02)

Auditoría ejecutada con skill `core-web-vitals`. Relevante solo si el proyecto sale de localhost.

| Métrica | Estado estimado | Acción requerida |
|---|---|---|
| **LCP** | ✅ Bueno (< 500ms local) | Ninguna |
| **INP** | ⚠️ Riesgo en interacciones pesadas | Ver INP-1 e INP-2 abajo |
| **CLS** | ✅ Excelente (~0) | Ninguna |

**INP-1 — DuckDB: feedback inmediato en click de reporte**
- Problema: Click en ítem de reporte → UI bloqueada ~2.5s mientras DuckDB WASM inicializa en el main thread
- Fix: Mostrar spinner/feedback visual antes de llamar `engine.load()` en `Workspace.js`
- Impacto: Percepción de INP mejora aunque el trabajo real tome el mismo tiempo

**INP-2 — FormRenderer: yield al main thread en forms grandes**
- Problema: `FormRenderer.render()` es un task sincrónico único — para forms con 30+ campos puede superar 200ms
- Fix: Insertar `await scheduler.yield()` (o `setTimeout(0)`) cada ~10 campos en el loop de renderizado
- Impacto: No necesario para forms actuales (< 10 campos), sí si escala

**Descartado:**
- CSS bloqueante (41KB): impacto mínimo en localhost, no justifica split
- CLS: arquitectura de contenedor vacío → fill ya es correcta, no genera shifts

---

## 🔴 FEATURE: Zona de Claves (v0.17.0)

### Objetivo
Implementar zona de claves estilo terminal para búsqueda de registros.

### Sintaxis XML Propuesta
```xml
<form title="Clientes" database="clientes">
    
    <!-- Zona de claves -->
    <field id="clieno" label="Cliente" type="select" size="6" key="true">
        <in-table table="clientes" key="clieno" display="nombre">
            <copy from="nombre" to="nombre"/>
            <copy from="direc" to="direc"/>
        </in-table>
    </field>
    
    <!-- Campo de control (fin zona claves) -->
    <field id="control" type="text" size="1" control="true" skip="true"/>
    
    <!-- Zona de datos -->
    <field id="nombre" label="Nombre" type="text" size="30" skip="true"/>
    <field id="direc" label="Dirección" type="text" size="30"/>
    
</form>
```

### Comportamiento Esperado
1. Usuario ingresa clave en campo con `key="true"`
2. Tab → busca registro (GetRecord)
3. Si existe → llena todo el form (DbToFm)
4. Si no existe → form en blanco (FM_NEW)

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `FormRenderer.js` | Detectar `key="true"`, implementar populateForm() |
| `Autocomplete.js` | Al seleccionar, cargar registro completo |
| `RecordService.js` | Agregar `loadRecord()` con populateForm |

---

## 🟡 FEATURE: Validaciones Inline (v0.17.0)

### Sintaxis XML Propuesta
```xml
<field id="importe" type="number" size="10">
    <validation>
        <max>100000</max>
        <min>0</min>
    </validation>
</field>

<field id="cuit" type="text" size="13">
    <validation>
        <pattern>^\d{2}-\d{8}-\d{1}$</pattern>
        <message>CUIT inválido</message>
    </validation>
</field>

<field id="tipo_iva" type="text" size="2">
    <validation>
        <in>RI,CF,EX,MT</in>
        <message>Tipo IVA inválido</message>
    </validation>
</field>
```

---

## 🔵 FEATURE: Sistema de Menús (Post-v1.0)

### Sintaxis XML Propuesta
```xml
<menu id="main">
    <option label="Clientes" type="form" target="clientes.xml"/>
    <option label="Facturas" type="form" target="facturas.xml"/>
    <separator/>
    <option label="Salir" type="exit"/>
</menu>
```

---
        emptyOption.textContent = '-- Seleccione --';
        inputEl.insertBefore(emptyOption, inputEl.firstChild);
    }
}
```

#### Paso 2: Estilos Brutalist (styles.css)

**Archivo:** `css/styles.css`
**Línea:** ~440

```css
/* PASO 2.1: Estilos base */
select {
    border: 2px solid var(--input-border);
    background: var(--bg-color);
    color: var(--text-color);
    padding: 0.4rem;
    border-radius: 0; /* Brutalist */
    font-family: var(--label-font);
    font-size: 0.95rem;
    cursor: pointer;

    /* PASO 2.2: Arrow personalizada (opcional) */
    appearance: none;
    background-image: url('data:image/svg+xml;utf8,<svg fill="%23e0e0e0" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>');
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    padding-right: 2rem;
}

/* PASO 2.3: Focus state */
select:focus {
    outline: 2px solid var(--help-icon-color);
    outline-offset: 2px;
    border-color: var(--help-icon-color);
}

/* PASO 2.4: Options */
select option {
    background: var(--bg-color);
    color: var(--text-color);
    padding: 0.4rem;
}

/* PASO 2.5: Disabled */
select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #0a0a0a;
}
```

#### Paso 3: Validación

**Archivo:** `js/utils/Validator.js`
**Línea:** ~80

```javascript
// PASO 3.1: Validar select required
validateSelect(value) {
    return value !== null && value !== undefined && value !== '';
}
```

**Integración en FormRenderer.js línea ~665:**
```javascript
// En attachValidation(), para select:
if (requiredXml && requiredXml.textContent === 'true') {
    if (inputEl.tagName === 'SELECT') {
        if (!this.validator.validateSelect(inputEl.value)) {
            isValid = false;
            errorMsg = 'Debe seleccionar una opción';
        }
    }
}
```

#### Paso 4: Testing

**Archivo:** `forms/apps/test-select.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="test-select" title="Test: Select Fields">
    <layout>
        <field id="pais" label="País de Residencia" type="select">
            <options>
                <option value="AR">Argentina</option>
                <option value="BR">Brasil</option>
                <option value="CL">Chile</option>
                <option value="UY">Uruguay</option>
            </options>
            <validation>
                <required>true</required>
            </validation>
        </field>

        <field id="estado_civil" label="Estado Civil" type="select">
            <options>
                <option value="S">Soltero/a</option>
                <option value="C">Casado/a</option>
                <option value="D">Divorciado/a</option>
                <option value="V">Viudo/a</option>
            </options>
        </field>
    </layout>
</form>
```

**Testing:**
1. ✅ Opciones se cargan correctamente
2. ✅ Opción vacía aparece si no es required
3. ✅ Validación required funciona
4. ✅ Estilos brutalist aplicados
5. ✅ Arrow personalizada visible

---

## 🔴 FEATURE 2: Atributo `is` (Campos Virtuales)

### Objetivo
Campos cuyo valor se calcula automáticamente a partir de otros campos o funciones.

### Sintaxis XML Propuesta
```xml
<field id="precio" label="Precio" type="number"/>
<field id="cantidad" label="Cantidad" type="number"/>

<!-- Campo virtual calculado -->
<field id="total" label="Total" type="number">
    <is>precio * cantidad</is>
</field>
```

### Plan de Implementación

#### Paso 1: Detección en XML (FormRenderer.js)

**Línea:** ~500

```javascript
// PASO 1.1: Detectar atributo <is>
const isExpr = fieldXml.querySelector('is');
if (isExpr) {
    config.isVirtual = true;
    config.expression = isExpr.textContent.trim();
}

// PASO 1.2: Campos virtuales son siempre display-only
if (config.isVirtual) {
    config.displayOnly = true;
}
```

#### Paso 2: Renderizado y Recálculo

**Línea:** ~550

```javascript
// PASO 2.1: Renderizar campo virtual
if (config.isVirtual) {
    const inputEl = this.renderInputField(config, messages, parentContainer);

    // PASO 2.2: Marcar como virtual
    inputEl.dataset.virtual = 'true';
    inputEl.dataset.expression = config.expression;
    inputEl.readOnly = true;

    // PASO 2.3: Identificar campos referenciados
    const referencedFields = this.extractFieldReferences(config.expression);

    // PASO 2.4: Agregar listeners a campos referenciados
    referencedFields.forEach(fieldId => {
        const refInput = document.getElementById(fieldId);
        if (refInput) {
            refInput.addEventListener('input', () => {
                this.recalculateVirtual(inputEl);
            });
        }
    });

    // PASO 2.5: Calcular valor inicial
    this.recalculateVirtual(inputEl);
}
```

#### Paso 3: Extracción de Referencias (FormRenderer.js)

**Línea:** ~600

```javascript
// PASO 3: Extraer nombres de campos referenciados en expresión
extractFieldReferences(expression) {
    // Regex para identificar nombres de variables (campos)
    const fieldRegex = /\b([a-z_][a-z0-9_]*)\b/gi;
    const matches = expression.match(fieldRegex);

    if (!matches) return [];

    // Filtrar palabras reservadas y funciones
    const reserved = ['sum', 'avg', 'max', 'min', 'count', 'this', 'null', 'true', 'false'];
    return [...new Set(matches)]
        .filter(name => !reserved.includes(name.toLowerCase()));
}
```

#### Paso 4: Recalcular Campo Virtual (FormRenderer.js)

**Línea:** ~630

```javascript
// PASO 4: Recalcular valor de campo virtual
recalculateVirtual(virtualInput) {
    const expression = virtualInput.dataset.expression;

    // PASO 4.1: Recopilar valores actuales del form
    const formData = {};
    const allInputs = this.formContainer.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        if (input.id) {
            formData[input.id] = input.value;
        }
    });

    // PASO 4.2: Evaluar expresión
    try {
        const result = this.expressionEngine.evaluateWithFields(expression, formData);

        // PASO 4.3: Actualizar valor
        virtualInput.value = result;

        // PASO 4.4: Disparar evento change (por si otro virtual depende de este)
        virtualInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (error) {
        console.error('Error calculando campo virtual:', error);
        virtualInput.value = 'ERROR';
    }
}
```

#### Paso 5: Funciones Agregadas (ExpressionEngine.js)

**Archivo:** `js/services/ExpressionEngine.js`
**Línea:** ~60

```javascript
// PASO 5.1: Funciones para multifields
class ExpressionEngine {
    // ... código existente ...

    // PASO 5.2: sum(campo_multifield)
    sum(fieldId, multifieldData) {
        if (!multifieldData[fieldId]) return 0;
        return multifieldData[fieldId].reduce((acc, val) => {
            const num = parseFloat(val);
            return acc + (isNaN(num) ? 0 : num);
        }, 0);
    }

    // PASO 5.3: avg(campo_multifield)
    avg(fieldId, multifieldData) {
        const values = multifieldData[fieldId];
        if (!values || values.length === 0) return 0;
        return this.sum(fieldId, multifieldData) / values.length;
    }

    // PASO 5.4: max(campo_multifield)
    max(fieldId, multifieldData) {
        if (!multifieldData[fieldId]) return null;
        const numbers = multifieldData[fieldId]
            .map(v => parseFloat(v))
            .filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.max(...numbers) : null;
    }

    // PASO 5.5: min(campo_multifield)
    min(fieldId, multifieldData) {
        if (!multifieldData[fieldId]) return null;
        const numbers = multifieldData[fieldId]
            .map(v => parseFloat(v))
            .filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.min(...numbers) : null;
    }

    // PASO 5.6: count(campo_multifield)
    count(fieldId, multifieldData) {
        if (!multifieldData[fieldId]) return 0;
        return multifieldData[fieldId].filter(v => v && v.trim() !== '').length;
    }
}
```

#### Paso 6: Testing

**Archivo:** `forms/apps/test-virtual.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="test-virtual" title="Test: Campos Virtuales">
    <layout>
        <!-- Campos base -->
        <field id="precio" label="Precio Unitario" type="number" size="10">
            <attributes>
                <default>100</default>
            </attributes>
        </field>

        <field id="cantidad" label="Cantidad" type="number" size="5">
            <attributes>
                <default>1</default>
            </attributes>
        </field>

        <!-- Campo virtual: Total -->
        <field id="total" label="Total" type="number">
            <is>precio * cantidad</is>
        </field>

        <!-- Campo virtual: IVA (21%) -->
        <field id="iva" label="IVA (21%)" type="number">
            <is>total * 0.21</is>
        </field>

        <!-- Campo virtual: Total con IVA -->
        <field id="total_iva" label="Total con IVA" type="number">
            <is>total + iva</is>
        </field>
    </layout>
</form>
```

**Testing:**
1. ✅ Cambiar precio → total se recalcula
2. ✅ Cambiar cantidad → total se recalcula
3. ✅ Total cambia → IVA se recalcula
4. ✅ IVA cambia → Total con IVA se recalcula
5. ✅ Campos virtuales son readonly

---

## 🔴 FEATURE 3: Backend API Básico

### Objetivo
Reemplazar LocalStorage con API REST real para persistencia de datos.

### Arquitectura

```
Frontend (Nilix)
    ↓ HTTP
Backend API (Node.js/Express)
    ↓ SQL
Database (PostgreSQL/SQLite)
```

### Plan de Implementación

#### Paso 1: Crear APIService (Frontend)

**Archivo nuevo:** `js/services/APIService.js`

```javascript
// PASO 1.1: Servicio de comunicación con API
class APIService {
    constructor(baseURL = 'http://localhost:8000/api') {
        this.baseURL = baseURL;
    }

    // PASO 1.2: Guardar formulario
    async saveForm(formId, data) {
        const response = await fetch(`${this.baseURL}/forms/${formId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // PASO 1.3: Cargar formulario por clave
    async loadForm(formId, key) {
        const response = await fetch(`${this.baseURL}/forms/${formId}/${key}`);

        if (!response.ok) {
            if (response.status === 404) {
                return null; // No existe
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // PASO 1.4: Actualizar formulario
    async updateForm(formId, key, data) {
        const response = await fetch(`${this.baseURL}/forms/${formId}/${key}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // PASO 1.5: Eliminar formulario
    async deleteForm(formId, key) {
        const response = await fetch(`${this.baseURL}/forms/${formId}/${key}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // PASO 1.6: Listar registros
    async listForms(formId, filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const url = `${this.baseURL}/forms/${formId}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }
}
```

#### Paso 2: Integrar en FormRenderer

**Archivo:** `js/components/FormRenderer.js`
**Línea:** ~205 (constructor)

```javascript
// PASO 2.1: Agregar APIService al constructor
constructor(validator, persistenceService, expressionEngine, apiService) {
    this.validator = validator;
    this.persistence = persistenceService;
    this.expressions = expressionEngine;
    this.api = apiService; // ← NUEVO
    this.messages = {};
    this.formData = {};
}

// PASO 2.2: Método para guardar (reemplaza PersistenceService)
async saveFormData() {
    try {
        const formId = this.currentFormId;
        const data = this.collectFormData();

        // Usar API en vez de LocalStorage
        const result = await this.api.saveForm(formId, data);

        console.log('✅ Form guardado:', result);
        this.showMessage('Formulario guardado exitosamente', 'success');

    } catch (error) {
        console.error('❌ Error guardando form:', error);
        this.showMessage('Error al guardar: ' + error.message, 'error');
    }
}

// PASO 2.3: Método para cargar
async loadFormData(key) {
    try {
        const formId = this.currentFormId;
        const data = await this.api.loadForm(formId, key);

        if (data) {
            this.populateForm(data);
            console.log('✅ Form cargado:', data);
        } else {
            console.log('ℹ️ No se encontró registro con clave:', key);
        }

    } catch (error) {
        console.error('❌ Error cargando form:', error);
        this.showMessage('Error al cargar: ' + error.message, 'error');
    }
}
```

#### Paso 3: Backend API (Node.js + Express)

**Archivo nuevo:** `backend/server.js`

```javascript
// PASO 3.1: Setup básico
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 8000;

// PASO 3.2: Middleware
app.use(cors());
app.use(express.json());

// PASO 3.3: Base de datos SQLite
const db = new sqlite3.Database('./forms.db', (err) => {
    if (err) {
        console.error('❌ Error abriendo BD:', err);
    } else {
        console.log('✅ Conectado a SQLite');
        initDatabase();
    }
});

// PASO 3.4: Inicializar tablas
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS form_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            form_id TEXT NOT NULL,
            key TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(form_id, key)
        )
    `);
}

// PASO 3.5: Rutas CRUD

// CREATE
app.post('/api/forms/:formId', (req, res) => {
    const { formId } = req.params;
    const data = req.body;
    const key = data.key || Date.now().toString();

    const sql = `INSERT INTO form_data (form_id, key, data) VALUES (?, ?, ?)`;
    const params = [formId, key, JSON.stringify(data)];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            form_id: formId,
            key: key
        });
    });
});

// READ
app.get('/api/forms/:formId/:key', (req, res) => {
    const { formId, key } = req.params;

    const sql = `SELECT * FROM form_data WHERE form_id = ? AND key = ?`;

    db.get(sql, [formId, key], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json({
            ...row,
            data: JSON.parse(row.data)
        });
    });
});

// UPDATE
app.put('/api/forms/:formId/:key', (req, res) => {
    const { formId, key } = req.params;
    const data = req.body;

    const sql = `UPDATE form_data SET data = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE form_id = ? AND key = ?`;

    db.run(sql, [JSON.stringify(data), formId, key], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ updated: this.changes });
    });
});

// DELETE
app.delete('/api/forms/:formId/:key', (req, res) => {
    const { formId, key } = req.params;

    const sql = `DELETE FROM form_data WHERE form_id = ? AND key = ?`;

    db.run(sql, [formId, key], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

// LIST
app.get('/api/forms/:formId', (req, res) => {
    const { formId } = req.params;

    const sql = `SELECT * FROM form_data WHERE form_id = ? ORDER BY created_at DESC`;

    db.all(sql, [formId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => ({
            ...row,
            data: JSON.parse(row.data)
        })));
    });
});

// PASO 3.6: Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});
```

#### Paso 4: Setup Backend

**Archivo nuevo:** `backend/package.json`

```json
{
  "name": "nilix-api",
  "version": "1.0.0",
  "description": "API REST para Nilix",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Instalación:**
```bash
cd backend
npm install
npm start
```

#### Paso 5: Testing

**Test manual:**

```bash
# Iniciar backend
cd backend
npm start

# En otra terminal, probar API
curl -X POST http://localhost:8000/api/forms/contacto \
  -H "Content-Type: application/json" \
  -d '{"key":"1","nombre":"Juan Pérez","email":"juan@mail.com"}'

# Leer
curl http://localhost:8000/api/forms/contacto/1
```

**Test desde frontend:**

```javascript
// En consola del navegador
const api = new APIService('http://localhost:8000/api');
await api.saveForm('test', { key: '1', nombre: 'Test' });
const data = await api.loadForm('test', '1');
console.log(data);
```

---

## 🟡 FEATURE 4: `in (valores)` con Menú

### Objetivo
Lista cerrada de valores con menú dropdown integrado en validación.

### Diferencia con `type="select"`
- **select:** Siempre muestra dropdown
- **in (valores):** Input text + botón para abrir menú (más flexible)

### Sintaxis XML Propuesta
```xml
<field id="tipo_cliente" label="Tipo de Cliente" type="text" size="2">
    <validation>
        <in>
            <value code="01" description="Empresa"/>
            <value code="02" description="Particular"/>
            <value code="03" description="Gobierno"/>
        </in>
    </validation>
</field>
```

### Implementación (resumen)

1. **Renderizar input con botón de lookup**
2. **Al click → abrir modal con opciones**
3. **Selección → llenar input y cerrar modal**
4. **Validación → verificar que valor esté en lista**

Ver MANUAL-DESARROLLO.md para implementación completa.

---

## 📊 MATRIZ DE PRIORIDADES

| Feature | Impacto | Complejidad | Prioridad original | Estado |
|---------|---------|-------------|--------------------|--------|
| type="select" | ⭐⭐⭐⭐⭐ | ⭐ | 🔴 CRÍTICO | ✅ v0.12.0 |
| Atributo `is` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔴 CRÍTICO | ⏳ Sprint 2 (post-1.0) |
| Backend API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🔴 CRÍTICO | ✅ v0.13.0 |
| `in (valores)` | ⭐⭐⭐⭐ | ⭐⭐ | 🟡 IMPORTANTE | ✅ v0.13.0 |
| Multifield CRUD | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🟡 IMPORTANTE | ⏳ Sprint 2 (post-1.0) |
| Máscaras | ⭐⭐⭐ | ⭐⭐ | 🟡 IMPORTANTE | ⏳ post-1.0 |
| `in tabla` | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🟢 DESEABLE | ✅ v0.13.0 |
| Subformularios | ⭐⭐⭐ | ⭐⭐⭐⭐ | 🟢 DESEABLE | ⏳ post-1.0 |
| Zona de claves | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🟢 DESEABLE | ✅ v0.28.0 + v0.31.0 |
| Sistema de Menús | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔵 FUTURO | ✅ v0.22.0 |
| Permisos A/U/D | ⭐⭐⭐⭐ | ⭐⭐ | 🔵 FUTURO | ✅ v0.29.0 (RADU) |

---

## 🔄 CONVENCIÓN DE COMMITS

```
feat(scope): Descripción corta
fix(scope): Corrección de bug
style(scope): Estilos (no lógica)
docs(scope): Documentación
refactor(scope): Refactorización
```

---

## 🎓 RECURSOS PARA IMPLEMENTADORES

### Antes de Empezar

1. ✅ Leer `MANUAL-DESARROLLO.md`
2. ✅ Leer `CODE-MAP.md`
3. ✅ Explorar `forms/simple-form.xml`
4. ✅ Ver `docs/07-archive/MForm.txt` (spec FDL)

### Después de Implementar

1. ✅ CHANGELOG.md — entrada vX.Y.Z
2. ✅ ROADMAP.md — Sprint ✅, versiones completadas
3. ✅ ANALYSIS-HIERARCHY.md — versión actual
4. ✅ memory/MEMORY.md — patrones nuevos

---

**Última actualización:** 2026-03-02
**Versión actual:** v0.31.0 (PAG_SIG/PAG_ANT navegación secuencial)
**Mantenido por:** Claude Code / GLM
