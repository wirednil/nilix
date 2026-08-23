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
| 4 filas vacías por defecto en multifield | Bajar `display="4"` → `display="1"` en el `<field type="multifield">` del form de venta real (equivalente en `mf_pedidos.xml` para el fixture de test) | Pendiente — grid ya arranca con `allRows=[]`, la única causa de las filas vacías es el atributo `display` (confirmado en `Multifield.js:407`) |
| `N°` ambiguo | `label="N° de venta"` + expandir `<help>` | Pendiente |
| Focus visible | Ya cubierto (19 reglas `:focus` en `styles.css`, incluye autocomplete y celdas de multifield) | Sin acción |
| Feedback al guardar | Ya cubierto — `StatusBar.push('success', ...)` tras cada guardado | Sin acción |
| Densidad, tipografía, paleta | Auditoría lo marca como fortaleza — no tocar | Sin acción |

### B — Parche de config/CSS posible, pero no es la solución de fondo

| Ítem auditoría | Parche | Por qué no alcanza |
|---|---|---|
| Redundancia PRODUCTO + NOMBRE | `[data-field-id="producto"] { display:none }` sobre la columna ya `readonly skip="true"` | Oculta visualmente una columna que el motor sigue tratando como presente; no hay atributo `hidden="true"` real |
| `+ AGR` / `"0 de 0"` poco claros | — | Strings hardcodeadas en `Multifield.js:559,759`, no vienen de ningún atributo de form |

### C — Requiere modificar el motor

| Ítem auditoría | Qué falta | Esfuerzo |
|---|---|---|
| `NOMBRE` de clienta visible solo si se elige "Otra" | Sistema de visibilidad condicional entre campos. Confirmado ausente: `nil-form.md` lista `display only when expr` / `skip when cond` como **"No implementado"** | Medio — nuevo atributo XML + soporte en `LayoutProcessor.js` |
| Costo de envío deshabilitado salvo que "Envío" esté seleccionado | Mismo mecanismo condicional, aplicado a `disabled` | Medio (reutiliza la feature de arriba) |
| Validación inline con resumen antes de enviar | Reemplazar `formEl.reportValidity()` nativo en `SubmitManager.js:64-66` por un recorrido de campos inválidos usando `validator.showErrorOnField()` (ya existe, `ValidationCoordinator.js:84,206`) + resumen en `StatusBar` | Bajo-medio — la infraestructura de error inline ya existe, falta usarla en el submit |
| ANT/SIG/ENVIAR compitiendo (¿wizard o formulario único?) | No existe flujo de "pasos" de formulario. "wizard" en el código es solo un **rol de usuario**, sin relación | Alto si se quiere wizard real. Alternativa barata: los botones ANT/SIG solo se generan si `tableConfig.keyField && tableConfig.table` (`SubmitManager.js:25`) — si el form de venta no encaja en ese patrón de navegación secuencial, sacarlos es tan simple como no cumplir esa condición (config, no motor) |
| Tarjetas mobile para el grid de productos | Reestructuración de layout más profunda que la actual (45 reglas CSS existentes cubren el caso básico, no el rediseño completo en ficha) | Medio-alto — pendiente de una captura mobile real antes de estimar en serio (la propia auditoría lo señala como no evaluado) |

---

## 2. Feature en diseño: "Agregar producto" vía modal (en discusión, no confirmada)

Propuesta del usuario: reemplazar el grid con `display` filas vacías por un estado inicial vacío (`+ AGREGAR PRODUCTO` solo), que al clickear abre una ventana modal con el producto como tarjeta vertical (mismo mockup de la sección "Mobile" de la auditoría), y al guardar lo agrega como fila compacta a la tabla.

### Infraestructura ya existente y reutilizable

- **`SubformModal.js`** — ya abre un form en overlay modal, escucha `sf:record-saved`, ejecuta callback con los datos. Backdrop, botón cerrar, cierre con click-afuera y Escape ya resueltos.
- **`_buildCatalogCell` / `_buildChoiceCell`** (`Multifield.js`) — ya están construidas sobre `Autocomplete.js`, el mismo widget que cualquier `<select>`/`<options>` top-level. No son un widget aparte.
- CSS de "card" para mobile ya tiene precedente (`.stepper-wrapper` card, fix v1.9.0 documentado en `ANALYSIS-HIERARCHY.md`).

### Gaps confirmados (motor)

1. **Trigger manual de subform no existe.** `nil-form.md`: *"Subformularios Manuales → ❌ No implementado."* Hoy `<subform>` solo dispara automáticamente desde `trigger-value` de un `<field type="select">`. Falta el gancho para que un botón arbitrario (`+ AGREGAR PRODUCTO`) abra un subform.
2. **`<choice>` está atado al DOM de fila de tabla.** `_buildChoiceCell` lee `rowEl.dataset.catalogRow` — depende de vivir dentro de un `<tr>`. Camino más barato: el modal renderiza la misma fila vía `_buildRow()` ya existente, solo reestilizada como tarjeta vertical por CSS — así se reutiliza toda la lógica de catalogRow/choice/validación sin reescribirla.
3. **Falta el pegamento de guardado**: al cerrar el modal con éxito, tomar los valores de esa fila → `allRows.push(...)` + `_rerenderGrid()` en el grid padre. Código nuevo, acotado (~20-30 líneas estimadas).

### Decisiones de producto pendientes (bloquean estimación final)

- ¿Las filas ya agregadas siguen editables inline en la tabla, o toda edición (incluso de un producto ya cargado) pasa a abrir el mismo modal?
- ¿El modal bloquea el cierre hasta que el producto sea válido, o se puede cancelar sin agregar nada?

**Estado:** en discusión con el usuario, sin código escrito todavía.

---

## 3. Orden de prioridad propuesto

1. **Hoy, config-only:** `display="1"` en multifields de venta, renombrar `N°`, revisar si ANT/SIG debe existir en el form de venta.
2. **Motor, bajo esfuerzo / alto impacto:** validación inline con resumen en submit; fix de los dos strings hardcodeados (`+ AGR`, `"0 de 0"`).
3. **Motor, esfuerzo medio:** sistema de visibilidad/habilitación condicional (`visible-when`/`enabled-when`) — resuelve de una sola vez "Nombre solo si Otra" y "costo de envío solo si Envío", reutilizable en cualquier form futuro.
4. **Motor, feature nueva (sección 2):** "Agregar producto" vía modal — pendiente de las 2 decisiones de producto arriba.
5. **Mobile cards del grid completo:** después de tener una captura real del form en ~375px.
