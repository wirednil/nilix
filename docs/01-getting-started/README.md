# NILIX

[![CI](https://github.com/wirednil/nilix/actions/workflows/ci.yml/badge.svg)](https://github.com/wirednil/nilix/actions/workflows/ci.yml)

*From nil, all structures emerge.*

Motor multi-parser para aplicaciones de negocio con estética terminal.
Formularios desde XML. Reportes desde YAML. Navegación desde menús estructurados.
Multi-tenant, autenticado, modular por diseño.

---

## Manifesto

Como la megaestructura de Blame! — modular, silenciosa, recursiva, absoluta.
Nilix no impone estructura: la extrae del vacío declarativo.
Un XML es un formulario. Un YAML es un reporte. Un menú es un espacio navegable.
Todo emerge de nil.

---

## ¿Sos un agente/LLM armando algo sobre nilix?

Leé [`AGENTS.md`](../../AGENTS.md) **antes** de escribir cualquier XML de
formulario, YAML de reporte, `menu.xml` o handler JS. nilix no sigue la
sintaxis de HTML/Django/Angular/Jinja en esos cuatro puntos, y generalizar
desde ahí produce archivos que no funcionan — con ejemplos reales de dónde ya
pasó. Es una lectura de dos minutos que ahorra rehacer todo después.

---

## Quick Start

### Requisitos

- Node.js 18+
- npm (con `--no-bin-links` en filesystems exFAT/NTFS)

### Setup

```bash
git clone <repo> && cd nilix
node scripts/setup.js
node server.js
# → http://localhost:3000
```

`setup.js` configura el entorno automáticamente: crea `.env` con JWT secret generado, instala dependencias, e inicializa las bases de datos con el dev sandbox incluido.

### Login demo — Dev Sandbox

```
URL:      http://localhost:3000/login.html
Usuario:  superdvlp
Password: devpass1234
```

**Este login solo entra al dev sandbox** (`dev/menu.xml`, datos de ejemplo) —
no a una app propia. Para armar tu propia app, seguí la sección siguiente.

---

### Empezar tu propia app (no el dev sandbox)

No escribas `menu.xml`/`form/*.xml`/`apps/*.js` a mano desde cero. `scaffold`
crea el skeleton completo con la estructura de directorios correcta:

```bash
. ./vars                          # desde la raíz de nilix — exporta NILSRC + scaffold/nil-start/nil-setup
scaffold mi-proyecto --dest=..    # crea ../mi-proyecto_v000/mi-proyecto/
cd ../mi-proyecto_v000/mi-proyecto
node setup.js                     # JWT secret + auth.db + app DB
node start.js                     # arranca el servidor
# → abrí /nil-setup para crear la primera empresa + usuario
```

Esto crea `.env`, `menu.xml`, y los directorios `form/`, `apps/`, `reports/`
ya en el lugar donde el motor los busca — evita el error más común de armar
esto a mano, que es poner los formularios o handlers en una carpeta que el
motor nunca resuelve.

Para un handler nuevo, generalo desde el XML real del form en vez de
escribirlo a mano — así el `module.exports`/firma de hooks sale siempre
correcta:

```bash
node utils/gencf.js form/mi_form.xml -o apps/mi_form.handler.js -a -b
```

Detalle completo de ambas herramientas: `node utils/scaffold.js --help`,
`node utils/gencf.js --help`.

---

## Submódulos

| Submódulo | Rol | Archivos clave |
|-----------|-----|----------------|
| **nil-form** | XML forms, CRUD, validación, handlers | `js/components/form/`, `js/components/FormRenderer.js`, `js/components/xmlParser/` |
| **nil-report** | YAML reports, OLAP, DuckDB-WASM | `js/components/report/ReportEngine.js`, `DataSourceManager.js`, `ReportRenderer.js` |
| **nil-explorer** | Menú, navegación, árbol de archivos | `src/services/menuService.js`, `js/components/FileExplorer.js` |
| **nil-data** | SQLite scoped multi-tenant | `src/services/scopedDb.js`, `src/services/database.js` |
| **nil-handler** | Lógica de negocio, hooks, POS | `src/services/handlerService.js` |
| **nil-runtime** | Servidor Express, rutas, middleware | `server.js`, `src/routes/`, `src/middleware/` |

---

## Arquitectura

```
nilix/
├── AGENTS.md                    # Leer primero si vas a generar XML/YAML/handlers
├── vars                         # . ./vars → exporta scaffold/nil-start/nil-setup
├── server.js                    # nil-runtime — entry point
├── src/
│   ├── routes/                  # API routes
│   ├── controllers/             # Lógica de controladores
│   ├── services/                # authService, database, scopedDb, menuService, ...
│   └── middleware/              # verifyToken, auditLog
├── js/
│   ├── main.js                  # Entry point frontend
│   ├── api/client.js            # authFetch(), logout()
│   ├── components/
│   │   ├── form/                # FormContext, ValidationCoordinator, SubmitManager, ...
│   │   ├── report/              # ReportEngine, DataSourceManager, ReportRenderer, ...
│   │   ├── FormRenderer.js      # Orquestador de formularios XML
│   │   └── FileExplorer.js      # Navegador de menú
│   ├── services/TableCache.js   # Cache de catálogos (nil_catalog_*)
│   └── utils/                   # RADU, ExpressionEngine, validator
├── css/styles.css               # Neobrutalismo terminal phosphor green
├── forms/                       # XML del motor (login.xml, etc.)
├── utils/                       # init-dev.js, ndat.js, gencf.js, scaffold.js
├── scripts/                     # setup.js, check.js
├── dev/                         # dev sandbox (menu.xml, forms, data, dbase)
├── tests/                       # test suite (38 tests unitarios)
├── data/                        # auth.db (motor) — NO la app DB
└── docs/                        # Documentación por capa
```

---

## Autenticación

El motor usa **HttpOnly cookie `nil_token`** — inaccesible a JavaScript (XSS-safe).

- Login: `POST /api/auth/login` → bcrypt + JWT → cookie
- Guard: `GET /api/auth/check` → verifica cookie activa
- Logout: `POST /api/auth/logout` → blacklist JTI + clearCookie
- Rate limiting: 10 req / 15 min por IP

Ver referencia completa: [`docs/03-reference/AUTH.md`](../03-reference/AUTH.md)

---

## Multi-tenant

Cada usuario pertenece a una `empresa_id`. El middleware `verifyToken` la extrae del JWT
y la expone en `req.empresaId`. `ScopedDb` filtra todas las queries automáticamente —
nunca mezcla datos entre empresas.

El dev sandbox incluido en el repo usa empresa 99:

| empresa_id | Nombre | Usuario | Password |
|------------|--------|---------|----------|
| 99 | Dev Sandbox | `superdvlp` | `devpass1234` |

Creado automáticamente por `scripts/setup.js` vía `utils/init-dev.js`.
Las apps existentes pueden migrar sus propios datos a `auth.db` vía la API o scripts custom.
`init-auth.js` fue removido en v2.4.1 — la inicialización del schema se maneja en `src/services/authDatabase.js::initAuthDatabase()`.

### Optar por single-tenant (una sola empresa, sin scoping)

No existe ningún flag de configuración para "desactivar" el multi-tenant.
Es una propiedad del **schema de cada tabla**, no un switch global: si una
tabla de tu app **no tiene columna `empresa_id`**, `ScopedDb` no la scopea —
la trata como single-tenant automáticamente (`schemaService.hasColumn()`
decide esto por tabla, en cada query). No hace falta declarar nada extra en
`.env` ni en el form. Simplemente no agregues esa columna al crear la tabla.

---

## Formularios XML (nil-form)

Un formulario se define en XML:

```xml
<form id="producto" title="Producto" database="productos" handler="producto_handler">
    <layout>
        <border>
            <field id="id" label="Código" type="number" keyField="true" size="6"/>
        </border>
        <field id="nombre" label="Nombre" type="text" size="50">
            <validation><required>true</required></validation>
        </field>
        <field id="precio" label="Precio" type="number" decimals="2"/>
        <field id="total" label="Total" is="precio * cantidad" skip="true"/>
    </layout>
</form>
```

Features: campos básicos, select/lookup, multifield grids, campos virtuales (`is=`),
validaciones inline, navegación PAG_SIG/PAG_ANT, RADU permissions, stepper.

Ver guía completa: [`docs/04-guides/GUIA-XML.md`](../04-guides/GUIA-XML.md)

---

## Reportes YAML (nil-report)

Un reporte se define en YAML:

```yaml
name: ventas_diario
config:
  schema: catalogs
  outputTo: display

fields:
  - name: vta_fecha
    type: date
    dbRef: { table: ventas, field: fecha }

dataSources:
  ventas:
    table: ventas
    orderBy: [vta_fecha]

zones:
  - name: dia_separador
    condition: { when: before, on: vta_fecha }
    template: ["--- {fecha} ---"]

  - name: dia_total
    condition: { when: after, on: vta_fecha }
    expressions:
      - { name: subtotal, aggregate: sum, argument: vta_total }
    template: ["Subtotal: {subtotal:currency}"]
```

Backend: DuckDB-WASM (OLAP) con fallback JS. Control breaks, aggregates, multi-datasource.

El motor de reportes **no exporta a CSV** — el reporte se renderiza a HTML
(`report.html`) e imprime/PDF vía el botón nativo del browser. El export a
CSV que sí existe en el proyecto es de `SubmissionsViewer.js` (el visor de
envíos de formulario), un componente distinto — no confundir ambos al
proponer una integración.

Ver spec: [`docs/05-specs/REP/REP-SPEC.md`](../05-specs/REP/REP-SPEC.md) y la
referencia completa y actualizada en [`docs/03-reference/NIL-REPORT.md`](../03-reference/NIL-REPORT.md)

---

## Menú (nil-explorer)

```xml
<menu id="app" title="Mi Aplicación">
    <option label="Productos" type="form"   target="form/productos.xml" permissions="RADU"/>
    <option label="Ventas"    type="report" target="reports/ventas.yaml" permissions="R"/>
    <option type="separator"/>
    <option label="Config"    type="menu"   target="form/config.xml"/>
</menu>
```

`NIL_MENU_FILE` apunta al `menu.xml` de la app. El motor resuelve paths y permisos RADU.

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NIL_PORT` | Puerto del servidor | `3000` |
| `NIL_MENU_FILE` | Path absoluto al menu.xml de la app | — |
| `NIL_APP_DIR` | Directorio raíz de la app (auto desde MENU_FILE) | — |
| `NIL_DB_FILE` | SQLite de la app | `data/catalogs.db` |
| `NIL_AUTH_DB` | SQLite del motor (auth) | `data/auth.db` |
| `NIL_JWT_SECRET` | Secret JWT — mínimo 256 bits en producción | — |
| `NIL_JWT_EXPIRY` | Expiración del token | `8h` |
| `NIL_TLS_CERT` | Path al certificado TLS (activa HTTPS) | — |
| `NIL_TLS_KEY` | Path a la clave TLS | — |
| `NIL_ALLOWED_ORIGIN` | Origen permitido para CORS en producción | — |
| `NIL_COMPAT_SPACE_FORM` | Compatibilidad con `.env` legacy `SF_*` (solo dev) | — |

---

## Upgrading desde versiones anteriores (v2.2.x → v2.3.0)

1. Renombrar todas las variables en `.env`: `SF_*` → `NIL_*`
2. Limpiar cookies del navegador (`nil_token` reemplaza la cookie anterior)
3. Limpiar localStorage (keys `nil_catalog_*` reemplazan los anteriores)
4. Para migración gradual en dev: `NIL_COMPAT_SPACE_FORM=1` en `.env`

---

## Documentación

**Leer antes de generar XML/YAML/handlers** (spec primaria, no solo referencia):

| Documento | Contenido |
|-----------|-----------|
| [`docs/03-reference/nil-form.md`](../03-reference/nil-form.md) | Spec completa de formularios XML — sintaxis de campos, validación, handlers |
| [`docs/05-specs/MENUS-SPEC.md`](../05-specs/MENUS-SPEC.md) | Spec de `menu.xml` — tags, tipos de opción, permisos |
| [`docs/03-reference/NIL-REPORT.md`](../03-reference/NIL-REPORT.md) | Spec de reportes YAML — zonas, `kind`, expresiones, agregación |

Resto de la documentación:

| Documento | Contenido |
|-----------|-----------|
| [`docs/03-reference/AUTH.md`](../03-reference/AUTH.md) | Flujo de autenticación completo |
| [`docs/03-reference/CODE-MAP.md`](../03-reference/CODE-MAP.md) | Mapa de archivos y líneas |
| [`docs/03-reference/CHANGELOG.md`](../03-reference/CHANGELOG.md) | Historial de versiones |
| [`docs/04-guides/GUIA-XML.md`](../04-guides/GUIA-XML.md) | Guía de formularios XML |
| [`docs/04-guides/MULTIFIELD-GUIDE.md`](../04-guides/MULTIFIELD-GUIDE.md) | Guía de multifields |
| [`docs/05-specs/REP/REP-SPEC.md`](../05-specs/REP/REP-SPEC.md) | Spec original del motor de reportes (legado RDL) |
| [`docs/06-development/ROADMAP.md`](../06-development/ROADMAP.md) | Roadmap y sprints |
| [`docs/02-architecture/ANALYSIS-HIERARCHY.md`](../02-architecture/ANALYSIS-HIERARCHY.md) | Arquitectura general |
| [`docs/02-architecture/HANDLER-AUDIT.md`](../02-architecture/HANDLER-AUDIT.md) | Auditoría de seguridad de handlers |
| [`docs/06-development/PRODUCTION-READINESS-PLAN.md`](../06-development/PRODUCTION-READINESS-PLAN.md) | Plan de madurez y producción |

---

*Nilix v2.4.0 · neobrutalismo terminal · phosphor green · ex nihilo*
