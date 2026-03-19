# 🔒 PLAN DE AUDITORÍA DE SEGURIDAD - NILIX

**Basado en:** OWASP Web Security Testing Guide (WSTG) v4.2  
**Arquitectura objetivo:** 3 capas (Vanilla JS Frontend + Express API + SQLite Multi-tenant)  
**Versión del plan:** 1.0.0  
**Fecha:** 2026-03-02  

---

## 📋 RESUMEN EJECUTIVO

Nilix es un motor de formularios web con arquitectura de 3 capas que maneja:
- **Frontend:** Vanilla JS ES6 Modules, XML Forms, Report Engine con DuckDB-WASM
- **API:** Node.js/Express con JWT + bcrypt
- **Backend:** SQLite (sql.js) multi-tenant con ScopedDb

**Superficie de ataque crítica identificada:**
1. Parsing XML con @xmldom (potencial XXE)
2. Handlers dinámicos (carga código JS arbitrario)
3. ScopedDb con escape hatches (SQL injection potencial)
4. JWT secret en .env (riesgo de exposición)
5. Multi-tenancy (riesgo IDOR entre empresas)
6. DuckDB-WASM desde CDN (supply chain risk)

---

## 🎯 FASES DE AUDITORÍA

### FASE 1: Information Gathering (WSTG-INFO)

**Objetivo:** Mapear superficie de ataque y identificar endpoints/configs expuestos.

#### 1.1 Reconocimiento de Tecnologías
| Prueba | Herramienta | Archivo/Línea Objetivo | Severidad |
|--------|-------------|------------------------|-----------|
| Fingerprint Node.js/Express | nmap, whatweb | [`server.js`](server.js:1) | Info |
| Detectar headers reveladores | curl, Burp | `X-Powered-By` en Express | Baja |
| Enumerar endpoints API | wfuzz, dirb | [`src/routes/`](src/routes/) | Media |
| Identificar versiones deps | npm audit | [`package.json`](package.json:13) | Media |

**Pruebas específicas Nilix:**
```bash
# Enumerar endpoints API
curl -s http://localhost:3000/api/menu
curl -s http://localhost:3000/api/catalogs/tables
curl -s http://localhost:3000/api/files/content?path=...

# Verificar headers
curl -I http://localhost:3000/api/auth/login
# Verificar: X-Powered-By, Server, X-Frame-Options, CSP
```

#### 1.2 Análisis de Metadatos
| Prueba | Ubicación | Riesgo | Acción |
|--------|-----------|--------|--------|
| Comentarios en HTML | [`index.html`](index.html:1), [`login.html`](login.html:1) | Info | Buscar paths internos |
| Comentarios en JS | [`js/main.js`](js/main.js:1), [`js/app.js`](js/app.js:1) | Info | Buscar TODOs, paths |
| XML Forms metadata | [`forms/*.xml`](forms/) | Media | Buscar paths a handlers |
| YAML Reports | [`reports/*.yaml`](reports/) | Baja | Validar estructura |

**Búsqueda de información sensible:**
```bash
# Buscar en código fuente
grep -r "NIL_" --include="*.js" --include="*.xml" .
grep -r "password\|secret\|token" --include="*.js" .
grep -r "localhost\|127.0.0.1\|192.168" --include="*.js" .
```

#### 1.3 Enumeración de Entry Points

**Endpoints Públicos (sin auth):**
| Endpoint | Método | Descripción | Riesgo |
|----------|--------|-------------|--------|
| `/api/auth/login` | POST | Login JWT | Alto (brute force) |
| `/api/public/report-data/:report/:table` | GET | Reportes públicos | Media |

**Endpoints Protegidos (con JWT):**
| Endpoint | Método | Descripción | Riesgo |
|----------|--------|-------------|--------|
| `/api/records/:table` | GET/POST/PUT/DELETE | CRUD completo | Alto (IDOR) |
| `/api/handler/:handler/*` | POST | Ejecuta handlers | Crítico (RCE) |
| `/api/files/content` | GET | Lee archivos | Alto (path traversal) |
| `/api/catalogs/:table` | GET | Lista catálogos | Media |
| `/api/menu` | GET | Menú de navegación | Baja |

**Parámetros críticos identificados:**
- `path` en `/api/files/content` (path traversal risk)
- `table` en `/api/records/:table` (SQL injection risk)
- `handler` en `/api/handler/:handler/*` (code execution risk)
- `empresa_id` en JWT payload (multi-tenant isolation)

---

### FASE 2: Configuration and Deployment Management Testing (WSTG-CONF)

**Objetivo:** Auditar configs de Express, env vars, headers de seguridad.

#### 2.1 Pruebas de HTTP Methods

| Prueba | Endpoint | Resultado Esperado |
|--------|----------|-------------------|
| OPTIONS a endpoints | `/api/records/clientes` | Solo GET/POST/PUT/DELETE permitidos |
| TRACE request | `/` | 405 Method Not Allowed (evitar XST) |
| PUT sin body | `/api/records/clientes` | 400 Bad Request |

**Comandos:**
```bash
# Verificar métodos permitidos
curl -X OPTIONS -i http://localhost:3000/api/records/clientes

# Probar TRACE (debe fallar)
curl -X TRACE -i http://localhost:3000/
```

#### 2.2 Headers de Seguridad

**Auditar en:** [`server.js`](server.js:20)

| Header | Estado Actual | Requerido | Acción |
|--------|---------------|-----------|--------|
| `X-Powered-By` | **Eliminado** ✅ v2.3.0 | Eliminar | `app.disable('x-powered-by')` |
| `X-Frame-Options` | **Presente** ✅ v2.3.0 (helmet) | `DENY` o `SAMEORIGIN` | ✅ Implementado |
| `X-XSS-Protection` | **Presente** ✅ v2.3.0 (helmet) | `1; mode=block` | ✅ Implementado |
| `X-Content-Type-Options` | **Presente** ✅ v2.3.0 (helmet) | `nosniff` | ✅ Implementado |
| `Content-Security-Policy` | **Presente** ✅ v2.3.0 (helmet) | Política estricta | ✅ Implementado |
| `Strict-Transport-Security` | **Presente si TLS** ✅ v2.3.0 | `max-age=31536000; includeSubDomains` | ✅ Condicional |
| `Referrer-Policy` | **Presente** ✅ v2.3.0 (helmet) | `strict-origin-when-cross-origin` | ✅ Implementado |

**Estado:** ✅ Implementado en v2.3.0 (`server.js` líneas 51-70). helmet con CSP estricta, HSTS condicional a TLS, `x-powered-by` deshabilitado.

#### 2.3 Archivos Backup/Unreferenced

| Patrón a buscar | Riesgo | Ubicación a escanear |
|-----------------|--------|---------------------|
| `*.bak`, `*.old` | Info | `/data/`, `/forms/`, root |
| `*.db` sin protección | Crítico | `NIL_DB_FILE`, `NIL_AUTH_DB` |
| `menu.xml` expuesto | Media | `NIL_MENU_FILE` |
| `package.json` | Info | Root directory |

**Comandos:**
```bash
# Buscar archivos backup
find . -name "*.bak" -o -name "*.old" -o -name "*~" 2>/dev/null

# Verificar acceso directo a DBs
curl -I http://localhost:3000/data/auth.db
curl -I http://localhost:3000/data/catalogs.db
```

#### 2.4 Variables de Entorno

**Auditar en:** [`.env`](.env:1)

| Variable | Valor Actual | Riesgo | Recomendación |
|----------|--------------|--------|---------------|
| `NIL_JWT_SECRET` | `cambiar-este-secreto-en-produccion` | **CRÍTICO** | Generar secreto >=256 bits |
| `NIL_JWT_EXPIRY` | `8h` | Media | Reducir a 1-2h, implementar refresh |
| `NIL_PORT` | `3000` | Baja | Usar 3000 solo en dev |
| `NIL_MENU_FILE` | `/opt/wc/pizzeria/menu.xml` | Info | Validar path absoluto |
| `NIL_DB_FILE` | `/opt/wc/pizzeria/dbase/pizzeria.db` | Alto | Proteger acceso directo |

**Generar nuevo JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### FASE 3: Identity Management y Authentication Testing (WSTG-ATHN)

**Objetivo:** Auditar JWT, bcrypt, multi-tenant auth, brute force protection.

#### 3.1 Enumeración de Usuarios

| Prueba | Endpoint | Técnica |
|--------|----------|---------|
| Timing attack | `/api/auth/login` | Medir tiempo respuesta user existe vs no |
| Mensajes diferenciados | `/api/auth/login` | Verificar mensajes genéricos |

**Auditar en:** [`src/services/authService.js`](src/services/authService.js:31)

```bash
# Prueba de enumeración - usuario existe
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"wrong"}'

# Prueba de enumeración - usuario no existe
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"nouser","password":"wrong"}'

# VERIFICAR: Ambos deben retornar "Usuario o contraseña incorrectos"
```

#### 3.2 Bypass de Autenticación

| Prueba | Método | Endpoint | Resultado Esperado |
|--------|--------|----------|-------------------|
| Sin JWT | GET | `/api/records/clientes` | 401 Unauthorized |
| JWT inválido | GET | `/api/records/clientes` | 401 Token inválido |
| JWT expirado | GET | `/api/records/clientes` | 401 Sesión expirada |
| JWT malformed | GET | `/api/records/clientes` | 401 Token inválido |
| Header sin Bearer | GET | `/api/records/clientes` | 401 Autenticación requerida |

**Comandos:**
```bash
# Sin token
curl -i http://localhost:3000/api/records/clientes

# Token inválido
curl -i -H "Authorization: Bearer invalid.token.here" \
  http://localhost:3000/api/records/clientes

# Token expirado (generar uno con fecha pasada)
# Token sin firma correcta
```

#### 3.3 Brute Force Protection

**Auditar en:** [`src/services/authService.js`](src/services/authService.js:35)

| Prueba | Descripción | Resultado Esperado |
|--------|-------------|-------------------|
| 5 intentos fallidos | Login con password incorrecto | Cuenta bloqueada (activo=0) |
| Rate limiting | >10 intentos/minuto | 429 Too Many Requests |
| Bloqueo persistido | Verificar en auth.db | failed_attempts >= 5 |

**Comandos:**
```bash
# Script de prueba de brute force
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario":"admin","password":"wrong'$i'"}'
done

# Verificar bloqueo en DB
sqlite3 data/auth.db "SELECT usuario, activo, failed_attempts FROM usuarios WHERE usuario='admin';"
```

**Implementación recomendada:**
```javascript
// Agregar express-rate-limit
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por IP
    message: { error: 'Demasiados intentos, intente más tarde' }
});
app.use('/api/auth/login', loginLimiter);
```

#### 3.4 JWT Weaknesses

**Auditar en:** [`src/middleware/verifyToken.js`](src/middleware/verifyToken.js:12)

| Prueba | Técnica | Herramienta |
|--------|---------|-------------|
| Weak secret | Fuerza bruta JWT | jwt_tool, hashcat |
| Algorithm confusion | Cambiar alg a `none` | jwt_tool |
| Kid injection | Manipular header `kid` | Burp JWT Editor |
| Expiry bypass | Modificar `exp` claim | jwt.io |

**Comandos:**
```bash
# Extraer y decodificar JWT
echo "eyJ..." | cut -d'.' -f1 | base64 -d 2>/dev/null
echo "eyJ..." | cut -d'.' -f2 | base64 -d 2>/dev/null

# Verificar firma con jwt_tool
python3 jwt_tool.py -t http://localhost:3000/api/records/clientes \
  -rc "Authorization: Bearer TOKEN" -M at

# Prueba de algorithm confusion
# Cambiar alg: "none" y eliminar firma
```

**Verificaciones manuales:**
```javascript
// Verificar algoritmo (debe ser HS256)
// Verificar expiración <= 8h
// Verificar secret >= 256 bits en producción
// Verificar no hay información sensible en payload
```

---

### FASE 4: Authorization Testing (WSTG-ATHZ)

**Objetivo:** Auditar IDOR, privilege escalation, path traversal, multi-tenant isolation.

#### 4.1 Insecure Direct Object References (IDOR)

| Prueba | Descripción | Riesgo |
|--------|-------------|--------|
| Acceso a empresa B | Usar JWT de empresa A para acceder datos empresa B | Crítico |
| Modificar empresa_id | Cambiar empresa_id en JWT payload | Crítico |
| Bypass scopedDb | Usar `db.exec()` directamente sin filtro | Alto |

**Auditar en:** [`src/services/scopedDb.js`](src/services/scopedDb.js:23)

```bash
# Paso 1: Login como empresa A (empresa_id=1)
TOKEN_A=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"demo1234"}' | jq -r '.token')

# Paso 2: Intentar acceder datos empresa B (empresa_id=2)
# Esto debería fallar porque ScopedDb inyecta empresa_id
curl -H "Authorization: Bearer $TOKEN_A" \
  "http://localhost:3000/api/records/demo_productos?empresa_id=2"

# Paso 3: Verificar que empresa_id viene del JWT, no del query param
```

#### 4.2 Privilege Escalation

| Prueba | Descripción | Archivo Objetivo |
|--------|-------------|------------------|
| Cambiar rol en JWT | Modificar claim `rol` | [`verifyToken.js`](src/middleware/verifyToken.js:26) |
| Acceso handler admin | Usar handler restringido | [`handlerController.js`](src/controllers/handlerController.js:25) |
| CRUD sin permisos | Bypass RADU | [`SubmitManager.js`](js/components/form/SubmitManager.js:1) |

**Verificaciones:**
```javascript
// Decodificar JWT y verificar claims
// Intentar acceder a handlers con prefijo "admin_"
// Verificar que RADU permissions se validan server-side
```

#### 4.3 Path Traversal

**Auditar en:** [`src/controllers/filesystemController.js`](src/controllers/filesystemController.js:85)

| Prueba | Input | Resultado Esperado |
|--------|-------|-------------------|
| Path traversal simple | `path=../../../etc/passwd` | 403 Path not authorized |
| Path traversal con null byte | `path=forms/test.xml%00.html` | 403/404 |
| Path traversal con URL encoding | `path=..%2f..%2f..%2fdata%2fauth.db` | 403 Path not authorized |
| Path absoluto | `path=/opt/wc/pizzeria/apps/../dbase/pizzeria.db` | 403 Path not authorized |

**Comandos:**
```bash
# Intentar leer auth.db directamente
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/files/content?path=/opt/wc/pizzeria/../../../data/auth.db"

# Verificar normalización de paths
# El sistema usa path.resolve() - verificar que bloquea traversal
```

**Verificación de protección:**
```javascript
// menuService.isAuthorizedPath() debe:
// 1. Resolver path absoluto
// 2. Verificar contra authorizedDirs
// 3. Rechazar paths fuera de dirs autorizados
```

#### 4.4 Bypass de Schema/Multi-table

| Prueba | Descripción | Riesgo |
|--------|-------------|--------|
| SQL injection en table | `table=clientes; DROP TABLE` | Crítico |
| Table name injection | `table=sqlite_master` | Alto |
| Bypass whitelist | Tabla no en ALLOWED_TABLES | Alto |

**Auditar en:** [`src/services/recordService.js`](src/services/recordService.js:1)

---

### FASE 5: Session Management Testing (WSTG-SESS)

**Objetivo:** Auditar JWT como mecanismo de sesión.

#### 5.1 JWT Session Testing

| Prueba | Descripción | Resultado Esperado |
|--------|-------------|-------------------|
| Session fixation | Nuevo token en cada login | Token diferente |
| Token reuse post-logout | Token debe invalidarse | ✅ Blacklist JTI implementada (v1.5.0) |
| Concurrent sessions | Mismo user, múltiples tokens | Permitido (stateless) |
| Expiry behavior | Acceder con token expirado | 401 Sesión expirada |

**Estado:** ✅ Implementado en v1.5.0. `POST /api/auth/logout` lee cookie `nil_token`, extrae JTI, inserta en `token_blacklist` (auth.db), llama `clearCookie`. `verifyToken.js` verifica blacklist en cada request. Cleanup automático al startup y cada hora.

#### 5.2 CSRF Protection

| Prueba | Descripción | Estado |
|--------|-------------|--------|
| CSRF en forms POST | Enviar form desde otro origin | ✅ Mitigado: cookie `SameSite=Lax` (v1.5.0) |
| SameSite cookies | Cookie `nil_token` | ✅ `SameSite: 'Lax'` — requests cross-site bloqueados |

**Nota:** La migración a HttpOnly cookie (v1.5.0) cambia el vector CSRF. `SameSite=Lax` mitiga el ataque principal. Verificar endpoints que acepten `application/x-www-form-urlencoded` con CORS permisivo.

---

### FASE 6: Input Validation Testing (WSTG-INPV)

**Objetivo:** SQLi, XXE, XSS, Command Injection, SSRF.

#### 6.1 SQL Injection

**Auditar en:** [`src/services/recordService.js`](src/services/recordService.js:1), [`src/services/scopedDb.js`](src/services/scopedDb.js:86)

| Vector | Input | Objetivo |
|--------|-------|----------|
| Union-based | `' UNION SELECT * FROM usuarios --` | Extraer datos |
| Boolean-based | `' OR 1=1 --` | Bypass WHERE |
| Time-based | `' OR (SELECT * FROM (SELECT(SLEEP(5)))a) --` | Delay |
| Error-based | `'` | Provocar error |

**Endpoints vulnerables potenciales:**
```bash
# Inyección en parámetro table
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/records/clientes' OR '1'='1"

# Inyección en query params
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/records/clientes?keyField=id&id=1 OR 1=1"

# Inyección en scopedDb.exec (escape hatch)
# Si un handler usa db.exec() con input no sanitizado
```

**Verificar prepared statements:**
```javascript
// recordService.js usa placeholders ?
// scopedDb.find/findAll/insert usan prepare()
// VERIFICAR: db.exec() y db.prepare() son escape hatches sin sanitización
```

#### 6.2 XML Injection / XXE

**Auditar en:** [`js/components/xmlParser/XmlParser.js`](js/components/xmlParser/XmlParser.js:1), [`js/components/form/LayoutProcessor.js`](js/components/form/LayoutProcessor.js:1)

| Vector | Input | Descripción |
|--------|-------|-------------|
| XXE External | `<!ENTITY xxe SYSTEM "file:///etc/passwd">` | LFI via XML |
| XXE Out-of-band | `<!ENTITY xxe SYSTEM "http://attacker.com">` | SSRF via XML |
| Billion laughs | Entity recursiva | DoS |

**Pruebas:**
```xml
<!-- forms/test-xxe.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE form [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<form id="test" title="XXE Test">
    <layout>
        <field id="name" label="&xxe;" type="text"/>
    </layout>
</form>
```

**Verificar configuración @xmldom:**
```javascript
// @xmldom/xmldom por defecto permite entities externas
// VERIFICAR: options en DOMParser
const parser = new DOMParser({
    // entityExpansionLimit: 1000,
    // externalEntities: false  // NO SOPORTADO nativamente
});

// Mitigación: usar DOMPurify en XML antes de parse
// O sanitizar entidades <!ENTITY
```

#### 6.3 XSS (Reflejado/Almacenado/DOM)

**Auditar en:** [`js/components/form/LayoutProcessor.js`](js/components/form/LayoutProcessor.js:136), [`js/components/report/ReportRenderer.js`](js/components/report/ReportRenderer.js:1)

| Tipo | Vector | Ubicación |
|------|--------|-----------|
| Stored XSS | `<script>alert(1)</script>` en campo de form | Base de datos |
| DOM XSS | `javascript:alert(1)` en href | XML forms |
| Reflected | URL parameters sin escape | Report params |

**Pruebas:**
```xml
<!-- forms/test-xss.xml -->
<field id="nombre" label="<script>alert('XSS')</script>" type="text"/>
<field id="descripcion" type="textarea">
    <default><![CDATA[<img src=x onerror=alert(1)>]]></default>
</field>
```

**Verificar sanitización:**
```javascript
// LayoutProcessor.js processNode()
// - ¿Escapa innerHTML?
// - ¿Usa textContent para datos dinámicos?
// ReportRenderer.js
// - ¿DOMPurify antes de insertar HTML?
```

**Implementación recomendada:**
```javascript
// Agregar DOMPurify
import DOMPurify from 'dompurify';

// Sanitizar antes de insertar en DOM
const clean = DOMPurify.sanitize(dirtyHtml);
element.innerHTML = clean;
```

#### 6.4 Command Injection

**Auditar en:** [`src/services/handlerService.js`](src/services/handlerService.js:45)

| Vector | Input | Riesgo |
|--------|-------|--------|
| Handler name injection | `handler=../../../etc/passwd` | Path traversal |
| Code injection en handler | `; rm -rf /` en campo | RCE si handler usa eval |

**Verificar handlers dinámicos:**
```javascript
// handlerService.loadHandler() usa require()
// Si handlerName contiene ../ puede cargar archivos arbitrarios
// VERIFICAR: getHandlerPath() valida nombre

// Handlers pueden ejecutar código arbitrario
// Si un handler usa eval() o child_process, es riesgoso
```

#### 6.5 SSRF (Server-Side Request Forgery)

**Auditar en:** [`js/components/report/DataSourceManager.js`](js/components/report/DataSourceManager.js:1)

| Vector | Input | Descripción |
|--------|-------|-------------|
| DuckDB source injection | `dbRef: "http://internal.service"` | Conectar a servicios internos |
| YAML report injection | `source: "file:///etc/passwd"` | Leer archivos locales |

**Verificar:**
```yaml
# reports/test-ssrf.yaml
dataSource:
  dbRef: "http://169.254.169.254/latest/meta-data/"  # AWS metadata
  # o file:///etc/passwd
```

---

### FASE 7: Error Handling y Weak Cryptography (WSTG-ERRH, WSTG-CRYP)

**Objetivo:** Validar manejo de errores y criptografía.

#### 7.1 Error Handling

| Prueba | Input | Resultado Esperado |
|--------|-------|-------------------|
| Stack trace leak | Provocar error no manejado | Sin stack trace en prod |
| SQL error detallado | SQL inválido | Mensaje genérico |
| Path disclosure | Request a archivo no existente | Sin paths absolutos |

**Auditar en:** Todos los controllers.

**Verificaciones:**
```javascript
// En producción, NODE_ENV=production
// Error handlers no deben exponer:
// - Stack traces
// - Paths absolutos
// - Consultas SQL
// - Variables internas
```

#### 7.2 Weak Cryptography

| Componente | Implementación Actual | Verificación |
|------------|----------------------|--------------|
| Password hashing | bcryptjs | ✅ Cost >= 10 |
| JWT signing | HS256 | ✅ Verificar secret >= 256 bits |
| JWT secret storage | .env | ⚠️ Mover a secrets manager |
| HTTPS | No implementado | 🔴 REQUERIDO en prod |
| TLS version | N/A | TLS 1.2+ mínimo |

**Verificar bcrypt cost:**
```javascript
// authService.js - bcrypt.compare()
// Verificar que password_hash almacenado tiene cost >= 10
// $2a$10$...  (10 = cost factor)
```

---

### FASE 8: Business Logic Testing (WSTG-BUSL)

**Objetivo:** Auditar handlers, RADU, workflows.

#### 8.1 Bypass de Workflows

| Prueba | Descripción | Objetivo |
|--------|-------------|----------|
| Saltar validate | POST directo a /api/records | Evadir validación handler |
| Saltar beforeSave | crudMode=direct | Bypass transformación |
| Race condition | Múltiples submits concurrentes | Estado inconsistente |
| Modificar empresa_id | En body de POST | Cross-tenant write |

**Comandos:**
```bash
# Bypass de handler con crudMode=direct
curl -X POST http://localhost:3000/api/records/clientes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "keyField": "id",
    "data": { "id": 1, "nombre": "Hacked" },
    "crudMode": "direct"
  }'
```

#### 8.2 RADU Permissions

**Auditar en:** [`js/utils/RADU.js`](js/utils/RADU.js:1)

| Prueba | Descripción | Verificación |
|--------|-------------|--------------|
| Read sin permiso | Usuario sin R en RADU | Server-side validation |
| Write sin permiso | Usuario sin W en RADU | Server-side validation |
| Delete sin permiso | Usuario sin D en RADU | Server-side validation |

**Verificar:**
```javascript
// RADU permissions se validan en frontend (SubmitManager.js)
// PERO deben validarse también en backend
// VERIFICAR: recordController valida permisos antes de operar
```

---

### FASE 9: Client-Side Testing (WSTG-CLNT)

**Objetivo:** DOM XSS, CORS, Clickjacking, LocalStorage.

#### 9.1 DOM XSS

**Auditar en:** [`js/components/form/LayoutProcessor.js`](js/components/form/LayoutProcessor.js:136)

| Vector | Input | Sink |
|--------|-------|------|
| innerHTML | `<img src=x onerror=alert(1)>` | LayoutProcessor.processNode() |
| document.write | En handlers | Evitar uso |
| eval() | En ExpressionEngine | ✅ Ya eliminado en v0.20.0 |
| setAttribute | `javascript:alert(1)` | href, src |

#### 9.2 CORS Configuration

**Auditar en:** [`server.js`](server.js:23)

| Configuración | Estado | Recomendación |
|---------------|--------|---------------|
| `cors()` | `*` (permisivo) | Restringir a dominios específicos |
| Credentials | No usado | OK (JWT en header) |
| Preflight | Automático | Verificar |

**Implementación recomendada:**
```javascript
// Reemplazar cors() permisivo
const cors = require('cors');
const allowedOrigins = ['http://localhost:3000', 'https://tu-dominio.com'];
app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
```

#### 9.3 Clickjacking

| Prueba | Descripción | Mitigación |
|--------|-------------|------------|
| Iframe embedding | Cargar app en iframe | X-Frame-Options: DENY |
| UI redressing | Overlay de botones | CSP frame-ancestors |

**Implementar:**
```javascript
// Agregar helmet incluye X-Frame-Options
app.use(helmet.frameguard({ action: 'deny' }));
```

#### 9.4 LocalStorage Security

| Riesgo | Descripción | Estado |
|--------|-------------|--------|
| XSS roba token | ~~`localStorage.getItem('sf_token')`~~ | ✅ **Mitigado** (v1.5.0): token en HttpOnly cookie `nil_token`, inaccesible a JS |
| Token persistence | Token permanece tras cerrar sin logout | ✅ Logout real con blacklist JTI (v1.5.0) |
| No encryption | Token en plaintext en cookie | No aplicable (signed JWT, no secret data en payload) |

**Estado actual:** El vector "XSS roba token desde localStorage" ya no existe. El riesgo residual es XSS + acción en sesión (mitigado por `SameSite=Lax` y CSP).

---

## 🔧 HERRAMIENTAS RECOMENDADAS

### Automáticas
| Herramienta | Propósito | Comando |
|-------------|-----------|---------|
| Snyk | Vulnerabilidades en deps | `snyk test` |
| npm audit | Vulnerabilidades npm | `npm audit` |
| eslint-plugin-security | Linting seguridad | `eslint --ext .js src/` |
| Burp Suite | Proxy de interceptación | GUI |
| OWASP ZAP | Scanner automático | `zap.sh` |

### Manuales
| Herramienta | Propósito |
|-------------|-----------|
| jwt_tool | Testing JWT |
| sqlmap | SQL Injection |
| nmap | Network scanning |
| curl/httpie | Requests manual |
| sqlite3 | Inspección BD |

---

## 📊 MATRIZ DE RIESGOS IDENTIFICADOS

| ID | Vulnerabilidad | Severidad | Fase WSTG | Archivo Crítico |
|----|----------------|-----------|-----------|-----------------|
| SEC-001 | JWT Secret débil en .env | **Crítico** | ATHN-02 | `.env` |
| SEC-002 | XXE en parsing XML | **Alto** | INPV-11 | `XmlParser.js` |
| SEC-003 | SQL Injection en escape hatches | **Alto** | INPV-05 | `scopedDb.js` |
| SEC-004 | Path traversal en file serving | **Alto** | ATHZ-03 | `filesystemController.js` |
| SEC-005 | ~~Missing security headers~~ | ~~Medio~~ **MITIGADO** ✅ v2.3.0 | CONF-06 | `server.js` (helmet) |
| SEC-006 | ~~No rate limiting en login~~ | ~~Medio~~ **MITIGADO** ✅ v2.3.0 | ATHN-03 | `authRoutes.js` (10/15min) |
| SEC-007 | CORS permisivo | **Medio** | CLNT-09 | `server.js` (`NIL_ALLOWED_ORIGIN` en prod) |
| SEC-008 | XSS potencial en form rendering | **Medio** | INPV-01 | `LayoutProcessor.js` |
| SEC-009 | Command injection en handlers | **Medio** | INPV-12 | `handlerService.js` |
| SEC-010 | ~~LocalStorage para JWT~~ | ~~Bajo~~ **MITIGADO** ✅ v1.5.0 | SESS-02 | Cookie HttpOnly `nil_token` |
| SEC-011 | Information disclosure en errores | **Bajo** | ERRH-01 | Controllers |
| SEC-012 | DuckDB desde CDN externo | **Bajo** | CONF-08 | `DuckDBAdapter.js` |

---

## 🚀 PLAN DE REMEDIACIÓN PRIORIZADO

### Sprint Seguridad 1 (Crítico)
- [ ] Cambiar JWT secret a valor >= 256 bits aleatorio en producción
- [x] ~~Implementar helmet con security headers~~ ✅ v2.3.0
- [x] ~~Agregar rate limiting en login~~ ✅ v2.3.0 (10 req/15min/IP)
- [x] ~~Deshabilitar X-Powered-By~~ ✅ v2.3.0
- [ ] Restringir CORS con `NIL_ALLOWED_ORIGIN` en producción (variable disponible, aplicar en deploy)

### Sprint Seguridad 2 (Alto)
- [ ] Sanitizar XML contra XXE (DOMPurify o config @xmldom)
- [ ] Auditar todos los usos de scopedDb.exec/prepare
- [ ] Validar y sanitizar path en filesystemController
- [ ] Implementar validación server-side de RADU

### Sprint Seguridad 3 (Medio)
- [ ] Agregar DOMPurify en frontend (LayoutProcessor.js)
- [x] ~~Implementar CSP estricta~~ ✅ v2.3.0 (helmet)
- [x] ~~Configurar HTTPS con TLS 1.2+~~ ✅ v2.3.0 (NIL_TLS_CERT/KEY)
- [x] ~~Implementar token blacklist/logout~~ ✅ v1.5.0 (JTI blacklist + cleanup)

### Sprint Seguridad 4 (Bajo/Futuro)
- [x] ~~Migrar JWT de LocalStorage a HttpOnly cookie~~ ✅ v1.5.0 (nil_token HttpOnly)
- [ ] Implementar Content-Security-Policy report-only en staging
- [ ] Auditar handlers de terceros
- [ ] Implementar WAF (modsecurity/nginx)

---

## 📝 CHECKLIST DE VERIFICACIÓN FINAL

- [ ] Todas las pruebas de FASE 1 completadas
- [ ] Todas las pruebas de FASE 2 completadas
- [ ] Todas las pruebas de FASE 3 completadas
- [ ] Todas las pruebas de FASE 4 completadas
- [ ] Todas las pruebas de FASE 5 completadas
- [ ] Todas las pruebas de FASE 6 completadas
- [ ] Todas las pruebas de FASE 7 completadas
- [ ] Todas las pruebas de FASE 8 completadas
- [ ] Todas las pruebas de FASE 9 completadas
- [ ] Documento de hallazgos generado
- [ ] Plan de remediación aprobado
- [ ] Fixes implementados y verificados

---

## 📚 REFERENCIAS

- [OWASP WSTG v4.2](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Documento generado:** 2026-03-02  
**Versión:** 1.0.0  
**Próxima revisión:** Post-implementación de fixes críticos
