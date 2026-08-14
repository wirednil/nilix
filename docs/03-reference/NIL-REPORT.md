# NIL-REPORT — Manual de Reportes Nilix

**Versión:** 1.8 — §10.8 nuevo: `if(cond, verdadero, falso)` no evalúa
aritmética compuesta en sus ramas — solo nombre de campo / literal / string.
Verificado en vivo: rompe silenciosamente cálculos como el punto de
equilibrio (`if(ventas>0, formula_compuesta, 0)`) sin ningún error en
consola. Encontrado auditando un plan de implementación real que usaba
exactamente ese patrón. Workaround documentado (precomputar aparte, elegir
con `if()` entre campos ya resueltos). 2026-08-14.

Versión 1.7 — §10 ampliada a 7 puntos tras revisión independiente
(agente con herramientas reales, sin acceso previo a §10): `kind` obligatorio
como primer punto (10.1, el bug más repetido), por qué una `VIEW` no sirve
para combinar tablas (10.5, `schemaService.tableExists` filtra `type='table'`
únicamente), `filter:` no acepta rangos de fecha (10.7). También: warning
agregado dentro de `sys/report/nil-audit.yaml`/`nil-users.yaml` — esos
archivos no tienen `kind:` y no deberían copiarse como plantilla, algo que
antes solo decía la doc y no el archivo mismo. 2026-08-13.

Versión 1.6 — agrega §10 "Límites y garantías del motor" (un solo nivel
de quiebre, `scope: dataset` global vs `scope: lookahead` sin filter, joins
sin agregación cruzada, apertura real de reportes desde el menú) — hechos
que antes solo vivían en el código fuente del motor, no en este documento.
2026-08-13.

Versión 1.5 — agrega `kind`/rol de zona (§5.4), corrige `layout` (`nav`
reemplaza a `horizontal-scroll`, `grid` no es un valor real de `layout`),
corrige el ejemplo de §5.3 (`layout: table` con `condition` no renderiza),
corrige §7.5 (`#` en zonas header/footer/subtotal ya no se muestra literal).
Reestructuración kind/document/ledger, 2026-07-24/25.
**Basado en:** REP-SPEC.md (Capítulo 17, IDEA-FIX RDL) + implementación nilix v2.5.3
**Formato nativo:** YAML (reemplaza el RDL textual del legado)

---

## Índice

1. [Conceptos fundamentales](#1-conceptos-fundamentales)
2. [Estructura del archivo YAML](#2-estructura-del-archivo-yaml)
3. [Sección `fields`](#3-sección-fields)
4. [Sección `dataSources`](#4-sección-datasources)
5. [Sección `zones`](#5-sección-zones)
   - [5.4 `kind` del reporte y rol de zona](#54-kind-del-reporte-y-rol-de-zona)
6. [Condiciones de impresión](#6-condiciones-de-impresión)
7. [Expresiones y templates](#7-expresiones-y-templates)
   - [7.5 Markdown en templates](#75-markdown-en-templates)
   - [7.5 `rowTemplate` — tabla GFM iterada](#rowtemplate--tabla-gfm-con-datos-iterados)
8. [Funciones de agregación](#8-funciones-de-agregación)
9. [Acceso público y multi-tenant](#9-acceso-público-y-multi-tenant)
10. [Límites y garantías del motor](#10-límites-y-garantías-del-motor--lo-que-no-podés-asumir-sin-leer-código)
11. [Equivalencias RDL → YAML](#11-equivalencias-rdl--yaml)
12. [Funcionalidades pendientes](#12-funcionalidades-pendientes)

---

## 1. Conceptos fundamentales

Un reporte nilix es un archivo `.yaml` que describe:

- **Qué datos** obtener (tablas, joins, filtros, orden)
- **Cuándo imprimir** cada zona (antes/después del reporte, ante cambios de campo)
- **Cómo se ve** cada zona (template con `{placeholders}`, agregados)

El motor ejecuta el reporte en el browser (`report.html`), consulta datos vía API, y renderiza HTML. No produce texto de ancho fijo como el RDL original — produce HTML responsivo.

**Pipeline de ejecución:**
```
YAML → YamlParser → ReportSchema
                  → DataSourceManager (carga datos, join, orden)
                  → BreakDetector (detecta cortes de control)
                  → ReportRenderer (zones → HTML DOM)
```

---

## 2. Estructura del archivo YAML

```yaml
name: nombre_del_reporte          # Identificador único
description: Descripción legible  # Opcional
public: false                     # true = accesible sin login (ver §9)

config:
  paginationMode: scroll          # Solo 'scroll' implementado
  markdown: false                 # true = habilita Markdown en templates (ver §7.5)
  outputFormat: web               # web | pdf | thermal (declarativo; ver nota abajo)

fields: [...]                     # Definición de campos (§3)
dataSources: {...}                # Fuentes de datos (§4)
zones: [...]                      # Zonas de salida (§5)

meta:
  version: "1.0"
  author: ""
  createdAt: ""
```

> **`config.outputFormat`:** campo declarativo/informativo que indica el destino esperado del reporte. `web` (default) = visualización en browser. `pdf` = destino impresión/PDF. `thermal` = ticket de impresora térmica. El motor no altera su comportamiento en función de este valor actualmente; se usa como documentación del propósito del reporte y puede usarse en CSS (`@media print`) o en futuras versiones del motor.

### Botón "Imprimir / PDF"

`report.html` incluye un botón fijo "Imprimir / PDF" siempre visible en la esquina inferior derecha de la pantalla. Al pulsarlo, invoca `window.print()`, lo que abre el diálogo de impresión del navegador (también permite guardar como PDF). El botón se oculta automáticamente con `@media print` para no aparecer en la salida impresa ni en el PDF generado.

---

## 3. Sección `fields`

Define el catálogo de campos disponibles para el reporte. Equivale a la sección `%fields` del RDL.

```yaml
fields:
  - name: prod_nombre             # Nombre lógico del campo (usado en templates y expresiones)
    type: string                  # string | numeric | float | date | time | boolean
    length: 40                    # Longitud de display
    decimals: 2                   # Solo para numeric/float

    dbRef:                        # Referencia a columna de base de datos
      table: productos
      field: nombre

    references:                   # FK → lookup en otra tabla
      table: categorias
      field: id_categoria         # Columna clave en la tabla referenciada
      displayField: nombre        # Columna a mostrar

    resolvedFrom: prod_id_cat     # Nombre del campo fuente de la FK a resolver

    escape: true                  # (opcional) Markdown-escapa el valor antes de insertarlo
                                  # en el template. Solo relevante cuando config.markdown: true.
                                  # Usar en campos con texto libre ingresado por usuarios.
```

### Tipos disponibles

| Tipo | Descripción |
|------|-------------|
| `string` | Texto |
| `numeric` | Entero |
| `float` | Decimal |
| `date` | Fecha |
| `time` | Hora |
| `boolean` | Booleano (1/0) |

---

## 4. Sección `dataSources`

Define las fuentes de datos. Equivale al `USE` del RDL más la especificación del orden de entrada.
El orden de `orderBy` es crítico: determina los cortes de control.

> **Nota de origen:** En RDL el filtrado de datos no era responsabilidad del reporte — los datos llegaban pre-filtrados vía `SELECT ... WHERE ... output to report` o `input from pipe "sql ..."`. El `filter:` y los `joins:` son adiciones propias de nilix, que unifica la definición de datos y de presentación en un único archivo YAML.

```yaml
dataSources:
  productos:                      # Nombre de la fuente (referenciado en zones)
    table: productos              # Tabla principal
    orderBy:
      - id_categoria              # Primer nivel de corte
      - nombre                   # Segundo nivel de orden dentro del grupo
    filter: "activo = true"       # Filtro WHERE (sintaxis simple, ver §4.1)
    joins:
      - from: id_categoria        # Campo FK en la tabla principal
        to: categorias.id_categoria  # tabla.campo referenciado
        include:
          - nombre                # Columna(s) a traer de la tabla join
```

### Joins encadenados

El campo `from:` de un join puede referenciar una columna traída por un join anterior, no solo campos de la tabla principal. El motor resuelve el `from:` buscando en el resultado acumulado de todos los joins previos en orden de declaración.

```yaml
dataSources:
  orden:
    table: ordenes
    filter: "id_orden = :id_orden"
    joins:
      - from: id_equipo
        to: equipos.id_equipo
        include: [tipo, marca_modelo, numero_serie, id_cliente]
      - from: id_cliente          # viene del join anterior (equipos), no de ordenes
        to: clientes.id_cliente
        include: [nombre_completo, telefono]
```

En el ejemplo, `ordenes` no tiene columna `id_cliente`; el valor lo aporta el primer join sobre `equipos`. El segundo join lo usa correctamente.

> Funciona tanto en el path JS (`DataSourceManager.js`) como en el path DuckDB.

### 4.1 Sintaxis de `filter`

Solo soporta comparaciones simples:

```yaml
filter: "campo = valor"
filter: "activo = true"           # → WHERE activo = 1
filter: "estado = 'Pendiente'"    # → WHERE estado = 'Pendiente'
```

> **No implementado aún:** `IN`, `LIKE`, `>`, `<`, expresiones compuestas.

### 4.2 Parámetros de URL en `filter`

El `filter` puede contener marcadores de la forma `:nombre_param` que se sustituyen con valores recibidos por URL al cargar el reporte. Esto permite generar reportes filtrados por un registro específico, por ejemplo desde la directiva `<output>` de un formulario.

**URL de ejemplo:**

```
report.html?file=comprobante_ingreso&id_orden=5
```

**YAML:**

```yaml
dataSources:
  orden:
    table: ordenes
    filter: "id_orden = :id_orden"
```

En tiempo de carga, `:id_orden` se reemplaza con `5` → `WHERE id_orden = 5`.

**Reglas de sustitución:**

| Tipo de valor | Comportamiento |
|---|---|
| Numérico | Se inyecta directamente sin comillas |
| String | Se valida contra lista blanca de caracteres permitidos y se entrecomilla con comillas simples |
| Parámetro ausente | El motor lanza un error visible en `report.html` |
| Caracteres inválidos en string | También producen error (protección contra inyección) |

Los parámetros de URL pueden combinarse con cualquier dataSource del reporte. Un reporte puede recibir múltiples parámetros simultáneamente si el YAML los referencia.

---

## 5. Sección `zones`

Una zona es una unidad de salida. Equivale a la definición `%zone` del RDL.

```yaml
zones:
  - name: encabezado_reporte      # Nombre único
    condition:
      when: before
      on: report                  # Se imprime una vez al inicio
    expressions:
      - name: titulo
        value: "Listado de Productos"
    template:
      - "============================="
      - "{titulo}"
      - "============================="

  - name: cabecera_categoria
    dataSource: productos         # Fuente de datos que itera esta zona
    condition:
      when: before
      on: [prod_id_categoria]     # Se imprime ante cambio de id_categoria
    expressions:
      - name: cat_nombre
        field: cat_nombre         # Campo definido en fields o traído por join
    template:
      - ""
      - "── {cat_nombre} ──"

  - name: detalle
    dataSource: productos
    expressions:
      - name: nombre
        field: prod_nombre
      - name: precio
        field: prod_precio
        format: currency
    template:
      - "  {nombre}  ${precio}"

  - name: subtotal_categoria
    dataSource: productos
    condition:
      when: after
      on: [prod_id_categoria]     # Se imprime al cerrar cada categoría
    expressions:
      - name: total_cat
        aggregate: sum
        argument: prod_precio
        format: currency
    template:
      - "  Subtotal: ${total_cat}"

  - name: total_reporte
    condition:
      when: after
      on: report                  # Se imprime una vez al final
    expressions:
      - name: gran_total
        aggregate: sum
        argument: prod_precio
        format: currency
    template:
      - "============================="
      - "TOTAL: ${gran_total}"
```

### 5.1 Propiedades de una zona

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `name` | string | Identificador único |
| `dataSource` | string | Fuente de datos a iterar |
| `condition` | object | Cuándo imprimir (ver §6) |
| `layout` | string | `vertical` (default) \| `lines` \| `table` \| `nav` \| `horizontal-scroll` (deprecado, ver nota) |
| `expressions` | array | Campos calculados o referencias (ver §7) |
| `template` | array | Líneas de salida con `{placeholders}` (no aplica con `layout: table`) |
| `columns` | array | Definición de columnas, solo con `layout: table` (ver §5.2) |
| `noPrint` | boolean | Zona procesada pero no renderizada |

> **`layout: vertical` es el default explícito** — cualquier zona sin `layout:` declarado
> se comporta como si dijera `layout: vertical` (`YamlParser.js` — `z.layout || 'vertical'`).
> Renderiza vía `renderCardZone()` (`.report-card`): útil para zonas de detalle simples,
> una tarjeta por registro.

> **`layout: nav` (agregado 2026-07-24, antes `horizontal-scroll`).** Selecciona la
> barra de navegación sticky por categorías (`.report-nav`, `renderNavZone()`) — solo
> válido en una zona con `condition: {when: before, on: report}`. El nombre anterior,
> `horizontal-scroll`, describía un efecto visual presunto en vez del rol que en
> realidad selecciona (navegación, no scroll); **sigue funcionando como alias
> deprecado** (mismo resultado, `ReportRenderer.js` acepta ambos) para no romper YAMLs
> que ya lo usen — pero usar `nav` en YAMLs nuevos.
>
> **Criterio de eliminación del alias** (no es "algún día"): se borra el branch
> `layout === 'horizontal-scroll'` de `ReportRenderer.js`/`YamlParser.js` cuando
> se cumplan **las dos** condiciones — (a) `grep -rl "horizontal-scroll"` sobre
> todos los `.yaml` de producción da cero resultados, **y** (b) existe al menos
> un `.yaml` real usando `layout: nav` que confirme que el reemplazo funciona
> en producción, no solo en un caso sintético de esta sesión. Hoy (a) se
> cumple trivialmente — ningún reporte usa ninguno de los dos — pero (b) no,
> así que el alias se queda: no hay reemplazo probado todavía.
>
> Semánticamente, una zona `nav` solo tiene sentido en reportes `kind: document`
> (el caso canónico es una carta/menú navegable por categoría) — ver §5.4.

> **`grid` NO es un valor de `layout` real** — a pesar de que versiones previas de
> este documento lo listaban como si lo fuera. Comprobado por grep contra
> `ReportRenderer.js`/`ReportEngine.js`: no existe ninguna comparación
> `layout === 'grid'` en el motor. Si una zona declara `layout: grid` hoy, el
> valor se ignora en silencio y la zona cae al comportamiento de `vertical`
> (tarjeta). Lo que sí es real es `.report-products-grid`
> (`ReportEngine.js:119`, `createProductsGrid()`): el motor envuelve el conjunto
> de zonas de detalle de **cada** corte/grupo en un contenedor CSS Grid
> (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, `gap: 1rem`)
> — **siempre, incondicionalmente, sin que ninguna zona lo pida.** Si el grupo
> contiene una zona `layout: lines`, un selector CSS (`.report-products-grid:has(.report-lines)`)
> colapsa el grid a una sola columna sin gap. No hay forma de configurar columnas
> o gap desde el YAML — es estructural, no una opción de zona. Documentado tal
> como se comporta hoy; que no sea configurable es una limitación conocida, no
> una feature pendiente de esta fase.

### 5.2 `layout: lines`

Renderiza el template como texto plano monospace sin card-borders ni grilla. Ideal para encabezados y pies con alineación manual.

```yaml
- name: dia_header
  layout: lines
  condition: { when: before, on: [fecha] }
  dataSource: movimientos
  expressions:
    - name: fecha_completa
      field: fecha
      format: dayname
  template:
    - ""
    - "{fecha_completa}"
    - "─────────────────────────────"
```

### 5.3 `layout: table`

Renderiza una zona como tabla HTML con encabezado y columnas configurables. No usa `template`.

```yaml
- name: resumen_tabla
  layout: table
  condition: { when: after, on: report }
  columns:
    - { field: tipo,     label: "Tipo",      width: "20%", align: left }
    - { field: categoria, label: "Categoría", width: "45%", align: left }
    - { field: monto_fmt, label: "Monto",     width: "35%", align: right }
```

| Propiedad de columna | Descripción |
|----------------------|-------------|
| `field` | Nombre de la expresión (debe estar en `expressions` de la misma zona o en el contexto) |
| `label` | Texto del encabezado |
| `width` | Ancho (porcentaje o valor CSS) |
| `align` | `left` \| `right` \| `center` |
| `format` | Formato opcional (mismos valores que §7.2) |

> **⚠️ El ejemplo de arriba no renderiza como tabla — confirmado en vivo (2026-07-24).**
> `layout: table` solo llega al renderer de tabla real (`renderTableZone()`,
> el que lee `columns`) cuando la zona **no tiene `condition:`** — es decir,
> como zona de detalle, una vez por registro (y ahí arma una tabla de 1 fila
> por llamada, con su propio `<thead>` cada vez, no una tabla de N filas).
> Una zona `layout: table` **con** `condition: {when: after, on: report}` —
> como el ejemplo de arriba — se enruta a `renderFooterZone()` (usa
> `template`, ignora `columns` por completo). Sin `template`, esa zona
> renderiza un `<div class="report-footer">` vacío. Esto no es hipotético:
> es exactamente la forma de la zona `resumen_tabla` en
> `flujo_mensual_nivel1.yaml`, verificada en vivo renderizando 0 hijos.
> **Hoy no existe una forma de producir una tabla HTML de N filas desde un
> `dataSource` vía `layout: table`** — la única vía que funciona para eso es
> `rowTemplate` con `markdown: true` (§7.5). Este ejemplo queda documentado
> tal cual estaba (para no inventar un comportamiento distinto al legado),
> pero no lo copies esperando que funcione.

### 5.4 `kind` del reporte y rol de zona

Todo reporte declara `kind: document` o `kind: ledger` — **obligatorio desde
2026-07-25** (antes de eso el motor lo inferÍa de las zonas presentes y solo
avisaba con un warning; la inferencia se retiró, pero el mismo cálculo se
reusa hoy para sugerir un valor en el mensaje de error, no se descartó).

```yaml
name: flujo_mensual
kind: ledger
```

Un reporte sin `kind`, o con un valor que no sea `document`/`ledger`, no
carga — `YamlParser.buildSchema()` tira un error visible en `report.html`
que nombra el reporte, dice qué está mal, lista los valores válidos, y
sugiere el `kind` que el reporte parece ser según sus zonas.

**`kind` no es lo mismo que `layout` ni que el `zoneType` que usa el
renderer.** Cada zona tiene un **rol** semántico, derivado de su
`condition.when`/`condition.on` y de si tiene una expresión `aggregate` —
**no** de su `layout`. Esto importa porque casi todos los reportes reales
ponen `layout: lines` en casi todas sus zonas (para el `||` de alineación
manual), lo que colapsa el `zoneType` que calcula `ReportRenderer.js` a
`'lines'` para ~90% de las zonas sin importar su rol real — un validador
construido sobre `zoneType` no distinguiría nada. Por eso el rol se calcula
aparte, en `YamlParser.js` (`classifyZoneRole()`), independiente del renderer.

| Rol | Cuándo se asigna |
|---|---|
| `header` | `condition: {when: before, on: report}` |
| `nav` | ídem, con `layout: nav` (o el alias deprecado `horizontal-scroll`, ver §5.1) |
| `footer` | `condition: {when: after, on: report}`, sin ninguna expresión `aggregate` |
| `total` | ídem, pero con al menos una expresión `aggregate` |
| `separator` | `condition: {when: before, on: [campo(s)]}` |
| `subtotal` | `condition: {when: after, on: [campo(s)]}` |
| `body` | sin `condition` — zona de detalle, una vez por registro |

Roles legales por `kind` (`ZONE_ROLES_BY_KIND` en `YamlParser.js` — copiado
del código, no reconstruido de memoria):

| `kind` | Roles permitidos |
|---|---|
| `document` | `header`, `nav`, `separator`, `footer`, `body` |
| `ledger` | `header`, `separator`, `subtotal`, `total`, `footer`, `body` |

Una zona con rol fuera del set de su `kind` — ej. una zona `nav` en un
`ledger`, o una zona `total` en un `document` — tira el mismo tipo de error
que un `kind` faltante, nombrando la zona ofensora.

**Pendiente, documentado a propósito y no por omisión:**

- **`ReportEngine.renderDetail()` no soporta múltiples zonas de rol `body`
  sobre `dataSource`s independientes** dentro de un mismo reporte — itera
  solo el `dataSource` de la primera, y aplica todas sobre esos registros.
  Ningún reporte real lo ejercita hoy (`estado_taller.yaml` fue reescrito
  para usar un solo `dataSource` + corte por campo en vez de esto). Ver el
  comentario inline en `ReportEngine.js` (método `renderDetail`, fecha
  2026-07-24) para el detalle — no se arregló por falta de caso vivo, no por
  descuido.
- **Agrupar por un valor calculado** (ej. combinar dos valores crudos de un
  campo en una sola sección, lo que `estado_taller.yaml` intentaba con un
  filtro `IN(...)` que nunca funcionó) **no está soportado, y es una
  decisión consciente, no una omisión.** `groupByCategory()` agrupa sobre
  `record[breakField]` crudo, antes de evaluar cualquier `expression`. Se
  evaluó agregarlo (Fase 5 de la reestructuración de 2026-07) y se descartó:
  el único caso que lo hubiera necesitado agrupaba contra un valor que ni
  siquiera existe en los datos reales del dominio ("Para Revisar" no es un
  `estado` real en `servicio_tecnico.db`). No hay caso de uso real
  pendiente — si aparece uno, es una feature nueva a evaluar entonces, no
  una que "faltó terminar" acá.
- **`nil-audit.yaml`/`nil-users.yaml`** fueron sacados del motor de reportes
  (no son `document` ni `ledger` — eran listados planos sobre datos vivos
  con `rowTemplate`, sin cortes ni agregación). `report.html` los rechaza
  con un mensaje que apunta a `docs/02-architecture/DATA-GRID-PROPOSAL.md`,
  donde está la spec de columnas/filtros para el data-grid que los
  reemplaza — no implementado todavía.

---

## 6. Condiciones de impresión

Equivalen a las cláusulas `before`/`after` del RDL.

```yaml
condition:
  when: before | after
  on: report | page | campo | [campo1, campo2]
```

### Tabla de condiciones

| `when` | `on` | RDL equivalente | Descripción |
|--------|------|-----------------|-------------|
| `before` | `report` | `before report` | Una vez al inicio del reporte |
| `after` | `report` | `after report` | Una vez al final del reporte |
| `before` | `[campo]` | `before campo` | Ante cada cambio de valor del campo |
| `after` | `[campo]` | `after campo` | Al cierre de cada grupo del campo |
| `before` | `[c1, c2]` | `before (c1, c2)` | Ante cambio en cualquiera de los campos |
| `after` | `[c1, c2]` | `after (c1, c2)` | Al cierre por cualquiera de los campos |

> **`before page` / `after page`:** No implementados. No hay paginación real — el modo es scroll continuo.

### Zona sin condición

Una zona sin `condition` se imprime por cada fila del `dataSource` (zona de detalle).

---

## 7. Expresiones y templates

### 7.1 Definición de expresiones

```yaml
expressions:
  - name: precio_fmt             # Nombre usado en el template
    field: prod_precio           # Campo fuente (de fields o de join)
    format: currency             # Formato de salida

  - name: etiqueta
    value: "Precio de lista:"    # Valor literal constante

  - name: subtotal
    aggregate: sum               # Función de agregación
    argument: prod_precio        # Campo a agregar
    format: currency

  - name: icono                  # Expresión condicional (ver §7.4)
    formula: "if(tipo == 'Ingreso', '↓', '↑')"

  - name: balance_previo         # Lookahead: agrega el grupo ANTES de renderizarlo (ver §8.2)
    aggregate: sum
    argument: monto
    scope: lookahead
    format: currency

  - name: total_ingresos         # Dataset: agrega todo el reporte con filtro opcional (ver §8.3)
    aggregate: sum
    argument: monto
    scope: dataset
    filter: "tipo == 'Ingreso'"
    format: currency
```

### 7.2 Formatos disponibles

| Formato | Ejemplo entrada | Ejemplo salida |
|---------|----------------|----------------|
| `currency` | `12500` | `$12.500,00` |
| `currency` | `-3200` | `-$3.200,00` |
| `upper` | `hola mundo` | `HOLA MUNDO` |
| `lower` | `HOLA MUNDO` | `hola mundo` |
| `date` | `2026-03-20` | `20/03/2026` |
| `dayname` | `2026-03-20` | `Jueves 20/03/2026` |
| `"2.2"` | `1234.5` | `1234.50` |

> **`currency`:** usa `toLocaleString('es-AR')` → separador de miles `.`, decimal `,`. Negativos con prefijo `-$`.
> **`dayname`:** siempre usa locale `es-AR` independientemente del idioma del browser.

### 7.3 Sintaxis de templates

Los templates son líneas de texto con `{placeholders}`:

```yaml
template:
  - "Nombre: {prod_nombre}"
  - "Precio: {prod_precio:currency}"   # formato inline
  - "---"                              # separador literal
  - ""                                 # línea en blanco
  - "  {concepto}  {monto_fmt} || [{metodo}]"  # alineación derecha
```

Los placeholders buscan el campo por nombre. Si no lo encuentran directamente, intentan variantes con prefijos (`prod_`, `cat_`, etc.).

**Alineación derecha — `||`** (solo `layout: lines`)

El separador `||` divide la línea en dos partes: la izquierda queda alineada a la izquierda y la derecha al extremo derecho del contenedor:

```
  Cobro orden — iPhone 11  $15.000,00        [Transferencia]
```

Implementado como `display: flex; justify-content: space-between` en `.report-lines-split`.

### 7.4 Fórmulas — `formula:`

`formula:` admite dos variantes: expresiones condicionales `if()` y expresiones aritméticas directas.

#### Condicional — `if(condición, valorSiTrue, valorSiFalse)`

```yaml
- name: icono
  formula: "if(tipo == 'Ingreso', '↓', '↑')"
```

**Condiciones soportadas directamente** (sin eval):
```
campo == 'valor'       campo != 'valor'
campo == número        campo != número
campo > número         campo < número
campo >= número        campo <= número
```

**Valores** pueden ser:
- Literal string con comillas simples: `'texto'`
- Número: `0`, `1.5`, `-100`
- Nombre de campo del contexto: `monto_fmt`

> **Nota:** condiciones compuestas (`&&`, `||`) usan `Function()` con `isConditionSafe` como guardia de seguridad.

#### Aritmética directa

`formula:` también acepta expresiones aritméticas simples entre campos del contexto:

```yaml
expressions:
  - name: saldo
    formula: "total - sena_pagada"
  - name: subtotal
    formula: "precio * cantidad"
```

Los nombres de campo se resuelven en el contexto de la fila (datos del registro). La expresión se valida contra `/^[\d\s+\-*/.()]+$/` antes de ser evaluada. Campos no numéricos o ausentes producen cadena vacía como resultado.

---

### 7.5 Markdown en templates

Activar con `config.markdown: true`. Cuando está activo, los templates de todas las zones se procesan con **marked.js v12** (GFM). Reportes sin el flag siguen renderizando como texto plano.

#### Habilitación

```yaml
config:
  markdown: true
```

#### Inline vs bloque según tipo de zona

El parsing markdown varía según la zone:

| Tipo de zone | Parser usado | Elementos disponibles |
|---|---|---|
| `lines` | `marked.parse()` | Todos (inline + bloque) |
| `header`, `footer`, `subtotal` | `marked.parseInline()` + strip de `#` líder | Solo inline (ver nota) |

> **Corrección — 2026-07-24.** `marked.parseInline()` nunca procesa sintaxis de
> bloque (`#`, `---`, `- lista`) — eso sigue siendo cierto para `---` y listas,
> que en `header`/`footer`/`subtotal` se muestran como texto literal, sin
> tratamiento especial. Pero un `#`/`##`/`###` líder es un caso aparte: como
> estas tres zonas ya se detectó que se usan casi siempre para una única línea
> de "título", `ReportRenderer.js` las hace pasar por `_markedLine()`
> (`ReportRenderer.js:512`) antes de `parseInline()`, que recorta el prefijo
> `#{1,6}\s+` con una regex — no lo convierte en `<h1>-<h6>` (eso generaría
> un margin propio del navegador que duplicaría el spacing que ya da el CSS
> del contenedor). Consecuencia: **el `#` inicial ya no aparece literal**, se
> descarta en silencio y el resto de la línea se procesa como inline normal.
> El estilo de "título" lo sigue dando el CSS del contenedor
> (`.report-header-line:first-child`, etc.), con o sin `#` en el YAML.

```yaml
# ✅ recomendado — sin '#', el CSS del contenedor ya da el estilo de título
template:
  - "FLUJO DE CAJA MENSUAL"

# también válido desde 2026-07-24 — el '#' se recorta, mismo resultado visual
template:
  - "# FLUJO DE CAJA MENSUAL"

# el resto de sintaxis de bloque SÍ sigue mostrándose literal en estas 3 zonas
template:
  - "---"          # → guion-guion-guion literal, no <hr>
  - "- item"        # → guion-item literal, no <li>
```

#### Construcciones soportadas

| Sintaxis | Output | Disponible en |
|---|---|---|
| `**texto**` | negrita | todas las zones |
| `*texto*` / `_texto_` | cursiva | todas las zones |
| `` `texto` `` | código monospace | todas las zones |
| `[texto](url)` | link | todas las zones |
| `---` (línea sola) | `<hr>` | solo `lines` |
| `# Título` / `## / ###` | `<h1>`–`<h3>` | solo `lines` |
| `- item` | bullet list | solo `lines` |
| `1. item` | numbered list | solo `lines` |
| Tabla GFM | `<table>` | solo `lines` |

**NO soportado:** blockquotes, código en bloque, imágenes, HTML embebido.

#### Orden de procesamiento

```
Template YAML → resolver {placeholders} → parsear Markdown → HTML final
```

Los valores de la DB se HTML-escapean automáticamente antes de que marked los procese. El template en sí (texto literal del YAML) se considera de confianza.

#### Escape de contenido de usuario

Si un campo contiene datos ingresados por usuarios, agregar `escape: true` en su definición de `fields` para que los caracteres Markdown (`*`, `_`, `` ` ``, `[`, `]`, `#`, `\`) queden literales:

```yaml
fields:
  - name: concepto
    type: string
    escape: true    # "Compra *urgente*" → "Compra \*urgente\*" → no cursiva
    dbRef: { table: caja, field: concepto }
```

#### Ejemplo completo

```yaml
config:
  markdown: true

# template en zona layout: lines
template:
  - "**{fecha_fmt}**   Balance: `{balance_dia}` {indicador}"
  - ""
  - "---"
  - "## RESUMEN DEL MES"
  - ""
  - "- **Ingresos:** `{total_ingresos}`"
  - "- **Egresos:** `{total_egresos}`"
```

**Output:**

```html
<strong>Domingo 08/02/2026</strong>   Balance: <code>$15.000,00</code> ✓

<hr>
<h2>RESUMEN DEL MES</h2>
<ul>
  <li><strong>Ingresos:</strong> <code>$68.000,00</code></li>
  <li><strong>Egresos:</strong> <code>-$113.500,00</code></li>
</ul>
```

#### Interacción con `||` (split)

El operador `||` de alineación derecha funciona también en modo markdown. Cada lado se procesa con `parseInline`:

```yaml
template:
  - "  `{concepto}`  `{monto_fmt}` || [{metodo}]"
  # izquierda: código inline  |  derecha: alineado a la derecha
```

#### `rowTemplate` — tabla GFM con datos iterados

Propiedad opcional de zona que habilita la generación de una fila de tabla GFM por cada registro del `dataSource`. Solo funciona en `layout: lines` con `markdown: true`.

**Estructura:**
- `template[]` → cabecera de la tabla (se renderiza **una vez**)
- `rowTemplate[]` → plantilla de fila (se repite **por cada registro**)

```yaml
- name: movimientos_tabla
  layout: lines
  condition: { when: after, on: report }
  dataSource: movimientos
  expressions:
    - name: icono
      formula: "if(tipo == 'Ingreso', '↓', '↑')"
    - name: tipo_label
      field: tipo
      format: upper
    - name: categoria
      field: categoria_flujo
    - name: concepto
      field: concepto
    - name: monto_fmt
      field: monto
      format: currency
  template:
    - "| | Tipo | Categoría | Concepto | Monto |"
    - "|:---:|:---|:---|:---|---:|"
  rowTemplate:
    - "| {icono} | {tipo_label} | {categoria} | {concepto} | `{monto_fmt}` |"
```

**Requisito:** la zone debe tener `dataSource` apuntando a una fuente de datos válida. El engine pasa el array completo de registros al renderer (en lugar del `datasetMap` habitual de las zones after-report).

**Alineación GFM** en la fila separadora del `template`:

| Sintaxis | Alineación |
|---|---|
| `:---` | izquierda (default) |
| `:---:` | centro |
| `---:` | derecha |

#### Fallback DIY

Si el CDN no está disponible, el renderer usa un parser interno que cubre Fases 1-2 (inline + `---` + headers + listas). Las tablas GFM requieren marked.js.

#### Ancho de columna y overflow (agregado 2026-07-24)

La tabla que produce `rowTemplate` **no trunca ni recorta contenido** — cada
columna toma el ancho de su contenido más largo (`table-layout: auto`, celdas
`white-space: nowrap`, sin `max-width`). Si la suma de columnas es más ancha
que el reporte (`.report-container`, 800px), la tabla **no desborda la
página**: queda contenida en su propia caja con scroll horizontal
(`.report-lines-md { overflow-x: auto }`), independiente del resto del
reporte (header/footer no se mueven).

El scroll admite tanto la barra nativa como **arrastre directo con mouse**
sobre la tabla (`report.html`, handler de `pointerdown`/`pointermove`
delegado en `#report-container`) — no hace falta bajar hasta la scrollbar.
Un click normal (sin arrastre, <4px de movimiento) no dispara el drag, así
que no interfiere con selección de texto ni con otros controles.

No hay forma de definir un ancho de columna manual en `rowTemplate` (a
diferencia de `layout: table`, que sí tiene `columns: [{width, align}]`) —
si una tabla GFM necesita columnas angostas fijas, es candidato a migrar a
`layout: table`.

---

## 8. Funciones de agregación

Equivalen a las funciones de acumulación del RDL. Se aplican en zonas con `condition` (generalmente `after`).

### 8.1 Funciones de corte (implementadas)

Se acumulan dentro de cada grupo y se resetean al cambiar el campo de corte.

| Función | RDL | Descripción |
|---------|-----|-------------|
| `sum` | `sum(campo)` | Suma del grupo |
| `avg` | `avg(campo)` | Promedio del grupo |
| `count` | `count(campo)` | Cantidad de filas del grupo |
| `min` | `min(campo)` | Mínimo del grupo |
| `max` | `max(campo)` | Máximo del grupo |

```yaml
expressions:
  - name: total
    aggregate: sum
    argument: monto
    format: currency
```

### 8.2 Lookahead (`scope: lookahead`)

Permite agregar los valores de un grupo **antes** de renderizarlo — útil en zonas `when: before` (encabezados de grupo).

```yaml
- name: balance_dia
  aggregate: sum
  argument: monto
  scope: lookahead
  format: currency
```

Funciona solo en zonas con `condition: { when: before, on: [...] }`. El motor ejecuta un pase previo (`precomputeGroupAggregates`) sobre los grupos detectados por el `BreakDetector`, y el valor queda disponible en el contexto de esa zona.

Soporta las mismas funciones que §8.1: `sum`, `avg`, `count`, `min`, `max`.

> **Encadenamiento con fórmulas:** las expresiones `lookahead` (y todas) guardan su valor numérico pre-format en `rawValues` antes de aplicar `format`. Las fórmulas posteriores en la misma zona reciben el número, no el string formateado. `if(balance_dia > 0, ...)` funciona correctamente aunque `balance_dia` tenga `format: currency`.

### 8.3 Dataset (`scope: dataset`)

Agrega sobre **todo el dataset** en un pase previo, sin afectar los acumuladores de corte. Acepta `filter:` opcional por expresión. Disponible en zonas `condition: { when: after, on: report }`.

```yaml
- name: total_ingresos
  aggregate: sum
  argument: monto
  scope: dataset
  filter: "tipo == 'Ingreso'"
  format: currency

- name: balance_neto
  aggregate: sum
  argument: monto
  scope: dataset
  format: currency

- name: indicador_mes
  formula: "if(balance_neto > 0, '✓ Superávit', '⚠ Déficit')"
```

**Sintaxis de `filter:`**

| Forma | Ejemplo |
|-------|---------|
| `campo == 'valor'` | `"tipo == 'Ingreso'"` |
| `campo != 'valor'` | `"estado != 'Anulado'"` |
| `campo op número` | `"monto > 0"`, `"cantidad <= 10"` |

Soporta `==`, `!=`, `>`, `<`, `>=`, `<=`. No soporta `AND`/`OR` (usar dos expresiones separadas).

Soporta las mismas funciones de agregación que §8.1: `sum`, `avg`, `count`, `min`, `max`.

### 8.4 Funciones globales (pendientes)

Estas funciones del RDL **no están implementadas** — acumulan durante todo el reporte sin reseteo:

| Función RDL | Descripción | Estado |
|-------------|-------------|--------|
| `runsum(campo)` | Suma acumulada global | ❌ No implementado |
| `runavg(campo)` | Promedio acumulado global | ❌ No implementado |
| `runcount(campo)` | Conteo acumulado global | ❌ No implementado |
| `runmin(campo)` | Mínimo global | ❌ No implementado |
| `runmax(campo)` | Máximo global | ❌ No implementado |

> **Workaround actual:** `scope: dataset` en zona `after report` cubre la mayoría de los casos de totales globales.

---

## 9. Acceso público y multi-tenant

### 9.1 Reporte autenticado (default)

El reporte se sirve bajo `/report.html?reportName=nombre`. Requiere sesión activa (cookie `nil_token`). Los datos se filtran automáticamente por `empresa_id` del token JWT.

### 9.2 Reporte público

```yaml
public: true
```

Con `public: true`, el reporte es accesible sin login usando el `public_token` de la empresa:

```
/report.html?reportName=carta&t=PUBLIC_TOKEN
```

- El servidor valida el token → resuelve `empresa_id`
- Token inválido → datos vacíos (sin error, sin leak cross-tenant)
- El `public_token` lo devuelve `/api/v1/auth/check` como `{ ok, publicToken, ... }`

---

## 10. Límites y garantías del motor — lo que no podés asumir sin leer código

*(Agregada 2026-08-13.)* Las secciones anteriores documentan cada feature en
aislamiento — qué hace `scope: dataset`, qué hace un `join`, cómo se abre un
reporte — y cada una es correcta. El problema es otro: **este documento nunca
había dicho qué combinaciones de esas features son válidas o inválidas**, y
esa frontera solo vive en el código fuente del motor
(`js/components/report/*.js`). Se detectó al auditar, en la misma sesión, un
intento de implementación real (un tablero mensual que cruza `ventas` +
`gastos`) hecho por un agente que **sí** leyó toda la documentación disponible
y **no inventó ninguna sintaxis falsa** — y aun así tuvo que releer
`AccumulatorManager.js`/`ReportEngine.js`/`BreakDetector.js` línea por línea
para descubrir, por prueba y error, los cinco puntos de abajo. Ninguno de los
cinco es un bug: son restricciones de diseño reales, documentadas acá para
que dejen de costar una relectura completa del motor cada vez que alguien
las necesita.

### 10.1 `kind` es obligatorio — su ausencia no es un warning, es un `Error` que corta la carga

El error más fácil de cometer, y el que más cuesta si no lo sabés de
antemano: un YAML sin `kind: document`/`kind: ledger` válido no se degrada
ni infiere nada — `YamlParser.buildSchema()` tira `Error` y **el reporte
entero no carga**, sin importar qué tan bien esté el resto del archivo.

```js
// js/components/report/parsers/YamlParser.js:246-256
if (kind !== 'document' && kind !== 'ledger') {
    throw new Error(`Reporte "${name}" no declara "kind". Los valores
        válidos son "document" o "ledger". ...`);
}
```

**No copies la estructura de `sys/report/nil-audit.yaml`/`nil-users.yaml`
como plantilla** — ninguno de los dos tiene `kind:`, porque a ambos se los
sacó del motor de reportes (§9, `report.html`'s `NOT_A_REPORT`) antes de que
`kind` existiera. Son ejemplos de sintaxis de `rowTemplate`, no reportes que
efectivamente cargan hoy. Confirmado en la práctica: es el bug más repetido
al escribir un reporte nuevo desde cero.

### 10.2 Un solo nivel de quiebre — no hay agrupar por dos campos a la vez

`groupByCategory()` arma los grupos usando **solo el primer campo** de
`condition.on` de todas las zonas del reporte — no hay agrupamiento anidado
(ej. mes → luego canal dentro de cada mes) en un mismo reporte.

```js
// ReportEngine.js:143
const breakField = breakFields.length > 0 ? breakFields[0] : null;
```

`renderAfterCategory`/`updateAccumulators` (líneas 122, 130, 205, 336) usan
el mismo `breakFields[0]` consistentemente — no es un descuido puntual, es
el modelo de quiebre del motor entero.

### 10.3 `scope: dataset` es global al reporte, no por grupo

Un expression con `scope: dataset` sí acepta `filter:`, pero el `filter` se
aplica sobre **todo el dataset del reporte**, no sobre el grupo/quiebre
actual — no hay forma de pedir "el total de este mes con este filtro" con
`scope: dataset`, solo "el total de todo el reporte con este filtro".

```js
// ReportEngine.js:109 — data es el dataset completo del reporte, no un grupo
const datasetMap = this.precomputeDatasetAggregates(data, this.schema.zones);

// ReportEngine.js:288-290 — el filtro corre sobre ese mismo `data` completo
const rows = expr.filter
    ? data.filter(r => this._matchSimpleFilter(r, expr.filter))
    : data;
```

### 10.4 `scope: lookahead` no soporta `filter` en absoluto

A diferencia de `scope: dataset`, `precomputeGroupAggregates()`
(`ReportEngine.js:239-273`, la función que resuelve `scope: lookahead`)
**nunca lee `expr.filter`** — no hay ninguna rama condicional para eso en
todo el método. Un `lookahead` con `filter:` en el YAML no tira error; el
`filter:` se ignora en silencio y el agregado suma sobre todos los registros
del grupo sin filtrar.

### 10.5 Los `joins` son a nivel de registro — nunca agregación cruzada entre tablas

```js
// QueryBuilder.js:104
`LEFT JOIN ${joinTable} ${joinAlias} ON ${fromAlias}.${joinFromDb} = ${joinAlias}.${joinField}`
```

Un `join:` trae columnas de otra tabla fila por fila (típicamente para
resolver un FK a su nombre legible). **No existe ninguna forma de sumar
una tabla contra otra dentro de un reporte** — no hay agregación cruzada,
no hay "total de ventas menos total de gastos del mismo mes" en un solo
reporte, sin importar cuántos `dataSources:` declares. Si tu reporte
necesita combinar matemáticamente datos de más de una tabla (ej. un
tablero de contribución/ganancia que resta gastos a ventas), la única vía
soportada es **mantener una tabla resumen ya combinada** (vía triggers de
SQLite en el schema de la app, o un handler) y que el reporte lea esa tabla
—no intentar expresarlo en YAML.

**Tiene que ser una tabla real, no una `VIEW`.** SQLite soporta `CREATE
VIEW` con la misma agregación, y sería la solución más limpia (se calcula
sola, sin triggers) — pero `schemaService.tableExists()` filtra
`sqlite_master` por `type='table'` exclusivamente:

```js
// src/services/schemaService.js:9-18
// SELECT name FROM sqlite_master WHERE type='table' AND name = ?
```

Una `VIEW` tiene `type='view'` — `tableExists()` devuelve `false`, y
`catalogService.getAll()` (lo que usa `/api/catalogs/:table`, la vía por la
que un reporte lee cualquier tabla) tira `TABLE_NOT_FOUND` antes de llegar a
ejecutar ningún `SELECT`. Por eso la tabla-resumen-combinada tiene que
mantenerse con triggers `AFTER INSERT/UPDATE/DELETE` (que sí escriben una
tabla real), no con una `VIEW` — es una limitación de una sola línea de
código, pero cierra por completo el camino "obvio" y no está anunciada en
ningún lado hasta acá.

### 10.6 Abrir un reporte desde el menú no renderiza el reporte directamente

Un ítem de menú `type="report"` no navega al reporte al clickearlo — abre
una tarjeta con el link público, botón de copiar, QR, y un botón **"ABRIR"**
recién ahí navega a `report.html?file=...`.

```js
// js/components/Workspace.js:46
this.showYamlInfo(item.target);
// showYamlInfo() arma la tarjeta de compartir — no renderiza el YAML.
// La navegación real ocurre cuando el usuario clickea "ABRIR" (línea 96-97,
// localUrl → /report.html?file=<nombre>).
```

Esto es interfaz real de la aplicación, no un detalle interno — un agente o
un humano probando el sistema desde el menú puede asumir razonablemente que
el reporte se abre solo, y quedarse bloqueado pensando que `type="report"`
no funciona (pasó exactamente eso en la sesión que motivó esta sección).

### 10.7 `filter:` no acepta rangos — "este mes" no es un filtro de fecha, es una columna

Ya documentado en §4.1 como sintaxis (`filter: "campo = valor"`, sin
`IN`/`LIKE`/`>`/`<`/compuestos), pero vale repetirlo acá como consecuencia de
diseño: **no hay forma de pedirle a un `dataSource` "los registros de este
mes"** vía `filter` — un rango de fechas no es una comparación de igualdad.
Si tu reporte necesita agrupar o filtrar por mes, la única vía soportada es
tener una **columna propia** con el valor ya recortado (`mes: 'YYYY-MM'`,
calculada en un trigger o handler al guardar) y usar esa columna en
`condition.on`/`filter` — no intentar derivarla del campo `fecha` dentro del
YAML, porque no hay ningún mecanismo de expresión a nivel de `dataSource`
para eso (los `formula:`/`is=` son de renderizado, corren después de que los
datos ya se cargaron).

### 10.8 `if(cond, verdadero, falso)` no evalúa aritmética compuesta en sus ramas

`formula: "a - b - c"` (aritmética pura, sin `if()`) sustituye nombres de
campo por valores y evalúa la expresión completa — funciona con cualquier
combinación de `+ - * / ( )`. Pero dentro de un `if(cond, verdadero, falso)`,
las ramas verdadero/falso **no pasan por ese mismo camino**: se resuelven con
`_resolveVal()`, que solo entiende tres casos — un string entre comillas, un
**nombre de campo exacto** presente en el contexto, o un número literal.
Una expresión aritmética compuesta ahí adentro no se evalúa, se devuelve
**tal cual, como string, sin ningún error**:

```js
// ExpressionEvaluator.js:212-219 — _resolveVal()
if (context[valStr] !== undefined) return context[valStr];   // nombre exacto
const n = parseFloat(valStr);                                  // número literal
return isNaN(n) ? valStr : n;   // si no es ninguno de los dos: el string SIN evaluar
```

Verificado en vivo: `if(ventas > 0, (ventas - materia_prima - mano_obra - envios) / ventas * 100, 0)`
devuelve el string literal `"(ventas - materia_prima - mano_obra - envios) / ventas * 100"`
cuando `ventas > 0` — no un número. Con `format:` aplicado encima, eso
renderiza vacío o basura, sin ningún error en consola que lo delate.

**Patrón correcto — calcular aparte, elegir con `if()` entre campos ya
resueltos:**

```yaml
expressions:
  - { name: porc_raw,          formula: "(ventas - materia_prima - mano_obra - envios) / ventas * 100" }
  - { name: porc_contribucion, formula: "if(ventas > 0, porc_raw, 0)", format: "0.1" }
```

Las expresiones de una misma zona ven los valores crudos (pre-`format`) de
las expresiones anteriores — mismo mecanismo que usa `scope: lookahead`
(§8.2) — así que `porc_raw` ya está disponible como campo simple cuando se
evalúa el `if()`. Confirmado en vivo que este patrón sí funciona.

---

## 11. Equivalencias RDL → YAML

| Concepto RDL | YAML nilix | Estado |
|---|---|---|
| `%fields` | `fields:` | ✅ |
| `%zone nombre` | `zones: [{name: ...}]` | ✅ |
| `before report` | `condition: {when: before, on: report}` | ✅ |
| `after report` | `condition: {when: after, on: report}` | ✅ |
| `before campo` | `condition: {when: before, on: [campo]}` | ✅ |
| `after campo` | `condition: {when: after, on: [campo]}` | ✅ |
| `before (c1,c2)` | `condition: {when: before, on: [c1, c2]}` | ✅ |
| `after (c1,c2)` | `condition: {when: after, on: [c1, c2]}` | ✅ |
| `sum(campo)` | `aggregate: sum` | ✅ |
| `avg(campo)` | `aggregate: avg` | ✅ |
| `count(campo)` | `aggregate: count` | ✅ |
| `min(campo)` | `aggregate: min` | ✅ |
| `max(campo)` | `aggregate: max` | ✅ |
| `field in tabla:display` | `references: {table, field, displayField}` | ✅ |
| `use schema` | `dataSources: {ds: {table}}` | ✅ |
| `no print` | `noPrint: true` | ✅ |
| `output to file/printer` | `config.outputTo` | ⚠️ Declarativo, no funcional |
| `if(cond, t, f)` simple | `formula: "if(campo == 'v', t, f)"` | ✅ |
| `dayname()` | `format: dayname` | ✅ |
| `before page` | — | ❌ |
| `after page` | — | ❌ |
| `eject before/after` | — | ❌ |
| `at line NN` | — | ❌ |
| `group with` | — | ❌ |
| `runsum(campo)` | — | ❌ |
| `runavg(campo)` | — | ❌ |
| `runcount/min/max` | — | ❌ |
| `resetaccum` | — | ❌ |
| `if <condición>` compuesta | — | ❌ |
| `null zeros` | — | ❌ |
| Máscara de formato | — | ❌ |
| `day()`, `month()`, `year()` | — | ❌ |
| `pageno`, `lineno` | — | ❌ |
| `$VARNAME` env vars | — | ❌ |
| Ancho fijo / margen | — | ❌ (HTML) |

---

## 12. Funcionalidades pendientes

Funcionalidades del RDL original que aún no tienen equivalente en nilix, ordenadas por impacto estimado.

> **Implementado en v2.6.0:** parámetros URL en `filter` (`:param`), aritmética en `formula:`, joins encadenados, botón Imprimir/PDF.

### Alta prioridad

| Feature | Descripción | Caso de uso |
|---------|-------------|-------------|
| **`runsum` / `runcount`** | Acumulados globales sin reset | Totales año-a-fecha, contadores de reporte |
| **Funciones de fecha** | `day()`, `month()`, `year()` | Agrupar por mes/año sin campo extra en DB |

### Media prioridad

| Feature | Descripción | Caso de uso |
|---------|-------------|-------------|
| **`if` compuesto** | Condiciones con `&&`, `||` en `formula:` | Mostrar alerta si `monto > 10000 && tipo == 'Egreso'` |
| **`null zeros`** | No mostrar cero en campos vacíos | Reportes con campos opcionales |
| **Export PDF** | `outputTo: pdf` funcional | Comprobantes imprimibles |
| **Filtros complejos en `filter:`** | `IN`, `LIKE`, rangos, `AND`/`OR` | Rango de fechas, múltiples estados simultáneos |

### Baja prioridad / Limitaciones de diseño

| Feature | Descripción | Nota |
|---------|-------------|------|
| **`before/after page`** | Encabezado/pie por página | Requiere paginación real (no scroll) |
| **`eject`** | Salto de página explícito | Idem anterior |
| **`at line NN`** | Posicionamiento absoluto | Modelo HTML no lo soporta nativamente |
| **`group with`** | Mantener zonas juntas | CSS `break-inside: avoid` como aproximación |
| **Ancho fijo / máscara** | Columnas alineadas en monospace | Posible con `<pre>` + padding manual |

---

*Generado a partir de REP-SPEC.md (IDEA-FIX, Capítulo 17) + análisis de la implementación nilix v2.5.1*
