# Plan de Mejora UX/UI Mobile — Nilix / THYM POS

**Fecha de creación:** 2026-08-27
**Origen:** Separado de `UX-UI-IMPROVEMENT-PLAN.md` (desktop, cerrado) a pedido del usuario — los dos hallazgos de mobile que quedaban sin resolver ahí nunca tuvieron una captura mobile real para evaluarlos con rigor.
**Input:** segunda auditoría UX/UI externa, esta vez sobre 4 capturas mobile reales del flujo completo (Venta → Agregar producto vía modal → Guardar línea → volver a Venta → producto persistido → total actualizado). Revisa y **corrige** una estimación anterior sin capturas (que había puesto el global mobile en 4.5/10) — con capturas reales, la auditoría lo sube a **7.5-8/10** y valida la decisión de usar modal en vez de tabla responsive.

**Veredicto de la auditoría, resumido:** la arquitectura (venta → colección de productos → subformulario) está bien (9/10) y no se toca. Lo que hace falta es afinar jerarquía/interacción dentro de ese patrón, no reemplazarlo.

---

## 0. Hallazgos verificados contra el código real (antes de creer nada a ciegas)

| Lo que dice la auditoría | Estado real (verificado) |
|---|---|
| "Contextualizar envío: RETIRO→costo disabled, ENVÍO→costo enabled" | ✅ **Ya implementado** (`enabled-when`, sesión de escritorio, `ventas.xml`) — la auditoría no lo sabía porque evalúa capturas, no el XML. Nada que hacer acá. |
| "Permitir tocar la tarjeta para editar (tap = editar, × = eliminar)" | ✅ **Ya implementado** (`_buildDisplayRow`, `Multifield.js`) — click en la fila reabre el modal precargado. Lo que SÍ falta: la tarjeta no comunica visualmente que es tappable (sin hover/pressed state, sin indicio), así que el gap real es de **affordance**, no de funcionalidad. |
| "El botón `×` debería tener touch target ≥44×44pt (el ícono puede ser chico, el área táctil no)" | ❌ **Gap real confirmado.** `.multifield-delete-btn` en mobile (`@media max-width:650px`) mide `min-width:2.2rem` (~35px) × `min-height:1.6rem` (~25.6px) — por debajo del mínimo táctil recomendado en ambos ejes. |
| "El botón Guardar del modal debería decir Agregar" | Confirmado: `mf-row-modal-save-btn` tiene el texto "Guardar" **hardcodeado siempre**, sin distinguir alta de edición (el título del modal sí distingue: `isEdit ? 'EDITAR' : 'AGREGAR'`). |
| "Spinners sin texto (`Cargando productos...`)" | No pude confirmar ni descartar — `Autocomplete.js` no tiene ningún estado de "cargando" con o sin texto hoy. Lo que se ve en las capturas como "círculos grises" no identifiqué qué es exactamente sin verlas — a confirmar antes de tocar nada acá. |
| "Modal con demasiado espacio vertical, compactar 25-35%" | Confirmado el mecanismo: `.mf-row-modal .multifield-table tbody td { padding: 0.5rem 0; gap: 0.2rem; }` — la compactación es factible vía CSS scoped a mobile, sin tocar el desktop (que la propia auditoría de escritorio ya había calificado bien de densidad). |

---

## 1. Los 5 cambios que propone la auditoría (P0/P1), con estado real

### P0

1. **Compactar el modal ~25-35% verticalmente** (sin reducir touch targets, solo espacio muerto). — ✅ **Implementado 2026-08-28**, con matiz: reducción real medida **~11.5%** (480px→425px, mismo estado, antes/después con el `@media` temporalmente deshabilitado para medir limpio), no el 25-35% pedido. La mayor parte del alto son 2-4 inputs con su propio touch-target (que no se tocó a propósito) — seguir bajando padding empezaba a comprometer separación entre campos, así que se frenó ahí en vez de forzar el número. `@media (max-width:650px)` nuevo, no existía ninguno para el modal antes (compartía densidad con desktop).
   - **Bug real encontrado y corregido después, 2026-08-28**: el usuario reportó una captura real de `ventas.xml` en mobile con espacio muerto enorme entre el label de cada campo y su input — muy por encima de lo que la medida del 11.5% de arriba explicaba. Diagnóstico con Playwright (`getComputedStyle`) sobre cada nodo del árbol: el `::before` que pinta el label de cada celda medía **112px de alto** por una sola palabra. Causa: `.multifield-table tbody td:not(.multifield-action-cell)::before` (la tarjeta mobile genérica, ya existente, para el grid persistido de solo lectura — `flex-direction: row`) fija `flex: 0 0 7rem` para alinear los ":" — pensado como ANCHO de columna en ese layout. Esa regla no está scopeada para excluir `.mf-row-modal`, así que también matchea el `::before` del modal, cuyo `td` es `flex-direction: column` — ahí el mismo `flex-basis: 7rem` se convierte en ALTO (112px) en vez de ancho, e infla cada celda ~120px de aire muerto. Fix: `flex: none;` agregado a la regla `::before` propia del modal (mayor especificidad, gana). Verificado con el mismo fixture: celda de un campo pasó de 159.98px a 67.19px de alto (contenido real). Suite completo re-corrido tras el fix: 165/165.
2. **Comunicar qué es editable vs. calculado/derivado dentro del modal.** — ✅ **Implementado 2026-08-28.** Gap real encontrado: una columna `is=` de multifield (ej. Subtotal) nunca recibía `.computed-field` (solo la reciben campos top-level vía `LayoutProcessor.js`) — `_buildRow()` ahora la agrega también. Verificado con fixture temporal: Subtotal queda itálica + opacidad 0.75, claramente distinta de Cantidad/Precio (normales).
3. **`GUARDAR` → `AGREGAR`** en el modal. — ✅ **Implementado 2026-08-28**, con la semántica completa que se había acotado en la conversación: alta dice "Agregar", edición sigue diciendo "Guardar" (mismo criterio que ya usa el título `EDITAR`/`AGREGAR`).

### P1

4. **Permitir editar una línea ya agregada sin pasar por eliminar+recrear.** — ✅ Ya funcionaba. La falta de **affordance visual** (que era el gap real) también se resolvió 2026-08-28: `.multifield-display-row` gana `:hover` reforzado + `:active` (feedback táctil, no depende de hover — mobile no lo tiene).
5. **Costo de envío contextual.** — ✅ Ya implementado (sesión de escritorio).
6. **`N° DE VENTA` — si lo genera el sistema, no debería ser un campo para completar.** — ✅ **Resuelto 2026-08-28, más radical de lo planteado: se sacó el campo por completo** (no solo read-only). Confirmado con el usuario que la corrección de ventas por N° nunca se usa en la práctica — y al revisar `ventas.handler.js` completo se encontró que esa función **nunca funcionó**: `beforeSave` siempre hace `db.insert()`, nunca `db.update()`, así que "cargar una venta existente y corregirla" en realidad creaba una venta duplicada. El campo `id`/`keyField="true"` se eliminó de `ventas.xml`, y como consecuencia **ANT/SIG a nivel de formulario también desapareció solo** (sin tocar código: `FormContext._findKeyField()` no encuentra ningún campo `keyField="true"` en el layout → `tableConfig.keyField` queda `null` → la condición que genera esos botones en `SubmitManager.js` da falso). Esto reabre y cierra la decisión "ANT/SIG se deja como está" de la sesión de escritorio — la razón que la sostenía (corregir venta por N°) resultó nunca haber sido real.
   - Efecto secundario encontrado y corregido: el feedback post-guardado (`¡CREADO! (ID: X)`) también leía el ID vía `tableConfig.keyField` — sin campo, mostraba `undefined`. Fix: fallback a `'id'` cuando no hay `keyField` declarado (convención que ya usa `ventas.handler.js` al setear `data.id` a mano).
   - Test permanente **#15** + fixture `dev/form/no_keyfield.xml` (un form con `table`+`handler` pero sin ningún campo `keyField`, mismo patrón que `ventas.xml` post-cambio).

### P2 (pulido, no urgente)

7. **Rediseño de la tarjeta de producto persistida** (formato recibo). — ⏳ Pendiente, deliberadamente no implementado — `_buildDisplayRow()` es genérico para cualquier multifield, un formato "nombre + cantidad×precio" hardcodeado no generaliza. Necesita decidirse como capability configurable por form antes de tocar código.
8. **Overlay del modal más marcado** (bajar peso visual del `ENVIAR` del form padre mientras el modal está abierto). — ✅ **Verificado 2026-08-28, ya estaba resuelto sin cambios de código.** El `.mf-row-modal-backdrop` existente (`rgba(0,0,0,0.55)`, `position:fixed/absolute; inset:0`) ya cubre las dos partes del hallazgo original:
   - *Bloqueo de interacción*: medido en vivo a 390px — el rect de `ENVIAR` cae 100% dentro del rect del backdrop, `document.elementFromPoint()` en el centro de `ENVIAR` devuelve el backdrop (no el botón), y un click directo con Playwright falla por timeout (botón no accionable) sin cerrar el modal ni disparar submit.
   - *Peso visual*: confirmado por comparación de capturas antes/después — `ENVIAR` pasa de botón negro sólido con texto blanco en negrita (máximo contraste de la pantalla) a texto gris fantasma que se funde con el backdrop oscuro, prácticamente ilegible.
   No se tocó CSS — el mecanismo ya cumplía el objetivo del punto 8.

---

## 2. Hallazgo nuevo durante la implementación, no resuelto

`.multifield-display-row` (la tarjeta tap-para-editar) no tiene `tabindex` — hoy es **imposible activarla por teclado**. Es un gap real de accesibilidad, pero requiere agregar interacción nueva (JS: `tabindex` + handler de `Enter`/`Space`), no solo CSS — quedó fuera del alcance acotado a "affordance visual" de esta vuelta.

---

## 3. Qué falta antes de empezar con lo que sigue

- Confirmar qué son los "círculos grises"/loaders de las capturas antes de decidir si hace falta texto descriptivo — sigue sin identificarse, no se tocó nada acá.
- Decidir el alcance de #7 (tarjeta resumida) — ¿solo para `ventas.xml` o como capability genérica del motor?
- `N° DE VENTA` (#6) es una pregunta de producto, no de UI — quién lo responde.
- Accesibilidad por teclado de la tarjeta tap-para-editar (sección 2 de arriba) — no estaba en el alcance original, a decidir si se suma.

## 4. Verificado (2026-08-28)

Suite completo `node --test tests/*.test.js`: **165/165** (corridas limpias; la única falla intermitente vista en el camino fue el mismo test preexistente ya conocido — "Update record — Clientes", sin relación con estos cambios). Medido en vivo (no asumido): botón `×` a 44×44px exacto en viewport 390px; texto del botón "Agregar"/"Guardar" según modo; alto del modal antes/después con el mismo estado; `.computed-field` aplicándose correctamente con fixture temporal (creado, probado, borrado); ausencia de ANT/SIG y feedback con ID real en un form sin `keyField`, también con fixture temporal antes de convertirlo en test permanente. Confirmado que desktop (viewport 1400px) no cambió — el `@media` nuevo no le aplica.
