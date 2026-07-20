# Known Bugs — Nilix

**Última actualización:** 2026-07-20
**Proyecto retomado tras abandono.** Lista de bugs encontrados al reanudar el desarrollo. Todos están en el branch `main` local (no pusheados a `origin`).

---

## ✅ Resueltos

### Bug 1 — `MAX_FAILED_ATTEMPTS` out of scope — ✅ FIXED

**Fix:** `authService.js:66` — `MAX_FAILED_ATTEMPTS` → `MAX_FAILED_ATTEMPTS_DEFAULT`

### Bug 2 — `last_login` en schema de test — ✅ FIXED

**Fix:** `tests/helpers/db.js:124` — columna `last_login TEXT` agregada a la tabla `usuarios`

---

## Bug 1 — `MAX_FAILED_ATTEMPTS` out of scope

| Campo | Valor |
|---|---|
| **Severidad** | Alta |
| **Archivo** | `src/services/authService.js:66` |
| **Síntoma** | `ReferenceError: MAX_FAILED_ATTEMPTS is not defined` en login con contraseña incorrecta |
| **Tests que fallan** | `authService.test.js` — tests 5, 6, 8 (rechazar usuario inexistente, contraseña incorrecta, bloqueo en 5to intento) |
| **Introducido en** | `724a768` ("nil-sys infra + last_login") |
| **Causa raíz** | `incrementFailedAttempts()` está definida fuera de `login()`, pero `MAX_FAILED_ATTEMPTS` se declaró como `const` local dentro de `login()`. La función no la ve en su closure. |
| **Fix** | Cambiar `MAX_FAILED_ATTEMPTS` → `MAX_FAILED_ATTEMPTS_DEFAULT` en línea 66 |

**Detalle:** En el initial commit (`40ef676`) funcionaba bien porque `MAX_FAILED_ATTEMPTS` era una constante global del módulo. El commit `724a768` la renombró a `MAX_FAILED_ATTEMPTS_DEFAULT` y creó una nueva `const MAX_FAILED_ATTEMPTS` local en `login()`, pero olvidó actualizar la referencia en `incrementFailedAttempts()`.

---

## Bug 2 — Falta columna `last_login` en schema de test

| Campo | Valor |
|---|---|
| **Severidad** | Alta |
| **Archivo** | `tests/helpers/db.js:114-127` |
| **Síntoma** | `SQLITE_ERROR: no such column: last_login` en login exitoso |
| **Tests que fallan** | `authService.test.js` — tests 9, 10, 11 (login exitoso, payload JWT, publicToken) |
| **Introducido en** | `724a768` ("nil-sys infra + last_login") |
| **Causa raíz** | `authService.js:167` ejecuta `UPDATE usuarios SET last_login = datetime(...)` pero el schema de test (`tests/helpers/db.js`) no incluye la columna `last_login`. El helper de test solo se modificó en el initial commit — nunca se actualizó para reflejar los cambios de schema. |
| **Fix** | Agregar `last_login TEXT` a la tabla `usuarios` en `tests/helpers/db.js:114-127` |

**Detalle:** `tests/helpers/db.js` tiene un solo commit en toda la historia del proyecto (`40ef676`). El schema de producción se extendió para nil-sys pero el helper de test quedó desactualizado.

---

## Contexto general (proyecto abandonado)

**Último commit funcional en origin:** `8187fb3` (2026-03-25) — v2.6.0
**Branch local adelantado:** 4 commits (`91df7bb` `724a768` `8fc7470` `ef593e3`) — nil-sys surface, abril 2026
**Cambios sin commit:** migración de forms dev a nuevo schema database/table + documentación v2.7.0

### Para retomar: documentos clave

| Documento | Qué contiene |
|---|---|
| `README.md` | Descripción general, quick start, ejemplos |
| `docs/01-getting-started/DOCS-INDEX.md` | Índice completo de documentación |
| `docs/03-reference/CODE-MAP.md` | Mapa archivo por archivo del codebase |
| `docs/03-reference/CHANGELOG.md` | Historial de versiones |
| `docs/06-development/ROADMAP.md` | Roadmap original (marzo 2026, desactualizado) |
| `docs/02-architecture/NIL-SURFACES.md` | Arquitectura de superficies (nil-sys vs app) |
| `graphify-out/GRAPH_REPORT.md` | Grafo de conocimiento del proyecto completo |
| `graphify-out/graph.html` | Visualización interactiva del grafo (abrir en navegador) |

### Pendiente antes de pushear a origin

1. [ ] Corregir Bug 1 (`MAX_FAILED_ATTEMPTS`)
2. [ ] Corregir Bug 2 (`last_login` en test helper)
3. [ ] Verificar que `npm test` pasa (38/38)
4. [ ] Hacer commit de los 8 archivos modificados (documentación v2.7.0)
5. [ ] Push a `origin/main`
