# NILIX — Contexto Estratégico para Sesiones

*v2.3.0 · 2026-03-11*

## Identidad del Proyecto

Motor multi-parser para aplicaciones de negocio con estética terminal/neobrutalismo.
Formularios desde XML (nil-form). Reportes desde YAML (nil-report). Menús estructurados (nil-explorer).
Multi-tenant, autenticado, scoped por empresa. Todo emerge de nil.

Filosofía: ex nihilo — como la megaestructura de Blame!, modular, silenciosa, absoluta.

## Ubicación

`/media/cibo/KINGSTON/side-proj/other/space-form`

## Estado Actual: v2.3.0

- **Cobertura FDL:** ~95%
- **Docs maestras:** `docs/02-architecture/ANALYSIS-HIERARCHY.md` (EMPEZAR SIEMPRE ACÁ)
- **Demo activo:** Gastro App Pizzería + Parrilla + Heladería (multi-tenant 3 empresas)

## Arquitectura Clave

```
nil-runtime (server.js + src/):
  src/routes/        — apiRoutes, authRoutes, recordRoutes, handlerRoutes, publicReportRoutes
  src/controllers/   — catalogController, recordController, handlerController,
                       filesystemController, publicReportController
  src/services/      — database.js (sql.js SQLite), authDatabase.js (auth.db separado),
                       authService.js (bcrypt+JWT), scopedDb.js (multi-tenant auto-filter),
                       menuService.js (parse menu.xml), handlerService.js, ...
  src/middleware/    — verifyToken.js (JWT cookie), auditLog.js

nil-form (js/components/form/ + FormRenderer.js):
  FormRenderer.js    — orquestador delgado (~105 líneas)
  FormContext.js     — estado centralizado, AbortController
  LayoutProcessor.js — XML → DOM recursivo
  ValidationCoordinator.js — lookups, copy-fields, loadRecord, navigateToAdjacent
  HandlerBridge.js   — POST /api/handler/:handler/after
  SubmitManager.js   — botones CRUD, RADU enforcement client-side
  fieldRenderer/     — Label, InputField, Autocomplete, Checkbox, Multifield, Stepper

nil-report (js/components/report/):
  ReportEngine.js    — motor principal, coordina DuckDB y rendering
  DataSourceManager.js — dual backend DuckDB/JS, fetchTable, normalizacion fechas
  ReportRenderer.js  — zonas → HTML (header, footer, separator, subtotal, card, detail)
  AccumulatorManager.js — sum/avg/count/min/max por nivel y global
  BreakDetector.js   — extrae break fields de zones
  ExpressionEvaluator.js — safe parser sin eval
  QueryBuilder.js    — YAML → SQL
  DuckDBAdapter.js   — DuckDB-WASM CDN wrapper
  parsers/YamlParser.js  — YAML → ReportSchema

nil-explorer (js/components/FileExplorer.js + src/services/menuService.js)
nil-data (src/services/scopedDb.js + database.js + authDatabase.js)
nil-handler (src/services/handlerService.js)
```

## Autenticación (v1.5.0+)

```
HttpOnly cookie nil_token (NO localStorage, NO Bearer)
├── POST /api/auth/login → bcrypt + JWT → res.cookie('nil_token', ...)
├── GET  /api/auth/check → verifica cookie → { ok, usuario, rol, publicToken }
├── POST /api/auth/logout → blacklist JTI + clearCookie
└── verifyToken.js lee req.cookies.nil_token
```

Rate limiting: 10 req / 15 min / IP en login.
Bloqueo: 5 intentos fallidos → failed_attempts en auth.db.

## Multi-tenant

```
auth.db (NIL_AUTH_DB):
  empresas — id, nombre, public_token (22 chars base64url, 128-bit)
  usuarios — empresa_id FK

app.db (NIL_DB_FILE):
  tablas con empresa_id INTEGER — auto-filtrado por ScopedDb

JWT payload: { usuarioId, empresaId, rol, publicToken, jti }
ScopedDb: createScopedDb(rawDb, empresaId) → auto-inyecta empresa_id
```

Demo: 3 empresas (Pizzería/Parrilla/Heladería), 3 usuarios, 100+ productos.

## Variables de Entorno (.env)

```env
NIL_PORT=3000
NIL_MENU_FILE=/opt/wc/pizzeria/menu.xml
NIL_APP_DIR=auto (dirname de MENU_FILE)
NIL_DB_FILE=/opt/wc/pizzeria/dbase/pizzeria.db
NIL_AUTH_DB=data/auth.db
NIL_JWT_SECRET=...
NIL_JWT_EXPIRY=8h
NIL_TLS_CERT=      # activa HTTPS si presente
NIL_TLS_KEY=
NIL_ALLOWED_ORIGIN= # CORS en producción
NIL_COMPAT_SPACE_FORM=1  # solo dev: lee SF_* como fallback
```

## Firmas de Handler (v0.27.0)

```javascript
module.exports = {
    table: 'tabla_principal',
    keyField: 'id',
    validate(data) {},                       // sin db
    before(fieldId, data, db) {},            // db = ScopedDb
    after(fieldId, value, data, db) {},      // db = ScopedDb
    beforeSave(data, db) {},                 // db = ScopedDb
    afterSave(data, isInsert) {},            // sin db
    beforeDelete(id) {},                     // sin db
    afterDelete(id) {},                      // sin db
};
```

## App Directory Convention

```
/opt/wc/pizzeria/
├── menu.xml        ← NIL_MENU_FILE
├── form/           ← formularios XML de la app
├── reports/        ← reportes YAML de la app
├── apps/           ← handlers JS de la app
└── dbase/          ← SQLite de la app
```

## Regla de Hierro

**SIEMPRE leer primero `docs/02-architecture/ANALYSIS-HIERARCHY.md`** antes de cualquier acción.

## Flujo de Trabajo

1. Leer `docs/02-architecture/ANALYSIS-HIERARCHY.md`
2. Consultar docs relevantes según sección
3. Hacer cambios
4. Actualizar jerárquicamente: ANALYSIS-HIERARCHY → CHANGELOG → ROADMAP/CODE-MAP

## Quick Debug

```javascript
// Consola navegador — ver cache
JSON.parse(localStorage.getItem('nil_catalog_demo_categorias'))

// Limpiar cache nil_catalog_*
Object.keys(localStorage)
  .filter(k => k.startsWith('nil_'))
  .forEach(k => localStorage.removeItem(k))
```

---

**Última actualización:** 2026-03-11 (v2.3.0 — Nilix Rebranding + Reporte de Ventas)
