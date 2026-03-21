# NIL-REPORT — Manual de Reportes Nilix

**Versión:** 1.2
**Basado en:** REP-SPEC.md (Capítulo 17, IDEA-FIX RDL) + implementación nilix v2.5.1
**Formato nativo:** YAML (reemplaza el RDL textual del legado)

---

## Índice

1. [Conceptos fundamentales](#1-conceptos-fundamentales)
2. [Estructura del archivo YAML](#2-estructura-del-archivo-yaml)
3. [Sección `fields`](#3-sección-fields)
4. [Sección `dataSources`](#4-sección-datasources)
5. [Sección `zones`](#5-sección-zones)
6. [Condiciones de impresión](#6-condiciones-de-impresión)
7. [Expresiones y templates](#7-expresiones-y-templates)
8. [Funciones de agregación](#8-funciones-de-agregación)
9. [Acceso público y multi-tenant](#9-acceso-público-y-multi-tenant)
10. [Equivalencias RDL → YAML](#10-equivalencias-rdl--yaml)
11. [Funcionalidades pendientes](#11-funcionalidades-pendientes)

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

fields: [...]                     # Definición de campos (§3)
dataSources: {...}                # Fuentes de datos (§4)
zones: [...]                      # Zonas de salida (§5)

meta:
  version: "1.0"
  author: ""
  createdAt: ""
```

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

### 4.1 Sintaxis de `filter`

Solo soporta comparaciones simples:

```yaml
filter: "campo = valor"
filter: "activo = true"           # → WHERE activo = 1
filter: "estado = 'Pendiente'"    # → WHERE estado = 'Pendiente'
```

> **No implementado aún:** `IN`, `LIKE`, `>`, `<`, expresiones compuestas.

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
| `layout` | string | `vertical` (default) \| `lines` \| `table` \| `horizontal-scroll` \| `grid` |
| `expressions` | array | Campos calculados o referencias (ver §7) |
| `template` | array | Líneas de salida con `{placeholders}` (no aplica con `layout: table`) |
| `columns` | array | Definición de columnas, solo con `layout: table` (ver §5.2) |
| `noPrint` | boolean | Zona procesada pero no renderizada |

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

### 7.4 Fórmulas — `formula: "if(...)"`

Expresiones condicionales en cualquier zona:

```yaml
- name: icono
  formula: "if(tipo == 'Ingreso', '↓', '↑')"
```

**Sintaxis:** `if(condición, valorSiTrue, valorSiFalse)`

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
- El `public_token` lo devuelve `/api/auth/check` como `{ ok, publicToken, ... }`

---

## 10. Equivalencias RDL → YAML

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

## 11. Funcionalidades pendientes

Funcionalidades del RDL original que aún no tienen equivalente en nilix, ordenadas por impacto estimado:

### Alta prioridad

| Feature | Descripción | Caso de uso |
|---------|-------------|-------------|
| **`runsum` / `runcount`** | Acumulados globales sin reset | Totales año-a-fecha, contadores de reporte |
| **Filtros complejos** | `IN`, `LIKE`, `>`, `<`, `AND`, `OR` | Rango de fechas, múltiples estados |
| **Funciones de fecha** | `day()`, `month()`, `year()` | Agrupar por mes/año sin campo extra en DB |

### Media prioridad

| Feature | Descripción | Caso de uso |
|---------|-------------|-------------|
| **`if` compuesto** | Condiciones con `&&`, `||` en `formula:` | Mostrar alerta si `monto > 10000 && tipo == 'Egreso'` |
| **`null zeros`** | No mostrar cero en campos vacíos | Reportes con campos opcionales |
| **Parámetros JWT** | Inyectar `empresa_id` u otros en queries | Queries parametrizadas seguras |
| **Export PDF** | `outputTo: pdf` funcional | Comprobantes imprimibles |

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
