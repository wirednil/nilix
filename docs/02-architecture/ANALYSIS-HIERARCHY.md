# 🔍 JERARQUÍA DE ANÁLISIS - NILIX

**Última actualización:** 2026-03-11 (v2.3.0 — Nilix Rebranding + Reporte de Ventas)
**Propósito:** Guía de consulta rápida para el agente IA

---

## 📊 NIVEL 1: CONTEXTO GLOBAL

### Quick Facts
| Atributo | Valor |
|----------|-------|
| **Nombre** | Nilix |
| **Tipo** | Motor de formularios web + launcher de apps externas |
| **Inspiración** | NILIX FDL + The Monospace Web |
| **Backend** | Node.js/Express (puerto configurable via `NIL_PORT`) + SQLite (sql.js) |
| **Frontend** | JavaScript ES6 Modules |
| **Report Engine** | DuckDB-WASM (OLAP) + SQLite (OLTP) |
| **Definiciones** | XML (formas) + YAML (reports) — en dir externo vía `NIL_MENU_FILE` |
| **Estética** | Terminal/Monospace + Neobrutalismo + CRT Effects |
| **Cobertura** | ~95% |
| **Estado actual** | 🚀 v2.0.0 — Gastro App Multi-Tenant (2026-03-10) |

### Stack Tecnológico
- **Runtime:** Node.js + Express 5.2.1
- **Auth DB:** sql.js SQLite — `NIL_AUTH_DB` (default `data/auth.db`) — empresas + usuarios — **propiedad del motor**
- **App DB:** sql.js SQLite — `NIL_DB_FILE` — datos de la app cliente — **propiedad de la app**
- **Report Engine OLAP:** DuckDB-WASM v1.33.0 (CDN lazy load)
- **Auth:** JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) ✅ v0.26.0
- **Frontend:** Vanilla JS + ES6 Modules
- **Parsing:** DOMParser nativo + js-yaml (CDN)
- **Estilos:** CSS vanilla + The Monospace Web patterns
- **Persistencia:** localStorage + API REST + SQLite
- **Caché:** TableCache (localStorage, invalidación por timestamp global)
- **Handlers:** Sistema de handlers para lógica de negocio
- **Efectos:** CRT scanlines, phosphor glow, cursor blink
- **Fuente:** JetBrains Mono, IBM Plex Mono (monospace estricto)
- **Utilitarios:** exp.js (TSV → SQLite), init-pizzeria.js (demo data)

### Dos DBs — separación de responsabilidades
```
nilix/data/auth.db    (NIL_AUTH_DB)   ← Motor gestiona esto
  empresas   — tenants: id, nombre, public_token (UUID base64url, 22 chars)
  usuarios   — empleados de cada empresa (empresa_id FK)

$APP/dbase/pizzeria.db     (NIL_DB_FILE)   ← La app gestiona esto
  demo_categorias + empresa_id
  demo_productos  + empresa_id
  empresa_config  + empresa_id (titulo, subtitulo, telefono, direccion, horario)
  ventas          + empresa_id
  detalle_ventas  + empresa_id

JWT payload: { usuarioId, empresaId, nombre, usuario, rol, publicToken, jti }
  ↓ HttpOnly cookie nil_token — inaccesible a JS (XSS-safe)
  ↓ /api/auth/check → { ok, usuario, rol, publicToken }
  ↓ publicToken en Workspace → URL pública ?t=TOKEN (128-bit entropy, no guessable)
```

**Por qué separado:**
- El mismo login funciona para cualquier app (pizzería, clientes, otro)
- Si se agrega una nueva app, solo necesita poner `empresa_id` en sus tablas y montar `verifyToken`
- `auth.db` nunca se mezcla con datos de negocio

---

## 📁 NIVEL 2: ESTRUCTURA DE ARCHIVOS

### Árbol General
```
nilix/
├── server.js              # Servidor Express
├── index.html             # Entry point HTML
├── package.json           # Dependencias
│
├── js/                    # Código frontend
│   ├── main.js           # Entry point módulos
│   ├── app.js            # Legacy renderer
│   ├── api/              # Cliente API
│   ├── components/       # Componentes UI
│   │   ├── form/         # Módulos FormRenderer (v0.21.0)
│   │   ├── fieldRenderer/ # Renderizado de campos
│   │   └── report/       # Report Engine (v0.20.0)
│   ├── services/         # Lógica de negocio
│   └── utils/           # Utilidades
│
├── forms/                # Definiciones XML
│   ├── apps/             # Formularios de ejemplo
│   └── *.xml            # Specs de formularios
│
├── src/                  # Backend Node.js
│   ├── routes/
│   ├── controllers/
│   └── services/
│
├── css/                  # Estilos
└── docs/                 # 📚 DOCUMENTACIÓN
```

---

## 🎯 NIVEL 3: PUNTOS DE CONSULTA RÁPIDA

### ¿Qué necesito saber?

| Pregunta | Consulta |
|----------|----------|
| **¿Cómo inicio el proyecto?** | [`docs/01-getting-started/README.md`](../01-getting-started/README.md) |
| **¿Qué hace cada componente?** | [`docs/06-development/MANUAL-DESARROLLO.md`](../06-development/MANUAL-DESARROLLO.md) |
| **¿Dónde está el código X?** | [`docs/03-reference/CODE-MAP.md`](../03-reference/CODE-MAP.md) |
| **¿Qué features faltan?** | [`docs/06-development/ROADMAP.md`](../06-development/ROADMAP.md) |
| **Estrategia de Modularización** | [`docs/02-architecture/DESIGN-STRATEGY.md`](DESIGN-STRATEGY.md) |
| **¿Cómo funciona multifield?** | [`docs/04-guides/MULTIFIELD-GUIDE.md`](../04-guides/MULTIFIELD-GUIDE.md) |
| **¿Qué dice la spec original?** | [`docs/05-specs/REP/REP-SPEC.md`](../05-specs/REP/REP-SPEC.md) |
| **¿Cómo implementar menús?** | [`docs/05-specs/MENUS-SPEC.md`](../05-specs/MENUS-SPEC.md) |
| **¿Qué cambió en cada versión?** | [`docs/03-reference/CHANGELOG.md`](../03-reference/CHANGELOG.md) |
| **Plan de auditoría de seguridad** | [`docs/02-architecture/SECURITY-AUDIT-PLAN.md`](SECURITY-AUDIT-PLAN.md) |

---

## 🔧 NIVEL 4: ANÁLISIS DE COMPONENTES

### FormRenderer (Core) - Modularizado v0.21.0
```javascript
// js/components/FormRenderer.js (~105 líneas - orquestador delgado)
class FormRenderer {
    constructor()                  // Inicializa ctx, backward compat props
    destroy()                      // Limpia AbortController + fields Map
    render(container, xmlString)   // Coordina módulos y construye DOM
}

// js/components/form/FormContext.js (~73 líneas)
class FormContext {
    constructor(formNode, messagesNode, layoutNode)  // Estado centralizado
    get signal()                   // AbortController.signal para listeners
    destroy()                      // abort() + fields.clear()
    registerField(id, element)     // Map-based O(1) field registry
    getField(id)                   // O(1) lookup por ID
}

// js/components/form/LayoutProcessor.js (~180 líneas)
class LayoutProcessor {
    processLayout(layoutNode, parentContainer)  // Recursivo XML → DOM
    processNode(xmlNode, parentContainer)       // Switch: CONTAINER/BORDER/FIELD
    renderField(fieldXml, parentContainer)      // Delega a fieldRenderer
    extractFieldConfig(fieldXml, parentContainer) // Extrae config del XML
}

// js/components/form/ValidationCoordinator.js (~125 líneas)
class ValidationCoordinator {
    attach(fieldXml, fieldId, handlerBridge)    // Conecta validación + handlers
    validateInTable(fieldId, value, config)     // Valida contra catálogos BD
    applyFieldCopies(copies)                   // Centraliza copy-fields
}

// js/components/form/HandlerBridge.js (~100 líneas)
class HandlerBridge {
    callAfter(fieldId, value)      // POST /api/handler/:handler/after
    getFormData()                  // Recolecta datos del formulario
}

// js/components/form/SubmitManager.js (~123 líneas)
class SubmitManager {
    addFormActions(formEl)         // Crea botones reset/submit
    attachSubmitHandler(formEl, submitBtn) // Submit con { signal }
}
```

### Flujo de Datos
```
XML String
    ↓
xmlParser.parseFormXml()  → {formNode, messagesNode, layoutNode}
    ↓
FormRenderer.render() → Crea FormContext + coordinators
    ↓
LayoutProcessor.processLayout() → Itera hijos del layout
    ↓
processNode() → Switch según tagName
    ↓
renderField() → fieldRenderer.render*(config, parent)
    ↓
onFieldRendered callback → ValidationCoordinator.attach()
    ↓
AbortController.signal → Cleanup automático de listeners

Campo key="true" → blur → ValidationCoordinator.loadRecord(value)
    → RecordService.load(table, keyField, value)
    → fillForm(record) → puebla todos los campos (DbToFm)
```

### Módulos Clave

| Módulo | Responsabilidad | Archivo |
|--------|-----------------|---------|
| **xmlParser** | Parsea XML a nodos DOM | `js/components/xmlParser/` |
| **fieldRenderer** | Renderiza inputs, checkboxes, multifields, autocompletes | `js/components/fieldRenderer/` |
| **Autocomplete** | Componente custom para selects (v0.15.0) | `js/components/fieldRenderer/Autocomplete.js` |
| **uiComponents** | Header, botones de acción | `js/components/uiComponents/` |
| **RADU** | `RADU(permString)` → canRead/canAdd/canDelete/canUpdate/canWrite ✅ v0.29.0 | `js/utils/RADU.js` |
| **PublicReports** | `public: true` en YAML → endpoint sin token `/api/public/report-data/:report/:table` ✅ v0.29.1 | `src/controllers/publicReportController.js` |
| **validator** | Validaciones en tiempo real | `js/utils/validator.js` |
| **ExpressionEngine** | Expresiones dinámicas | `js/utils/ExpressionEngine.js` |
| **PersistenceService** | Guardado de envíos (localStorage) | `js/services/PersistenceService.js` |
| **LookupService** | Validación contra catálogos BD + invalidación cache | `js/services/LookupService.js` (v0.13.0, v0.18.0) |
| **TableCache** | Caché localStorage con invalidación global | `js/services/TableCache.js` (v0.13.0, v0.18.0) |
| **RecordService** | CRUD frontend (v0.16.0) | `js/services/RecordService.js` |

### Módulos Backend

| Módulo | Responsabilidad | Archivo |
|--------|-----------------|---------|
| **database** | Conexión sql.js SQLite + persistencia | `src/services/database.js` |
| **catalogService** | Consultas tablas con whitelist | `src/services/catalogService.js` |
| **catalogController** | Controller API /catalogs | `src/controllers/catalogController.js` |
| **catalogRoutes** | Rutas GET /api/catalogs/:table | `src/routes/catalogRoutes.js` |
| **recordService** | CRUD SQL (v0.16.0) | `src/services/recordService.js` |

### Report Engine (v0.20.0 - DuckDB-WASM)

| Módulo | Responsabilidad | Archivo |
|--------|-----------------|---------|
| **ReportEngine** | Motor principal: parsea YAML, coordina DuckDB | `js/components/report/ReportEngine.js` |
| **ReportRenderer** | Renderiza zonas a HTML | `js/components/report/ReportRenderer.js` |
| **AccumulatorManager** | Gestión de sum, avg, count, runsum, etc. | `js/components/report/AccumulatorManager.js` |
| **BreakDetector** | Detección de control breaks | `js/components/report/BreakDetector.js` |
| **ExpressionEvaluator** | Evaluación segura de expresiones (sin eval) | `js/components/report/ExpressionEvaluator.js` |
| **DataSourceManager** | Queries DuckDB/JS dual backend | `js/components/report/DataSourceManager.js` |
| **DuckDBAdapter** | Wrapper DuckDB-WASM con CDN lazy load | `js/components/report/DuckDBAdapter.js` |
| **QueryBuilder** | Compilador YAML → SQL | `js/components/report/QueryBuilder.js` |
| **YamlParser** | Parsea reportes .yaml a ReportSchema | `js/components/report/parsers/YamlParser.js` |
| **recordController** | Controller CRUD (v0.16.0) | `src/controllers/recordController.js` |
| **recordRoutes** | Rutas CRUD (v0.16.0) | `src/routes/recordRoutes.js` |
| **scopedDb** | `createScopedDb(rawDb, empresaId)` → auto-inyecta `empresa_id` en tablas tenant ✅ v0.27.0 | `src/services/scopedDb.js` |
| **handlerService** | Carga handlers dinámicos; `transformWithHandler(handler, data, db)` — db ya es ScopedDb | `src/services/handlerService.js` |
| **handlerController** | Controller /api/handler/:handler/* — construye ScopedDb antes de llamar handlers ✅ v0.27.0 | `src/controllers/handlerController.js` |
| **handlerRoutes** | Rutas handler (v0.18.0) | `src/routes/handlerRoutes.js` |
| **menuService** | Parsea `menu.xml` recursivo, acumula `authorizedDirs` | `src/services/menuService.js` |
| **authDatabase** | Conexión separada a `NIL_AUTH_DB` ✅ v0.25.0 | `src/services/authDatabase.js` |
| **authService** | `login(usuario, pass)` → bcrypt + JWT con `publicToken`; LoginError enum; bloqueo 5 intentos ✅ v0.26.0 | `src/services/authService.js` |
| **verifyToken** | Middleware: extrae `empresaId/usuarioId/rol` del JWT → `req.*` ✅ v0.26.0 | `src/middleware/verifyToken.js` |
| **publicReportController** | `isReportPublic()` + `resolveEmpresaId(token)` → `WHERE public_token = ?`; sin token válido → `[]` ✅ v0.39.0 | `src/controllers/publicReportController.js` |

### Arquitectura DuckDB-WASM

```
┌─────────────────────────────────────────────────────────┐
│ report.html                                             │
│   ┌───────────────┐      ┌─────────────────────────┐   │
│   │ ReportEngine  │─────▶│ DuckDBAdapter           │   │
│   │ (orchestrator)│      │ - init() Web Worker     │   │
│   └───────┬───────┘      │ - loadTable() register  │   │
│           │              │ - query() SQL → JS[]    │   │
│           ▼              └─────────────────────────┘   │
│   ┌───────────────┐                 │                   │
│   │ QueryBuilder  │                 ▼                   │
│   │ YAML → SQL    │      ┌─────────────────────────┐   │
│   └───────────────┘      │ DuckDB-WASM (~2.5MB)    │   │
│                          │ - JOINs eficientes      │   │
│   ┌───────────────┐      │ - GROUP BY nativo       │   │
│   │ /api/catalogs │─────▶│ - ORDER BY optimizado   │   │
│   │ (SQLite)      │      └─────────────────────────┘   │
│   └───────────────┘                                     │
└─────────────────────────────────────────────────────────┘

Form Renderer (OLTP) → SQLite/sql.js (sin cambios)
Report Engine (OLAP) → DuckDB-WASM (nuevo)
```

---

## 📋 NIVEL 5: ATRIBUTOS XML SOPORTADOS

### Variables de Entorno (.env)
| Variable | Descripción |
|----------|-------------|
| `NIL_PORT` | Puerto del servidor (default 3000) |
| `NIL_MENU_FILE` | Path absoluto al `menu.xml` raíz de la app |
| `NIL_APP_DIR` | Dir raíz de la app activa (derivado de `dirname(NIL_MENU_FILE)` automáticamente) |
| `NIL_DB_FILE` | Path a la DB SQLite de la app (default `data/catalogs.db`) |
| `NIL_AUTH_DB` | Path a la DB de auth del motor (default `data/auth.db`) ✅ v0.25.0 |
| `NIL_JWT_SECRET` | Clave para firmar tokens JWT ✅ v0.26.0 |
| `NIL_JWT_EXPIRY` | Expiración del token (default `8h`) ✅ v0.26.0 |
| `NIL_TLS_CERT` | Path al certificado TLS — activa HTTPS nativo ✅ v2.3.0 |
| `NIL_TLS_KEY` | Path a la clave TLS ✅ v2.3.0 |
| `NIL_ALLOWED_ORIGIN` | Origen CORS permitido en producción ✅ v2.3.0 |
| `NIL_COMPAT_SPACE_FORM` | Si `=1`, lee vars `SF_*` como fallback (solo dev, deprecation bridge) ✅ v2.3.0 |

### Estructura convencional de una app externa
```
/opt/wc/pizzeria/
├── menu.xml           ← NIL_MENU_FILE apunta acá
├── form/              ← formularios XML de la app
├── reports/           ← reportes YAML de la app
├── apps/              ← handlers JS de la app ✅ v0.22.1
└── dbase/             ← base de datos SQLite de la app ✅ v0.22.1
```

### Firmas de Handler (v0.27.0)

```javascript
module.exports = {
    table: 'demo_productos',   // tabla principal
    keyField: 'id',            // PK

    validate(data) { ... },                    // sin db — validación de datos
    before(fieldId, data, db) { ... },         // db = ScopedDb
    after(fieldId, value, data, db) { ... },   // db = ScopedDb
    beforeSave(data, db) { ... },              // db = ScopedDb
    afterSave(data, isInsert) { ... },         // sin db — side effects post-save
    beforeDelete(id) { ... },                  // sin db — validación pre-delete
    afterDelete(id) { ... },                   // sin db — side effects post-delete
};
```

**ScopedDb API** (auto-inyecta `empresa_id` en tablas tenant):
```javascript
db.find('tabla', { id: 1 })         // → row | null
db.findAll('tabla', { activo: 1 })  // → row[]
db.insert('tabla', { nombre: 'X' }) // → last_insert_rowid
db.exec(sql, params)                // escape hatch — sin auto-filtering
db.prepare(sql)                     // escape hatch — sin auto-filtering
```

### Convención handler en XML
```xml
<!-- Handler propio de la app (busca en $NIL_APP_DIR/apps/) -->
<form handler="producto_nuevo" ...>

<!-- Sin handler explícito → CRUD genérico del motor (sin lógica de negocio) -->
<form handler="none" ...>
<!-- o simplemente sin atributo handler -->
```

### Elemento `<form>`
| Atributo | Descripción |
|----------|-------------|
| `title` | Título de la ventana |
| `database` | Tabla principal para persistencia |
| `handler` | Nombre del handler (sin extensión). `"none"` = CRUD puro sin handler |
| `crud-mode` | "direct" para bypass handler en save |

### Elemento `<field>`
| Atributo | Descripción |
|----------|-------------|
| `id` | Identificador único |
| `label` | Texto de etiqueta |
| `type` | text, number, date, textarea, checkbox, select, multifield |
| `size` | Tamaño del campo |
| `rows` | Filas (para textarea / max filas de multifield) |
| `display` | Filas visibles en multifield |
| `align` | left, right |
| `key` | `"true"` → blur carga registro (DbToFm) |
| `skip` | `"true"` → campo display-only |
| `unique` | `"true"` → validación unicidad en columna multifield |
| `is` | Expresión virtual: `"precio * qty"` o `"sum(importe)"` → campo calculado |

### Select con Autocomplete (v0.15.0)
```xml
<!-- Select dinámico con BD -->
<field id="clieno" label="Cliente" type="select" size="6">
    <in-table table="clientes" key="clieno" display="nombre">
        <copy from="nombre" to="nombre"/>
        <copy from="direc" to="direc"/>
    </in-table>
</field>

<!-- Select estático con opciones -->
<field id="tipo_iva" label="Tipo IVA" type="select" size="2">
    <options>
        <option value="RI">Responsable Inscripto</option>
        <option value="CF">Consumidor Final</option>
    </options>
</field>
```

### Comportamiento Autocomplete
| Acción | Resultado |
|--------|-----------|
| Click en input | Abre dropdown |
| Click en ▼ | Toggle dropdown |
| **F1** | Abre dropdown (estilo terminal) |
| Escribir | Filtra opciones |
| **Tab** | Valida y carga datos |
| ↑↓ | Navega opciones |
| Enter | Selecciona opción |
| Escape | Cierra dropdown |

### Lógica de Campos type="select"
| Sub-elemento | Resultado |
|--------------|-----------|
| `<options>` | Autocomplete con lista estática |
| `<in-table>` | Autocomplete con datos de BD |
| Ninguno | Error - select vacío |

### Validaciones
```xml
<field id="email" type="text" label="Email">
    <validation>
        <required>true</required>
        <pattern>.*@.*</pattern>
        <message>Email inválido</message>
    </validation>
</field>
<field id="descuento" type="number" label="Descuento">
    <validation>
        <min>0</min>
        <max>100</max>
    </validation>
</field>
<field id="importe" type="number" label="Importe">
    <validation>
        <check>this > 0 and this <= 999999</check>
        <message>Importe fuera de rango</message>
    </validation>
</field>
```
| Elemento | Descripción |
|----------|-------------|
| `<required>true</required>` | Campo obligatorio |
| `<min>` | Mínimo numérico (v0.34.0) |
| `<max>` | Máximo numérico (v0.34.0) |
| `<pattern>` | Regex de formato (v0.34.0) |
| `<message>` | Mensaje personalizado para `<pattern>` y `<check>` (v0.34.0) |
| `<check>` | Expresión booleana (ExpressionEngine) |

### Atributos Especiales
```xml
<field id="fecha" type="date" label="Fecha">
    <attributes>
        <default>today</default>
        <help>help_fecha</help>
        <skip>true</skip>
    </attributes>
</field>
```

---

## 🎨 NIVEL 6: ESTILOS CSS

### Clases Principales
| Clase | Propósito |
|-------|-----------|
| `#global-header` | Header global con título y controles (v0.11.0) |
| `.header-title` | Título "NILIX" en el header |
| `.header-left` | Contenedor hamburguesa + título |
| `.header-right` | Contenedor toggle theme |
| `.terminal-window` | Contenedor principal |
| `.window-header` | Barra de título del formulario |
| `.form-vertical` | Formulario |
| `.field-row` | Fila de campo |
| `.horizontal-container` | Layout horizontal |
| `.vertical-container` | Layout vertical |
| `.border-box` | Recuadro con borde |
| `.help-icon` | Icono de ayuda |
| `.help-tooltip` | Tooltip flotante |
| `.hamburger-btn` | Botón toggle sidebar (v0.10.0) |
| `.theme-toggle` | Botón toggle tema claro/oscuro |
| `#sidebar.collapsed` | Sidebar oculto en desktop |
| `#sidebar.open` | Sidebar visible en móvil |
| `.multifield-table tr[data-empty]` | Fila filler oculta en móvil (v1.9.0) |
| `.multifield-table tbody td::before` | Label card en móvil — `flex: 0 0 33%` (v1.9.0) |
| `.actions-nav` (mobile) | `position: sticky; bottom: 0` — sticky en móvil (v1.9.0) |
| `.stepper-wrapper` (card) | `flex: 1; display: flex` — rellena espacio en card móvil (v1.9.0) |

### Variables CSS
```css
:root {
    --bg-color: #1a1a1a;
    --text-color: #00ff00;
    --border-color: #333;
    --accent-color: #00aaff;
}
```

---

## 🚀 NIVEL 7: COMANDOS ÚTILES

### Iniciar Servidor
```bash
# Producción (con backend)
node server.js

# Inicializar BD (solo primera vez o reset)
npm run init-db
```

### API Endpoints (v0.13.0)
```bash
# Listar tablas permitidas
curl http://localhost:3000/api/catalogs/tables

# Obtener todos los registros de una tabla
curl http://localhost:3000/api/catalogs/clientes

# Validar clave específica
curl http://localhost:3000/api/catalogs/clientes/clieno/1
```

### Agregar Nuevo Campo
1. Editar [`MANUAL-DESARROLLO.md`](../06-development/MANUAL-DESARROLLO.md) → sección campos
2. Agregar caso en [`FormRenderer.js`](../../js/components/FormRenderer.js) → `extractFieldConfig()`
3. Crear función en [`fieldRenderer/`](../../js/components/fieldRenderer/)
4. Agregar estilos en [`css/styles.css`](../../css/styles.css)
5. Crear ejemplo XML en [`forms/`](../../forms/)
6. Actualizar [`CODE-MAP.md`](../03-reference/CODE-MAP.md)

### Agregar Nueva Tabla Catálogo
1. Editar `src/services/catalogService.js` → `ALLOWED_TABLES`
2. Editar `scripts/initCatalogsDB.js` → CREATE TABLE + INSERT
3. Ejecutar `npm run init-db`

---

## 📖 LECTURA RECOMENDADA (Por Rol)

### Para Mí (Agente IA)
1. **Siempre:** Este archivo (`ANALYSIS-HIERARCHY.md`)
2. **Entender contexto:** [`docs/01-getting-started/README.md`](../01-getting-started/README.md)
3. **Buscar código:** [`docs/03-reference/CODE-MAP.md`](../03-reference/CODE-MAP.md)
4. **Features faltantes:** [`docs/06-development/ROADMAP.md`](../06-development/ROADMAP.md)

### Para Desarrolladores
1. README.md → MANUAL-DESARROLLO.md → CODE-MAP.md → ROADMAP.md

### Para Code Review
1. MANUAL-DESARROLLO.md (completo) → CODE-MAP.md → ROADMAP.md → MForm.txt

---

## ⚡ PROBLEMAS COMUNES

| Problema | Solución |
|----------|----------|
| Tooltip no aparece | Verificar `overflow: visible` en styles.css |
| Multifield no se detecta | Revisar `isTextareaMultifield()` en fieldRenderer |
| Validación no funciona | Verificar `attachFieldValidation()` en FormRenderer.js |
| Estilos no cargan | Verificar `<link>` en index.html |
| Sidebar no colapsa en móvil | Verificar breakpoint `650px` en styles.css y main.js |
| Hamburguesa no anima | Verificar clase `.active` en toggle |
| API catalogs 404 | Verificar orden de middlewares en server.js |
| Autocomplete no carga | Verificar LookupService, TableCache, API /api/catalogs |
| in-table no copia campos | Verificar que campos destino existan con IDs correctos |
| Campos no monospace | Verificar `font: inherit` en inputs (styles.css) |
| Inputs desalineados | Verificar `height: calc(var(--line-height) * 2)` |
| CRT no funciona | Verificar clase `.crt-mode` en body + localStorage |
| Dark mode no es negro puro | Verificar `--bg-color: #000000` en body.dark-mode |
| CRUD no guarda en SQLite | Verificar recordRoutes montado en server.js |
| Registro no se actualiza | Verificar `currentMode === 'edit'` y `currentRecordId` |
| Form no carga datos | Verificar `populateForm()` en FormRenderer |
| Handler no carga | Verificar nombre archivo: `nombre.handler.js` en `$NIL_APP_DIR/apps/` primero |
| `GET /api/files/content` devuelve 403 | El path no está en `authorizedDirs` — revisar menu.xml targets |
| Sidebar vacío | Verificar `NIL_MENU_FILE` en `.env` y que el archivo exista |
| Cache no invalida | Verificar `nil_invalidation_time` en localStorage |
| Multi-table no persiste | Verificar `saveDatabase()` después de handler |
| **Catálogo desactualizado** | **Cache valida count vs API (304 = sin cambios)** |
| auth.db sobreescrito al init | SIEMPRE parar servidor antes de `node utils/init-auth.js` — sql.js in-memory sobrescribe el archivo nuevo |
| publicToken null en URL | Correr init-auth.js con servidor detenido; el JWT viejo no tiene publicToken |
| Report muestra datos de otra empresa | Token alterado → `resolveEmpresaId` devuelve null → `{ rows: [] }` (esperado) |
| Header/footer dinámico no carga | Verificar que NIL_APP_DIR/reports/ tenga carta.yaml con `dataSource: config` |
| Zone expression devuelve undefined | Usar nombre de columna DB crudo (`field: titulo`), no alias YAML (`field: cfg_titulo`) |
| App report no se sirve | Verificar `app.use('/reports', static(NIL_APP_DIR/reports))` ANTES de `static(__dirname)` en server.js |

---

## 🚀 NIVEL 8: ESTADO ACTUAL

### v0.20.0 - DuckDB-WASM Integration ✅ COMPLETO (2026-02-23)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | DuckDBAdapter - Wrapper DuckDB-WASM CDN | `js/components/report/DuckDBAdapter.js` | ✅ |
| 2 | QueryBuilder - Compilador YAML → SQL | `js/components/report/QueryBuilder.js` | ✅ |
| 3 | DataSourceManager v2.0 - Backend dual DuckDB/JS | `js/components/report/DataSourceManager.js` | ✅ |
| 4 | ReportEngine v2.0 - Coordinación DuckDB | `js/components/report/ReportEngine.js` | ✅ |
| 5 | ExpressionEvaluator - Fix eval() security | `js/components/report/ExpressionEvaluator.js` | ✅ |
| 6 | report.html - Loading state + backend badge | `report.html` | ✅ |
| 7 | index.js - Exportar nuevos módulos | `js/components/report/index.js` | ✅ |
| 8 | CHANGELOG actualizado | `agent/03-reference/CHANGELOG.md` | ✅ |
| 9 | ANALYSIS-HIERARCHY actualizado | `agent/ANALYSIS-HIERARCHY.md` | ✅ |

**Cambios clave:**
- O(n²) joins reemplazados por SQL nativo en DuckDB
- `eval()` eliminado por custom safe parser
- Fallback automático a JS si DuckDB falla
- Badge visual indica backend activo (DuckDB/JS)

### v0.19.0 - Web Report Engine PoC ✅ COMPLETO (2026-02-22)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | YamlParser - Parsea YAML a ReportSchema | `js/components/report/parsers/YamlParser.js` | ✅ |
| 2 | DataSourceManager - Construye queries | `js/components/report/DataSourceManager.js` | ✅ |
| 3 | AccumulatorManager - Funciones de agregación | `js/components/report/AccumulatorManager.js` | ✅ |
| 4 | BreakDetector - Detección de control breaks | `js/components/report/BreakDetector.js` | ✅ |
| 5 | ExpressionEvaluator - Evaluación de expresiones | `js/components/report/ExpressionEvaluator.js` | ✅ |
| 6 | ReportRenderer - Renderizado HTML | `js/components/report/ReportRenderer.js` | ✅ |
| 7 | ReportEngine - Motor principal | `js/components/report/ReportEngine.js` | ✅ |
| 8 | CSS estilos para reportes | `css/styles.css` | ✅ |
| 9 | Demo carta digital | `reports/carta.yaml`, `reports/carta.html` | ✅ |
| 10 | Integración explorador | `Workspace.js`, `filesystemController.js` | ✅ |
| 11 | Docs actualizadas | `agent/*.md` | ✅ |
| 12 | Visor público `/report.html` | `report.html` | ✅ |

### v0.18.1 - Cache Inteligente ✅ COMPLETO (2026-02-21)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Cache valida count vs API | `js/services/LookupService.js` | ✅ |
| 2 | Headers anti-cache HTTP | `src/controllers/catalogController.js` | ✅ |
| 3 | Respuesta 304 si sin cambios | `src/controllers/catalogController.js` | ✅ |
| 4 | `invalidateTables` dinámico | `js/components/FormRenderer.js` | ✅ |
| 5 | Logs de debug comentados | Múltiples archivos | ✅ |
| 6 | Docs actualizadas | `agent/*.md` | ✅ |

### v0.18.0 - Handler System + Multi-table CRUD ✅ COMPLETO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Handler `after(fieldId, value, data, db)` | `handlers/*.handler.js` | ✅ |
| 2 | Handler `beforeSave(data, db)` multi-table | `handlers/*.handler.js` | ✅ |
| 3 | `callHandlerAfter()` en FormRenderer | `js/components/FormRenderer.js` | ✅ |
| 4 | `enableFields/disableFields/setValues` | Response handler | ✅ |
| 5 | `invalidateTables` en handler | `handlers/*.handler.js` | ✅ |
| 6 | Cache invalidation global | `js/services/TableCache.js` | ✅ |
| 7 | `forceRefreshOnNextLoad()` | `js/services/LookupService.js` | ✅ |
| 8 | `saveDatabase()` en recordController | `src/controllers/recordController.js` | ✅ |
| 9 | Handler routes `/api/handler/:handler/after` | `src/routes/handlerRoutes.js` | ✅ |
| 10 | `populateRows()` en Multifield | `js/components/fieldRenderer/Multifield.js` | ✅ |
| 11 | Demo pizzería completo | `forms/demo/pizzeria/` | ✅ |

### v0.16.0 - CRUD Completo ✅ COMPLETO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `tableExists(tableName)` | `src/services/schemaService.js` | ✅ |
| 2 | `getAllTables()` | `src/services/schemaService.js` | ✅ |
| 3 | `findById(table, keyField, id)` | `src/services/recordService.js` | ✅ |
| 4 | `insert(table, data)` | `src/services/recordService.js` | ✅ |
| 5 | `update(table, keyField, id, data)` | `src/services/recordService.js` | ✅ |
| 6 | `upsert(table, keyField, data)` | `src/services/recordService.js` | ✅ |
| 7 | `filterValidFields(table, data)` | `src/services/recordService.js` | ✅ |
| 8 | `getRecord(req, res)` | `src/controllers/recordController.js` | ✅ |
| 9 | `createRecord(req, res)` | `src/controllers/recordController.js` | ✅ |
| 10 | `upsertRecord(req, res)` | `src/controllers/recordController.js` | ✅ |
| 11 | `updateRecord(req, res)` | `src/controllers/recordController.js` | ✅ |
| 12 | `deleteRecord(req, res)` | `src/controllers/recordController.js` | ✅ |
| 13 | `GET/POST/PUT/DELETE /api/records` | `src/routes/recordRoutes.js` | ✅ |
| 14 | Montar recordRoutes | `server.js` | ✅ |
| 15 | `RecordService.js` frontend | `js/services/RecordService.js` | ✅ |
| 16 | `tableConfig` en FormRenderer | `js/components/FormRenderer.js` | ✅ |
| 17 | `handleSubmit()` a SQLite | `js/components/FormRenderer.js` | ✅ |
| 18 | `filterValidFields` backend | `src/services/recordService.js` | ✅ |
| 19 | Utilitario `exp.js` | `utils/exp.js` | ✅ |
| 20 | Demo form `forms/demo/clientes.xml` | `forms/demo/` | ✅ |

### v0.17.0 - Zona de Claves (Próximo)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Atributo `key="true"` | FormRenderer.js | ⏳ |
| 2 | Atributo `control="true"` | FormRenderer.js | ⏳ |
| 3 | `populateForm()` completo | FormRenderer.js | ⏳ |
| 4 | `selectItem()` carga registro | Autocomplete.js | ⏳ |
| 5 | Validaciones `<max>`, `<pattern>` | Validator.js | ⏳ |
| 6 | Validación `<in>` | Validator.js | ⏳ |

---

### Demo PoC - forms/demo/clientes.xml

**Objetivo:** Cumplir funcionalidad básica de validate-clie/clientes.fm

| Feature | Estado |
|-----------------|--------|
| Zona de claves (clieno) | ✅ |
| in-table lookup | ✅ |
| copy fields (nombre, direc, etc.) | ✅ |
| F1 help | ✅ |
| Tab validation | ✅ |
| PutRecord (upsert) | ✅ |
| exp demo.clientes clientes.dat | ✅ |

**Comandos:**
```bash
# Cargar datos demo
node utils/exp.js demo_clientes forms/demo/demo_clientes.dat

# Iniciar servidor
node server.js

# Cargar formulario
# http://localhost:3000 → forms/demo/clientes.xml
```

---

### Demo Pizzería - forms/demo/pizzeria/

**Objetivo:** Demo completo de handler system + multi-table CRUD

| Formulario | Descripción | Handler |
|------------|-------------|---------|
| `precios.xml` | Lista productos por categoría | `precios_handler` |
| `producto_nuevo.xml` | Crea producto con nueva categoría | `producto_nuevo` |

| Tabla | Registros |
|-------|-----------|
| `demo_categorias` | 8 categorías |
| `demo_productos` | 50+ productos |

**Features demostrados:**
- ✅ Handler `after()` pobla multifield dinámicamente
- ✅ Handler `beforeSave()` crea categoría si no existe
- ✅ Cache invalidation automática
- ✅ Multi-table persistence (producto + categoría)
- ✅ Campo readonly habilitado dinámicamente por handler

**Comandos:**
```bash
# Inicializar datos demo
node utils/init-pizzeria.js

# Iniciar servidor
node server.js

# Cargar formularios
# http://localhost:3000 → forms/demo/pizzeria/precios.xml
# http://localhost:3000 → forms/demo/pizzeria/producto_nuevo.xml
```

---

### v0.22.0 - Menu System + External App Architecture ✅ COMPLETO (2026-02-27)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | dotenv + @xmldom/xmldom instalados | `package.json` | ✅ |
| 2 | server.js carga .env al inicio | `server.js` | ✅ |
| 3 | menuService.js — parseo recursivo menu.xml | `src/services/menuService.js` | ✅ |
| 4 | GET /api/menu endpoint | `src/controllers/filesystemController.js` | ✅ |
| 5 | GET /api/files/content endpoint con autorización | `src/controllers/filesystemController.js` | ✅ |
| 6 | Rutas registradas | `src/routes/apiRoutes.js` | ✅ |
| 7 | client.js: getMenu() + getFile() | `js/api/client.js` | ✅ |
| 8 | FileExplorer.js: renderiza items de menú | `js/components/FileExplorer.js` | ✅ |
| 9 | Workspace.js: loadItem(item) | `js/components/Workspace.js` | ✅ |
| 10 | main.js usa getMenu() | `js/main.js` | ✅ |
| 11 | .env creado | `.env` | ✅ |
| 12 | /opt/wc/pizzeria/menu.xml creado | `/opt/wc/pizzeria/menu.xml` | ✅ |

**Pendiente v0.22.1 — App Directory Structure:**
- menu.xml targets incorrectos (`precios.xml` → `form/precios.xml`)
- Handlers en `nilix/handlers/` → mover a `/opt/wc/pizzeria/apps/`
- `handlerService.js`: resolución en `$NIL_APP_DIR/apps/` primero
- `NIL_DB_FILE` en `.env` + `database.js` lo usa
- Convención `handler="none"` documentada en GUIA-XML.md

---

### v0.26.0 - Login con Form Engine + JWT ✅ COMPLETO (2026-02-28)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `authService.js` — login seguro con LoginError, bloqueo 5 intentos | `src/services/authService.js` | ✅ |
| 2 | `authRoutes.js` — `POST /api/auth/login` público | `src/routes/authRoutes.js` | ✅ |
| 3 | `verifyToken.js` — middleware JWT para rutas protegidas | `src/middleware/verifyToken.js` | ✅ |
| 4 | `server.js` — authRoutes antes de verifyToken; inicia authDatabase | `server.js` | ✅ |
| 5 | `forms/login.xml` — form XML con `type="password"` + `action` | `forms/login.xml` | ✅ |
| 6 | `login.html` — página pública mínima centrada | `login.html` | ✅ |
| 7 | `FormContext.js` — extrae `formAction` | `js/components/form/FormContext.js` | ✅ |
| 8 | `SubmitManager.js` — `_handleCustomAction` + `_showFormError` | `js/components/form/SubmitManager.js` | ✅ |
| 9 | `client.js` — `authFetch()` usa cookie automática; elimina Bearer header; `logout()` POST + redirect | `js/api/client.js` | ✅ |
| 10 | `main.js` — guard: sin `nil_token` → redirect login | `js/main.js` | ✅ |
| 11 | `init-auth.js` — schema actualizado con `usuario`, `failed_attempts`, timestamps | `utils/init-auth.js` | ✅ |
| 12 | `.env` — `NIL_JWT_SECRET` + `NIL_JWT_EXPIRY=8h` | `.env` | ✅ |

**Demo:** `admin` / `demo1234` → JWT válido 8h → `nil_token` cookie (HttpOnly)

---

### v0.25.0 - Multi-tenant DB Schema ✅ COMPLETO (2026-02-28)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `src/services/authDatabase.js` — conexión `NIL_AUTH_DB` | `src/services/authDatabase.js` | ✅ |
| 2 | `utils/init-auth.js` — crea `empresas` + `usuarios` + demo data | `utils/init-auth.js` | ✅ |
| 3 | `bcryptjs` instalado | `package.json` | ✅ |
| 4 | `.env`: `NIL_AUTH_DB=data/auth.db` | `.env` | ✅ |
| 5 | `demo_categorias`: columna `empresa_id` | `utils/init-pizzeria.js` | ✅ |
| 6 | `demo_productos`: columna `empresa_id` | `utils/init-pizzeria.js` | ✅ |
| 7 | Seed data con `empresa_id=1` | `utils/init-pizzeria.js` | ✅ |
| 8 | `data/auth.db` creado con empresa + usuario demo | `data/auth.db` | ✅ |

**Demo usuario:** admin@pizzeria.local / demo1234 (bcrypt hash en auth.db)

---

### v2.0.0 — Multi-Tenant 3 Empresas Demo ✅ COMPLETO (2026-03-10)
### v2.1.0 — Public Token IDOR Hardening ✅ COMPLETO (2026-03-10)
### v2.2.0 — Dynamic Report Header/Footer ✅ COMPLETO (2026-03-10)

| # | Tarea | Versión | Archivo | Estado |
|---|-------|---------|---------|--------|
| 1 | 3 empresas demo + 3 usuarios en auth.db | 2.0.0 | `utils/init-auth.js` | ✅ |
| 2 | Datos demo para 3 empresas (cat + prod sin colisión) | 2.0.0 | `utils/init-pizzeria.js` | ✅ |
| 3 | `public_token` (UUID base64url 22 chars) reemplaza slug | 2.1.0 | `utils/init-auth.js`, `authService.js`, `authRoutes.js` | ✅ |
| 4 | URL pública `?t=TOKEN` — 128-bit entropy, no guessable | 2.1.0 | `Workspace.js`, `DataSourceManager.js`, `report.html`, `main.js` | ✅ |
| 5 | `resolveEmpresaId` busca `WHERE public_token = ?` | 2.1.0 | `src/controllers/publicReportController.js` | ✅ |
| 6 | Sin token válido → `{ rows: [] }` (no cross-tenant leak) | 2.1.0 | `src/controllers/publicReportController.js` | ✅ |
| 7 | Tabla `empresa_config` con datos por empresa | 2.2.0 | `utils/init-pizzeria.js` | ✅ |
| 8 | `carta.yaml` header/footer desde DB (`dataSource: config`) | 2.2.0 | `/opt/wc/pizzeria/reports/carta.yaml` | ✅ |
| 9 | `evaluateExpressions` unwrap array → `ctx[expr.field]` | 2.2.0 | `js/components/report/ReportRenderer.js` | ✅ |
| 10 | App reports con prioridad sobre engine reports | 2.2.0 | `server.js` | ✅ |

### v1.7.0 — Stepper Visual Fix ✅ COMPLETO

- CSS: `.stepper-wrapper .stepper-input` mayor especificidad — `border: none !important` + `border-left/right`
- JS: `data-size` en `<th>`; `_getColumns` lee `size`; `_buildStepperCell` usa `(size+0.5)ch`, `10^size-1` max, `padStart(size,'0')`
- Resultado: `[▼ 001 ▲]` borde exterior único

### v1.8.0 — POS Punto de Venta ✅ COMPLETO

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Form POS completo | `/opt/wc/pizzeria/form/pos.xml` | ✅ |
| 2 | Handler venta | `/opt/wc/pizzeria/apps/venta_handler.js` | ✅ |
| 3 | Tablas ventas + detalle_ventas | `utils/init-pizzeria.js` | ✅ |
| 4 | `Multifield.appendRow()` estático | `js/components/fieldRenderer/Multifield.js` | ✅ |
| 5 | `ValidationCoordinator` maneja `appendRow` | `js/components/form/ValidationCoordinator.js` | ✅ |

### v1.9.0 — Mobile UX POS Responsive ✅ COMPLETO (2026-03-09)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Stack: `.horizontal-container` (todos los containers) | `css/styles.css` | ✅ |
| 2 | Cards multifield: `td::before { flex: 0 0 33% }` | `css/styles.css` | ✅ |
| 3 | Sticky: `.actions-nav { position: sticky; bottom: 0 }` | `css/styles.css` | ✅ |
| 4 | Stepper card: `width: auto` en `.stepper-btn`, `flex:1` en `.stepper-input` | `css/styles.css` | ✅ |
| 5 | `_getColumns`: agrega `label: th.textContent.trim()` | `js/components/fieldRenderer/Multifield.js` | ✅ |
| 6 | `_buildRow`: `td.dataset.label`, `row.dataset.empty`, `actionTd.dataset.label=''` | `js/components/fieldRenderer/Multifield.js` | ✅ |

**Cambio clave:** `button { width: 100% }` en mobile se propaga a `.stepper-btn` como `flex-basis: 100%` aplastando el input. Fix: `width: auto` en el selector específico del card.

---

**Última actualización:** 2026-03-10 (v2.2.0 - Dynamic Report Header/Footer)
**Fin del documento de análisis**
