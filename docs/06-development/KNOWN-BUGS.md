# Known Bugs — Nilix

**Última actualización:** 2026-07-21
**Todos los bugs conocidos están resueltos.** Branch local sin pushear a `origin`.

---

## ✅ Resueltos

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
