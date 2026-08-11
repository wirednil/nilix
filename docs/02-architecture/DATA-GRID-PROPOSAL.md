# Data-grid — requerimiento extraído de nil-audit / nil-users

**Fecha:** 2026-07-24
**Estado:** Cola de trabajo (Fase 5-bis de la reestructuración del motor de reportes).
No implementado. El grid en sí se diseña e implementa aparte — este documento
solo registra el requerimiento tal como estaba codificado en los `.yaml` que
se sacaron del motor, antes de que esa información se perdiera.

## Por qué existe este documento

`nil-audit.yaml` y `nil-users.yaml` (`sys/report/`) usaban el motor de
reportes (`layout: lines` + `markdown: true` + `rowTemplate`) para mostrar un
listado plano de datos vivos — sin cortes de control, sin subtotales, sin
agregación. Eso no es un reporte, es un data-grid escrito en el lenguaje
equivocado. La reestructuración de `kind` (`document`/`ledger`) los excluyó
del motor (`report.html` ahora rechaza `file=nil-audit`/`file=nil-users` con
un mensaje que apunta acá — ver `NOT_A_REPORT` en `report.html`). Los dos
`.yaml` siguen en el repo sin tocar: son la especificación de columnas de
este documento, no hace falta reinventarla.

## Audit Log (`sys/report/nil-audit.yaml`)

**Fuente de datos:** `GET /api/admin/audit-log?limit=500` (`adminController.js:40-49`)
→ `queryAuditLog(empresaId, {limit, offset})` (`authDatabase.js:212-225`).

```sql
SELECT id, ts, usuario_id, empresa_id, method, path, status, ms, ip
FROM audit_log WHERE empresa_id = ?
ORDER BY id DESC LIMIT ? OFFSET ?
```

| Columna (YAML) | Tipo | Notas |
|---|---|---|
| `ts` | string | timestamp, ya formateado server-side |
| `usuario_id` | numeric | sin resolver a nombre — el YAML no tenía `references` a `usuarios` |
| `method` | string | `GET`/`POST`/etc., mostrado con `` `code` `` en el template |
| `path` | string | la columna más ancha — causó el bug de overflow de esta sesión |
| `status` | numeric | HTTP status |
| `ms` | numeric | latencia |
| `ip` | string | |

**Filtro/orden/paginación que el YAML tenía implícitos** (no explícitos, porque el motor de reportes no soporta ninguno de los tres sobre `layout: lines`):
- Orden: `id DESC` fijo, no configurable desde el cliente.
- Límite: `500` hardcodeado en la URL del `dataSource`, sin UI para cambiarlo.
- **`offset` ya existe en `queryAuditLog()` a nivel servicio** (`authDatabase.js:212`) pero **no está expuesto** en la ruta (`adminController.js:41` solo lee `req.query.limit`) — paginación real necesita menos trabajo de backend del que parece: exponer `offset` es agregar una línea, no una función nueva.
- Sin filtro por `method`/`status`/rango de fechas — no existía ni a nivel YAML ni a nivel API.

## Usuarios (`sys/report/nil-users.yaml`)

**Fuente de datos:** `GET /api/admin/usuarios` (`adminController.js:55-63`) →
`queryUsuarios(empresaId)` (`authDatabase.js:230-242`).

```sql
SELECT id, nombre, usuario, email, rol, activo, created_at
FROM usuarios WHERE empresa_id = ? ORDER BY nombre
```

| Columna (YAML) | Tipo | Notas |
|---|---|---|
| `id` | numeric | |
| `nombre` | string | orden por defecto |
| `usuario` | string | mostrado con `` `code` `` en el template |
| `email` | string | |
| `rol` | string | `wizard`/`admin`/`auditor`/`operador` — ver `ROLE_RANK` en `usersController.js` |
| `activo` | numeric | 1/0, sin formatear a Sí/No en el YAML original |
| `created_at` | string | |

**Filtro/orden/paginación implícitos:**
- Orden: `nombre ASC` fijo, sin opción de cambiar columna de orden.
- **Sin `limit`/`offset` en absoluto** — ni a nivel ruta ni a nivel servicio. Trae todos los usuarios de la empresa siempre. Funciona hoy porque los datasets de prueba son chicos; un grid real necesita paginación que hoy no existe en ningún nivel para este endpoint (a diferencia de audit-log, acá no hay ni el `offset` parcial).
- Sin filtro por `rol`/`activo` — sería el filtro más obviamente útil para este listado y no existe.

## Lo que el grid necesita que el reporte nunca tuvo

Ambos endpoints hoy son "traé todo lo que entre en el límite fijo" — ningún
filtro, un solo orden fijo, paginación inexistente o parcial. Un data-grid de
verdad (filtro/orden/paginación sobre datos vivos, re-consultable) necesita:

1. **Backend:** exponer `offset`/`sort`/`filter` como query params reales en
   `adminController.js` (audit-log tiene medio camino andado vía `queryAuditLog`;
   usuarios no tiene nada). Sin esto el grid es cosmético — sigue trayendo un
   dump fijo del servidor y paginando/filtrando en el cliente sobre datos
   truncados, que es peor que lo que hay ahora.
2. **Frontend:** un componente de grid (no forma parte de `FormRenderer`
   actual ni del motor de reportes) con columnas, orden por click de header,
   filtro por columna, paginación real contra el backend.
3. **`usuario_id` → nombre de usuario** en Audit Log: hoy queda como número
   crudo porque el YAML no tenía `references` — un grid real debería resolver
   esto (join simple contra `usuarios`, no requiere motor de reportes).

Nada de esto está diseñado todavía — esta sección es la lista de lo que hay
que decidir cuando se ataque el grid, no una propuesta de solución.
