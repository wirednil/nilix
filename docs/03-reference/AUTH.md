# Autenticación — Referencia Técnica

*nilix v2.3.0 · nil-runtime*

---

## JWT (JSON Web Token)

Un JWT es una cadena en tres partes:

```
header.payload.signature
```

- **header** — algoritmo (`HS256`)
- **payload** — `usuarioId`, `empresaId`, `rol`, `publicToken`, `jti`, `exp`
- **signature** — HMAC del header+payload firmado con `NIL_JWT_SECRET`

El payload no está encriptado — cualquiera puede leerlo en base64.
La seguridad está en la **firma**: sin el secret no se puede forjar un token válido.

---

## Flujo de autenticación (v1.5.0+)

```
1. POST /api/auth/login
   → rate limit: 10 req / 15 min por IP
   → authService verifica usuario/password en auth.db (bcrypt)
   → bloqueo tras 5 intentos fallidos consecutivos (campo failed_attempts)
   → si ok: jwt.sign({ usuarioId, empresaId, rol, publicToken, jti }, NIL_JWT_SECRET)
   → res.cookie('nil_token', jwt, { httpOnly: true, sameSite: 'Lax', secure: si TLS })
   → responde { ok: true }

2. El token vive en la cookie HttpOnly `nil_token`
   → inaccesible a JavaScript (XSS-safe)
   → el browser la envía automáticamente en cada request al mismo origen

3. Cada request protegido:
   → verifyToken.js lee req.cookies.nil_token
   → jwt.verify(token, NIL_JWT_SECRET) → ok o 401
   → si ok: req.empresaId, req.usuarioId, req.rol disponibles en controladores

4. Si 401 → client.js redirige a /login.html automáticamente
```

**No hay localStorage. No hay Authorization: Bearer.**

---

## Guard de sesión (client-side)

`main.js` verifica sesión antes de cargar la app:

```javascript
const res = await fetch('/api/auth/check');
if (!res.ok) window.location.href = '/login.html';
```

`GET /api/auth/check` es público (sin `verifyToken`). Devuelve:

```json
{ "ok": true, "usuario": "admin", "rol": "admin", "publicToken": "abc123..." }
```

Si la cookie es inválida o expiró devuelve `401`.

---

## Logout

```
POST /api/auth/logout
→ lee req.cookies.nil_token
→ decodifica el jti (JWT ID único)
→ inserta jti en token_blacklist (auth.db)
→ res.clearCookie('nil_token')
→ responde { ok: true }
```

La blacklist se limpia automáticamente:
- Al iniciar el servidor (tokens expirados eliminados)
- Cada hora via `setInterval`

---

## Por qué cambiar NIL_JWT_SECRET invalida todos los tokens

La firma es `HMAC(header + payload, secret)`.

Al cambiar `NIL_JWT_SECRET`, `jwt.verify` recalcula con el nuevo secret → no coincide
con la firma del token viejo → `JsonWebTokenError: invalid signature` → 401.

**Es como cambiar la cerradura: las llaves viejas ya no entran.**

Todos los usuarios deben volver a loguearse. Comportamiento correcto.

---

## Expiración (`NIL_JWT_EXPIRY=8h`)

El payload incluye `exp` (unix timestamp). Pasadas 8 horas, `jwt.verify` lanza
`TokenExpiredError` → 401 → redirect a login.

Para cambiar: modificar `NIL_JWT_EXPIRY` en `.env`.

No hay refresh token — a las 8h el usuario vuelve a loguearse.

---

## Bloqueo por intentos fallidos

`authService.js` bloquea al usuario tras **5 intentos fallidos** consecutivos
(columna `failed_attempts` en `auth.db`). El bloqueo devuelve HTTP 403.

Para desbloquear: `UPDATE usuarios SET failed_attempts = 0 WHERE usuario = 'X'`
directamente en `auth.db`.

---

## Multi-tenant

El JWT payload incluye `empresaId`. `verifyToken.js` lo asigna a `req.empresaId`.

Todos los controladores usan `ScopedDb(rawDb, empresaId)` para que cada query
filtre automáticamente por empresa. Un usuario no puede acceder a datos de otra empresa.

El `publicToken` (UUID base64url de 22 chars, 128-bit entropy) permite acceso a
reportes públicos sin autenticación — ver `publicReportController.js`.

---

## Seguridad adicional

| Control | Implementación |
|---------|---------------|
| `helmet` + CSP | `server.js` — headers estrictos, HSTS condicional si TLS |
| Rate limiting login | `express-rate-limit`: 10 req / 15 min / IP |
| AuditLog | `src/middleware/auditLog.js` — registra escrituras con usuarioId + empresaId |
| Cookie HttpOnly | XSS no puede leer el token |
| SameSite=Lax | Mitiga CSRF para requests cross-site |
| TLS opcional | `NIL_TLS_CERT` + `NIL_TLS_KEY` en `.env` — activa HTTPS nativo |
| Blacklist JTI | Logout real invalida tokens activos antes de expirar |

---

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `src/services/authService.js` | `login()` — verifica credenciales, firma JWT, bloqueo |
| `src/services/authDatabase.js` | DB de auth separada (`auth.db`), blacklist, cleanup |
| `src/middleware/verifyToken.js` | Lee `req.cookies.nil_token`, verifica firma y blacklist |
| `src/middleware/auditLog.js` | Registra operaciones de escritura y errores |
| `src/routes/authRoutes.js` | `POST /login`, `POST /logout`, `GET /check` con rate limit |
| `js/api/client.js` | `authFetch()` — fetch con cookies automáticas; `logout()` |
| `data/auth.db` | Base de datos de usuarios (separada de la app DB) |
| `.env` → `NIL_JWT_SECRET` | Secret de firma — mínimo 256 bits en producción |
| `.env` → `NIL_JWT_EXPIRY` | Tiempo de vida del token (default: `8h`) |
| `.env` → `NIL_AUTH_DB` | Path al auth.db (default: `data/auth.db`) |
