# Known Bugs — Nilix

**Última actualización:** 2026-10-27

---

## ⚠️ Abiertos

_(ninguno)_

---

## ✅ Resueltos

### Bug 6 — El mensaje de validación del handler no llega a la pantalla — ✅ FIXED (2026-10-27)

**Síntoma (detectado en thym-pos):** al intentar modificar una venta registrada, `ventas.handler.js` la rechaza con "Las ventas registradas no se modifican…", pero la usuaria veía `❌ Error guardando tabla=ventas | Validation failed — at RecordService.upsert (…/RecordService.js:70:19)`.

**Causa:** `recordController.js` responde un `validate()` fallido con `400 { error: { message: 'Validation failed', errors: [<texto del handler>] } }`. `RecordService.js` solo leía `error.message`. Y `SubmitManager.js` mostraba el error vía `logger.error`, que arma el texto con el stack.

**Fix:** `RecordService.js` — `responseError()`: el `Error` lleva el texto de `errors[]` (marcado `userFacing`). `SubmitManager.js` — después de registrar el error, la barra de estado muestra solo ese texto (o "No se pudo guardar: …" si no vino del handler).

**Tests:** `tests/e2e.test.js` #22. Fixture: `dev/form/comprobante_fixture.xml` + `dev/apps/comprobante_fixture.handler.js`. En thym-pos: `tests/ui.test.js` (punto 7).

### Bug 7 — Después de guardar, el form queda a medias y el comprobante no se ve — ✅ FIXED (2026-10-27)

**Síntoma (detectado en thym-pos):** al guardar una venta, el comprobante (`<output>`) se abría en una pestaña nueva que quedaba en segundo plano, y el form se vaciaba solo en parte: fecha, total y combos fijos sí; la clienta ("2 - Keyla") y los productos no. Sin ningún mensaje visible, parecía no guardada — riesgo de cargar la venta dos veces.

**Causa:** `SubmitManager.js` abría el reporte con `window.open()` y a los 2 s llamaba `formEl.reset()`, que solo vacía inputs nativos: no toca el valor/overlay de los select de catálogo (Autocomplete) ni las filas del multifield, y además deja vacíos los campos con `<default>` (ej. fecha `today`).

**Fix:** el comprobante se muestra en un modal sobre el form (`js/components/form/ReportModal.js`, mismo backdrop que `SubformModal`), con el N° guardado en el título, VOLVER/✕ e IMPRIMIR (abre `report.html`). Al cerrarlo, el form se vuelve a dibujar desde su XML (`FormRenderer` — `ctx.reload()`) con el N° guardado en la barra. Sin `<output>`: tras un alta, mismo redibujado a los 2 s; tras una actualización, el registro queda cargado.

**Tests:** `tests/e2e.test.js` #23. En thym-pos: `tests/ui.test.js` (punto 14).

### e2e #6 intermitente — "Update record — Clientes" — ✅ FIXED (2026-10-27)

**Causa (ya no "sin investigar"):** `SubmitManager.js` reseteaba el form 2 s después de **todo** guardado, y el test espera esos mismos 2 s antes de navegar con SIG/ANT desde el registro actualizado — carrera entre el `setTimeout` y el `waitForTimeout`. Si el reset ganaba, navegaba desde un form vacío. **Fix:** después de una actualización el registro queda cargado (ver Bug 7). Corrido aislado 4/4 y la suite completa 2/2 sin fallas.

### Bug 5 — Select catálogo no refleja el registro cargado — ✅ FIXED (2026-10-26)

**Síntoma (detectado en thym-pos):** al cargar una venta por N° o con ANT/SIG, el campo Clienta seguía mostrando "3 - Flor" (la última elección manual) aunque la venta fuera de otra clienta; el valor guardado era el correcto, solo la capa "clave - nombre" y los `<copy>` quedaban viejos. En el mismo sentido, las líneas de una venta recargada mostraban el id del producto (`13`, `7`) en vez del nombre, y el modal de edición mostraba solo la clave.

**Causa:** `Autocomplete.js` arma el overlay desde `dataset.selectedRow`, que solo setean `selectItem()` / Tab. `ValidationCoordinator.fillForm()` y `Multifield._buildCatalogCell()` ponen `inputEl.value` sin pasar por ahí. Además, `Multifield._resolveDisplayValue()` solo sabía leer `__catalogRow`, que las filas cargadas por un handler (`populate`) no traen.

**Fix:** `Autocomplete.js` — `syncSelectedRowToValue()`: en cada `change` (y al conectar un campo que ya trae valor) re-resuelve la fila del catálogo para la clave actual y actualiza overlay, `catalogRow` y `<copy>`. `Multifield.js` — `_resolveDisplayValue()` cae a la columna `<copy>` del campo display (ej. `producto`) si no hay `__catalogRow`.

**Tests:** `tests/e2e.test.js` #20 (top-level: N° directo, SIG, ANT) y #21 (grid + modal del multifield). Fixtures: `dev/form/catalog_keyfield.xml`, `catalog_keyfield` y `venta_draft` id=1 en `utils/init-dev.js`.

### Bug 1 — `MAX_FAILED_ATTEMPTS` out of scope — ✅ FIXED (2026-07-20)

**Fix:** `authService.js:66` — `MAX_FAILED_ATTEMPTS` → `MAX_FAILED_ATTEMPTS_DEFAULT`

### Bug 2 — `last_login` en schema de test — ✅ FIXED (2026-07-20)

**Fix:** `tests/helpers/db.js:124` — columna `last_login TEXT` agregada a la tabla `usuarios`

### Bug 3 — DELETE no funciona con Express 5 — ✅ FIXED (2026-07-21)

**Fix:** `RecordService.js` — `keyField` como query param en vez de body.

### Bug 4 — `empresa_id` incorrecto al crear usuarios nil — ✅ FIXED (2026-07-21)

**Fix:** `authRecordService.js:75` — fuerza `empresa_id = 0` para usuarios sistema (wizard global).

---

## Contexto general

**Último commit funcional en origin:** `8187fb3` (2026-03-25) — v2.6.0
**Branch local adelantado:** 6 commits — nil-sys + v2.7.0 + fixes + tests
**Suite de tests:** 75 tests (38 unit + 37 integration) — 100% pass

### Pendiente antes de pushear a origin

1. [x] Corregir Bug 1 (`MAX_FAILED_ATTEMPTS`)
2. [x] Corregir Bug 2 (`last_login` en test helper)
3. [x] Verificar que `npm test` pasa (38/38)
4. [x] Hacer commit de los 8 archivos modificados (documentación v2.7.0)
5. [x] Integration tests (37 tests)
6. [x] Fix DELETE Express 5
7. [x] Fix empresa_id=0 nil users
8. [ ] Push a `origin/main`
