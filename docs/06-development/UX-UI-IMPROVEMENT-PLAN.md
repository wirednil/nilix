# Plan de Mejora UX/UI — Nilix / THYM POS

**Fecha de creación:** 2026-08-23
**Origen:** Auditoría UX/UI externa (heurística Nielsen + cognitive walkthrough) sobre el formulario de Venta de THYM POS, contrastada línea por línea contra el código real del motor.
**Alcance:** clasificar cada hallazgo en (A) resoluble con configuración de formulario existente, (B) parche de config/CSS que no es la solución de fondo, o (C) requiere modificar el motor nilix — y trackear qué se aplicó.

---

## 0. Ya aplicado en esta sesión (2026-08-23)

| Cambio | Archivo(s) | Origen |
|---|---|---|
| Contraste `[?]` icon: `#00ff00`→`#008000` (WCAG AA, 1.37:1→5.14:1) | `css/styles.css` | Auditoría de contraste WCAG previa |
| Bug de fecha `default="today"` en UTC-3 (rollover 21:00-23:59 local) | `js/components/fieldRenderer/InputField.js` | Auditoría — corregido a fecha local |
| `productos.xml`: `id` como select funcional con autocompletado de todo el form | `/opt/wc/thym-pos_v000/thym-pos/form/productos.xml` + `LookupService.js`/`LayoutProcessor.js`/`ValidationCoordinator.js`/`Autocomplete.js` | Pedido directo — reveló y arregló un bug real de motor (URL sin segmento `db` en `loadRecord()`) |
| Botón LIMPIAR eliminado | `UiComponents.js`, `SubmitManager.js`, `FormRenderer.js` (comentario) | Auditoría — reduce decisiones/ruido visual |
| Vocabulario ANT/SIG unificado (form-level y paginación de multifield) | `Multifield.js` | Auditoría — evita "¿ENVIAR vs SIG, qué diferencia hay?" |
| Botones mobile: ANT+SIG en una fila, ENVIAR ancho completo debajo | `css/styles.css` (`@media max-width:650px`, `nth-child`/`nth-last-child`) | Propuesta directa del usuario |
| 4 tests nuevos permanentes (self-referencing select+in-table, `<choice>` widget, fillForm null-clear, insert con keyField autoincrement vacío) + fixtures `dev/form/mf_productos.xml` / `mf_pedidos.xml` | `tests/e2e.test.js`, `tests/recordService.test.js` | Crítica del usuario: verificaciones ad-hoc deben quedar como regresión permanente |

**Estado:** todo lo anterior está en el working tree, sin commitear (ver sección de commit pendiente al final de esta conversación).

---

## 1. Clasificación del resto de la auditoría

### A — Config-only (form XML / CSS), sin tocar motor

| Ítem auditoría | Acción concreta | Estado |
|---|---|---|
| 4 filas vacías por defecto en multifield | Bajar `display="4"` → `display="1"` | ✅ Aplicado 2026-08-23 en `ventas.xml` y `mf_pedidos.xml` — superado por la sección 2: el grid ya no rellena filas, arranca directamente en `+ AGREGAR PRODUCTO` |
| `N°` ambiguo | `label="N° de venta"` | ✅ Aplicado 2026-08-23 en `ventas.xml` |
| Focus visible | Ya cubierto (19 reglas `:focus` en `styles.css`, incluye autocomplete y celdas de multifield) | Sin acción |
| Feedback al guardar | Ya cubierto — `StatusBar.push('success', ...)` tras cada guardado | Sin acción |
| Densidad, tipografía, paleta | Auditoría lo marca como fortaleza — no tocar | Sin acción |

### B — Parche de config/CSS posible, pero no es la solución de fondo

| Ítem auditoría | Parche | Por qué no alcanza |
|---|---|---|
| Redundancia PRODUCTO + NOMBRE | En la fila compacta de solo lectura (grid real) sigue mostrándose (decisión deliberada, ver sección 2 — no se intentó auto-detectar qué columnas skip son "redundantes" para no arriesgar ocultar algo como `precio_total` por error) | Dentro del **modal** sí se resolvió: oculta automáticamente cualquier columna que sea target de un `<copy>` de una columna catálogo hermana (ej. "Nombre"), sin tocar columnas skip/readonly independientes (ej. "Subtotal") — ver `_buildRow`, `Multifield.js` |
| `+ AGR` / `"0 de 0"` poco claros | — | ✅ Resuelto — ver sección 2: `+ AGR` ahora es `+ AGREGAR <ITEM-LABEL>` configurable, `"0 de 0"` desapareció junto con la paginación |

### C — Requiere modificar el motor

| Ítem auditoría | Qué falta | Esfuerzo |
|---|---|---|
| `NOMBRE` de clienta visible solo si se elige "Otra" | Sistema de visibilidad condicional entre campos. Confirmado ausente: `nil-form.md` lista `display only when expr` / `skip when cond` como **"No implementado"** | Medio — nuevo atributo XML + soporte en `LayoutProcessor.js` |
| Costo de envío deshabilitado salvo que "Envío" esté seleccionado | Mismo mecanismo condicional, aplicado a `disabled` | Medio (reutiliza la feature de arriba) |
| Validación inline con resumen antes de enviar | Reemplazar `formEl.reportValidity()` nativo en `SubmitManager.js:64-66` por un recorrido de campos inválidos usando `validator.showErrorOnField()` (ya existe, `ValidationCoordinator.js:84,206`) + resumen en `StatusBar` | Bajo-medio — la infraestructura de error inline ya existe, falta usarla en el submit |
| ANT/SIG/ENVIAR compitiendo (¿wizard o formulario único?) | No existe flujo de "pasos" de formulario. "wizard" en el código es solo un **rol de usuario**, sin relación | Alto si se quiere wizard real. Alternativa barata: los botones ANT/SIG solo se generan si `tableConfig.keyField && tableConfig.table` (`SubmitManager.js:25`) — si el form de venta no encaja en ese patrón de navegación secuencial, sacarlos es tan simple como no cumplir esa condición (config, no motor) |
| Tarjetas mobile para el grid de productos | Reestructuración de layout más profunda que la actual (45 reglas CSS existentes cubren el caso básico, no el rediseño completo en ficha) | Medio-alto — pendiente de una captura mobile real antes de estimar en serio (la propia auditoría lo señala como no evaluado) |

---

## 2. "Agregar producto" vía modal — ✅ IMPLEMENTADO (2026-08-23)

Propuesta del usuario: reemplazar el grid con `display` filas vacías por un estado inicial vacío (`+ AGREGAR PRODUCTO` solo), que al clickear abre una ventana modal con el producto como tarjeta vertical (mismo mockup de la sección "Mobile" de la auditoría), y al guardar lo agrega como fila compacta a la tabla.

### Decisiones de producto — CERRADAS (2026-08-23)

| Decisión | Resuelto |
|---|---|
| Edición de filas ya agregadas | **Solo lectura + reabrir modal.** Click en la fila (no en un input) reabre el modal precargado con esos valores. Un solo camino de edición — el modal — en vez de dos conviviendo. |
| Navegación cuando hay más productos que `display` | **Botones ▲/▼ personalizados** que avanzan de a una fila (no scrollbar nativo). Más código que `overflow-y:auto`, pero consistente con la estética terminal del resto de la app. |
| ANT/SIG a nivel de formulario (navegar entre ventas ya guardadas) | **Se deja como está.** Cumple una función real (corregir venta por N°) y no bloquea esta feature — queda fuera de alcance. |

### `display`: de "tamaño de página" a "alto máximo visible"

Cambio de semántica ya aplicado en `ventas.xml` (THYM POS) y `dev/form/mf_pedidos.xml`: `display="4"` → `display="1"` como primer paso (grid arranca vacío, sin filas de relleno). El significado de `display` pasa de "cuántas filas por página" a "cuántas filas se ven antes de necesitar ▲/▼" — esto **elimina** la máquina de paginación actual (`currentPage`, `_updateControls`, `"0 de 0"`, ANT/SIG del grid) en vez de solo renombrarla. Ya no hace falta relleno con filas vacías (`_rerenderGrid` hoy pad-ea hasta `display` con filas `null` — deja de ser necesario si el grid nunca se ve directamente, solo a través del modal).

### Infraestructura ya existente y reutilizable

- **`SubformModal.js`** — ya abre un form en overlay modal, escucha `sf:record-saved`, ejecuta callback con los datos. Backdrop, botón cerrar, cierre con click-afuera y Escape ya resueltos.
- **`_buildCatalogCell` / `_buildChoiceCell`** (`Multifield.js`) — ya están construidas sobre `Autocomplete.js`, el mismo widget que cualquier `<select>`/`<options>` top-level. No son un widget aparte.
- CSS de "card" para mobile ya tiene precedente (`.stepper-wrapper` card, fix v1.9.0 documentado en `ANALYSIS-HIERARCHY.md`).

### Cómo quedó implementado

No se reusó `SubformModal.js` (fetchea un `.xml` externo completo — no encaja con renderizar el fragmento de un solo `<field type="multifield">`). En cambio, `Multifield.js` ganó un modal propio, autocontenido:

- **`_buildDisplayRow()`** — fila compacta de solo lectura para el grid persistido. Cada celda lleva un `<input type="hidden">` con el mismo `name` que antes tenía el input editable — necesario porque `SubmitManager.js` junta los datos con `new FormData(formEl)`, no lee `dataset.allRows` directamente; sin el hidden, el valor de la fila no llegaba al submit. Columnas `type="select"` resuelven su texto vía `__catalogRow` (la fila de catálogo completa que deja la última selección) en vez de mostrar la clave cruda.
- **`_openRowModal()`** — arma un mini-grid de 1 fila reusando `_buildRow()`/`_setupChangeTracking()` tal cual (sin reescribir nada de catálogo/choice/`is=`/`<check>`). El botón "+ AGREGAR `<ITEM-LABEL>`" y el click en una fila compacta (fuera del `✕`) lo abren, en alta o edición respectivamente.
- **`item-label`** — nuevo atributo XML en `<field type="multifield">` (ej. `item-label="producto"`) que arma el texto del botón; sin declararlo cae a `"+ AGREGAR REGISTRO"`.
- **`display` como alto máximo, no tamaño de página** — se eliminaron `_updateControls`/`_addRow`/paginación por completo. `_rerenderDisplayGrid()` renderiza todas las filas reales (sin relleno) dentro de un contenedor `overflow-y:auto`, con botones `▲`/`▼` (`_scrollGridBy`) que aparecen solo si hace falta scroll (medido en vivo contra la altura real de una fila, no un rem fijo — así funciona igual en la tabla desktop y en la tarjeta mobile).
- Redundancia PRODUCTO+NOMBRE dentro del modal: `_buildRow()` oculta (`td.style.display='none'`, no el atributo `hidden` — un CSS del modal lo pisaba) cualquier columna que sea `copy.to` de una columna catálogo hermana, sin tocar columnas skip/readonly independientes como "Subtotal".

### Ajuste de diseño tras feedback directo del usuario (2026-08-23)

El primer diseño del modal (caja con borde propio alrededor de los campos, separador entre cada campo, botón `✕` suelto) generó rechazo visual — "2 recuadros anidados con fondos distintos". Causa real: `.mf-row-modal-grid` heredaba el `border`+`background`+`box-shadow` de `.multifield-grid` (pensados para el grid real de la página), sumado al borde propio del modal. Rediseño final: título centrado + un solo separador debajo (sin caja para los campos), footer de dos botones iguales (VOLVER/GUARDAR) reemplazando el `✕`.

**Ocultar "Nombre" nunca fue pedido explícitamente** — fue una decisión de diseño tomada sin preguntar, inspirada en el mockup original del usuario. Corregido a pedido: en vez de ocultar el campo, el campo catálogo (`PRODUCTO`) ahora muestra "clave - nombre" combinado (ej. `2 - Mochila Fixture`). Esto requirió tocar `Autocomplete.js` (el widget compartido por **todos** los campos catálogo de la app, no solo este modal) — se le agregó una capa visual (`.autocomplete-display-overlay`) que muestra "clave - nombre" mientras el input no tiene foco, sin tocar `inputEl.value` (que sigue siendo la clave cruda — es literalmente lo que se guarda como clave foránea; cambiarlo habría roto el submit real). Al hacer foco para buscar de nuevo, la capa se oculta y se ve el input real de siempre. Efecto secundario descubierto en el camino: el DOM de `.autocomplete-wrapper` ganó un nivel de anidamiento (`inputEl` ahora vive dentro de `.autocomplete-input-box`), lo que rompió un test que asumía `#rol` como sibling directo de `.autocomplete-btn` (`tests/e2e.test.js`, ya corregido) — la única referencia a esa estructura interna en todo el código.

### Extensión a campos top-level (2026-08-24)

El overlay "clave - nombre" es global (vive en `Autocomplete.js`, usado por cualquier `type="select"` con `<in-table>`), así que también afecta campos catálogo fuera de un multifield — ej. `id_clienta` en `ventas.xml`. Pero el ocultamiento de la columna redundante (`copyTargetIds`) solo vivía dentro de `Multifield.js`, así que `CLIENTA` mostraba "5 - Juan Pérez" **y** el campo `NOMBRE` separado seguía visible mostrando el nombre de nuevo — mismo problema que PRODUCTO+NOMBRE, ahora a nivel de formulario. Extendido el mismo mecanismo a `LayoutProcessor.js::processLayout()`: computa una vez por formulario el set de IDs que son `copy.to` de algún `<in-table>` en TODO el layout (excluyendo campos anidados dentro de un `<field type="multifield">`, que ya tienen su propio mecanismo equivalente), y oculta el `.field-row`/`.field-block-horizontal` de esos campos en `renderField()`. **No requiere tocar `ventas.xml`** — el fix es genérico, se aplica solo con recargar el form. Fixture nuevo `dev/form/top_level_catalog.xml` + test #11 en `tests/e2e.test.js`.

### Dos bugs de motor encontrados y corregidos durante la implementación (no eran del feature en sí)

1. **`miniGrid` sin `<thead>` ni `data-multifield-id`** — `_setupChangeTracking`/`_getColumns` dependen de leer metadatos del `<thead>` del contenedor sobre el que corren; el mini-grid del modal no tenía ninguno de los dos, así que el refresco de `<choice>` al cambiar el catálogo fallaba en silencio (excepción no capturada en un event listener). Fix: clonar el `<thead>` real y setear `data-multifield-id` al crear el mini-grid.
2. **Header contado como fila del scroll** — `scrollBox.style.maxHeight` se calculaba solo con `firstRow.height * display`, sin sumar la altura del `<thead>` (que vivía DENTRO del mismo contenedor con scroll) — el header ocupaba parte del presupuesto de `display` filas y además scrolleaba junto con las filas, quedando oculto al bajar. Fix: `maxHeight = headerHeight + rowHeight*display`, más `position:sticky` en `.multifield-scroll-box thead th` para que el header quede fijo arriba. Efecto secundario encontrado en el camino: la tabla usaba `table-layout:auto` (ancho por contenido), que dentro del contenedor flex `.multifield-scroll-box` (necesita poder achicarse) hacía que la tabla se saliera del contenedor — arreglado con `table-layout:fixed` scoped a `.multifield-scroll-box`.
3. **Condición de carrera preexistente en `_setupChangeTracking`** (ya estaba en el código antes de esta feature, pero era inofensiva): al cambiar la columna catálogo, dispara un `change` anidado en su columna `choice` hermana *mientras el handler del catálogo todavía está corriendo* — ese anidado escribe `dataset.allRows` con el valor nuevo, pero el handler externo lo pisa después con su propia copia (parseada antes del anidado) al terminar. En el grid viejo esto nunca importó porque el submit real leía los `<input>` vía `FormData`, no el dataset. El modal sí necesitaba el dataset como fuente de verdad al guardar — fix: al guardar, leer los valores directo de los inputs del DOM (que siempre están correctos) en vez de `miniGrid.dataset.allRows`.

### Verificado

Suite completo `node --test tests/*.test.js`: **160/160**, dos corridas limpias consecutivas. Test #10 de `tests/e2e.test.js` reescrito para cubrir el flujo completo: abrir modal, elegir catálogo, `default-from` de `<choice>`, elección manual persiste al cambiar de producto, Guardar → fila compacta con los valores correctos, click en la fila reabre el modal precargado, Escape sin guardar no duplica la fila. No se hizo verificación manual en vivo contra THYM POS real (`ventas.xml`, server corriendo en :3002) por no tener credenciales de login a mano en esta sesión — recomendado antes de dar la feature por cerrada en producción.

---

## 3. Orden de prioridad propuesto

1. ~~**Hoy, config-only:** `display="1"` en multifields de venta, renombrar `N°`.~~ ✅ Aplicado 2026-08-23. ANT/SIG a nivel de formulario: se deja como está (decisión cerrada, sección 2).
2. ~~**Motor, feature nueva (sección 2):** "Agregar producto" vía modal + grid de solo lectura + ▲/▼.~~ ✅ Implementado y verificado 2026-08-23 (160/160 tests) — pendiente solo la verificación manual en THYM POS real, ver sección 2.
3. **Motor, bajo esfuerzo / alto impacto:** validación inline con resumen en submit (`formEl.reportValidity()` → usar `validator.showErrorOnField()`, que ya existe).
4. **Motor, esfuerzo medio:** sistema de visibilidad/habilitación condicional (`visible-when`/`enabled-when`) — resuelve de una sola vez "Nombre solo si Otra" y "costo de envío solo si Envío", reutilizable en cualquier form futuro.
5. **Mobile cards del grid completo:** el modal ya cubre la tarjeta vertical para alta/edición; falta decidir si el grid de solo lectura en sí necesita algo más allá de lo que ya hace el CSS mobile existente (probablemente no, a confirmar con una captura real).
