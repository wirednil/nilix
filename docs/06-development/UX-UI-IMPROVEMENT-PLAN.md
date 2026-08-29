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
| `NOMBRE` de clienta visible solo si se elige "Otra" | ❌ Descartado — no era un caso real. El sentinel `id_clienta==0` abre el subform `clientas_nuevo` (alta de clienta nueva), no un campo de texto "Otra" — la premisa del hallazgo original no aplicaba al comportamiento real del form. | — |
| Costo de envío deshabilitado salvo que "Envío" esté seleccionado | ✅ Implementado 2026-08-25 — ver sección 6 | — |
| Validación inline con resumen antes de enviar | ✅ Implementado 2026-08-24 — ver sección 4 | — |
| ANT/SIG/ENVIAR compitiendo (¿wizard o formulario único?) | ⏸️ Revisado — decisión explícita del usuario: se deja como está. Cumple una función real (corregir venta cargando su N°), no bloquea nada de lo implementado. "wizard" en el código es solo un **rol de usuario**, sin relación con esto | — |
| Tarjetas mobile para el grid de productos | ⏭️ Movido a un plan aparte — ver sección 8 | — |
| Navegación lateral no evaluable en móvil | ⏭️ Movido a un plan aparte — ver sección 8 | — |

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

El overlay "clave - nombre" es global (vive en `Autocomplete.js`, usado por cualquier `type="select"` con `<in-table>`), así que también afecta campos catálogo fuera de un multifield — ej. `id_clienta` en `ventas.xml`. Pero el ocultamiento de la columna redundante (`copyTargetIds`) solo vivía dentro de `Multifield.js`, así que `CLIENTA` mostraba "5 - Juan Pérez" **y** el campo `NOMBRE` separado seguía visible mostrando el nombre de nuevo — mismo problema que PRODUCTO+NOMBRE, ahora a nivel de formulario. Extendido el mismo mecanismo a `LayoutProcessor.js::processLayout()`: computa una vez por formulario el set de IDs que son `copy.to` de algún `<in-table>` en TODO el layout (excluyendo campos anidados dentro de un `<field type="multifield">`, que ya tienen su propio mecanismo equivalente), y oculta el `.field-row`/`.field-block-horizontal` de esos campos en `renderField()`. **No requiere tocar `ventas.xml`** — el fix es genérico, se aplica solo con recargar el form. El campo catálogo que se queda solo en su `container` reclama el ancho liberado (antes se quedaba angosto al tamaño pensado solo para la clave). Fixture nuevo `dev/form/top_level_catalog.xml` + test #11 en `tests/e2e.test.js`.

### Segunda vuelta de ajuste visual del modal (2026-08-24)

Tras ver el modal renderizado, dos correcciones más:

- **Separadores entre cada campo** (se habían agregado sin pedido explícito) → sacados, solo queda el separador debajo del título.
- **"2 recuadros anidados con fondos distintos"** — `.mf-row-modal-grid` heredaba `border`+`background`+`box-shadow` de `.multifield-grid` (pensados para el grid real de la página) además del borde propio del modal. Anulados esos estilos dentro del modal (`.mf-row-modal-grid { border:none; background:transparent; box-shadow:none; }`).
- **Centrado sobre `.terminal-window` (el form), no sobre todo el navegador** — el backdrop pasa de `position:fixed` sobre `document.body` a `position:absolute` anclado al `.terminal-window` más cercano (con fallback a `fixed`/`body` si no hay uno), así que el modal queda centrado sobre la caja del form aunque el navegador sea mucho más ancho. Verificado matemáticamente (centro del modal == centro de `.terminal-window`, con viewport 1600×1200 y form de 900×497).

### Dos bugs de motor encontrados y corregidos durante la implementación (no eran del feature en sí)

1. **`miniGrid` sin `<thead>` ni `data-multifield-id`** — `_setupChangeTracking`/`_getColumns` dependen de leer metadatos del `<thead>` del contenedor sobre el que corren; el mini-grid del modal no tenía ninguno de los dos, así que el refresco de `<choice>` al cambiar el catálogo fallaba en silencio (excepción no capturada en un event listener). Fix: clonar el `<thead>` real y setear `data-multifield-id` al crear el mini-grid.
2. **Header contado como fila del scroll** — `scrollBox.style.maxHeight` se calculaba solo con `firstRow.height * display`, sin sumar la altura del `<thead>` (que vivía DENTRO del mismo contenedor con scroll) — el header ocupaba parte del presupuesto de `display` filas y además scrolleaba junto con las filas, quedando oculto al bajar. Fix: `maxHeight = headerHeight + rowHeight*display`, más `position:sticky` en `.multifield-scroll-box thead th` para que el header quede fijo arriba. Efecto secundario encontrado en el camino: la tabla usaba `table-layout:auto` (ancho por contenido), que dentro del contenedor flex `.multifield-scroll-box` (necesita poder achicarse) hacía que la tabla se saliera del contenedor — arreglado con `table-layout:fixed` scoped a `.multifield-scroll-box`.
3. **Condición de carrera preexistente en `_setupChangeTracking`** (ya estaba en el código antes de esta feature, pero era inofensiva): al cambiar la columna catálogo, dispara un `change` anidado en su columna `choice` hermana *mientras el handler del catálogo todavía está corriendo* — ese anidado escribe `dataset.allRows` con el valor nuevo, pero el handler externo lo pisa después con su propia copia (parseada antes del anidado) al terminar. En el grid viejo esto nunca importó porque el submit real leía los `<input>` vía `FormData`, no el dataset. El modal sí necesitaba el dataset como fuente de verdad al guardar — fix: al guardar, leer los valores directo de los inputs del DOM (que siempre están correctos) en vez de `miniGrid.dataset.allRows`.

### Verificado

Suite completo `node --test tests/*.test.js`: **163/163**. Tests permanentes en `tests/e2e.test.js`:
- **#10** — flujo completo del modal: abrir, elegir catálogo, `default-from` de `<choice>`, elección manual persiste al cambiar de producto, Guardar → fila compacta con los valores correctos, click en la fila reabre el modal precargado, Escape sin guardar no duplica la fila.
- **#11** — campo top-level con `<copy>` queda oculto, el catálogo hermano muestra "clave - nombre".
- **#12** — intercepta el POST real de submit y confirma que las claves planas `items_<col>_<idx>` llegan con los valores correctos. Es el más importante de los tres: protege el mecanismo del que depende que un form no pierda sus filas de multifield en silencio al guardar (un handler real como `ventas.handler.js` en THYM POS ya parsea exactamente ese patrón por regex).
- **#13** — ver sección 4 (validación inline).

No se hizo verificación manual en vivo contra THYM POS real (`ventas.xml`, server corriendo en :3002) por no tener credenciales de login a mano en esta sesión — recomendado antes de dar la feature por cerrada en producción.

---

## 4. Validación inline con resumen en submit — ✅ IMPLEMENTADO (2026-08-24)

**Lo que ya existía:** `validator.validateField()` (min/max/pattern/check/max-days-ago) + `showErrorOnField()` (mensaje inline `.error-msg` debajo del campo) — se disparaba solo en cada `blur` (`ValidationCoordinator.js`), sin tocar nada. **Lo que faltaba, dos cosas:** `required` nunca pasaba por ese sistema (lo manejaba 100% el atributo HTML `required` + `checkValidity()`/`reportValidity()` nativo del navegador), y no existía ningún resumen — el submit solo enfocaba el primer `.field-error` que hubiera quedado de un blur anterior.

Implementado:
- **`ValidationCoordinator`** — `attach()` ahora guarda `{fieldXml, inputEl}` de cada campo top-level en `this._fields` (las columnas de multifield no pasan por acá, `renderField()` las deriva a `renderMultifield()` antes). Nuevo método `validateAll()`: recorre todos los campos registrados, limpia errores viejos, chequea `inputEl.required` (vacío → "Este campo es obligatorio.") y re-corre `validator.validateField()` para el resto — devuelve la lista de campos inválidos con `{fieldId, label, message}`.
- **`SubmitManager`** — el handler de submit reemplaza `formEl.checkValidity()`/`reportValidity()` por `this.coordinator.validateAll()`; si hay campos inválidos, pinta cada uno inline (ya lo hace `validateAll()`), empuja un resumen a la `StatusBar` (`Falta "X".` o `Faltan N campos: X, Y, Z.`) y enfoca el primero — sin llegar a armar `data` ni pegarle al servidor.
- **`FormRenderer`** — el `<form>` gana `noValidate = true`. Necesario: un `<button type="submit">` con `required` vacío nunca llega a disparar el evento `submit` si el navegador puede validar por su cuenta — lo bloquea antes y muestra su propio globito. Sin `noValidate`, `validateAll()` nunca llegaría a correr.

Verificado en vivo (Clientes, campo `Nombre` requerido vacío): el campo queda en rojo con "❌ Este campo es obligatorio." debajo, la `StatusBar` dice `❌ Falta "Nombre".`, y no aparece ningún tooltip nativo del navegador. Test permanente **#13**.

---

## 6. Visibilidad/habilitación condicional (`visible-when`/`enabled-when`) — ✅ IMPLEMENTADO (2026-08-25)

El caso "Nombre visible solo si Otra" se descartó (ver sección 1-C: era un malentendido de la auditoría original, el sentinel abre un subform de alta, no un campo de texto). Se implementó el mecanismo genérico y se aplicó al caso real: **costo de envío deshabilitado salvo que se elija "Envío"**.

**Sintaxis** — hijo directo de `<field>`, misma convención que `<default>`/`<help>` (no atributo):
```xml
<field id="envio_costo" label="Costo de envío ($)" type="number" size="12">
    <default>0</default>
    <enabled-when>envio_retiro == 'Envío'</enabled-when>
</field>
```
`visible-when` funciona igual, oculta el `.field-row`/`.field-block-horizontal` en vez de deshabilitar el input.

**Implementación** — `LayoutProcessor.js` gana `setupConditional(el, visibleWhenExpr, enabledWhenExpr)` (mismo patrón que el ya existente `setupIsExpression`): engancha un listener al `<form>` entero (`input`/`change`), recalcula con `ExpressionEngine.evaluate(expr, ExpressionEngine.createContextFromForm(formEl))` — la misma función que ya arma el contexto para `<check>`, cero motor de expresiones nuevo. Cálculo inicial al cargar, no solo en cambios futuros.

**Interacción con la validación de la sección 4:** un campo `required` pero oculto por `visible-when` (o deshabilitado por `enabled-when`) no puede completarse — `ValidationCoordinator.validateAll()` ahora salta campos `disabled` o con `offsetParent === null` (oculto por `display:none` en sí mismo o cualquier ancestro), para no bloquear el submit por algo que el usuario ni ve ni puede tocar.

**Bug de motor encontrado y corregido en el camino** — más serio que el feature en sí: `ExpressionEngine.evaluateRelational()` mandaba **ambos lados** de `==`/`!=` a través de `evaluateArithmetic()` (parser numérico puro). Un literal entre comillas como `'Envío'` no es aritmética válida — el parser lo rechazaba y devolvía `0` para ambos lados sin importar el valor real, así que `campo == 'Texto'` daba **siempre `true`**, incluso comparando contra un valor completamente distinto. Confirmado ejecutando el motor directo antes de aplicar el fix (`"Retira" == 'Envío'` → `true`, incorrecto). Nadie dependía de este comportamiento (`grep` sin resultados de `==`/`!=` en ningún `<check>` existente), así que el fix es seguro: para `==`/`!=` específicamente, ambos lados se resuelven ahora con `resolveValue()` (entiende comillas/variables/números) en vez de `evaluateArithmetic()`; `>`/`<`/`>=`/`<=` siguen aritméticos sin cambios.

Fixture nuevo `dev/form/conditional_fields.xml` + test permanente **#14** (arranca deshabilitado, "Retira" lo mantiene deshabilitado —el caso exacto que el bug de `==` invertía—, "Envío" lo habilita). Verificado también visualmente (captura real, fondo gris/deshabilitado vs. blanco/habilitado).

---

## 7. Orden de prioridad propuesto

1. ~~**Hoy, config-only:** `display="1"` en multifields de venta, renombrar `N°`.~~ ✅ Aplicado 2026-08-23. ANT/SIG a nivel de formulario: se deja como está (decisión cerrada, sección 2).
2. ~~**Motor, feature nueva (sección 2):** "Agregar producto" vía modal + grid de solo lectura + ▲/▼.~~ ✅ Implementado y verificado 2026-08-23.
3. ~~**Motor, bajo esfuerzo / alto impacto:** validación inline con resumen en submit.~~ ✅ Implementado y verificado 2026-08-24 (sección 4).
4. ~~**Motor, esfuerzo medio:** sistema de visibilidad/habilitación condicional.~~ ✅ Implementado y verificado 2026-08-25 (sección 6).
5. ~~**Mobile cards del grid completo.**~~ ⏭️ Movido a un plan aparte (sección 8) — no queda nada de escritorio pendiente en este documento.

---

## 8. Mobile — movido a un plan aparte (2026-08-26)

Los dos ítems de la auditoría original que quedaban sin resolver son ambos de mobile:
- Tabla del grid de productos incómoda en pantallas angostas (la auditoría ya marcaba esto como no evaluado con rigor — "para eso habría que ver el formulario en ~360-430px", nunca hubo una captura mobile real).
- Navegación lateral (sidebar) no evaluable en mobile — directamente fuera de cualquier capture de la auditoría.

Decisión del usuario: separar esto en un plan propio, no seguir agregándolo a este documento. Motivo implícito — a diferencia de todo lo de sección 1 a 6, acá no hay un hallazgo concreto contra código real todavía, solo una sospecha razonable ("probablemente haga falta algo más que el CSS mobile que ya existe") sin una captura mobile real que la confirme. Mezclarlo con este plan (que sí fue punto por punto contra el código) le restaría precisión a ambos.

**Estado de este documento: cerrado para desktop.** Los 13 hallazgos concretos de la auditoría original (sección 21) quedaron: 9 implementados, 2 ya cubiertos de antes, 1 decidido explícitamente dejar como está, 2 movidos al plan de mobile.
