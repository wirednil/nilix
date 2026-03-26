# 📝 CHANGELOG

Registro de todos los cambios notables en Nilix.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es-ES/).

---

## [2.6.1] — 2026-03-25

### Fixed — nil-form

**`ValidationCoordinator` — after hooks al cargar registro**

`loadRecord` ahora llama `callAfter` para todos los campos del registro después de `fillForm`. Antes, los `after` hooks (ej. visibilidad de campos por estado) solo se disparaban al cambiar un campo manualmente; al abrir un registro existente, los campos quedaban en el estado por defecto en lugar de reflejar el estado guardado.

```js
// después de fillForm(record):
if (this._handlerBridge) {
    for (const [fieldId, val] of Object.entries(record)) {
        if (val != null && val !== '') {
            await this._handlerBridge.callAfter(fieldId, val);
        }
    }
}
```

**Archivos modificados:** `js/components/form/ValidationCoordinator.js`

---

**`recordService.insert` — PK auto-generada en resultado**

Después de un INSERT exitoso, el servicio consulta `last_insert_rowid()` e inyecta la PK generada en el objeto `data` retornado. Antes, si la PK venía como `null` (nuevo registro), el resultado devolvía `id = null`, rompiendo los `<output>` y `__output` del handler que necesitaban el ID real para abrir comprobantes.

```js
const pkCol = schemaService.getPrimaryKey(tableName);
if (pkCol && filteredData[pkCol] == null) {
    const rowidRows = db.exec('SELECT last_insert_rowid()');
    const rowid = rowidRows[0]?.values[0]?.[0];
    if (rowid != null) filteredData[pkCol] = rowid;
}
```

**Archivos modificados:** `src/services/recordService.js`

---

### Added — nil-form

**`<button>` tag en layout XML**

`LayoutProcessor` soporta el tag `<button>` con `action="print-report"`. Al hacer click, lee el valor del campo `param` desde el DOM y abre el reporte en nueva pestaña. Útil para botones de reimpresión en formularios.

```xml
<button action="print-report" report="comprobante_ingreso" param="id_orden" label="Reimprimir Ingreso"/>
```

Si el campo `param` está vacío (formulario sin registro cargado), el click no hace nada.

**Archivos modificados:** `js/components/form/LayoutProcessor.js`

---

**`inherit` en subforms**

El atributo `inherit` en `<subform>` propaga valores del formulario padre al subformulario al momento de abrirlo. Acepta una lista de IDs separados por coma.

```xml
<subform trigger-value="2" form="equipo_nuevo" inherit="id_cliente"/>
```

Los valores se aplican después del render del subformulario (`setTimeout 0`) y disparan `change` para activar lookups dependientes.

**Archivos modificados:** `js/components/form/LayoutProcessor.js`

---

### Changed — nil-form

**`setupIsExpression` — delegación de eventos a nivel form**

Reemplaza el approach anterior de listeners por dependencias individuales (que fallaba cuando `getValueDependencies` devolvía array vacío). Ahora un único listener en `formEl` reacciona a cualquier `input`, `change` o `multifield-populated`. Más robusto y elimina la necesidad de parsear dependencias para los listeners.

```js
// Antes: listener por cada campo dependiente (roto si deps vacío)
// Ahora:
formEl.addEventListener('input',  recompute, { signal });
formEl.addEventListener('change', recompute, { signal });
formEl.addEventListener('multifield-populated', recompute, { signal });
```

**Archivos modificados:** `js/components/form/LayoutProcessor.js`

---

### Changed — nil-report

**`ExpressionEngine.evaluateArithmetic` — recursive descent parser (CSP-safe)**

Reemplaza la implementación anterior (split por operador, sin precedencia) con un parser recursivo completo. El cambio fue forzado por la política CSP `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` que bloquea `new Function` y `eval`.

Soporta: `+`, `-`, `*`, `/`, paréntesis anidados, unario negativo. Precedencia correcta (`*` antes de `+`).

```js
// Antes: split por '+' / '-' / '*' / '/' — sin precedencia, roto con expresiones mixtas
// Ahora: _parseExpr → _parseTerm → _parseFactor (recursive descent)
//        "2 + 3 * 4" → 14  (antes podía dar 20)
```

**Archivos modificados:** `js/utils/ExpressionEngine.js`

---

**`DataSourceManager` — DuckDB deshabilitado por defecto + fallback ante errores**

`useDuckDB` pasa a `false` en el constructor. DuckDB 1.29.0 WASM tiene un bug interno (`RuntimeError: unreachable`) al insertar datos en tablas Arrow. El path JS cubre todos los casos actuales con datasets pequeños.

Adicionalmente, el bloque `loadWithDuckDB` ahora está envuelto en try/catch: si falla, loguea advertencia, desactiva DuckDB para la sesión y reintenta con JS.

**Archivos modificados:** `js/components/report/DataSourceManager.js`

---

**`DuckDBAdapter` — bundle MVP forzado + polyfill `_setThrew`**

Eliminada la detección de bundle EH (`WebAssembly.suspend`): siempre se usa MVP para máxima compatibilidad. El bundle EH requiere soporte completo de WASM Exception Handling que no está disponible en todos los entornos.

Agregado polyfill `var _setThrew = function(a, b) {}` al inicio del worker blob, necesario porque duckdb-wasm 1.29.0 genera stubs `invoke_*` de Emscripten que llaman a `_setThrew` pero no la incluyen cuando se compila con excepciones WASM.

**Archivos modificados:** `js/components/report/DuckDBAdapter.js`

---

### Fixed — css

**`#active-content .form-vertical` — selector de especificidad para formularios embebidos**

Agrega `#active-content .form-vertical` como alias del selector existente `.form-vertical` en el breakpoint responsive. Sin este selector, formularios renderizados dentro del contenedor `#active-content` no heredaban el `width: 100%; min-width: 0` en mobile.

**Archivos modificados:** `css/styles.css`

---

### Added — scripts

**`scripts/csp-demo.js` — demostración de ausencia de CSP reporting**

Script de diagnóstico que prueba la visibilidad del servidor ante violaciones CSP. Verifica si el header CSP incluye `report-uri`, simula payloads reales de violación (inline script, script externo, eval bloqueado, clickjacking) y ejecuta una ráfaga de 20 reportes concurrentes para medir cuántos son recibidos vs. descartados.

Uso: `node scripts/csp-demo.js` (requiere servidor corriendo en `localhost:3000`).

**Archivos nuevos:** `scripts/csp-demo.js`

---

## [2.6.0] — 2026-03-21

### Pipeline Form → Report (`<output>`), reportes parametrizados, joins encadenados, aritmética en fórmulas, botón imprimir, selects en cascada, subformularios, `skip` en selects, layout vertical expand

---

**1. Directiva `<output>` — pipeline Formulario → Reporte**

Después de un guardado exitoso, el formulario puede abrir automáticamente un reporte en una pestaña nueva. La directiva se declara dentro de `<form>`, antes de `<form-attributes>`:

```xml
<output report="comprobante_ingreso" param="id_orden" on="create"/>
<output report="comprobante_entrega" param="id_orden" condition="estado == 'Entregado'"/>
```

Atributos:

| Atributo | Descripción |
|---|---|
| `report` | Nombre del YAML del reporte (sin `.yaml`) |
| `param` | Campo del registro guardado que se pasa como parámetro URL |
| `on` | `"create"` (solo al insertar) \| `"save"` (siempre, default) |
| `condition` | Expresión `campo == 'valor'` evaluada contra el dato guardado |

Si el navegador bloquea el popup, aparece un enlace clickeable inline en el formulario como alternativa.

**Output desde handler:** el handler puede disparar un reporte asignando `data.__output = { report: 'nombre', param: 'campo' }` en `beforeSave`. La salida del handler tiene prioridad sobre las directivas XML.

**Archivos modificados:** `FormContext.js`, `SubmitManager.js`, `parsers/FormParser.js`

---

**2. Reportes parametrizados — sustitución `:param` en `filter`**

Los reportes pueden recibir parámetros via URL que se sustituyen directamente en la expresión `filter`:

URL: `report.html?file=comprobante_ingreso&id_orden=5`

```yaml
dataSources:
  orden:
    table: ordenes
    filter: "id_orden = :id_orden"
```

`:id_orden` se reemplaza con el valor del parámetro de URL correspondiente. Reglas de sustitución:
- Parámetros numéricos → se inyectan sin comillas.
- Parámetros string → validados contra lista blanca de caracteres seguros y entrecomillados con comillas simples.
- Parámetro ausente → el motor lanza un error visible en `report.html`.
- Caracteres inválidos en parámetro string → también producen error.

**Archivos modificados:** `parsers/YamlParser.js`, `DataSourceManager.js`, `report.html`

---

**3. Joins encadenados**

Los joins pueden referenciar columnas traídas por joins anteriores, no solo campos de la tabla principal. El motor resuelve el `from:` buscando en el resultado acumulado de joins previos.

```yaml
dataSources:
  orden:
    table: ordenes
    filter: "id_orden = :id_orden"
    joins:
      - from: id_equipo
        to: equipos.id_equipo
        include: [tipo, marca_modelo, numero_serie, id_cliente]
      - from: id_cliente          # proviene del join anterior (equipos), no de ordenes
        to: clientes.id_cliente
        include: [nombre_completo, telefono]
```

Funciona tanto en el path JS (`DataSourceManager.js`) como en el path DuckDB.

---

**4. Aritmética en `formula:`**

Además de `if()`, `formula:` ahora acepta expresiones aritméticas directas:

```yaml
expressions:
  - name: saldo
    formula: "total - sena_pagada"
  - name: subtotal
    formula: "precio * cantidad"
```

Los nombres de campo se resuelven en el contexto de la fila (datos del registro). Solo participan campos numéricos; la expresión se valida contra `/^[\d\s+\-*/.()]+$/` antes de `eval`. Campos no numéricos o ausentes producen cadena vacía.

**Archivos modificados:** `ReportRenderer.js`

---

**5. Botón Imprimir / PDF en `report.html`**

Un botón fijo "Imprimir / PDF" siempre visible en la esquina inferior derecha de `report.html`. Llama a `window.print()`. Se oculta automáticamente con `@media print` para no aparecer en la salida impresa ni en el PDF generado por el navegador.

**Archivos modificados:** `report.html`, `css/styles.css`

---

**6. Selects en cascada — `filter-by` / `filter-field` en `<in-table>`**

Un campo `type="select"` con `<in-table>` puede filtrar sus opciones en función del valor seleccionado en otro campo del formulario:

```xml
<!-- Campo padre -->
<field id="id_cliente" label="Cliente" type="select">
    <in-table table="clientes" key="id_cliente" display="nombre_completo"/>
</field>

<!-- Campo hijo — filtra por id_cliente -->
<field id="id_equipo" label="Equipo" type="select">
    <in-table table="equipos" key="id_equipo" display="marca_modelo"
              filter-by="id_cliente" filter-field="id_cliente"/>
</field>

<!-- Campo nieto — filtra por id_equipo -->
<field id="id_orden" label="Ticket" type="select" keyField="true">
    <in-table table="ordenes" key="id_orden" display="problema_reportado"
              filter-by="id_equipo" filter-field="id_equipo"/>
</field>
```

| Atributo | Descripción |
|---|---|
| `filter-by` | ID del campo padre cuyo valor conduce el filtro |
| `filter-field` | Columna en la tabla hija a comparar contra el valor padre (por defecto igual a `filter-by`) |

Comportamiento:
- Cambio de usuario en el padre (`sf:user-change`) → hijo se resetea y re-carga.
- Carga programática de registro existente (evento `change`) → el filtro se actualiza pero el valor hijo se preserva.
- Soporta N niveles (en el ejemplo: cliente → equipo → orden).

**Archivos modificados:** `fieldRenderer/SelectField.js`, `ValidationCoordinator.js`

---

**7. Subformularios — `<subform>` en campos select**

Un campo `type="select"` puede disparar navegación inline hacia un formulario secundario cuando el usuario elige un valor específico:

```xml
<field id="choose" label="ACCION" type="select" default="1">
    <options>
        <option value="1">EXISTENTE</option>
        <option value="2">NUEVO</option>
    </options>
    <subform trigger-value="2" form="clientes_nuevo"/>
</field>
```

| Atributo | Descripción |
|---|---|
| `trigger-value` | Valor de opción que dispara la navegación |
| `form` | Nombre del archivo XML (sin `.xml`), relativo al directorio del formulario actual |

Comportamiento:
- Al seleccionar el valor disparador, el workspace se reemplaza con el subformulario.
- Aparece un botón `← Volver` en la parte superior para retornar al formulario padre sin guardar.
- Tras un guardado exitoso en el subformulario, el catálogo de lookup se invalida y el workspace vuelve al padre después de 1,5 segundos.
- La opción disparadora se resetea a la primera opción (default) al volver al padre.

**Archivos modificados:** `fieldRenderer/SelectField.js`, `Workspace.js`, `FormRenderer.js`

---

**8. `skip="true"` en campos select**

Anteriormente, `skip="true"` en cualquier campo lo hacía completamente de solo lectura (incluyendo bloqueo del dropdown). A partir de esta versión, `skip="true"` sobre un campo `type="select"` (con `<in-table>` o `<options>`) permite al usuario operar el dropdown con normalidad, pero bloquea el ingreso de texto libre.

Caso de uso típico: formulario padre en modo EXISTENTE donde `id_cliente` debe ser navegable via dropdown pero no ingresable manualmente.

**Archivos modificados:** `fieldRenderer/SelectField.js`

---

**9. Layout vertical: `expand-to-label` automático**

En contenedores `<container type="vertical">`, todos los inputs ahora se expanden para ocupar el ancho disponible del contenedor, independientemente del tamaño del label. Anteriormente, solo se expandían los campos cuyo label era más ancho que el input.

En layout horizontal el comportamiento original se preserva: expansión solo cuando el label supera el ancho del input.

**Archivos modificados:** `LayoutProcessor.js`

---

## [2.5.3] — 2026-03-21

### Report engine — `rowTemplate` + comportamiento inline/block en markdown

**`rowTemplate` en zones**

Nueva propiedad de zona que permite generar una fila de tabla GFM por cada registro del `dataSource`, útil en zonas after-report donde antes solo había acceso al `datasetMap`.

Pipeline de rendering cuando `rowTemplate` está presente:
1. `template[]` → se evalúa una sola vez (cabecera de la tabla: `| Col |` + `|---|`)
2. `rowTemplate[]` → se evalúa por cada registro del `dataSource` (filas de datos)
3. El bloque completo se pasa a `marked.parse()` → `<table>` GFM

```yaml
- name: resumen_tabla
  layout: lines
  condition: { when: after, on: report }
  dataSource: movimientos
  expressions:
    - name: monto_fmt
      field: monto
      format: currency
  template:
    - "| Tipo | Concepto | Monto |"
    - "|---|---|---:|"
  rowTemplate:
    - "| {tipo_label} | {concepto} | `{monto_fmt}` |"
```

**Fix en `renderAfterReport`:** cuando una zona tiene `dataSource` + `rowTemplate`, el engine pasa el array completo de datos en lugar del `datasetMap`. Consistente con el comportamiento de `renderBeforeReport`.

**Comportamiento inline vs block en markdown**

Las zones `header`, `footer` y `subtotal` usan `marked.parseInline()` — solo procesan markdown inline (`**bold**`, `` `code` ``, `[link](url)`). Los elementos de bloque (`# H1`, `---`, `- lista`) **no se procesan** en estas zones.

La zone `lines` usa `marked.parse()` sobre el bloque completo → soporta todos los elementos.

Consecuencia práctica: en zones `header`, escribir el texto directamente sin `#`. El estilo de título lo aporta el CSS (`.report-header-line:first-child`):

```yaml
# ✅ correcto — el CSS lo estiliza como título
template:
  - "FLUJO DE CAJA MENSUAL"

# ❌ el # se muestra literal en zones header/footer/subtotal
template:
  - "# FLUJO DE CAJA MENSUAL"
```

**CSS para tablas markdown**

Nuevos estilos en `.report-lines-md table/th/td`: `width: 100%`, bordes, padding. Layout `auto` para distribución dinámica de columnas por contenido.

**Archivos modificados:** `ReportRenderer.js`, `ReportEngine.js`, `parsers/YamlParser.js`, `css/styles.css`

---

## [2.5.2] — 2026-03-21

### Report engine — Soporte Markdown en templates

**`config.markdown: true`**

Nuevo flag opt-in que habilita parsing Markdown en los templates de todas las zones. Reportes sin el flag siguen renderizando como texto plano (backward compatible).

**Pipeline correcto:** `{placeholders}` se resuelven ANTES del parsing Markdown. Los valores inyectados desde la DB se HTML-escapen automáticamente para prevenir XSS en `innerHTML`.

**`fields[].escape: true`**

Nuevo atributo en la sección `fields`. Cuando está presente, los caracteres Markdown del valor (`*`, `_`, `` ` ``, `[`, `]`, `#`, `\`) se escapean antes de la sustitución, evitando que datos de usuario rompan el formato del template.

**Markdown soportado (Fases 1-3):**

| Construcción | Sintaxis | Output |
|---|---|---|
| Negrita | `**texto**` | `<strong>` |
| Cursiva | `*texto*` / `_texto_` | `<em>` |
| Código inline | `` `texto` `` | `<code>` |
| Link | `[texto](url)` | `<a>` |
| Separador | `---` (línea sola) | `<hr>` |
| Headers | `# ## ###` | `<h1>` – `<h3>` |
| Bullet list | `- item` | `<ul><li>` |
| Numbered list | `1. item` | `<ol><li>` |
| Tablas GFM | `\| Col \| …` | `<table>` |

Listas consecutivas se agrupan automáticamente en un único `<ul>` o `<ol>`.

**Implementación:** marked.js v12 (CDN ESM) con fallback DIY para Fases 1-2 si CDN no disponible.

**Archivos modificados:** `ReportRenderer.js`, `ReportEngine.js`, `parsers/YamlParser.js`, `css/styles.css`
**YAML de prueba:** `flujo_mensual_md.yaml` (demo completo con casos 1-4 del spec)

---

## [2.5.1] — 2026-03-21

### Report engine — Nivel 2 features

**Context chaining en expresiones (`rawValues`)**

Las fórmulas ahora pueden referenciar expresiones previas de la misma zona con su valor numérico (pre-format). Antes, una expresión `balance_dia` formateada como `$15.000,00` llegaba al `if()` como string → `parseFloat('$15.000,00') = NaN` → comparación fallaba siempre.

Fix en `ReportRenderer.evaluateExpressions`: se mantiene un objeto `rawValues` paralelo que acumula valores **sin formato**. Las fórmulas reciben `rawValues` en lugar del contexto original.

```yaml
- name: balance_dia
  aggregate: sum
  argument: monto
  scope: lookahead
  format: currency           # balance_dia en result = "$15.000,00"
- name: indicador
  formula: "if(balance_dia > 0, '✓', '⚠')"  # recibe 15000 (raw) → funciona
```

**`scope: dataset` + `filter:` en expresiones de agregado**

Nueva modalidad de agregación que computa sobre todo el dataset en un pase previo (`precomputeDatasetAggregates`), con filtro opcional por expresión. No usa `AccumulatorManager` — no hay riesgo de interferir con la lógica de cortes existente.

```yaml
- name: total_ingresos
  aggregate: sum
  argument: monto
  scope: dataset
  filter: "tipo == 'Ingreso'"   # solo filas donde tipo == Ingreso
  format: currency

- name: indicador_mes
  formula: "if(balance_neto > 0, '✓ Superávit', '⚠ Déficit')"
```

`filter:` soporta: `campo == 'valor'` y `campo op número` (`==`, `!=`, `>`, `<`, `>=`, `<=`).

Disponible en zonas `condition: { when: after, on: report }`. Los valores se inyectan en el contexto de esas zonas antes de evaluar expresiones.

**`||` — alineación derecha en `layout: lines`**

Separador en template que divide la línea en dos spans con `display: flex; justify-content: space-between`:

```yaml
template:
  - "  {concepto}  {monto_fmt} || [{metodo}]"
# → "  Cobro orden — iPhone  $15.000,00        [Transferencia]"
```

El texto a la izquierda de `||` queda alineado a la izquierda; el de la derecha, al extremo derecho del contenedor. Funciona solo en zonas `layout: lines`.

**Archivos modificados:**
- `js/components/report/ReportRenderer.js` — `evaluateExpressions`: `rawValues`; `renderLinesZone`: split `||`
- `js/components/report/ReportEngine.js` — `precomputeDatasetAggregates`, `_matchSimpleFilter`, `render()`, `renderAfterReport(datasetMap)`
- `js/components/report/parsers/YamlParser.js` — `filter:` en schema de expresiones
- `css/styles.css` — `.report-lines-split`

---

## [2.5.0] — 2026-03-20

### Report engine — Nivel 1 features

Cuatro capacidades nuevas en el motor de reportes:

**`format: dayname`** — Formatea una fecha como nombre de día + fecha larga en español:
```yaml
- name: fecha_completa
  field: fecha
  format: dayname   # → "Jueves 05/03/2026"
```

**`formula: "if(cond, trueVal, falseVal)"`** — Expresiones condicionales en zonas de detalle y separadores:
```yaml
- name: icono
  formula: "if(tipo == 'Ingreso', '↓', '↑')"
```
- Parser directo para comparaciones simples (`campo op 'valor'` o `campo op número`) — sin `Function()`.
- Soporta `==`, `!=`, `>`, `<`, `>=`, `<=`.
- Fallback `Function()`-based para condiciones compuestas (con `isConditionSafe` como guardia).

**`scope: lookahead`** — Agrega el valor de un grupo **antes** de renderizar su encabezado (`when: before`):
```yaml
- name: balance_dia
  aggregate: sum
  argument: monto
  scope: lookahead
  format: currency
```
- `ReportEngine.precomputeGroupAggregates()` hace un pase previo sobre los grupos ya detectados por `groupByCategory`.
- Los valores se inyectan en el contexto bajo la clave `_lookahead_{exprName}` antes de renderizar la zona `before`.

**`layout: table`** — Zona en formato tabla HTML con cabecera y columnas configurables:
```yaml
- name: resumen
  layout: table
  condition: { when: after, on: report }
  columns:
    - { field: tipo,     label: "Tipo",   width: "20%", align: left }
    - { field: monto_fmt, label: "Monto", width: "80%", align: right }
```

**Archivos modificados:**
- `js/components/report/ExpressionEvaluator.js` — `evaluateFormula`, `_splitArgs`, `_evalCond`, `_resolveVal`; `format: dayname`
- `js/components/report/ReportRenderer.js` — `renderLinesZone`, `renderTableZone`; `determineZoneType` respeta `layout` antes de retornar `'detail'`
- `js/components/report/ReportEngine.js` — `precomputeGroupAggregates`; `render()` inyecta lookaheadMap en `renderCategorySeparator`
- `js/components/report/parsers/YamlParser.js` — `formula`, `scope` en expresiones; `columns` en zonas
- `css/styles.css` — `.report-lines`, `.report-table`, `.report-table-th`, `.report-table-td`

---

## [2.4.9] — 2026-03-20

### Report engine — correcciones

- **`evaluateExpressions` no aplicaba `format`**: el valor de `expr.format` se guardaba en el schema pero nunca se aplicaba al valor resultante. Ahora `formatValue` se llama tras resolver cualquier tipo de expresión (`field`, `aggregate`, `formula`).
- **`layout: lines`**: nueva variante de zona que renderiza texto plano en `<div class="report-lines">` sin card-borders ni grilla. Agregado a `determineZoneType`, `renderLinesZone`, y CSS.
- **`.report-subtotal` invisible**: la clase existía en el renderer JS pero no tenía reglas CSS — los subtotales se renderizaban sin estilos. Agregado bloque CSS.
- **`.report-products-grid` side-by-side**: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` causaba que zonas `layout: lines` se mostraran en columnas. Fix: selector `:has(.report-lines)` fuerza `grid-template-columns: 1fr`.
- **Currency `es-AR`**: formato `currency` migrado de `toFixed(2)` a `toLocaleString('es-AR', {minimumFractionDigits: 2})`. Negativos como `-$X.XXX,XX`.
- **Date `timeZone: UTC`**: fechas de DuckDB llegan como epoch ms; `new Date(value)` sin `timeZone: 'UTC'` desfasaba un día. Forzado `timeZone: 'UTC'` en formatos `date` y `dayname`.
- **`dayname` en inglés**: el formato usaba `navigator.language` para el weekday, que retornaba `en-US` en el browser. Hardcodeado `'es-AR'` para weekday y fecha.

---

## [2.4.8] — 2026-03-20

### OpenAPI spec (T1.5)

- **`docs/api/openapi.yaml`** — spec OpenAPI 3.1 con 19 operaciones en 16 paths:
  - **System:** `GET /api/health`
  - **Auth:** login, logout, check, refresh
  - **App:** `GET /api/menu`
  - **Records:** CRUD + navigate (`GET`, `POST`, `PUT`, `DELETE` sobre `/:table`)
  - **Handlers:** after, after-field
  - **Users:** list, create, update, set-permisos (admin only)
  - **Reports:** `GET /api/public/report-data/:reportName/:table`
  - **Security:** `POST /api/security/csp-report`
- **Schemas:** `Record`, `MenuItem`, `HandlerRequest/Response`, `UserCreateRequest`, `PermisosRequest`, `CspReport`, `HealthResponse`, `AuthCheckResponse`, `ErrorResponse`
- **Responses reutilizables:** `Unauthorized`, `Forbidden`, `NotFound`, `RateLimited`, `InternalError`
- **Security scheme:** `cookieAuth` (apiKey in cookie `nil_token`)
- **`.github/workflows/ci.yml`** — nuevo job `openapi` que valida con `@redocly/cli lint` en cada PR

## [2.4.7] — 2026-03-20

### Docker (T1.6)

- **`Dockerfile`** — multi-stage: stage `deps` instala solo dependencias de producción (`npm ci --omit=dev`); stage `runtime` copia fuente + deps. Base `node:22-alpine`. Sin `--no-bin-links` (no necesario en Linux).
- **`docker-compose.yml`** — levanta el dev sandbox con `docker compose up`. Volúmenes para persistir `data/` (auth.db) y `dev/dbase/` (app DB) entre reinicios. Healthcheck integrado usando `GET /api/health`.
- **`.dockerignore`** — excluye `node_modules/`, `.env`, `*.db`, `data/`, `dev/dbase/`, `.git/`, `docs/`, `tests/`.
- **`scripts/docker-entrypoint.sh`** — primer arranque: si `auth.db` no existe, corre `init-dev.js` (inicializa dev sandbox); luego `exec node server.js`.
- **`.github/workflows/ci.yml`** — nuevo job `docker` que valida `docker build` en cada PR.

Uso:
```bash
cp .env.example .env          # editar NIL_JWT_SECRET
docker compose up             # primer arranque inicializa DBs automáticamente
```

## [2.4.6] — 2026-03-20

### CSP reporting endpoint (T1.7)

- **`src/routes/cspReportRoutes.js`** — `POST /api/security/csp-report`: acepta `application/csp-report` y `application/json`, loguea la violación como `logger.warn` con campos estructurados (`blockedUri`, `violatedDirective`, `effectiveDir`, `documentUri`, `disposition`, `scriptSample`), responde 204.
- **`server.js`** — ruta montada **antes** de `verifyToken` (los browsers envían CSP reports sin cookies). Aplica `publicLimiter` (60/min).
- **`server.js` helmet CSP** — agrega directiva `report-uri /api/security/csp-report`. Los browsers ahora envían automáticamente reportes de violación al servidor.

Log de violación en producción:
```json
{"level":40,"blockedUri":"inline","violatedDirective":"script-src 'self'","effectiveDir":"script-src","documentUri":"http://host/","scriptSample":"fetch(...)","msg":"[CSP] Violation reported"}
```

## [2.4.5] — 2026-03-20

### Rolling sessions y refresh token (T1.3)

- **`src/middleware/verifyToken.js`** — rolling sessions transparentes: si el token tiene menos del 25% de vida restante, se emite un nuevo JWT con expiry completo y se rota la cookie `nil_token`. El cliente no necesita hacer nada. El token viejo expira naturalmente (no se blacklistea, para no romper requests concurrentes).
- **`POST /api/auth/refresh`** — endpoint explícito para forzar rotación. Verifica cookie actual, emite nuevo token, blacklistea el JTI viejo. Útil para clientes que quieren renovar la sesión antes de operaciones críticas.
- Montado en `/api/auth` (antes de `verifyToken`) junto con login/logout/check.

Comportamiento con `NIL_JWT_EXPIRY=8h`:
- Threshold de rolling: 2h restantes (25% de 8h)
- Usuario activo → sesión nunca expira
- Usuario inactivo 6h → próximo request rota cookie; inactivo 8h → sesión expirada, re-login

## [2.4.4] — 2026-03-20

### Structured logging con pino (T1.4)

- **`src/services/logger.js`** — singleton pino. En TTY: pino-pretty (legible). Sin TTY: JSON estructurado a stdout. Nivel configurable con `NIL_LOG_LEVEL` (default `info`).
- **Migración completa de `console.*` → `logger.*`** en todo el backend:
  - `server.js` — startup, CORS warn, HTTPS, fatal crashes
  - `src/middleware/auditLog.js` — logs estructurados `{ usuario, empresa, method, path, status, ms }`
  - `src/middleware/verifyToken.js` — token revocado, token inválido
  - `src/routes/authRoutes.js` — login ok/fail, logout
  - `src/routes/logRoutes.js` — eventos del frontend
  - `src/services/authService.js` — errores de DB en auth
  - `src/services/handlerService.js` — load, path traversal, afterSave/afterDelete errors
  - `src/services/authHandlerService.js` — load de auth handlers
  - `src/controllers/recordController.js`, `catalogController.js`, `handlerController.js`, `filesystemController.js`, `publicReportController.js`, `usersController.js`
- **`.env.example`** — documenta `NIL_LOG_LEVEL` con valores válidos
- **`pino`** agregado a dependencies, **`pino-pretty`** a devDependencies

Ejemplo de log estructurado en producción:
```json
{"level":30,"time":...,"usuario":"superdvlp","msg":"[AUTH] Login ok"}
{"level":30,"time":...,"usuario":1,"empresa":99,"method":"GET","path":"/api/menu","status":200,"ms":15,"msg":"[AUDIT]"}
{"level":40,"time":...,"errorCode":"INVALID_INPUT","usuario":"hacker","msg":"[AUTH] Login failed"}
```

## [2.4.3] — 2026-03-20

### CI/CD básico (T1.1)

- **`.github/workflows/ci.yml`** — pipeline GitHub Actions en cada push/PR a `main`: tres jobs independientes:
  - `Tests` — `npm ci --no-bin-links` + `npm test` (38 tests, Node 22)
  - `Lint` — `npm run lint` (ESLint, exit 0 si solo warnings)
  - `.env.example` — verifica que las 6 claves requeridas estén presentes (`NIL_MENU_FILE`, `NIL_PORT`, `NIL_DB_FILE`, `NIL_AUTH_DB`, `NIL_JWT_SECRET`, `NIL_JWT_EXPIRY`)
- **`eslint.config.mjs`** — configuración flat config ESLint v10:
  - Backend (`src/`, `scripts/`, `server.js`): reglas estrictas (`error`) — 0 errores
  - Frontend (`js/`): `no-undef` como error, resto como `warn` — 27 warnings pre-existentes, no bloquean
  - Tests: reglas estrictas + `allowEmptyCatch: true`
- **`package.json`**: script `lint`, devDependencies `eslint@^10` + `@eslint/js@^10`, versión `2.4.3`
- **Badge CI** en `docs/01-getting-started/README.md`
- **5 fixes de backend** detectados por lint:
  - `authService.js` — `catch (e)` → `catch {}` (variable no usada)
  - `authDatabase.js` — `catch (_)` → `catch {}` (ídem)
  - `menuService.js` — función `intersectPerms` removida (código muerto)
  - `recordController.js` — `keyField` removido del destructuring en handler POST (no se usaba en INSERT)
  - `scripts/check.js` — `let sessionCookie = null` → `let sessionCookie` (asignación inútil)
- **1 fix de frontend** detectado por lint:
  - `js/components/report/index.js` — `export default ReportEngine` removido (`ReportEngine` no estaba en scope)

## [2.4.2] — 2026-03-20

### Rate limiting general (T1.2)

- **`server.js`** — tres niveles de rate limiting con `express-rate-limit`:
  - `publicLimiter` (60 req/min/IP) — `GET /api/auth/check`, `POST /api/auth/logout`, `GET /api/public/report-data`
  - `apiLimiter` (200 req/min/IP) — resto de `/api/*` autenticado (records, catalogs, menu, files, users, log)
  - `handlerLimiter` (30 req/min/IP) — `POST /api/handler/*`, montado antes del apiLimiter general
  - `/api/health` queda excluido — sin rate limit para monitoring externo
  - `/api/auth/login` mantiene su limiter propio (10 req/15min); `publicLimiter` se aplica igual al router de auth
- Respuesta estandarizada en 429: `{ error: { code: 'RATE_LIMITED', message: '...' } }`
- Headers `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` en todas las respuestas (standardHeaders: true)

- **`scripts/attack-demo.js`** — script de demostración y verificación reescrito:
  - Conteo por status HTTP real (429 vs 401 vs 404 son distinguibles — no más falsos positivos)
  - N uniforme por vector (`N=100` para endpoints con límite bajo, `N_API=250` para apiLimiter)
  - Nuevo Vector 4: `POST /api/handler/*/after` — demuestra el handlerLimiter
  - Endpoint correcto para lectura de datos: `/api/catalogs/clientes` (no `/api/records/:table` que requiere keyField+id)
  - Resumen final con tabla de 429s/N por endpoint

---

## [2.4.1] — 2026-03-19

### Dev sandbox autónomo

- **`utils/init-dev.js` self-contained** — ya no requiere `init-auth.js` previo. Crea el schema del auth DB (`empresas`, `usuarios`, `token_blacklist`) con `CREATE TABLE IF NOT EXISTS` si la DB no existe, luego inserta empresa 99 + superdvlp. Idempotente en ambos casos.
- **`scripts/setup.js` simplificado** — reducido de 4 a 3 pasos: `.env` → `npm install` → `init-dev.js`. El paso `init-auth.js` era específico de la app demo (pizzería) y no corresponde al engine.
- **`init-auth.js` removido de nilix** — pertenece a la app de demo, no al motor. `init-dev.js` cubre todo lo necesario para el dev sandbox.

Roadmap post git clone inalterado:
```bash
git clone <repo> && cd nilix
node scripts/setup.js
node server.js
```

---

## [2.4.0] — 2026-03-19

### Dev tooling & production readiness

#### Health endpoint (T0.1)
- `GET /api/health` — endpoint público (antes de verifyToken) que retorna `{ status, version, uptime, db, authDb }`
- 200 si ambas DBs responden; 503 si alguna falla
- Nuevo archivo: `src/routes/healthRoutes.js`

#### CORS restrictivo por defecto (T0.2)
- Sin `NIL_ALLOWED_ORIGIN` → `cors({ origin: false })` — bloquea todos los orígenes externos
- Warning visible al arrancar indicando que CORS está bloqueado
- `.env.example` documenta `NIL_ALLOWED_ORIGIN` como requerido en producción

#### Handler audit + gencf.js hardening (T0.3)
- Nuevo: `docs/02-architecture/HANDLER-AUDIT.md` — inventario de handlers con veredicto de seguridad
- `utils/gencf.js`: template `beforeSave` incluye comentarios de seguridad obligatorios (JSON.parse try/catch, parámetros ? en SQL)
- `authDatabase.js`: fix `setInterval(...).unref()` — el proceso ya no queda vivo esperando el cleanup de token_blacklist

#### Test suite — 38 tests unitarios (T0.4)
- `tests/helpers/db.js` — helpers `setupAppDb()` y `setupAuthDb()` con DBs temporales en /tmp/
- `tests/authService.test.js` — 11 tests: login, JWT payload, bloqueo de cuenta, anti-enumeración
- `tests/scopedDb.test.js` — 12 tests: tenant isolation, find/findAll/insert en tablas tenant y globales
- `tests/recordService.test.js` — 15 tests: CRUD, navigate, tenant isolation
- `package.json`: script `test` apunta a los 3 archivos

#### ndat — nil data utility
- Nuevo: `utils/ndat.js` — bidireccional TSV ↔ SQLite
- `ndat exp <tabla> [--db=<path>]` → TSV con headers a stdout
- `ndat imp <tabla> [--db=<path>]` → TSV con headers desde stdin a SQLite
- Reemplaza y elimina `utils/exp.js`
- TSV siempre incluye headers — simetría garantizada en export/import

#### Dev sandbox (dev/)
- `dev/menu.xml` — menú de desarrollo interno (3 opciones: Clientes, Órdenes, Ítems)
- `dev/form/clientes.xml` — CRUD completo: number, date, checkbox, select con options, text, validaciones
- `dev/form/ordenes.xml` — in-table + copy, cross-field check (fentr >= fecha), select numérico
- `dev/form/items.xml` — tabla global (sin empresa_id), validaciones min
- `dev/data/clientes.dat` — 28 filas (datos reales IdeaFix demo, TSV con headers)
- `dev/data/ordenes.dat` — 7 filas
- `dev/data/items.dat` — 8 filas
- `utils/init-dev.js` — empresa 99 "Dev Sandbox" + usuario `superdvlp/devpass1234` + carga datos via ndat (idempotente en auth DB, clean slate en dev.db)

#### Scripts de desarrollo
- `scripts/setup.js` — onboarding post git clone: .env desde .env.example + JWT secret generado + npm install + init-auth + init-dev
- `scripts/check.js` — validación post-cambio: ENV + 38 tests unitarios + smoke tests HTTP (login, /api/auth/check, /api/menu, /api/catalogs/clientes, /api/catalogs/ordenes)
- `package.json`: scripts `setup` y `check`

#### .env.example
- Apunta al dev sandbox por defecto (`NIL_MENU_FILE=dev/menu.xml`, `NIL_DB_FILE=dev/dbase/dev.db`)
- Comentario explica que son los defaults del dev sandbox y cómo cambiarlos para una app real

### Roadmap post git clone

```bash
git clone <repo> && cd nilix
node scripts/setup.js    # configura .env, instala deps, inicializa DBs
node server.js           # demo en http://localhost:3000
```

Usuario demo dev sandbox: `superdvlp / devpass1234`

---

## [2.3.0] — 2026-03-10

### Rebranding — Nilix

- Proyecto renombrado de "Space Form" a **Nilix**
- Submódulos: nil-form, nil-report, nil-explorer, nil-data, nil-handler, nil-runtime
- Env vars: `SF_*` → `NIL_*` (breaking change — actualizar `.env`)
- Cookie: `sf_token` → `nil_token`
- Cache: `sf_catalog_*` → `nil_catalog_*`

### Breaking changes en v2.3.0

- Variables de entorno: `SF_*` → `NIL_*` — actualizar `.env`
- Cookie de auth: `sf_token` → `nil_token` — limpiar cookies del navegador
- localStorage catálogos: `sf_catalog_*` → `nil_catalog_*` — limpiar localStorage
- Compatibilidad temporal: `NIL_COMPAT_SPACE_FORM=1` en `.env` para dev

---

## [2.2.0] - 2026-03-10 — Dynamic Report Header/Footer

### ✨ Feature

Header y footer de la carta digital se cargan desde `empresa_config` (app DB) por empresa.
Cada empresa ve su propio título, subtítulo, teléfono, dirección y horario.

**Tabla `empresa_config`:** `empresa_id UNIQUE, titulo, subtitulo, telefono, direccion, horario`

**`carta.yaml`:** nuevo dataSource `config: { table: empresa_config }`. Zonas `header` y
`footer` usan `dataSource: config`. Expressions referencian columnas DB crudas (`field: titulo`).

**`ReportRenderer.evaluateExpressions`:** unwrap array → `ctx = context[0] ?? {}`;
usa `ctx` en `result = {...ctx}` Y en `ctx[expr.field]`. (Bug anterior: expression sobreescribía
valor válido del spread con `undefined` porque buscaba en el array, no en el objeto.)

**`server.js`:** `app.use('/reports', static(NIL_APP_DIR/reports))` antes de `static(__dirname)`
→ reportes de la app tienen prioridad sobre los del motor.

**Modificado:** `utils/init-pizzeria.js`, `/opt/wc/pizzeria/reports/carta.yaml`,
`js/components/report/ReportRenderer.js`, `server.js`

---

## [2.1.0] - 2026-03-10 — Public Token IDOR Hardening

### 🔒 Security

Reemplaza `slug` guessable (`?empresa=parrilla`) por `public_token` UUID Base64URL (`?t=TOKEN`).

**Motivación:** slugs son guessables y no escalan (varias parrillas). Con `?t=TOKEN` de 128-bit
entropy, un token alterado devuelve `{ rows: [] }` — imposible bruteforcear.

**`makeToken()`:** `Buffer.from(crypto.randomUUID().replace(/-/g,''),'hex').toString('base64url')`
→ 22 chars URL-safe, sin `+`, `/`, ni `=`. UNIQUE constraint → índice B-tree implícito en SQLite.

**Flujo:** Login → JWT `publicToken` → `/api/auth/check` → `Workspace` URL `?t=TOKEN`
→ `DataSourceManager` fetch `?t=TOKEN` → `resolveEmpresaId(WHERE public_token = ?)`.
Token inválido/ausente → `{ rows: [] }` (no cross-tenant leak).

**Modificado:** `utils/init-auth.js`, `src/services/authService.js`, `src/routes/authRoutes.js`,
`src/controllers/publicReportController.js`, `js/components/report/DataSourceManager.js`,
`report.html`, `js/main.js`, `js/components/Workspace.js`

---

## [2.0.0] - 2026-03-10 — Multi-Tenant: 3 Empresas Demo

### ✨ Feature

3 empresas demo con datos no colisionantes para desarrollo y testing:
- Pizzería Demo (empresa_id=1): usuario `admin`, 5 cat, 50 prod
- La Parrilla del Sur (empresa_id=2): usuario `parrilla`, 5 cat, 34 prod
- Heladería Frío & Arte (empresa_id=3): usuario `helado`, 6 cat, 39 prod

IDs de categorías no colisionantes: Pizzería 1-5, Parrilla 11-15, Heladería 21-26.
Contraseña compartida demo: `demo1234`.

**Modificado:** `utils/init-auth.js`, `utils/init-pizzeria.js`

---

## [1.9.0] - 2026-03-09 — Mobile UX POS Responsive

### ✨ Feature

#### Cards en multifield + stack de inputs + sticky bottom (mobile ≤650px)

**Motivación:** En viewport móvil el carrito del POS mostraba una tabla con scroll horizontal
inusable. Los selectors de Categoría/Producto aparecían lado a lado. El botón ENVIAR/total
desaparecía al scrollear.

**CSS — `css/styles.css`:**
- **Stack:** `.horizontal-container` reemplaza `.border-box .horizontal-container` — ahora
  todos los containers horizontales colapsan a columna en móvil, no solo los dentro de border-box.
  Cubre los selectors del POS que están fuera de border-box.
- **Cards multifield:** thead oculto; `tr[data-empty="true"]` oculto; tabla → bloque;
  filas → cards con `border: 2px solid`; `td` como fila flex; `td::before { content: attr(data-label);
  flex: 0 0 33% }` — labels en columna de 1/3 de ancho, inputs en 2/3 con `flex: 1`;
  celda acción sin label, alineada a la derecha.
- **Sticky bottom:** `.actions-nav { position: sticky; bottom: 0; z-index: 50; background }` —
  ENVIAR y total siempre visibles mientras el cajero scrollea el carrito.

**JS — `js/components/fieldRenderer/Multifield.js`:**
- `_getColumns`: agrega `label: th.textContent.trim()` al objeto de columna
- `_buildRow`: `td.dataset.label = col.label` en cada celda de datos; `row.dataset.empty = 'true'`
  en filas filler (sin `rowData`); `actionTd.dataset.label = ''` en celda de acción

**Bugfix — Stepper en card (`|▼|   01   |▲|`):**

`button { width: 100% }` del breakpoint mobile se propaga a los botones ▼/▲ del stepper.
Como son flex items, `width: 100%` equivale a `flex-basis: 100%` → cada botón intenta
ocupar todo el wrapper → el input queda aplastado.

Fix en `@media (max-width: 650px)`:
- `.stepper-wrapper { flex: 1; display: flex }` — wrapper rellena el 67% restante del card
- `.stepper-btn { width: auto; padding: 0; min-width: 1.5rem }` — cancela `width: 100%`, tamaño compacto
- `.stepper-input { flex: 1 }` — número se expande entre ▼ y ▲
- `border-left/right` del input conservados como separadores visuales `|▼|…|▲|`

**Modificado:** `css/styles.css`, `js/components/fieldRenderer/Multifield.js`

---

## [1.8.0] - 2026-03-06 — POS Punto de Venta

### ✨ Feature

#### Form POS completo + engine extension `appendRow`

**Archivos nuevos:**
- `/opt/wc/pizzeria/form/pos.xml` — form: selector categoría/producto + carrito (multifield) +
  total virtual (`is="sum(subtotal)"`) + forma de pago/tipo pedido/mesa/nota
- `/opt/wc/pizzeria/apps/venta_handler.js` — `after('id_producto')` → `{ appendRow: { field, row } }`;
  `beforeSave` → insert `ventas` + `detalle_ventas` (bypass CRUD estándar)
- `utils/init-pizzeria.js` — tablas `ventas` (cabecera) + `detalle_ventas` (líneas) con `empresa_id`

**Engine — `appendRow` (extensión al motor):**
- `ValidationCoordinator.js`: si `result.appendRow` → llama `Multifield.appendRow(field, row, formEl)`
- `Multifield.appendRow(fieldId, rowData, formEl)` estático: push a `allRows` en dataset + `_rerenderGrid`
- Sin reemplazo del carrito — agrega UNA fila al multifield existente

**Flujo:** Seleccionar producto → `after()` → `appendRow` → fila aparece en carrito →
cambiar cantidad → `subtotal` se recalcula (is=) → `TOTAL` se actualiza (`sum(subtotal)`) →
COBRAR → `beforeSave` → insert DB

**Modificado:** `js/components/fieldRenderer/Multifield.js`,
`js/components/form/ValidationCoordinator.js`, `utils/init-pizzeria.js`

---

## [1.7.0] - 2026-03-06 — Stepper visual fix

### ✨ Feature

#### Stepper `[▼ 001 ▲]` — borde único, zero-pad, max implícito por `size`

**Problema:** `.multifield-cell-input` aplicaba `border: 1px solid` al `.stepper-input`,
resultando en borde doble `[▼| [1] |▲]|` en lugar del grupo unificado `[▼ 001 ▲]`.

**CSS — `css/styles.css`:**
- `.stepper-wrapper .stepper-input` con mayor especificidad que `.multifield-cell-input`:
  `border: none !important`; solo `border-left/right` como separadores internos;
  `width: auto` — ancho controlado por JS

**JS — `js/components/fieldRenderer/Multifield.js`:**
- `renderGridFromMultifield`: guarda `data-size` en `<th>` desde atributo XML `size`
- `_getColumns`: lee `col.size = parseInt(th.getAttribute('data-size')) || null`
- `_buildStepperCell`: `size = col.size || 3`; ancho `(size+0.5)ch`; max implícito `10^size - 1`;
  zero-pad `String(n).padStart(size, '0')`; ▼ no baja de 0; ▲ no sube del max

**Resultado visual:** `[▼ 001 ▲]` — borde exterior del wrapper, separadores internos border-left/right.

**Modificado:** `css/styles.css`, `js/components/fieldRenderer/Multifield.js`

---

## [1.6.0] - 2026-03-05 — RADU Server-side Enforcement (SEC-008)

### 🔒 Security

#### RADU permissions enforced on the server (recordController)

**Motivación:** Hasta v1.5.0 RADU solo ocultaba botones en el cliente. Un atacante con
JWT válido podía hacer `DELETE /api/records/tabla/1` aunque `permissions="R"` en el menú.

**Implementación:**
- `src/utils/radu.js` (nuevo) — port CommonJS de `js/utils/RADU.js`
- `src/services/menuService.js`: Map `tablePermissions` poblado al parsear cada `<option type="form">`;
  lee el atributo `database` del XML del form y asocia su permString. Unión si múltiples forms
  apuntan a la misma tabla. `getTablePermissions(table)` exportado.
- `src/controllers/recordController.js`: helper `assertOperationAllowed(table, op, res)` —
  consulta `getTablePermissions`, evalúa RADU, retorna 403 `RADU_FORBIDDEN` si denegado.
  Llamado en `createRecord` (canAdd), `updateRecord` (canUpdate), `deleteRecord` (canDelete),
  `upsertRecord` (canAdd || canUpdate inline).
- Tablas sin form en el menú: sin cambio — `assertTableAllowed` sigue siendo el guard.

---

## [1.5.0] - 2026-03-05 — JWT HttpOnly Cookie (Seg-5)

### 🔒 Security

#### JWT migrado de localStorage a HttpOnly cookie

**Motivación:** El token JWT en `localStorage` es accesible a cualquier script JS en la
página (XSS). Con HttpOnly cookie el token es completamente inaccesible a JavaScript;
el browser lo envía automáticamente en cada request same-origin.

**Backend:**
- `npm install cookie-parser` (+ `--no-bin-links`)
- `server.js`: `app.use(cookieParser())` antes de las rutas
- `authRoutes.js`: POST /login → `res.cookie('sf_token', ..., { httpOnly: true, sameSite: 'Lax', secure: <si TLS> })` → body `{ ok: true }` (sin token)
- `authRoutes.js`: POST /logout → lee `req.cookies.sf_token`, blacklist jti, `res.clearCookie('sf_token')`
- `authRoutes.js`: GET /check (nuevo) → verifica cookie sin pasar por verifyToken → `{ ok, usuario, rol }`
- `verifyToken.js`: reemplaza lectura de `Authorization: Bearer` por `req.cookies?.sf_token`

**Frontend:**
- `client.js`: eliminado `getToken()` y header `Authorization`; `authFetch()` usa cookie automática; `logout()` simplificado
- `SubmitManager.js`: eliminado `localStorage.setItem('sf_token', json.token)`
- `main.js`: auth guard usa `fetch('/api/auth/check')` en lugar de `localStorage.getItem('sf_token')`; limpieza de migración `localStorage.removeItem('sf_token')`
- `login.html`: skip-if-logged usa `/api/auth/check`; limpieza de migración

| Amenaza | Antes | Después |
|---------|-------|---------|
| XSS lee token | ❌ localStorage accesible a JS | ✅ HttpOnly — JS no puede leerlo |
| CSRF | N/A (header manual) | ✅ Mitigado por SameSite: Lax |
| Logout real | ✅ jti blacklist | ✅ jti blacklist + clearCookie |

**Modificado:** `server.js`, `src/routes/authRoutes.js`, `src/middleware/verifyToken.js`,
`js/api/client.js`, `js/components/form/SubmitManager.js`, `js/main.js`, `login.html`

---

## [1.4.2] - 2026-03-05 — Bugfix: nav categorías en blanco en móvil

### 🐛 Bugfix

#### #1 — Categoría seleccionada quedaba en blanco en mobile (dark mode)

**Causa raíz:** La regla CSS suelta `.report-nav-item:hover, :focus, :active` usaba
`background: var(--help-icon-color)` y `color: var(--bg-color)`. La variable
`--help-icon-color` **nunca está definida** en el proyecto → el browser la resuelve
como valor inválido → `background` cae a `transparent` y `color` toma `var(--bg-color)`
(`#000000` en dark mode). Resultado: texto negro sobre fondo negro = invisible.

En mobile el problema se manifiesta porque `:active` se activa al tocar y `:focus`
persiste después del tap (el browser mantiene foco en el anchor), aplicando
indefinidamente los colores rotos.

Adicionalmente no existía estado `.active` persistente — al cambiar de categoría el
item anterior simplemente perdía el pseudo-estado y no quedaba ningún indicador visual.

**Fix CSS** (`css/styles.css`):
- Eliminada la regla suelta que usaba `--help-icon-color`
- Los estados `:hover`, `:focus`, `:active` y `.active` unificados dentro del bloque
  `.report-nav-item { }` usando `var(--text-color)` / `var(--bg-color)` (variables
  definidas)
- Dark mode explícito: `background: #ffffff; color: #000000`
- `outline: none` para evitar anillo de foco del browser superpuesto al estilo invertido

**Fix JS** (`js/components/report/ReportRenderer.js`):
- Primera categoría arranca con clase `.active` al renderizar el nav
- Click handler por item: quita `.active` de todos, lo asigna al clickeado
- Estado persistente — no desaparece al soltar el touch en mobile

**Resultado:** Light mode → item activo: fondo negro, texto blanco. Dark mode →
fondo blanco, texto negro. Contraste máximo en ambos temas.

**Modificado:** `css/styles.css`, `js/components/report/ReportRenderer.js`

---

## [1.4.1] - 2026-03-03 — CSP fixes: DuckDB WASM + datasource encoding

### 🔒 Security / Bugfix

#### #1 — CSP incompleta bloqueaba DuckDB-WASM

Tras activar helmet con CSP en v1.3.0, el reporte con DuckDB fallaba silenciosamente:

- **`worker-src` ausente** → el browser caía al fallback `script-src`, que no incluía `blob:`. DuckDB crea un blob URL para su worker → bloqueado.
- **`connect-src 'self'`** → fetch de archivos `.wasm` y bundles desde `cdn.jsdelivr.net` y `esm.sh` → bloqueado.
- **`wasm-unsafe-eval` ausente** → compilación de módulos WebAssembly bloqueada en algunos contextos.

**Fix en `server.js`:**
```
scriptSrc:  + 'wasm-unsafe-eval'
connectSrc: + https://cdn.jsdelivr.net, https://esm.sh
workerSrc:  ["'self'", "blob:"]   ← nuevo
```

#### #2 — `originAgentCluster: false` explícito

Helmet enviaba el header `Origin-Agent-Cluster` por defecto. Aunque inofensivo en HTTP, genera warnings repetitivos en browser. Deshabilitado explícitamente.

**Modificado:** `server.js`

#### #3 — `encodeURIComponent(tableName)` en DataSourceManager

Si el nombre de un datasource o tabla contenía `#`, el browser lo interpretaba como fragmento URL y lo cortaba antes de enviarlo al servidor → request incompleto → 401/404.

**Fix:** `encodeURIComponent(tableName)` en `DataSourceManager.fetchTable()` (ruta pública).
Express decodifica `req.params.table` automáticamente, sin cambios en backend.

**Modificado:** `js/components/report/DataSourceManager.js`

---

## [1.4.0] - 2026-03-03 — Sprint Seg-4: Advanced (parcial)

### 🔒 Security

#### #3 — Path traversal en handler names (SEC-004)

`handlerService.getHandlerPath()` usaba `handlerName` directamente en `path.join()` sin validación.
Un atacante podía enviar `handler=../../etc/passwd` para intentar cargar archivos arbitrarios del sistema.

**Fix:** Validación con regex `^[a-zA-Z0-9_-]+$` antes de construir cualquier path. Si no pasa, retorna `null` (handler no encontrado) y loguea el intento.

**Diferidos a futura iteración:**
- #1 JWT a HttpOnly cookie — refactor arquitectural (afecta main.js, client.js, login.html, SubmitManager.js, verifyToken.js)
- #2 CSP report-only — ya implementado como CSP enforcement en Seg-3
- #4 WAF (modsecurity/nginx) — infraestructura, fuera del scope del código
- #5 HSTS — disponible cuando se configure HTTPS (NIL_TLS_CERT/NIL_TLS_KEY)

**Modificado:** `src/services/handlerService.js`

---

## [1.3.0] - 2026-03-03 — Sprint Seg-3: Hardening

### 🔒 Security

#### #1 — XSS en SubmissionsViewer (SEC-008)

`createSubmissionItem()` inyectaba valores de la DB directamente en `innerHTML`.
Si un campo contenía `<script>` o `<img onerror=...>`, se ejecutaría.

**Fix:** `header` construido con `createElement` + `textContent`; datos renderizados con `createTextNode`. Sin DOMPurify — no se necesita librería externa cuando se puede evitar `innerHTML`.

**Modificado:** `js/components/SubmissionsViewer.js`

---

#### #2 — Content Security Policy (SEC-008)

`helmet` ya estaba instalado (Seg-1) con CSP deshabilitado. Ahora configurado:
- `default-src 'self'` — solo recursos del mismo origen
- `script-src 'self' 'unsafe-inline'` — inline scripts en report.html/login.html (pendiente extracción en Seg-4)
- `style-src 'self' 'unsafe-inline'` — inline styles
- `img-src 'self' data: https://api.qrserver.com` — QR codes
- `frame-ancestors 'none'` — previene clickjacking (complementa X-Frame-Options)
- `form-action 'self'` — formularios solo apuntan al mismo origen

**Modificado:** `server.js`

---

#### #3 — HTTPS opcional vía variables de entorno

Si `NIL_TLS_CERT` y `NIL_TLS_KEY` están definidos en `.env`, el servidor arranca con HTTPS (TLS 1.2+). Si no, HTTP como antes. El endpoint `/api/server-info` devuelve el protocolo correcto para el QR.

Para generar certificado auto-firmado (red local):
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```
Luego en `.env`:
```
NIL_TLS_CERT=/ruta/a/cert.pem
NIL_TLS_KEY=/ruta/a/key.pem
```

**Modificado:** `server.js`, `.env`

---

#### #4 — Logout real + token blacklist (SEC-010)

Antes, "cerrar sesión" solo borraba el token del localStorage — el JWT seguía válido.
Ahora los tokens revocados quedan inutilizables hasta su expiración natural.

**Implementación:**
- `token_blacklist(jti, expires_at)` — tabla en `auth.db` (creada automáticamente en `initAuthDatabase`)
- JWT firmado con `jti` único (`crypto.randomUUID()`) en cada login
- `verifyToken.js` — verifica `isBlacklisted(jti)` antes de autorizar
- `POST /api/auth/logout` — verifica el token, agrega `jti` a la blacklist
- `authDatabase.js` — prune de tokens expirados en cada startup
- `client.js` — `logout()`: llama `/api/auth/logout` + limpia localStorage + redirige

**Modificado:** `src/services/authService.js`, `src/services/authDatabase.js`, `src/middleware/verifyToken.js`, `src/routes/authRoutes.js`, `js/api/client.js`

---

#### #5 — Audit logging middleware (SEC-011)

`src/middleware/auditLog.js` — loguea todas las operaciones de escritura (POST/PUT/DELETE) y errores (4xx/5xx) de requests autenticados:
```
[AUDIT] INFO | 2026-03-03T12:00:00Z | u=1 emp=1 | POST /api/records/demo_productos → 200 (45ms)
```
GET exitosos (200) no se loguean para no saturar los logs.
Montado después de `verifyToken` — tiene acceso a `req.usuarioId` y `req.empresaId`.

**Modificado:** `src/middleware/auditLog.js` (nuevo), `server.js`

---

## [1.2.0] - 2026-03-03 — Sprint Seg-2: Input Validation

### 🔒 Security

#### #1 — XXE: strip DOCTYPE antes de parsear XML (SEC-002)

`menuService.js` parseaba `SF_MENU_FILE` con `@xmldom/xmldom` sin sanear el XML.
Un archivo XML con `<!DOCTYPE ... SYSTEM "file:///etc/passwd">` podría exfiltrar archivos locales.

**Fix:** Strip de declaraciones `<!DOCTYPE ...>` con regex antes de pasar el contenido al parser.

**Modificado:** `src/services/menuService.js`

---

#### #2 — SQL injection via column names (SEC-003 parcial)

`keyField` y otros nombres de columna se interpolaban directamente en SQL sin validación.
Un atacante podía enviar `keyField="; DROP TABLE demo_productos; --"` en el body/query.

**Fix:** nueva función `isColumnAllowed(tableName, columnName)` en `schemaService.js`:
- Valida formato con regex `[a-zA-Z_][a-zA-Z0-9_]*`
- Verifica que la columna exista en el schema real de la tabla
- Lanza `COLUMN_FORBIDDEN` (403) si no pasa

Aplicado en:
- `recordService.js` — `findById`, `update`, `remove`, `navigate`
- `catalogService.js` — `findByKey`
- `recordController.js` — maneja `COLUMN_FORBIDDEN` → 403

**Modificado:** `src/services/schemaService.js`, `src/services/recordService.js`, `src/services/catalogService.js`, `src/controllers/recordController.js`

---

#### #3 — Path traversal (SEC-004) — ya mitigado

`filesystemController.getContent` ya validaba con `menuService.isAuthorizedPath(resolved)`.
`getTree` y `getReports` usan paths hardcodeados. **No requirió cambios.**

---

#### #4 — RADU server-side (SEC-008) — diferido a Seg-3

Requiere arquitectura: mapear tabla → permisos por rol sin confiar en el cliente.
Los permisos RADU son por form, no por tabla. Pendiente diseño en Sprint Seg-3.

---

#### #5 — Whitelist de tablas centralizada en schemaService (SEC-003 parcial)

La validación `isTableAllowed` (regex + blacklist sqlite_*) se movió de `recordController`
a `schemaService.js` como función reutilizable. Se aplicó también en `catalogController`
(rutas `GET /api/catalogs/:table` y `GET /api/catalogs/:table/:keyField/:value`).

**Modificado:** `src/services/schemaService.js` — exporta `isTableAllowed`, `isColumnAllowed`; `src/controllers/catalogController.js` — agrega `assertTableAllowed` en `getTable` y `validateKey`; `src/controllers/recordController.js` — usa `schemaService.isTableAllowed` en lugar de lógica inline

---

## [1.1.0] - 2026-03-03 — Sprint Seg-1: Security Critical

### 🔒 Security

#### #1 — Dependencia vulnerable actualizada (`qs`)

`qs 6.7.0` tenía un bypass de `arrayLimit` en comma parsing (DoS). Actualizado vía `npm audit fix`.

**Mitigado:** DEP-001

---

#### #2 — `X-Powered-By` ocultado

`app.disable('x-powered-by')` — evita revelar que el backend corre sobre Express/Node.

**Mitigado:** SEC-009

---

#### #3 — Headers de seguridad con `helmet`

`helmet({ contentSecurityPolicy: false })` agrega automáticamente:
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`.
CSP postergado a Sprint Seg-3 (requiere configuración de fuentes permitidas).

**Mitigado:** SEC-005

**Instalado:** `helmet`

---

#### #4 — CORS configurable vía `NIL_ALLOWED_ORIGIN`

Si `NIL_ALLOWED_ORIGIN` está definido en `.env`, CORS solo acepta ese origen.
Si no está definido (dev/local), mantiene comportamiento permisivo actual.

**Mitigado:** SEC-007

**Modificado:** `server.js`, `.env` (variable documentada como comentario)

---

#### #5 — Rate limiting en `/api/auth/login`

`express-rate-limit`: máx 10 intentos por IP cada 15 minutos.
Responde `429` con mensaje en español. Headers `RateLimit-*` incluidos.

**Mitigado:** SEC-006

**Instalado:** `express-rate-limit`

**Modificado:** `src/routes/authRoutes.js`

---

#### #6 — JWT secret reemplazado por valor seguro

`NIL_JWT_SECRET` en `.env` era un placeholder literal (`cambiar-este-secreto-en-produccion`).
Reemplazado por 32 bytes aleatorios (256 bits) generados con `crypto.randomBytes`.

**Mitigado:** SEC-001

**Modificado:** `.env`

---

#### #7 — Validación de nombre de tabla en Records API

Todas las funciones de `recordController.js` validan el parámetro `:table` antes de operar:
- Formato: solo `[a-zA-Z_][a-zA-Z0-9_]*` (sin caracteres especiales, previene inyección vía nombre de tabla)
- Blacklist explícita: `sqlite_master`, `sqlite_sequence`, `sqlite_stat1` (tablas internas de SQLite)
- Responde `403 TABLE_FORBIDDEN` si no pasa la validación

**Mitigado:** SEC-003 (parcial)

**Modificado:** `src/controllers/recordController.js` — `assertTableAllowed()` aplicado en `getRecord`, `createRecord`, `upsertRecord`, `updateRecord`, `deleteRecord`, `navigateRecord`

---

## [1.0.5] - 2026-03-03

### ✨ Added (Agregado)

#### QR code para reportes públicos

Al seleccionar un reporte YAML en el explorador, el panel ahora muestra un código QR
que apunta a la URL pública del reporte con la IP real de red del servidor (no `localhost`),
para que cualquier dispositivo en la misma red pueda escanearlo y acceder directamente.

**Implementación:**
- `GET /api/server-info` (público, sin token) — detecta la IP local del servidor via
  `os.networkInterfaces()` y devuelve `{ host: "http://192.168.x.x:PORT" }`.
- `Workspace.showYamlInfo()` — llama `/api/server-info` antes de armar la URL del reporte;
  usa esa IP como base para el QR. Si falla, usa `window.location.origin` como fallback.
- QR generado via `api.qrserver.com` (servicio gratuito, sin cuenta, sin expiración —
  el QR es estático: codifica la URL directamente, sin short links ni redirecciones).
- Botón `[ DESCARGAR QR ]` — fetch + blob → descarga `qr-{nombre}.png` localmente.

**Modificado:**
- `server.js` — endpoint `GET /api/server-info` montado antes de `verifyToken`
- `js/components/Workspace.js` — `showYamlInfo()` ahora es `async`; agrega QR + botón descarga
- `css/styles.css` — `.qr-container`, `.qr-image`, `.qr-download-btn`

---

### 🐛 Fixed (Corregido)

#### Mobile — checkbox sin tilde (appearance: none)

La regla global `input, textarea, select { appearance: none }` eliminaba el tilde nativo del
checkbox. El `accent-color` no es suficiente sin `appearance: auto`.

**Fix:** Se agrega `appearance: auto` (con prefijos webkit/moz) en `.checkbox-wrapper input[type="checkbox"]`,
que tiene mayor especificidad `(0,2,1)` y sobreescribe el reset global.

**Modificado:**
- `css/styles.css` — `.checkbox-wrapper input[type="checkbox"]`: agrega `-webkit-appearance: auto; -moz-appearance: auto; appearance: auto`

---

#### Mobile — checkbox y label desalineados

En mobile, `.checkbox-wrapper` tenía `align-items: flex-start` con `margin-top: 3px` como
compensación manual en el checkbox. Resultaba en desalineación con etiquetas de una sola línea.

**Fix:** Se vuelve a `align-items: center` (igual que desktop) y se elimina el `margin-top: 3px`.

**Modificado:**
- `css/styles.css` — `@media (max-width: 650px) .checkbox-wrapper`: `align-items: center`; eliminado `margin-top: 3px` del checkbox

---

#### Mobile — checkbox ocupa ancho completo, label queda fuera

En mobile, dos reglas con `!important` aplicaban `width: 100%` a todos los inputs incluyendo
checkboxes, sobreescribiendo el `width: 20px` del `.checkbox-wrapper input[type="checkbox"]`.

**Fix:** Se agrega `:not([type="checkbox"])` a ambas reglas del bloque `@media (max-width: 650px)`.

**Modificado:**
- `css/styles.css` — `.border-box input` → `.border-box input:not([type="checkbox"])`
- `css/styles.css` — `.field-row input` → `.field-row input:not([type="checkbox"])`

---

#### Panel de reporte — título muestra ruta absoluta completa

El `window-title` del panel de reporte mostraba la ruta completa del archivo
(`/opt/wc/pizzeria/reports/carta.yaml`), desbordando el ancho del header.

**Fix:** Se usa solo el nombre del archivo sin extensión (`carta`), ya extraído en `fileName`.

**Modificado:**
- `js/components/Workspace.js` — `showYamlInfo()`: `${fullPath}` → `${fileName}`

---

#### Multifield — fila eliminada (X) no se persistía en DB (v1.0.4)

Al presionar **X** en una fila del multifield y guardar el formulario, el registro solo
desaparecía de la UI pero seguía existiendo en la DB. Al recargar, volvía a aparecer.

**Causa:** `_deleteRow()` solo eliminaba la fila de `allRows` (estado en memoria), sin
notificar al submit qué filas habían sido borradas.

**Fix (frontend):** Se agrega un `<input type="hidden" name="${id}_deleted" value="[]">` dentro
del `multifield-grid`. Al eliminar una fila con datos, `_deleteRow()` agrega el objeto de la
fila al JSON del hidden input. `new FormData(formEl)` lo recoge automáticamente al enviar.

**Fix (handler):** Los handlers pueden leer `data.${multifieldId}_deleted` (array JSON de
objetos de filas eliminadas) y ejecutar los DELETE correspondientes antes de procesar el resto.

**Patrón establecido:** si `beforeSave()` retorna `null`, el controller omite el CRUD estándar
y devuelve `200 { updated: true }`. Permite que handlers tomen control total del guardado
(batch updates, deletes, lógica compleja).

**Modificado:**
- `js/components/fieldRenderer/Multifield.js` — `renderMultifield()`: agrega hidden input `${id}_deleted`; `_deleteRow()`: persiste fila eliminada en el hidden input antes del splice
- `src/controllers/recordController.js` — `createRecord()`, `upsertRecord()`, `updateRecord()`: check `transformedData === null` → skip CRUD estándar, retorna `200 { updated: true }`
- `apps/precios_handler.js` (pizzeria demo): `beforeSave` procesa `productos_deleted` (DELETE por id) y actualiza `precio_actual` de los restantes; retorna `null`

---

#### Multifield — inputs `type="number"` rechazan decimales (v1.0.3)

Mismo bug que v1.0.2 pero en columnas de multifield. `_buildRow()` asignaba `input.type = 'number'`
sin `step`, por lo que heredaba `step="1"` de HTML5 y rechazaba valores como `1.5`.

**Fix:** `if (col.type === 'number') input.step = 'any';` en `_buildRow()`.

**Modificado:**
- `js/components/fieldRenderer/Multifield.js` — `_buildRow()`: agrega `step="any"` para columnas `type="number"`

---

#### Number field — rechaza valores decimales (v1.0.2)

`<input type="number">` tiene `step="1"` por defecto en HTML5, lo que hace que el navegador
rechace valores con decimales como `1.5` tanto al tipear como al enviar el formulario.

**Fix:** Se agrega `inputEl.step = 'any'` al crear inputs de tipo `number`, permitiendo
cualquier valor decimal. Para restringir a enteros, usar `<pattern>^\d+$</pattern>` en el XML.

**Modificado:**
- `js/components/fieldRenderer/InputField.js` — `createInputElement()`: agrega `if (type === 'number') inputEl.step = 'any';`

---

#### Autocomplete — dropdown muestra solo item seleccionado al reabrir (v1.0.1)

Al abrir el dropdown sobre un campo con valor ya seleccionado, `openDropdown()` llamaba
`renderOptions(inputEl.value)` filtrando por el valor actual. Resultado: solo aparecía el
item seleccionado, no la lista completa.

**Fix:** `openDropdown()` llama `renderOptions('')` — lista completa al abrir. El filtrado
al tipear (`input` event → `renderOptions(inputEl.value)`) no fue modificado.

**Modificado:**
- `js/components/fieldRenderer/Autocomplete.js` — `openDropdown()`: `renderOptions(inputEl.value)` → `renderOptions('')`

---

## [1.0.0] - 2026-03-02

**Primer release funcional de Space Form.**

Motor de formularios web basado en XML: definición de formularios en XML, persistencia
en SQLite multi-tenant, handler system, report engine dual (DuckDB-WASM / SQLite), autenticación
JWT, menú externo, RADU, Zona de Claves con navegación PAG_SIG/PAG_ANT, Multifield CRUD,
Campos Virtuales e Inline Validators.

**Stack:** Node.js + Express · sql.js · DuckDB-WASM · Vanilla JS ES Modules · The Monospace Web

**Cobertura FDL:** ~95% · **Cobertura RDL:** ~45-50%

**Nota de seguridad:** Este release es funcional pero **no apto para producción** sin aplicar
primero Sprint Seg-1 (v1.1.0): JWT secret ≥256 bits, helmet, rate limiting, CORS restrictivo.

---

### 🔒 Security (Seguridad) - 2026-03-02

#### Plan de Auditoría de Seguridad OWASP WSTG - Documentación

Documento completo de auditoría de seguridad basado en OWASP Web Security Testing Guide (WSTG) v4.2, adaptado para la arquitectura de 3 capas de Space Form (Vanilla JS Frontend + Express API + SQLite Multi-tenant).

**Superficie de ataque documentada:**
- 12 vulnerabilidades potenciales identificadas (SEC-001 a SEC-012)
- 10 fases de auditoría según OWASP WSTG
- 4 sprints de remediación priorizados

**Vulnerabilidades críticas identificadas:**
| ID | Vulnerabilidad | Severidad | Ubicación |
|----|----------------|-----------|-----------|
| SEC-001 | JWT Secret débil en .env | Crítico | `.env` |
| SEC-002 | XXE en parsing XML | Alto | `XmlParser.js` |
| SEC-003 | SQL Injection en escape hatches | Alto | `scopedDb.js` |
| SEC-004 | Path traversal en file serving | Alto | `filesystemController.js` |

**Archivos afectados en análisis:**
- [`plans/SECURITY-AUDIT-PLAN.md`](../plans/SECURITY-AUDIT-PLAN.md) - **NUEVO**
- [`server.js`](../../server.js) - Headers, CORS, Helmet
- [`src/middleware/verifyToken.js`](../../src/middleware/verifyToken.js) - JWT validation
- [`src/services/scopedDb.js`](../../src/services/scopedDb.js) - SQL injection prevention
- [`src/services/authService.js`](../../src/services/authService.js) - Authentication
- [`src/controllers/filesystemController.js`](../../src/controllers/filesystemController.js) - Path traversal
- [`js/components/form/LayoutProcessor.js`](../../js/components/form/LayoutProcessor.js) - XSS
- [`js/components/xmlParser/XmlParser.js`](../../js/components/xmlParser/XmlParser.js) - XXE

**Próximos pasos (Post-v1.0):**
- Sprint Seguridad 1 (v1.1.0): Fixes críticos (JWT secret, helmet, rate limiting) — **Bloqueante para producción**
- Sprint Seguridad 2 (v1.2.0): XXE, SQLi, path traversal hardening
- Sprint Seguridad 3 (v1.3.0): CSP, HTTPS, token blacklist
- Sprint Seguridad 4 (v1.4.0): HttpOnly cookies, WAF

---

### ✅ Added (Agregado) - 2026-03-02

#### Sprint 21 — Inline Validators (v0.34.0)

Validaciones inline declaradas directamente en el XML del campo: `<min>`, `<max>`, `<pattern>`,
`<message>`. Evitan JS custom para rangos numéricos y formatos de texto. El elemento `<message>`
aplica como mensaje personalizado para `<check>` y `<pattern>`.

**Modificados:**
- `js/utils/validator.js` — `validateField()` procesa los nuevos nodos:
  - `<min>` / `<max>`: `parseFloat(value)` vs umbral; mensaje por defecto si no hay `<message>`
  - `<pattern>`: `new RegExp(pattern).test(value)`; soporte para CUIT, códigos, etc.
  - `<message>`: mensaje personalizado compartido por `<pattern>` y `<check>`

**Ejemplo XML:**
```xml
<field id="cuit" type="text">
    <validation>
        <pattern>^\d{2}-\d{8}-\d{1}$</pattern>
        <message>CUIT inválido (formato: XX-XXXXXXXX-X)</message>
    </validation>
</field>
<field id="descuento" type="number">
    <validation>
        <min>0</min>
        <max>100</max>
    </validation>
</field>
```

---

#### Sprint 20 — Campos Virtuales (v0.33.0)

Atributo `is=` en campos XML para cómputo automático de valores derivados. Soporta expresiones
aritméticas inter-campo (`precio * cantidad`) y funciones de agregado sobre multifields
(`sum(importe)`, `avg(precio)`, `count(id)`, `min(valor)`, `max(valor)`). El campo se marca
`readOnly` y recalcula en tiempo real.

**Modificados:**
- `js/utils/ExpressionEngine.js` — nuevos métodos estáticos:
  - `isAggregateExpression(expr)` — detecta patrón `fn(col)`
  - `evaluateAggregate(fn, colId, formEl)` — suma/promedio/conteo sobre inputs `*_colId_*`
  - `evaluateValue(expr, formEl)` — dispatcher: agregado o aritmética con contexto de form
  - `getValueDependencies(expr)` — retorna `[{type:'field'|'aggregate', fieldId?, colId?}]`
- `js/components/form/LayoutProcessor.js` — importa `ExpressionEngine`; `extractFieldConfig()` extrae `isExpression`; nuevo método `setupIsExpression(el, expr)`:
  - Marca campo como `readOnly` + clase `computed-field`
  - Escucha `change`/`input` en campos dependientes
  - Para agregados: delegación en form + `multifield-populated` custom event
  - Cálculo inicial tras render
- `css/styles.css` — clase `.computed-field`: `font-style: italic`, fondo tenue

**Ejemplo XML:**
```xml
<field id="subtotal" label="SUBTOTAL" is="precio * cantidad" type="number" skip="true"/>
<field id="total_kg" label="TOTAL KG" is="sum(peso)" type="number" skip="true"/>
```

**Evento `multifield-populated`:**
Disparado por `populateRows()` en Multifield.js vía `gridContainer.dispatchEvent(...)`.
Permite que campos virtuales de tipo agregado recalculen al cargar datos del handler.

---

#### Sprint 19 — Multifield CRUD (v0.32.0)

Grids de multifield ahora soportan agregar y eliminar filas. Botón `+ AGR` en la barra de
controles agrega una fila vacía al final. Cada fila tiene botón `✕` para eliminación. Columnas
marcadas `unique="true"` validan duplicados en tiempo real al cambiar. En modo solo-lectura
(RADU !canWrite()), los botones AGR y ✕ se ocultan automáticamente.

**Modificados:**
- `js/components/fieldRenderer/Multifield.js` — refactorización completa del módulo grid:
  - `_getColumns(thead)` — lee metadatos desde `<th>` (`data-field-id`, `data-skip`, `data-unique`, `data-type`)
  - `_buildRow(multifieldId, columns, rowData, absoluteIndex)` — genera TR con inputs + botón ✕
  - `_rerenderGrid(gridContainer)` — re-renderiza tbody + controles; dispara `multifield-populated`
  - `_setupChangeTracking(gridContainer)` — event delegation en gridContainer (una sola vez): sync allRows + validación unique
  - `_updateControls(gridContainer, controls, ...)` — actualiza prev/next/pageInfo
  - `_addRow(gridContainer)` — append `{}` a allRows, navega a última página
  - `_deleteRow(gridContainer, absoluteIndex)` — splice, ajusta página, re-renderiza
  - `renderGridFromMultifield()`: `<th>` almacena `data-unique` y `data-type`; botón `+ AGR` en controles; `_setupChangeTracking()` al crear
  - `populateRows()`: delega a `_rerenderGrid()`
- `js/components/form/SubmitManager.js` — en bloque `!canWrite()`: oculta `.multifield-add-btn` y `.multifield-delete-btn`
- `css/styles.css` — nuevas clases: `.multifield-action-header`, `.multifield-action-cell`, `.multifield-delete-btn` (rojo en hover), `.multifield-cell-input.field-error` (borde rojo)

**Atributos XML nuevos:**
```xml
<field type="multifield" id="items" rows="50" display="5">
    <field id="sku" label="SKU" unique="true"/>
    <field id="nombre" label="NOMBRE"/>
    <field id="precio" label="PRECIO" type="number"/>
</field>
```

---

#### Sprint 10b — PAG_SIG / PAG_ANT (v0.31.0)

Navegación secuencial entre registros con botones `< ANT` y `SIG >`. Equivalente a
`PAG_ANT` / `PAG_SIG`. Los botones aparecen cuando el form tiene `keyField`
(campo con `key="true"`). En boundary (primer/último registro) el click es silencioso (noop).

**Modificados:**
- `src/services/recordService.js` — `navigate(tableName, keyField, currentKey, dir, empresaId)`: SELECT adyacente tenant-aware (ASC/DESC LIMIT 1)
- `src/controllers/recordController.js` — `navigateRecord(req, res)`: 200 `{ data }` | 404 en boundary
- `src/routes/recordRoutes.js` — `GET /:table/navigate` registrado ANTES de `/:table`
- `js/components/form/FormContext.js` — añade `this.currentKey = null`
- `js/components/form/ValidationCoordinator.js` — `loadRecord()` asigna `ctx.currentKey`; nuevo `navigateToAdjacent(dir)`
- `js/services/RecordService.js` — método estático `navigate(table, keyField, currentKey, dir)`
- `js/components/form/SubmitManager.js` — `this.coordinator`, `setCoordinator(vc)`, botones ANT/SIG en `addFormActions()`
- `js/components/FormRenderer.js` — `submitManager.setCoordinator(validationCoord)`

**Flujo:**
```
keyField blur → loadRecord(value) → fillForm + ctx.currentKey = value
SIG > click → navigateToAdjacent('next') → GET /:table/navigate?dir=next
              → fillForm(record) + ctx.currentKey = record[keyField]
boundary → 404 → noop silencioso
```

#### Sprint 17 — params schema (v0.30.0)

`YamlParser` soporta sección `params:` en YAML. Cada parámetro tiene `name`, `type` (default
`string`) y `source` (default `jwt`). Base para inyección de `empresa_id` u otros valores JWT
en queries futuras.

**Modificados:**
- `js/components/report/parsers/YamlParser.js` — `buildSchema()` agrega `params: this.buildParams(raw.params)`; nuevo método `buildParams(arr)` → `[{ name, type, source }]`

---

#### Hotfix v0.29.1 — Public Reports (Sprint 12-B merged)

Reportes con `public: true` en YAML son accesibles sin token. La carta QR (`carta.yaml`) ya no
redirige a login para clientes sin sesión. Reportes privados siguen requiriendo JWT.

**Nuevos archivos:**
- `src/controllers/publicReportController.js` — `isReportPublic(reportName)` busca el YAML en `reports/` y `NIL_APP_DIR/reports/` con regex `/^\s*public:\s*true\s*$/m`; `getTableData(req, res)` sirve datos si público, 403 si no
- `src/routes/publicReportRoutes.js` — `GET /:reportName/:table` → `publicReportController.getTableData`

**Modificados:**
- `server.js` — monta `/api/public/report-data` ANTES de `verifyToken`
- `js/components/report/parsers/YamlParser.js` — `buildSchema()` agrega `public: raw.public === true`
- `js/components/report/DataSourceManager.js` — constructor: `publicMode/publicReportName`; `setPublicMode(name)`; `fetchTable()` bifurca según modo (sin token vs authFetch)
- `js/components/report/ReportEngine.js` — `load(path, yamlContent=null)` acepta contenido pre-cargado; si `schema.public` → llama `setPublicMode(reportName)`
- `report.html` — fetch YAML → detecta flag `public`; guard condicional (sin token sólo bloquea si !public); pasa `yamlContent` a `engine.load()` (evita doble fetch)
- `reports/carta.yaml` — `public: true`
- `/opt/wc/pizzeria/reports/carta.yaml` — `public: true`

**Lógica de bifurcación:**
```
DataSourceManager.fetchTable():
  si publicMode → fetch('/api/public/report-data/${reportName}/${table}')  // sin token
  si no         → authFetch('/api/catalogs/${table}')                       // con token
```

**Flujo report.html:**
```
fetch(yamlPath) → yamlContent
isPublic = /^\s*public:\s*true\s*$/m.test(yamlContent)
si !isPublic && !sf_token → redirect /login.html
engine.load(yamlPath, yamlContent)
```

---

#### Sprint 18 — RADU Enforcement (v0.29.0)

Los permisos del `menu.xml` ahora se aplican en el formulario. `permissions="R"` en un item
oculta los botones ENVIAR/LIMPIAR, deshabilita todos los inputs y muestra badge `[R]` en el sidebar.
`RADU(null)` equivale a acceso total — el form de login no se ve afectado.

**Nuevo archivo:**
- `js/utils/RADU.js` — `RADU(permString)` → `canRead/canAdd/canDelete/canUpdate/canWrite`
  - `RADU(null)` = full access (default, consistente con backend)
  - D o U implican R automáticamente

**Modificados:**
- `js/components/FormRenderer.js` — `render(container, xml, options = {})` acepta 3er arg; asigna `ctx.permissions = options.permissions || null`
- `js/components/form/FormContext.js` — agrega `this.permissions = null` en constructor
- `js/components/form/SubmitManager.js` — importa `RADU`; en `addFormActions()`: si `!radu.canWrite()` remueve botones y deshabilita inputs con `setTimeout(0)` (captura multifield async)
- `js/components/FileExplorer.js` — importa `RADU`; agrega badge `[R]` en leaf nodes si `!radu.canWrite()`

**Tabla de comportamiento:**

| permissions | ENVIAR/LIMPIAR | Inputs | Badge sidebar |
|---|---|---|---|
| `"RADU"` / null | visibles | editables | — |
| `"RAU"` | visibles | editables | — |
| `"R"` | ocultos | disabled | `[R]` |

---

### ✅ Added (Agregado) - 2026-03-01

#### Sprint 10 — Zona de Claves (v0.28.0)

Formularios con `key="true"` en un campo ahora cargan el registro existente al perder foco —
equivalente a una búsqueda por clave primaria. Si el ID no existe,
el form queda vacío para INSERT. Si existe, se carga para UPDATE. `SubmitManager` ya manejaba
este caso sin cambios vía `RecordService.save()` → upsert.

**Modificados:**
- `js/components/form/ValidationCoordinator.js`:
  - `attach()` — lee `isKeyField = fieldXml.getAttribute('key') === 'true'`; agrega rama `else if (isKeyField)` en blur handler
  - `loadRecord(value)` — NUEVO: llama `RecordService.load()`; si 404 → no-op (INSERT mode)
  - `fillForm(record)` — NUEVO: puebla todos los campos del form con datos del registro (DbToFm)
- `/opt/wc/pizzeria/form/producto_nuevo.xml` — agregado `<field id="id" key="true">` para demo

**Flujo:**
```
Usuario ingresa ID → Tab
    ↓ blur en campo key="true"
ValidationCoordinator.loadRecord(value)
    ↓ GET /api/records/demo_productos?keyField=id&id=1
RecordService.load() → record | throw(404)
    ↓ si encontrado
fillForm(record) → puebla todos los campos (DbToFm)
    ↓ usuario edita + guarda
RecordService.save() → data.id != null → upsert() → UPDATE
```

**No cambia:** FormContext, SubmitManager, RecordService, backend.

---

### ✅ Fixed (Corregido) - 2026-03-01

#### AuthFetch en RecordService y HandlerBridge (v0.27.1)

`RecordService.js` y `HandlerBridge.js` usaban `fetch()` directo sin `Authorization: Bearer`.
Con `verifyToken` protegiendo todas las rutas `/api/*`, todos los formularios fallaban con 401.

**Modificados:**
- `js/services/RecordService.js` — importa `authFetch`; reemplazados 6 `fetch()` (load, create, upsert, update, delete, getTables)
- `js/services/LookupService.js` — importa `authFetch`; reemplazados 3 `fetch()` (getCatalog ×2, loadRecord)
- `js/components/form/HandlerBridge.js` — importa `authFetch`; reemplazado `fetch()` en `callAfter()`
- `js/components/report/DataSourceManager.js` — importa `authFetch`; reemplazado `fetch()` en `fetchTable()`

`authFetch()` ya existía en `client.js` y estaba exportada — solo faltaba usarla.
Comportamiento: inyecta `Authorization: Bearer <sf_token>` en cada request; en 401 limpia el token y redirige a `/login.html`.

---

### ✅ Added (Agregado) - 2026-03-01

#### ScopedDb — Encapsulación de DB en Handlers (v0.27.0)

El programador del handler ya no
escribe `empresa_id` a mano — el sistema lo inyecta automáticamente en tablas tenant.

**Nuevo archivo:**
- `src/services/scopedDb.js` — `createScopedDb(rawDb, empresaId)` → ScopedDb wrapper
  - `db.find(table, conditions)` — busca una fila, auto-inyecta `empresa_id`
  - `db.findAll(table, conditions)` — busca todas las filas, auto-inyecta `empresa_id`
  - `db.insert(table, data)` — inserta fila, auto-inyecta `empresa_id`, retorna rowid
  - `db.exec(sql, params)` — escape hatch para SQL complejo (sin auto-filtering)
  - `db.prepare(sql)` — escape hatch para prepared statements

**Modificados:**
- `src/controllers/handlerController.js` — construye `ScopedDb` antes de llamar handlers; quita `empresaId` como 5to parámetro
- `src/controllers/recordController.js` — construye `ScopedDb` en `createRecord`, `upsertRecord`, `updateRecord`
- `src/services/handlerService.js` — `transformWithHandler(handler, data, db)` — quitado `empresaId`
- `utils/gencf.js` — firmas revertidas: `after(fieldId, value, data, db)`, `beforeSave(data, db)` (sin `empresaId`)
- `/opt/wc/pizzeria/apps/producto_nuevo.handler.js` — migrado a `db.find()` + `db.insert()`
- `/opt/wc/pizzeria/apps/precios_handler.js` — migrado a `db.findAll()`, eliminado helper `queryAll`

**Firma final de handlers:**
```javascript
after(fieldId, value, data, db)   // db = ScopedDb
before(fieldId, data, db)         // db = ScopedDb
beforeSave(data, db)              // db = ScopedDb
validate(data)                    // sin db
afterSave(data, isInsert)         // sin db
beforeDelete(id)                  // sin db
afterDelete(id)                   // sin db
```

**Equivalencia:**
```
GetRecord(s1 | CLIENTES, key, mode)  ←→  db.find('clientes', { id: value })
PutRecord(CLIENTES)                  ←→  db.insert('clientes', data)
Filtro de tenant implícito           ←→  WHERE empresa_id = ? auto-inyectado
```

---

### ✅ Added (Agregado) - 2026-02-28

#### Login con Form Engine + JWT (v0.26.0)

Autenticación completa integrada al motor. El login se renderiza con el mismo
engine de formularios XML. JWT protege todas las rutas `/api/*`.

**Seguridad (basada en análisis C++ login_new.cpp):**
- `LoginError` enum interno (granular) vs mensaje externo genérico (anti-enumeración)
- Validación de formato de `usuario` antes de tocar la DB
- Bloqueo automático tras 5 intentos fallidos (`failed_attempts` + `activo=0`)
- Verificación de `activo` **antes** de bcrypt (fail-fast)
- `bcrypt.compare` timing-safe para la contraseña
- Errores `USER_NOT_FOUND` y `WRONG_PASSWORD` producen el mismo mensaje externo

**Nuevos archivos:**
- `src/services/authService.js` — `login(usuario, password)` con todas las defensas; firma JWT en éxito
- `src/routes/authRoutes.js` — `POST /api/auth/login`; log interno con código, respuesta sin detalle
- `src/middleware/verifyToken.js` — verifica JWT → `req.empresaId`, `req.usuarioId`, `req.rol`; 401 con mensaje genérico
- `forms/login.xml` — form XML del motor: `usuario` + `type="password"` + `action="/api/auth/login"`
- `login.html` — página pública mínima, carga `FormRenderer` + `login.xml`; redirige si ya hay token

**Modificados:**
- `utils/init-auth.js` — tabla `usuarios` ahora incluye: `usuario TEXT NOT NULL UNIQUE`, `failed_attempts INTEGER DEFAULT 0`, `created_at`, `updated_at`; `email` se mantiene (para app administrativa futura); seed: `usuario=admin`
- `src/services/authService.js` — `jsonwebtoken` instalado; JWT firmado con `NIL_JWT_SECRET` + `SF_JWT_EXPIRY`
- `server.js` — `authRoutes` montado ANTES de `verifyToken`; `verifyToken` aplicado a todo `/api/*`; inicializa `authDatabase` al arrancar
- `js/api/client.js` — `authFetch()` helper: inyecta `Authorization: Bearer`, redirige a login en 401; todas las funciones usan `authFetch`
- `js/components/form/FormContext.js` — extrae `formAction` de `<form action="...">`
- `js/components/form/SubmitManager.js` — `_handleCustomAction()`: POST JSON al `formAction`, guarda `sf_token` en localStorage, redirect; `_showFormError()`: error inline (sin `alert()`)
- `js/main.js` — guard: si no hay `sf_token` → redirect a `/login.html`
- `.env` — `NIL_JWT_SECRET` + `SF_JWT_EXPIRY=8h`

**Schema `usuarios` final:**
```sql
id, empresa_id, nombre, usuario, email, password_hash, rol,
activo, failed_attempts, created_at, updated_at
```

**Demo:** `admin` / `demo1234`

---

#### Multi-tenant DB Schema (v0.25.0)

Base de datos de autenticación separada del motor. Esquema multi-inquilino con
`empresa_id` en todas las tablas de datos de la app.

**Nuevos archivos:**
- `src/services/authDatabase.js` — **NUEVO**
  - Gestiona `data/auth.db` (o `SF_AUTH_DB`)
  - Mismo patrón API que `database.js` (`initAuthDatabase`, `getAuthDatabase`, `saveAuthDatabase`)
  - Crea directorio automáticamente si no existe
- `utils/init-auth.js` — **NUEVO**
  - Crea tablas `empresas` + `usuarios` en `auth.db`
  - Inserta empresa demo (id=1: Pizzería Demo)
  - Inserta usuario demo con password hasheada via `bcryptjs` (admin@pizzeria.local / demo1234)

**Modificados:**
- `.env` — agregado `SF_AUTH_DB=data/auth.db`
- `utils/init-pizzeria.js` — tablas `demo_categorias` y `demo_productos` ahora incluyen columna `empresa_id INTEGER NOT NULL DEFAULT 1`; seed data lleva `empresa_id=1`

**Dependencia nueva:**
- `bcryptjs` — hashing de passwords (instalado con `--no-bin-links` por exFAT filesystem)

**Esquema auth.db:**
```sql
CREATE TABLE empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, direccion TEXT, email TEXT, activo INTEGER DEFAULT 1
);
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, rol TEXT DEFAULT 'operador', activo INTEGER DEFAULT 1
);
```

---

### ✅ Added (Agregado) - 2026-02-27

#### Menu System + External App Architecture (v0.22.0)

Separación motor (space-form) / aplicación cliente (pizzería). El sidebar ahora
refleja un `menu.xml` externo configurable vía `.env`, en lugar de escanear `forms/`.

**Backend:**
- `dotenv` + `@xmldom/xmldom` instalados como dependencias
- `server.js`: `require('dotenv').config()` al inicio; `PORT` desde `SF_PORT`
- `src/services/menuService.js` — **NUEVO**
  - `parseMenuFile(path)` — parsea menu.xml con `@xmldom/xmldom`, recursivo para `type="menu"`
  - `isAuthorizedPath(path)` — verifica que un path esté dentro de los dirs autorizados
  - `resetAuthorizedDirs()` — limpia el Set antes de cada parseo
  - Acumula `authorizedDirs` Set mientras parsea targets
- `src/controllers/filesystemController.js`
  - `getMenu(req, res)` — lee `SF_MENU_FILE`, llama `menuService.parseMenuFile()`
  - `getContent(req, res)` — sirve archivo si path está en `authorizedDirs` (403 si no)
- `src/routes/apiRoutes.js`
  - `GET /api/menu` → `getMenu`
  - `GET /api/files/content?path=ENCODED` → `getContent`
- `.env` creado: `SF_MENU_FILE=/opt/wc/pizzeria/menu.xml`, `SF_PORT=3000`

**Frontend:**
- `js/api/client.js`: `getMenu()` → `GET /api/menu`; `getFile(absPath)` → `GET /api/files/content`
- `js/components/FileExplorer.js`: `render()` acepta array de items de menú;
  renderiza `separator`, `form`, `report`, sub-menús `menu` anidados
- `js/components/Workspace.js`: `loadItem(item)` despacha por `item.type`
- `js/main.js`: usa `getMenu()` en lugar de `getTree()`

**Demo pizzería (archivos externos — no en space-form):**
- `/opt/wc/pizzeria/menu.xml` — 4 opciones: Precios, Producto Nuevo, separator, Carta Digital
- `/opt/wc/pizzeria/form/precios.xml` — form existente
- `/opt/wc/pizzeria/form/producto_nuevo.xml` — form existente
- `/opt/wc/pizzeria/apps/` — directorio para handlers de la app (vacío aún)

### ✅ Added (Agregado) - 2026-02-27

#### App Directory Structure (v0.22.1)

- **`/opt/wc/pizzeria/menu.xml`** — targets corregidos (`form/precios.xml`, `form/producto_nuevo.xml`)
- **`server.js`** — deriva `NIL_APP_DIR` automáticamente de `dirname(SF_MENU_FILE)` si no está en `.env`
- **`.env`** — agregado `SF_DB_FILE=/opt/wc/pizzeria/dbase/pizzeria.db`
- **`src/services/database.js`** — usa `process.env.SF_DB_FILE` con fallback a `data/catalogs.db`
- **`src/services/handlerService.js`** — nueva resolución de handlers:
  1. `$NIL_APP_DIR/apps/<name>.handler.js` (app dir primero)
  2. `$NIL_APP_DIR/apps/<name>.js`
  3. `space-form/handlers/<name>.handler.js` (core fallback)
  4. `space-form/handlers/<name>.js`
  - Lee `process.env.NIL_APP_DIR` en tiempo de llamada (no al cargar el módulo)
- **`handlers/`** — `precios_handler.js` y `producto_nuevo.handler.js` eliminados del core
- **`/opt/wc/pizzeria/apps/`** — handlers de la pizzería movidos aquí
- **`/opt/wc/pizzeria/dbase/pizzeria.db`** — DB migrada desde `data/catalogs.db`
- **`utils/init-pizzeria.js`** — lee `SF_DB_FILE` del `.env`; crea el directorio si no existe
- **`agent/04-guides/GUIA-XML.md`** — convención `handler="none"` documentada; orden de resolución de handlers

---

### ✅ Added (Agregado) - 2026-02-23

#### DuckDB-WASM Integration (v0.20.0)

Migración del Report Engine a DuckDB-WASM para OLAP eficiente en browser.

- **DuckDBAdapter** - Wrapper para DuckDB-WASM con lazy loading desde CDN
  - `init()` - Inicializa DuckDB en Web Worker
  - `loadTable(name, data)` - Registra tablas desde JSON
  - `query(sql)` - Ejecuta SQL y retorna resultados como JS array
  - CDN: `@duckdb/duckdb-wasm@1.33.0` (~2.5MB WASM)

- **QueryBuilder** - Compilador YAML → SQL
  - `buildQuery(dataSource, fields)` - Genera SQL completo
  - `buildSelect()` - Columnas con aliases y joins
  - `buildJoins()` - LEFT JOIN desde definición `references`
  - `buildWhere()` - Conversión de filtros YAML a SQL
  - `buildOrderBy()` - Cláusulas ORDER BY

- **DataSourceManager v2.0** - Backend dual DuckDB/JS
  - `initDuckDB()` - Inicialización lazy de DuckDB
  - `loadWithDuckDB()` - Ejecuta queries con SQL nativo
  - `loadWithJS()` - Fallback a loops JS si DuckDB falla
  - `isDuckDBActive()` - Indica backend en uso

- **ReportEngine v2.0** - Coordinación con DuckDB
  - `isDuckDBActive()` - Expone estado del backend
  - `close()` - Limpieza de recursos DuckDB

#### Security Fix

- **ExpressionEvaluator** - Eliminado `eval()` vulnerable
  - Nuevo `isConditionSafe()` - Whitelist de caracteres permitidos
  - Nuevo `isSafeIdentifier()` - Validación de nombres de campo
  - `evaluateCondition()` usa `new Function()` con sanitización
  - Bloquea: eval, Function, window, document, fetch, import

#### UI Improvements

- **report.html** - Estados de carga mejorados
  - Spinner animado durante carga
  - Indicador de progreso ("Inicializando DuckDB...")
  - Badge de backend (DuckDB/JS) en esquina inferior
  - Mejor manejo de errores con stack trace

#### Arquitectura Actualizada
```
js/components/report/
├── ReportEngine.js          # Motor principal (v2.0)
├── ReportRenderer.js        # Renderizado HTML
├── DataSourceManager.js     # Queries DuckDB/JS (v2.0)
├── DuckDBAdapter.js         # Wrapper DuckDB-WASM (NEW)
├── QueryBuilder.js          # YAML → SQL compiler (NEW)
├── AccumulatorManager.js    # Funciones de agregación
├── BreakDetector.js         # Control breaks
├── ExpressionEvaluator.js   # Evaluación segura (v2.0)
├── parsers/
│   └── YamlParser.js        # Parsea YAML a ReportSchema
└── index.js                 # Exports
```

#### Performance

| Métrica | Antes (JS loops) | Después (DuckDB) |
|---------|------------------|------------------|
| 100 registros | ~5ms | ~50ms init + ~1ms |
| 1,000 registros | ~50ms | ~50ms init + ~2ms |
| 10,000 registros | ~5,000ms (freeze) | ~50ms init + ~10ms |
| JOIN 2 tablas | O(n²) | O(n log n) |

---

### ✅ Added (Agregado) - 2026-02-22

#### Web Report Engine PoC (v0.19.0)

Motor de reportes web que migra la funcionalidad de NILIX RDL a una arquitectura moderna.

- **ReportEngine** - Motor principal: parsea YAML, ejecuta datasources, coordina renderizado
  - `load(reportPath)` - Carga reporte desde archivo YAML
  - `render()` - Ejecuta el reporte y genera HTML

- **YamlParser** - Convierte `carta.yaml` a `ReportSchema`
  - Soporte para config, fields, dataSources, zones
  - Condiciones `before/after` y control breaks

- **DataSourceManager** - Construye y ejecuta queries desde dbRef
  - Integración con API `/api/catalogs/:table`
  - Soporte para orderBy, filter, joins

- **AccumulatorManager** - Gestión de funciones de agregación
  - sum, avg, count, min, max (se resetean en control break)
  - runsum, runavg, runcount, runmin, runmax (globales)

- **BreakDetector** - Detección de cambios en campos de control
  - `detectChanges()` - Detecta cuando cambia un campo
  - `extractBreakFields()` - Extrae campos de control de las zonas

- **ExpressionEvaluator** - Evaluación de expresiones en zonas
  - Placeholders `{campo}` en templates
  - Formato: currency, upper, lower, date

- **ReportRenderer** - Renderiza zonas a HTML
  - Tipos: header, footer, nav, separator, card, detail
  - Layout horizontal-scroll para navegación

- **CSS estilos** para reportes (estilo monospace/brutalist)
  - `.report-container`, `.report-header`, `.report-nav`
  - `.report-card`, `.report-products-grid`, `.report-footer`

- **Demo carta digital** - `reports/carta.yaml` + `reports/carta.html`

#### Arquitectura del Módulo
```
js/components/report/
├── ReportEngine.js          # Motor principal
├── ReportRenderer.js        # Renderizado HTML
├── AccumulatorManager.js    # Funciones de agregación
├── BreakDetector.js         # Control breaks
├── ExpressionEvaluator.js   # Evaluación de expresiones
├── DataSourceManager.js     # Queries desde dbRef
├── parsers/
│   └── YamlParser.js        # Parsea YAML a ReportSchema
└── index.js                 # Exports
```

#### Ejemplo de uso
```javascript
import { ReportEngine } from './js/components/report/ReportEngine.js';

const engine = new ReportEngine();
await engine.load('reports/carta.yaml');
const html = await engine.render();
document.getElementById('report-container').appendChild(html);
```

#### Integración en Explorador (v0.19.0)
- **Carpeta `reports/`** separada de `forms/`
- **Forms XML** → Privados, solo en explorador
- **Reports YAML** → Públicos, acceso vía `/report.html?file=nombre`
- **API `/api/reports`** → Lista reportes disponibles
- **Visor genérico** `/report.html` para cualquier reporte YAML

### 🔗 Uso de Reportes Públicos

```
# Acceso directo a reporte
http://localhost:3000/report.html?file=carta

# Reporte en subcarpeta
http://localhost:3000/report.html?file=demo/pizzeria/carta

# API para listar reportes disponibles
GET /api/reports → { reports: [{ name, file, path }] }
```


### ✅ Fixed (Corregido) - 2026-02-21

#### Cache System - Validación contra API
- **Cache inteligente** - LookupService ahora valida contra API antes de usar cache local
  - Siempre consulta API con header `X-Cache-Count`
  - API responde 304 si count coincide → usa cache local
  - API responde con datos si count diferente → actualiza cache
- **catalogController.js** - Headers anti-cache HTTP + lógica 304
- **TableCache.js** - `count` siempre tiene valor

#### Documentación
- **Cobertura actualizada** - Corregido de "90%" a "~60%" en ANALYSIS-HIERARCHY.md
- **Sistemas dinámicos documentados** - Nueva sección en MANUAL-DESARROLLO.md:
  - `exp.js` como sistema de carga dinámica TSV→SQLite
  - `schemaService` con detección automática de esquemas
  - Advertencia sobre SQLite en memoria (no producción)
- **Archivos duplicados eliminados** - Removidos 8 archivos .md duplicados de raíz
- **Advertencia SQLite** - Agregada en README.md principal

#### Código
- **`invalidateTables` dinámico** - FormRenderer.js ahora usa `invalidateTables` del handler
  - Antes: tablas hardcodeadas (`demo_productos`, `demo_categorias`)
  - Ahora: usa array `invalidateTables` del handler dinámicamente
- **recordController.js** - Respuesta incluye `invalidateTables` del handler
- **Logs de debug comentados** - Preparado para producción

### Por Implementar

#### 🟡 v0.19.0 - Zona de Claves + READ Completo
- **Atributo `key="true"`** - Marcar campos como zona de claves
- **Atributo `control="true"`** - Campo de control (fin zona claves)
- **READ completo** - `DbToFm` equivalente (llenar todo el form desde BD)
- **Validaciones inline** - `<max>`, `<min>`, `<pattern>`, `<in>`

### Futuro
- **Atributo `is` completo** - Campos virtuales calculados
- **Máscaras de entrada** - Formateo automático (CUIT, teléfono)
- **Multifield: Agregar/Eliminar filas** - CRUD en grids
- **Subformularios** - Popup forms modales
- **Sistema de menús** - Navegación entre formularios

---

## [0.18.0] - 2026-02-21

### ✅ Added (Agregado)

#### Handler System - Control Dinámico de Campos
- **`handler.after(fieldId, value, data, db)`** - Ejecutado al cambiar campo
  - Retorna `populate` para llenar multifield
  - Retorna `enableFields` / `disableFields` para habilitar/deshabilitar campos
  - Retorna `setValues` para llenar valores de campos

- **`handler.beforeSave(data, db)`** - Ejecutado antes de guardar
  - Recibe objeto `db` para multi-table operations
  - Puede insertar/actualizar otras tablas
  - Retorna datos transformados

- **`handler.invalidateTables`** - Array de tablas a invalidar cache después de save

#### Cache Invalidation System
- **`TableCache.invalidate(tableName)`** - Invalida cache de tabla específica
- **Global invalidation timestamp** - `sf_invalidation_time` en localStorage
- **`LookupService.forceRefreshOnNextLoad(tableName)`** - Fuerza refresh en próxima carga
- **Autocomplete detecta invalidación** - Recarga datos si cache obsoleto

#### Multi-table Persistence
- **`saveDatabase()` en recordController** - Persiste cambios de handler a disco
- **Handler recibe `db`** - Acceso directo a SQLite para multi-table operations

#### API Endpoints
- `POST /api/handler/:handler/after` - Ejecuta `handler.after()`
- `POST /api/handler/:handler/before` - Ejecuta `handler.before()`

#### Frontend
- **`callHandlerAfter()` en FormRenderer** - Llama handler al cambiar campo
- **`populateRows()` mejorado** - Página con 10 filas fijas
- **Readonly dinámico** - Handler habilita/deshabilita campos

### 🔧 Changed (Modificado)

#### FormRenderer.js
- `callHandlerAfter()` unificado para populate + enableFields + setValues
- Invalida cache de tablas del handler después de guardar

#### Multifield.js
- `populateRows()` usa paginación con 10 filas fijas (las vacías se muestran)
- Headers con `data-field-id` para match de columnas

#### Autocomplete.js
- Detecta invalidación global y recarga datos

#### TableCache.js
- Nueva función `getGlobalInvalidationTime()` / `setGlobalInvalidationTime()`
- `get()` verifica timestamp global vs savedAt

### 🗑️ Files Changed

| Archivo | Tipo | Líneas | Descripción |
|---------|------|--------|-------------|
| `src/controllers/handlerController.js` | MOD | +50 | after() method |
| `src/routes/handlerRoutes.js` | MOD | +5 | Ruta /after |
| `src/services/handlerService.js` | MOD | +10 | Pasa db a beforeSave |
| `src/controllers/recordController.js` | MOD | +20 | saveDatabase() + invalidate |
| `js/components/FormRenderer.js` | MOD | +60 | callHandlerAfter + invalidate |
| `js/components/fieldRenderer/Multifield.js` | MOD | +40 | Paginación + data-field-id |
| `js/services/LookupService.js` | MOD | +30 | forceRefresh + invalidateCache |
| `js/services/TableCache.js` | MOD | +25 | Global invalidation |
| `handlers/producto_nuevo.handler.js` | NUEVO | 95 | Handler demo multi-table |
| `handlers/precios_handler.js` | MOD | 55 | Handler para multifield |
| `forms/demo/pizzeria/precios.xml` | NUEVO | 25 | Form lista productos |
| `forms/demo/pizzeria/producto_nuevo.xml` | NUEVO | 42 | Form alta producto |
| `utils/init-pizzeria.js` | NUEVO | 200 | Demo data pizzería |

### 🔗 Handler API

```javascript
// handler/producto_nuevo.handler.js
module.exports = {
    table: 'demo_productos',
    keyField: 'id',
    invalidateTables: ['demo_productos', 'demo_categorias'],
    
    after(fieldId, value, data, db) {
        if (fieldId === 'id_categoria' && value) {
            const exists = db.prepare("SELECT nombre FROM demo_categorias WHERE id = ?");
            // Retorna { setValues, enableFields, disableFields }
        }
        return null;
    },
    
    beforeSave(data, db) {
        // Puede insertar en otras tablas
        // Retorna datos transformados
    }
}
```


## [0.17.0] - 2026-02-20 (Skipped - merged into v0.18.0)

---

## [0.16.0] - 2026-02-20

### ✅ Added (Agregado)

#### CRUD Completo - Backend
- **`src/services/schemaService.js`** (NUEVO) - Validación dinámica de tablas
  - `tableExists(tableName)` - Verifica tabla via sqlite_master
  - `getAllTables()` - Lista todas las tablas
  - `getTableInfo(tableName)` - Columnas de tabla
  - `getPrimaryKey(tableName)` - Detecta PK

- **`src/services/recordService.js`** (NUEVO) - CRUD SQL
  - `findById(table, keyField, id)` - Buscar por ID
  - `insert(table, data)` - Crear nuevo registro
  - `update(table, keyField, id, data)` - Actualizar existente
  - `upsert(table, keyField, data)` - PutRecord style (INSERT o UPDATE)
  - `remove(table, keyField, id)` - Eliminar registro
  - `filterValidFields(table, data)` - Filtra campos que existen en tabla

- **`src/controllers/recordController.js`** (NUEVO) - Controller REST
  - `getRecord(req, res)` - GET /api/records/:table?keyField=X&id=Y
  - `createRecord(req, res)` - POST /api/records/:table
  - `upsertRecord(req, res)` - POST /api/records/:table/:id (PutRecord)
  - `updateRecord(req, res)` - PUT /api/records/:table/:id
  - `deleteRecord(req, res)` - DELETE /api/records/:table/:id
  - `getTables(req, res)` - GET /api/records/tables

- **`src/routes/recordRoutes.js`** (NUEVO) - Rutas REST
  - `GET /api/records/tables` - Lista tablas disponibles
  - `GET /api/records/:table?keyField=X&id=Y` - Leer registro
  - `POST /api/records/:table` - Crear registro
  - `POST /api/records/:table/:id` - Upsert (PutRecord style)
  - `PUT /api/records/:table/:id` - Actualizar registro
  - `DELETE /api/records/:table/:id` - Eliminar registro

#### CRUD Completo - Frontend
- **`js/services/RecordService.js`** (NUEVO) - Cliente API
  - `load(table, keyField, id)` - Cargar registro
  - `create(table, keyField, data)` - Crear nuevo
  - `upsert(table, keyField, id, data)` - Upsert
  - `update(table, keyField, id, data)` - Actualizar
  - `save(table, keyField, data)` - Auto-detecta create vs update
  - `getTables()` - Lista tablas

#### Utilitario exp (TSV → SQLite)
- **`utils/exp.js`** (NUEVO) - Importa TSV a SQLite
  - `node exp.js demo.clientes clientes.dat`
  - Detecta tipos automáticamente (INTEGER, REAL, TEXT)
  - DROP + CREATE TABLE + INSERT
  - Importación de datos TSV a SQLite

### 🔧 Changed (Modificado)

#### Validación Dinámica (sin hardcodeo)
- **Antes:** `ALLOWED_TABLES = ['clientes', 'provin', ...]`
- **Ahora:** `schemaService.tableExists(tableName)` consulta sqlite_master

#### catalogService.js
- Eliminado `ALLOWED_TABLES` hardcodeado
- Usa `schemaService.tableExists()` para validación

#### catalogController.js
- `getAllowedTables()` usa `schemaService.getAllTables()` dinámico
- Error responses con formato estándar `{ error: { code, message } }`

#### FormRenderer.js
- `tableConfig` - Guarda table/keyField del primer `<in-table>`
- `attachSubmitHandler()` - Usa `RecordService.save()` si hay tableConfig
- `showSubmitFeedback()` - Muestra "¡CREADO!" o "¡ACTUALIZADO!"

#### server.js
- Agregado `recordRoutes` montado en `/api/records`

### 🗑️ Files Changed

| Archivo | Tipo | Líneas | Descripción |
|---------|------|--------|-------------|
| `src/services/schemaService.js` | NUEVO | 47 | Validación dinámica |
| `src/services/recordService.js` | NUEVO | 170 | CRUD SQL |
| `src/controllers/recordController.js` | NUEVO | 200 | Controller REST |
| `src/routes/recordRoutes.js` | NUEVO | 14 | Rutas /api/records |
| `js/services/RecordService.js` | NUEVO | 94 | Cliente API frontend |
| `utils/exp.js` | NUEVO | 280 | Utilitario TSV→SQLite |
| `src/services/catalogService.js` | MOD | -30 | Sin ALLOWED_TABLES |
| `src/controllers/catalogController.js` | MOD | -20 | Usa schemaService |
| `js/components/FormRenderer.js` | MOD | +30 | Submit a SQLite |
| `server.js` | MOD | +2 | Monta recordRoutes |

### 🔗 API Endpoints

```
GET    /api/records/tables                  # Lista tablas
GET    /api/records/:table?keyField=X&id=Y  # Leer registro
POST   /api/records/:table                  # Crear
POST   /api/records/:table/:id              # Upsert (PutRecord)
PUT    /api/records/:table/:id              # Actualizar
DELETE /api/records/:table/:id              # Eliminar
```


## [0.15.0] - 2026-02-17
[Cliente: 5] → Tab → Valida que existe → Copia nombre
[Guardar] → localStorage

AHORA:
[Cliente: 5] → Tab → Carga TODOS los campos del registro
[Nombre: ACME CORP    ] ← editable
[Direc:  Av. Lib 1234 ] ← editable
[Guardar] → SQLite (UPDATE)

[Nuevo] → Form limpio
[Guardar] → SQLite (INSERT)
```

#### Autocomplete.js
- Al seleccionar item con Enter/Click, carga registro completo
- `selectItem()` llama a `RecordService.load()` y `populateForm()`

### 🗑️ Files Changed

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/services/recordService.js` | NUEVO | ~100 líneas |
| `src/controllers/recordController.js` | NUEVO | ~80 líneas |
| `src/routes/recordRoutes.js` | NUEVO | ~20 líneas |
| `js/services/RecordService.js` | NUEVO | ~60 líneas |
| `server.js` | MODIFICADO | Importar recordRoutes |
| `js/components/FormRenderer.js` | MODIFICADO | populateForm, modo edit, submit |


## [0.15.0] - 2026-02-17

### ✅ Added (Agregado)

#### Autocomplete Component (Reemplaza select nativo)
- **Componente custom `Autocomplete.js`** - Reemplaza `<select>` nativo
  - Input de texto + botón ▼ para abrir lista
  - **F1** abre el dropdown (estilo terminal)
  - Filtrado mientras escribes
  - **Tab** valida y carga datos del catálogo
  - Navegación con ↑↓ y Enter
  - Escape cierra el dropdown
  - Auto-copia campos al seleccionar

#### Comportamiento Unificado
- **Select estático (`<options>`)** - Usa autocomplete con lista fija
- **Select dinámico (`<in-table>`)** - Usa autocomplete con datos de BD
- Ambos muestran solo el key en el input
- Dropdown muestra `key - display`

#### Dark Mode Estilo The Monospace Web
- **Fondo negro puro** `#000000`
- **Texto blanco** `#ffffff`
- **Bordes blancos gruesos**
- **Sombras neobrutalistas blancas**
- **Input background** `#111111`

#### Sintaxis XML (sin cambios)
```xml
<!-- Select dinámico con BD -->
<field id="clieno" label="Cliente" type="select" size="6">
    <in-table table="clientes" key="clieno" display="nombre">
        <copy from="nombre" to="nombre"/>
        <copy from="direc" to="direc"/>
    </in-table>
</field>

<!-- Select estático -->
<field id="tipo_iva" label="Tipo IVA" type="select" size="2">
    <options>
        <option value="RI">Responsable Inscripto</option>
        <option value="CF">Consumidor Final</option>
    </options>
</field>
```

### 🔧 Changed (Modificado)

#### Archivos Nuevos
- `js/components/fieldRenderer/Autocomplete.js` - ~250 líneas (componente nuevo)

#### Archivos Modificados
- `js/components/fieldRenderer/InputField.js` - Eliminado código select nativo, delega a Autocomplete
- `css/styles.css` - Dark mode The Monospace Web, estilos autocomplete

#### CSS Variables Dark Mode
```css
body.dark-mode {
    --bg-color: #000000;
    --text-color: #ffffff;
    --border-color: #ffffff;
    --input-bg: #111111;
    --neo-shadow: 4px 4px 0 #ffffff;
}
```

### 🗑️ Removed (Eliminado)
- Código de `<select>` nativo en InputField.js
- Función `attachDynamicSelectHandlers()` movida a Autocomplete.js


## [0.14.3] - 2026-02-17

### ✅ Added (Agregado)

#### The Monospace Web Integration
- **Fuente monospace estricta** - `--font-family` en `:root` con propiedades ópticas
- **Input sizing** - Altura fija `calc(var(--line-height) * 2)`
- **Padding con ch units** - `calc(1ch - var(--border-thickness))`
- **Label-input sin gap** - Gap 0 entre label e input
- **`font: inherit`** - Inputs heredan fuente del root
- **Autofill override** - `-webkit-box-shadow` para forzar colores
- **Dark mode shadow blanco** - `--neo-shadow: 4px 4px 0 #ffffff` en dark

#### Layout
- **`.border-box` con gap** - `gap: 0.5rem` interno
- **Responsive border-box** - Horizontal → vertical en móvil
- **Reduced gaps** - `.field-row`, `.form-vertical`, `.vertical-container`

#### Variables CSS
```css
--font-family: ui-monospace, 'Cascadia Code', 'JetBrains Mono', ...;
--line-height: 1.2rem;
--border-thickness: 2px;
font-optical-sizing: auto;
font-variant-numeric: tabular-nums lining-nums;
```

#### Archivos
- `css/styles.css` - Monospace Web patterns, input sizing, responsive border-box
- `agent/03-reference/CHANGELOG.md` - Esta entrada
- `agent/ANALYSIS-HIERARCHY.md` - Versión v0.14.3

### 🔗 Inspiración
- The Monospace Web (Oskar Wickström)
- https://owickstrom.github.io/the-monospace-web

---

## [0.14.2] - 2026-02-17

### ✅ Added (Agregado)

#### CRT Effects (Terminal Retro)
- **CRT Scanlines** - Overlay sutil de líneas horizontales en dark mode
- **Phosphor Glow** - `text-shadow` verde en títulos y labels
- **Cursor Blink** - Caret parpadeante estilo terminal en inputs
- **Placeholder Glow** - `text-shadow` en placeholders dark mode
- **CRT Toggle** - Botón para activar/desactivar efectos CRT

#### Fuente Mejorada
- `'JetBrains Mono'` y `'IBM Plex Mono'` como fuentes primarias

#### Archivos
- `css/styles.css` - CRT effects, phosphor glow, cursor blink
- `index.html` - Botón CRT toggle en header
- `js/main.js` - Lógica toggle CRT con localStorage

#### Variables CSS
```css
--crt-glow: rgba(0, 255, 0, 0.4);
--crt-scanline: rgba(0, 0, 0, 0.06);
```

### 🔗 Inspiración
- The Monospace Web (Oskar Wickström)
- Terminal CRT de los 80s/90s
- motor legacy

---

## [0.14.1] - 2026-02-16

### ✅ Added (Agregado)

#### Neobrutalismo Híbrido
- **Hard Shadows** - `--neo-shadow: 4px 4px 0 #000` (light) / `#00ff00` (dark)
- **Hover físico** - `translate(-2px, -2px)` + shadow increase
- **Active pressed** - `translate(2px, 2px)` + shadow decrease

#### Elementos con Neobrutalismo
- `.terminal-window` - Hard shadow
- `.border-box` - Hard shadow
- `button` - Hover/active físico
- `input:focus` - Hard shadow
- `.multifield-grid` - Hard shadow
- `.multifield-btn` - Hover/active físico
- `.theme-toggle` - Hover/active físico

#### Archivos
- `css/styles.css` - Variables --neo-shadow, hover/active states

---

## [0.14.0] - 2026-02-16

### ✅ Added (Agregado)

#### Campos
- **Select dinámico con `<in-table>`** - Select que carga opciones desde BD
  - Sintaxis: `<field type="select"><in-table table="clientes" key="clieno" display="nombre">`
  - Al hacer focus en el select, carga `SELECT * FROM table`
  - Muestra `displayField` en cada opción
  - Al seleccionar, copia campos automáticamente según `<copy>`
  - Caché automático en localStorage (24h TTL)

#### Sintaxis XML
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

#### Lógica
| `type` | Sub-elemento | Resultado |
|--------|--------------|-----------|
| `select` | `<options>` | Select estático |
| `select` | `<in-table>` | Select dinámico de BD |
| `text/number` | `<in-table>` | Validación blur + copy |

#### Archivos
- `js/components/FormRenderer.js` - Detecta `<in-table>` en selects
- `js/components/fieldRenderer/InputField.js` - Renderiza dynamic-select
- `forms/clie.xml` - Formulario de ejemplo con ambas sintaxis


## [0.13.0] - 2026-02-16

### ✅ Added (Agregado)

#### Backend
- **SQLite con sql.js** - Base de datos in-memory con persistencia
  - Tablas: provin, local, clientes, items, ordenes, movim
  - Datos de ejemplo: 24 provincias, 13 localidades, 5 clientes, 5 items

#### API REST
- `GET /api/catalogs/tables` - Lista tablas permitidas
- `GET /api/catalogs/:table` - Obtiene todos los registros de una tabla
- `GET /api/catalogs/:table/:keyField/:value` - Valida clave

#### Frontend
- **LookupService** - Servicio de validación contra catálogos
- **TableCache** - Caché en localStorage con TTL 24h
- **`<in-table>`** - Validación de campo contra tabla

#### Sintaxis XML
```xml
<field id="prov" label="Provincia" type="text" size="2">
    <validation>
        <in-table table="provin" key="codpro">
            <copy from="nombre" to="prov_nombre"/>
        </in-table>
    </validation>
</field>
```

#### Archivos
- `src/services/database.js` - Conexión sql.js
- `src/services/catalogService.js` - Consultas a tablas
- `src/controllers/catalogController.js` - Controller API
- `src/routes/catalogRoutes.js` - Rutas /api/catalogs
- `scripts/initCatalogsDB.js` - Script de inicialización
- `data/catalogs.db` - Base de datos SQLite
- `js/services/TableCache.js` - Caché localStorage
- `js/services/LookupService.js` - Lógica de lookup
- `forms/test-lookup.xml` - Formulario de prueba

---

## [0.12.0] - 2026-02-16

### ✅ Added (Agregado)

#### Campos
- **`type="select"`** - Campos dropdown con opciones
  - Sintaxis XML: `<field type="select"><options><option value="X">Texto</option></options></field>`
  - Opción vacía "-- Seleccione --" si no es requerido
  - Soporte para `<default>` (preselecciona opción)
  - Soporte para `<help>` (tooltip de ayuda)
  - Funciona en layouts horizontales y verticales

#### CSS
- **Estilos brutalist para `<select>`**
  - `appearance: none` con arrow SVG personalizada (verde phosphor)
  - Sin bordes redondeados
  - Hover y focus states

#### Archivos
- `js/components/fieldRenderer/InputField.js` - detecta `type="select"`
- `js/components/FormRenderer.js` - extrae `<options>` del XML
- `css/styles.css` - estilos para select
- `forms/test-select.xml` - formulario de prueba

### 📊 Resumen

| Tipo de campo | Antes | Ahora |
|---------------|-------|-------|
| text | ✅ | ✅ |
| number | ✅ | ✅ |
| date | ✅ | ✅ |
| textarea | ✅ | ✅ |
| checkbox | ✅ | ✅ |
| multifield | ✅ | ✅ |
| **select** | ❌ | ✅ |

---

## [0.11.0] - 2026-02-15

### ✅ Added (Agregado)

#### UI/UX
- **Header global** - Barra superior siempre visible
  - Título "SPACE FORM" estilo terminal (uppercase, monospace)
  - Botón hamburguesa integrado en el header
  - Toggle de tema (☀️/🌙) SIEMPRE visible (no depende del form)
  - Layout: hamburguesa + título (izq) | theme toggle (der)

### 🔧 Changed (Modificado)

#### HTML
- **index.html** - Nuevo `<header id="global-header">`
  - `.header-left`: hamburguesa + título
  - `.header-right`: botón de tema
  - Título de página actualizado a "Space Form"

#### CSS
- **styles.css** - Nueva sección Global Header (~48px height)
  - `#global-header`: sticky, z-index 1002
  - `.header-title`: uppercase, letter-spacing 2px
  - `.hamburger-btn`: ahora dentro del header (no fixed)
  - `#os-interface`: height calc(100vh - 48px)
  - Media query: sidebar con `top: 48px` en móvil

#### JavaScript
- **main.js** - Toggle de tema inicializado en header global
  - Import `toggleTheme` y `isDark` desde themeService
  - Event listener para `#theme-btn`
  - Actualización de icono ☀️/🌙

- **UiComponents.js** - Eliminado botón de tema del header del form
  - El formulario ya no incluye el toggle de tema
  - Solo muestra título y db-info

### 📊 Resumen

| Aspecto | Antes | Después |
|---------|-------|---------|
| Toggle tema | Solo en form abierto | Siempre visible |
| Título proyecto | No visible | "SPACE FORM" en header |
| Hamburguesa | Position fixed | Dentro del header |
| Layout | sidebar + workspace | header + (sidebar + workspace) |

**Archivos modificados:**
- `index.html` (nuevo header global)
- `css/styles.css` (~60 líneas nuevas/modificadas)
- `js/main.js` (toggle tema global)
- `js/components/uiComponents/UiComponents.js` (eliminado toggle del form)

---

## [0.10.0] - 2026-02-15

### ✅ Added (Agregado)

#### UI/UX
- **Sidebar colapsable responsive** - Nuevo sistema de navegación
  - Botón hamburguesa brutalista (3 líneas horizontales, sin bordes redondeados)
  - Toggle manual en desktop (click para colapsar/expandir)
  - Toggle automático en móvil (sidebar a pantalla completa)
  - Auto-cierre al seleccionar archivo `.xml` en móvil
  - Breakpoint unificado: `650px`
  - Icono animado: líneas forman "X" cuando está activo
  - Archivos: `index.html`, `css/styles.css`, `js/main.js`

### 🔧 Changed (Modificado)

#### CSS
- **Nueva sección hamburger** (`styles.css` líneas ~122-163)
  - `.hamburger-btn`: posición fixed, z-index 1001
  - `.hamburger-btn.active span`: animación a "X" (transform rotate)
  - `#sidebar.collapsed`: `margin-left: -280px` en desktop
  - `@media (max-width: 650px)`: sidebar full-width con `transform: translateX(-100%)`

- **Media query unificado** (`styles.css` líneas ~1131-1158)
  - Eliminado breakpoint duplicado `768px`
  - Todo el responsive ahora usa `650px` como punto de quiebre

#### JavaScript
- **main.js** - Lógica de toggle del sidebar
  - Constante `MOBILE_BREAKPOINT = 650`
  - Event listener para toggle con detección de modo (desktop/móvil)
  - `resize` listener para limpiar clases al cambiar de tamaño
  - Auto-cierre en móvil al seleccionar `.xml`

#### HTML
- **index.html** - Botón hamburguesa agregado antes del sidebar
  ```html
  <button id="sidebar-toggle" class="hamburger-btn" aria-label="Toggle sidebar">
      <span></span>
      <span></span>
      <span></span>
  </button>
  ```

### 🐛 Fixed (Corregido)

- **Sidebar invisible en móvil** - Breakpoint inconsistente entre CSS y JS
  - **Antes:** Media query a `768px` pero lógica JS a `650px`
  - **Ahora:** Ambos usan `650px`

- **Botón hamburguesa con borde visible en móvil** - Estilo desktop heredado
  - **Antes:** `border: 2px solid` visible en móvil
  - **Ahora:** `border: none` en media query móvil

- **Clases CSS conflictivas** - `.open` y `.collapsed` con misma especificidad
  - **Antes:** Sidebar no aparecía al hacer click
  - **Ahora:** Uso de `transform: translateX()` para móvil, `margin-left` para desktop

- **Comportamiento errático al redimensionar** - Clases persistentes
  - **Antes:** Sidebar quedaba en estado incorrecto al cambiar de tamaño
  - **Ahora:** `resize` listener limpia clases `open`, `collapsed`, `active`

### 📊 Resumen

| Aspecto | Desktop | Móvil (≤650px) |
|---------|---------|----------------|
| Sidebar visible | Sí (280px) | No (oculto) |
| Toggle | `.collapsed` | `.open` |
| Ancho sidebar | 280px | 100% (full-width) |
| Auto-cierre en .xml | No | Sí |
| Botón hamburguesa | Con borde | Sin borde |

**Archivos modificados:**
- `index.html` (agregado botón hamburguesa)
- `css/styles.css` (~50 líneas nuevas/modificadas)
- `js/main.js` (~25 líneas nuevas)

---

## [0.9.0] - 2026-02-15

### ✅ Added (Agregado)

#### Refactorización Modular (v0.9.0)

#### Documentación
- **README.md** actualizado con nueva estructura
- **CODE-MAP.md** actualizado con índices v2.0
- Jerarquía de proceso documentada en FormRenderer.js

### 🔧 Changed (Modificado)

#### JavaScript
- **FormRenderer.js** refactorizado a ~340 líneas (era ~1,260)
  - Imports de módulos separados en vez de código inline
  - Mantiene funcionalidad: render(), processLayout(), processNode()
  - Documentación de jerarquía agregada en comentarios

- **Constants centralizadas**
  - `InputField.js`: DEFAULTS = { TEXTAREA_ROWS, DATE_WIDTH, etc. }
  - `Multifield.js`: DEFAULTS = { ROWS, DISPLAY }

### 📊 Resumen

| Métrica | Antes | Después |
|---------|-------|---------|
| FormRenderer.js | ~1,260 líneas | ~340 líneas |
| Acoplamiento | Alto | Bajo |
| Testabilidad | Difícil | Fácil |
| Módulos | 1 archivo | 8 archivos |

**Archivos creados:**
- `js/components/fieldRenderer/Label.js`
- `js/components/fieldRenderer/InputField.js`
- `js/components/fieldRenderer/Checkbox.js`
- `js/components/fieldRenderer/Multifield.js`
- `js/components/fieldRenderer/index.js`
- `js/components/xmlParser/XmlParser.js`
- `js/components/xmlParser/index.js`
- `js/components/uiComponents/UiComponents.js`
- `js/components/uiComponents/index.js`

**Archivos modificados:**
- `js/components/FormRenderer.js` (refactorizado)
- `README.md` (actualizado)
- `CODE-MAP.md` (actualizado)

---

## [0.8.1] - 2026-02-01

### ✅ Added (Agregado)

#### Features
- **Tag `<border>`** - Recuadros alrededor de campos
  - Dibuja un recuadro sólido alrededor de campos
  - Estilo brutalist (border-radius: 0, **3px solid**)
  - Background transparente (usa el fondo del formulario)
  - Puede contener uno o múltiples campos
  - Compatible con containers (horizontal/vertical)
  - Similar a boxes original
  - Archivo: `FormRenderer.js` línea ~737
  - CSS: `styles.css` línea ~350

- **Atributo `align`** - Alineación de campos
  - `align="left"` (default) - Izquierda
  - `align="center"` - Centro
  - `align="right"` - Derecha
  - Útil para fechas en esquina derecha, totales, etc.
  - Archivo: `FormRenderer.js` línea ~586, ~1074
  - CSS: `styles.css` línea ~361

- **Input auto-expand to label width** - Inputs se ajustan al ancho del label
  - Lógica: `ancho_final = (size_field > size_label) ? size_field : size_label`
  - Solo aplica cuando el label (incluyendo `[?]`) es más ancho que el input
  - Medición dinámica después del renderizado
  - Clase CSS `.expand-to-label` aplicada automáticamente
  - Archivo: `FormRenderer.js` línea ~626
  - CSS: `styles.css` línea ~452

#### Ejemplos
```xml
<!-- Border con campo alineado a derecha -->
<container type="horizontal">
    <border>
        <field id="orderno" label="Número de Factura" type="text" size="5"/>
    </border>
    <field id="fecha" label="Fecha" type="date" align="right"/>
</container>

<!-- Border con múltiples campos -->
<border>
    <field id="cliente" label="Cliente" type="text" size="6"/>
    <field id="nombre" label="Nombre" type="text" size="50"/>
</border>

<!-- Input se expande al label -->
<field id="precio" label="Precio Unitario con IVA" type="number" size="5"/>
<!-- El input será más ancho que 5ch para igualar el label -->
```

#### Testing
- ✅ `forms/apps/test-border.xml` - Formulario de prueba completo
  - Ejemplo 1: Border con campo a la derecha
  - Ejemplo 2: Border con múltiples campos
  - Ejemplo 3: Campos con diferentes alineaciones
  - Ejemplo 4: Borders dentro de container horizontal

- ✅ `forms/apps/calculo-precios-menu.xml` - Caso real completo
  - Formulario estilo terminal con borders
  - Tabla de menús (multifield grid)
  - Múltiples secciones con recuadros

#### Documentación
- ✅ README.md actualizado con ejemplos de border y align
- ✅ MANUAL-DESARROLLO.md actualizado con implementación técnica
- ✅ CODE-MAP.md actualizado con líneas exactas
- ✅ CHANGELOG.md completado (este archivo)

### 🔧 Changed (Modificado)

#### JavaScript
- **processNode()** (`FormRenderer.js` línea ~698): Agregado caso 'BORDER' en switch
- **extractFieldConfig()** (`FormRenderer.js` línea ~1074): Agregado extracción de atributo `align`
- **renderInputField()** (`FormRenderer.js` línea ~586): Agregado aplicación de clases de alineación
- **createLabel()** (`FormRenderer.js` línea ~362): Help icon ahora envuelto en `help-icon-wrapper`
- **createInputElement()** (`FormRenderer.js` línea ~437): Campos usan `width` en vez de `min-width`
- **Auto-expand logic** (`FormRenderer.js` línea ~626): Medición dinámica de label vs input width

#### CSS
- **Border box** (`styles.css` línea ~350):
  - **Antes:** `border: 2px solid`, `background: var(--bg-color)`
  - **Ahora:** `border: 3px solid`, `background: transparent`

- **Horizontal container spacing** (`styles.css` línea ~187):
  - **Antes:** `gap: 1rem`
  - **Ahora:** `gap: 0.5rem`

- **Vertical spacing** - Reducido a la mitad:
  - `.form-vertical` (`línea ~326`): `gap: 1.5rem` → `0.75rem`
  - `.vertical-container` (`línea ~342`): `gap: 1.5rem` → `0.75rem`
  - `.grid-group` (`línea ~375`): `gap: 1.5rem` → `0.75rem`

- **Tooltip positioning** (`styles.css` línea ~703):
  - Agregado `.help-icon-wrapper` con `position: relative`
  - Tooltip ahora posicionado relativo al icono `[?]` en vez del campo completo
  - Labels, `.field-row`, `.field-block-horizontal` con `overflow: visible`

- **Input expand to label** (`styles.css` línea ~452):
  - Nueva clase `.expand-to-label` con `min-width: 100%`
  - Aplicada dinámicamente cuando `labelWidth > inputWidth`

### 🐛 Fixed (Corregido)

- **Tooltip position** - Tooltips ahora aparecen debajo del icono `[?]` en vez de debajo del campo completo
  - Mejor UX: ayuda visual justo donde el usuario hace click
  - Implementado con wrapper: `<span class="help-icon-wrapper">`

- **Input width mismatch** - Inputs pequeños con labels largos ahora se expanden
  - **Antes:** Labels largos con inputs pequeños se veían desbalanceados
    ```
    [?] Número de Factura:
    [___]  ← Input muy pequeño
    ```
  - **Ahora:** Input se expande al ancho del label
    ```
    [?] Número de Factura:
    [___________________]  ← Input iguala al label
    ```

- **Inputs grandes innecesariamente expandidos** - Solo expande cuando es necesario
  - Campos con labels cortos (ej: "IVA") mantienen su tamaño original
  - Lógica condicional: solo aplica `.expand-to-label` si `labelWidth > inputWidth`

### 📊 Resumen de Cambios

**Archivos modificados:**
- `FormRenderer.js`: 6 secciones modificadas, 2 métodos nuevos
- `styles.css`: 10 secciones modificadas
- `README.md`: Agregada sección Border y Align
- `MANUAL-DESARROLLO.md`: Agregadas secciones 5 y 6
- `CODE-MAP.md`: Actualizadas líneas de código

**Formularios creados:**
- `forms/apps/test-border.xml` (testing)
- `forms/apps/calculo-precios-menu.xml` (caso real)

**Líneas de código:** ~150 líneas modificadas/agregadas

---

## [0.8.0] - 2026-02-01

### ✅ Added (Agregado)

#### Features
- **Multifield auto-detection** (Fase 1 y 2)
  - Detección automática: 1 campo hijo → textarea
  - Detección automática: N campos hijos → grid/tabla
  - Conversión de atributos `rows` y `display`
  - Navegación con botones Anterior/Siguiente en grids
  - Indicador "1-7 de N" en grids
  - Readonly según atributos `display-only` y `skip`
  - Archivo: `FormRenderer.js` líneas 744-1050

- **Sistema de Help Tooltips**
  - Icono `[?]` en verde phosphor (#00ff00)
  - Click para mostrar/ocultar tooltip
  - Tooltips estilo terminal (negro con borde verde)
  - Prompt `> help campo` en tooltip
  - ESC y click-outside para cerrar
  - Event bubbling prevention
  - Archivo: `FormRenderer.js` líneas 346-388

- **Campos básicos completos**
  - text, number, date, time, email, tel
  - **textarea** con atributo explícito `type="textarea"`
  - Default 3 rows para textareas
  - Date field width: 17ch (sin overlap de calendario)
  - Archivo: `FormRenderer.js` líneas 395-550

- **Validaciones básicas**
  - `<required>true</required>`
  - `<check>expr</check>` (expresiones simples)
  - `<between min="X" max="Y"/>`
  - Operadores: `>`, `<`, `>=`, `<=`, `==`, `!=`
  - Archivo: `Validator.js`

- **Containers (Layout)**
  - Container vertical (default)
  - Container horizontal
  - Atributo `aligned_labels` para grids
  - Archivo: `FormRenderer.js` líneas 555-650

#### Estilos Terminal/Brutalist
- **Border radius: 0** (sin esquinas redondeadas)
- **Bordes gruesos**: 2-3px sólidos
- **Fuente monospace**: JetBrains Mono, Courier New
- **Labels UPPERCASE** con letter-spacing
- **Verde phosphor** (#00ff00) para help icons
- **Sin sombras** (box-shadow: none)
- **Alto contraste**: fondo #1a1a1a, texto #e0e0e0
- **Padding compacto**: 0.4rem en inputs
- Archivo: `styles.css` líneas 100-450

#### Documentación
- ✅ `README.md` - Inicio rápido y ejemplos
- ✅ `MANUAL-DESARROLLO.md` - Manual exhaustivo (25+ páginas)
- ✅ `CODE-MAP.md` - Mapa de líneas de código
- ✅ `ROADMAP.md` - Plan de features faltantes
- ✅ `DOCS-INDEX.md` - Índice maestro
- ✅ `CHANGELOG.md` - Este archivo
- ✅ `forms/MULTIFIELD-GUIDE.md` - Guía de multifields

#### Formularios de Ejemplo
- `forms/simple-form.xml` - Ejemplo básico actualizado
- `forms/apps/test-multifield.xml` - Testing de multifields
- `forms/apps/imail.xml` - Caso real

### 🔧 Changed (Modificado)

- **Date field width**: 12ch → 16ch → 17ch (final)
  - Previene overlap con icono de calendario
  - Archivo: `FormRenderer.js` línea ~417

- **Input padding**: 0.7rem → 0.4rem
  - Diseño más compacto (brutalist)
  - Archivo: `styles.css` línea ~393

- **Help messages**: Inline text → Click-to-show tooltips
  - Elimina overflow horizontal
  - Mejor UX en espacios reducidos
  - Archivo: `FormRenderer.js` + `styles.css`

- **Labels**: Horizontal → Top-aligned (vertical)
  - Labels arriba de inputs en vez de al lado
  - Mejor para diseño terminal/brutalist
  - Archivo: `styles.css` líneas 270-380

- **Textarea detection**: Hardcoded ID → Explicit `type="textarea"`
  - Eliminado: `if (id === 'message')`
  - Agregado: `if (type === 'textarea')`
  - Archivo: `FormRenderer.js` línea ~395

### 🐛 Fixed (Corregido)

- **Date field calendar icon overlap**
  - Width insuficiente ocultaba el año (2026)
  - Solución: Incremento a 17ch
  - Commit: "fix(date): Increase width to prevent calendar overlap"

- **Help tooltips invisibles**
  - Causa 1: `overflow: hidden` en contenedores → Cambiado a `overflow: visible`
  - Causa 2: Event bubbling → Agregado `e.stopPropagation()`
  - Causa 3: z-index bajo → Incrementado a 9999
  - Archivo: `styles.css` línea ~260, `FormRenderer.js` línea ~382

- **Duplicate textarea logic**
  - Eliminado chequeo hardcoded de `id === 'message'`
  - Unificado en check de `type === 'textarea'`
  - Archivo: `FormRenderer.js` línea ~395

- **Help messages overflow**
  - Tooltips reemplazan inline messages
  - Elimina completamente el problema de overflow
  - Archivo: `FormRenderer.js` líneas 346-388

### 📚 Documentation (Documentación)

- Manual exhaustivo con:
  - Arquitectura completa del proyecto
  - Mapeo NILIX FDL → Space Form XML
  - Features implementados (tablas comparativas)
  - Features faltantes (con prioridades)
  - Guía: Dónde hacer cada tipo de cambio
  - Debugging: Problemas comunes y soluciones
  - Roadmap práctico con implementación paso a paso
  - Índice maestro de documentación

- Mapa de código con líneas exactas:
  - FormRenderer.js: ~1,200 líneas indexadas
  - styles.css: ~900 líneas indexadas
  - Quick reference para cambios comunes

- Guía específica de multifields:
  - Detección automática (textarea vs grid)
  - Conversión de atributos FDL
  - Ejemplos completos
  - Comparación de sintaxis

### 🔒 Security (Seguridad)

- Sin cambios de seguridad en esta versión

### ⚠️ Deprecated (Deprecado)

- Ninguno

### 🗑️ Removed (Eliminado)

- Hardcoded textarea detection (línea `if (id === 'message')`)
- Inline help messages (reemplazados por tooltips)

---

## [0.7.0] - 2026-01-31 (Antes de esta sesión)

### Added
- ExpressionEngine básico para evaluación de expresiones
- PersistenceService con LocalStorage
- Validator con validaciones básicas
- Container support (horizontal/vertical)

### Fixed
- Varios bugs visuales menores
- Alineación de containers

---

## [0.6.0] - 2026-01-30

### Added
- FormRenderer básico
- Parsing de XML
- Campos simples (text, number, date)
- Estilos CSS básicos

---

## [0.5.0] - 2026-01-29

### Added
- Estructura inicial del proyecto
- Documentación FDL (MForm.txt)

---

## Tipos de Cambios

- **Added** - Para funcionalidad nueva
- **Changed** - Para cambios en funcionalidad existente
- **Deprecated** - Para funcionalidad que será removida
- **Removed** - Para funcionalidad removida
- **Fixed** - Para corrección de bugs
- **Security** - Para vulnerabilidades de seguridad

---

## Versioning

Este proyecto usa [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (ej: 1.2.3)
- **MAJOR** - Cambios incompatibles de API
- **MINOR** - Funcionalidad nueva compatible hacia atrás
- **PATCH** - Correcciones de bugs compatibles

---

## Links

- [Unreleased]: Próxima versión (en desarrollo)
- [0.14.0]: Dynamic select con lookup BD (2026-02-16)
- [0.13.0]: SQLite + API catalogs + in-table validation (2026-02-16)
- [0.12.0]: type="select" dropdown (2026-02-16)
- [0.11.0]: Header global + toggle tema siempre visible (2026-02-15)
- [0.10.0]: Sidebar responsive colapsable (2026-02-15)
- [0.9.0]: Refactorización modular (2026-02-15)
- [0.8.1]: Versión anterior (2026-02-01)
- [0.8.0]: Versión con multifields (2026-02-01)
- [0.7.0]: Sesión anterior
- [0.6.0]: FormRenderer básico
- [0.5.0]: Estructura inicial

---

## Próxima Versión (0.15.0)

### Planificado
- [ ] Atributo `is` básico (campos virtuales simples)
- [ ] Read de registros desde BD (cargar formulario completo)
- [ ] Testing exhaustivo

**Fecha estimada:** 2026-02-23

---

## Versión 1.0.0 (Objetivo)

### Requisitos para v1.0
- ✅ Campos básicos completos
- ✅ Multifields (textarea y grid)
- ✅ Validaciones básicas
- ✅ Help tooltips
- ✅ Estilos brutalist
- ✅ Arquitectura modular (0.9.0)
- ✅ Sidebar responsive colapsable (0.10.0)
- ✅ Header global (0.11.0)
- ✅ type="select" (0.12.0)
- ✅ SQLite + API catalogs (0.13.0)
- ✅ in-table validation (0.13.0)
- ✅ Dynamic select con lookup (0.14.0)
- [ ] Atributo `is` completo
- [ ] Read de registros
- [ ] Testing completo (unit + integration)

**Cobertura actual:** ~75%

**Fecha estimada:** 2026-03-01

---

**Mantenido por:** Claude Code / GLM
**Última actualización:** 2026-02-16 (v0.14.0)
