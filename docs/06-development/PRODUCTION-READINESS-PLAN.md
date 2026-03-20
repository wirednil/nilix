# Plan de Producción — Madurez y Seguridad del Sistema

**Fecha de creación:** 2026-03-18
**Actualizado:** 2026-03-20 — T1.1 + T1.2 completadas
**Basado en:** Análisis técnico exhaustivo del proyecto (v2.2.0+)
**Equipo asumido:** 1–4 desarrolladores full-time

---

## 0. Auditoría — 2026-03-19

Validación independiente del estado real del proyecto contra el plan.

### 0.1 Verificación Fase 0

| Tarea | Estado | Evidencia |
|-------|--------|-----------|
| T0.1 Health check | ✅ Implementado | `GET /api/health` en `src/routes/healthRoutes.js`. Retorna `{ status, uptime, version, db, authDb }`. 503 si DB falla. |
| T0.2 CORS | ✅ Implementado | `server.js`: sin `NIL_ALLOWED_ORIGIN` usa `{ origin: false }`. Warning visible al arrancar. `.env.example` lo documenta como REQUERIDO. |
| T0.3 Handlers | ✅ N/A | No existen handlers custom en `dev/apps/`. Solo core (`handlerService.js`). Nombre validado con regex `^[a-zA-Z0-9_-]+$`. |
| T0.4 Tests | ✅ Implementado | 38 tests pasando: 11 authService + 14 scopedDb + 13 recordService. Coverage estimado ≥75% en módulos críticos. Node.js built-in test runner. |
| T0.5 Setup | ✅ Implementado | `scripts/setup.js`: genera JWT secret con `crypto.randomBytes(32)`, npm install, init-dev. `.env.example` completo con comentarios. |

**Veredicto Fase 0: ✅ COMPLETADA**

### 0.2 Estado Fase 1

| Tarea | Estado | Gap |
|-------|--------|-----|
| T1.1 CI/CD | ✅ Implementado | `.github/workflows/ci.yml`: tests + lint + .env.example check en cada PR. Badge en README. |
| T1.2 Rate limiting general | ✅ Implementado | `server.js`: 3 niveles — publicLimiter (60/min), apiLimiter (200/min), handlerLimiter (30/min). `/api/health` excluido. |
| T1.3 Refresh token | ❌ Faltante | JWT fijo 8h. No hay `/api/auth/refresh` ni rolling sessions. |
| T1.4 Structured logging | ❌ Faltante | Solo `console.*`. Sin pino/winston. Logs no parseables por herramientas. |
| T1.5 OpenAPI | ❌ Faltante | No existe `docs/api/openapi.yaml`. |
| T1.6 Docker | ❌ Faltante | No existe `Dockerfile` ni `docker-compose.yml`. |
| T1.7 CSP reporting | ❌ Faltante | CSP configurada en `server.js` pero sin `report-uri`. No existe `POST /api/security/csp-report`. |

**Veredicto Fase 1: ⚠️ 2/7 completadas**

### 0.3 Hallazgos de seguridad

**Críticos**

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|-----------|---------------|
| 1 | ~~Sin rate limiting en API general~~ | ~~`server.js`~~ | ✅ Resuelto en v2.4.2 — 3 niveles implementados |
| 2 | ~~Sin CI/CD = merges sin validación~~ | — | ✅ Resuelto en v2.4.3 — GitHub Actions activo |

**Altos**

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|-----------|---------------|
| 3 | `ScopedDb.exec()` / `.prepare()` sin auditoría de uso | `scopedDb.js:85-96` | Documentar que handlers deben sanitizar al usar SQL raw. Agregar log warning. |
| 4 | Sin refresh token | `authService.js` | Rolling sessions o endpoint `/api/auth/refresh` |
| 5 | Logs no estructurados | Todo el backend | Migrar a pino: `{ level, time, msg, empresaId, usuarioId }` |
| 6 | Sin API versioning | `server.js` | Prefixar rutas con `/api/v1/` |

**Medios**

| # | Hallazgo | Ubicación | Recomendación |
|---|----------|-----------|---------------|
| 7 | CSP sin reporting | `server.js:54-73` | Agregar `report-uri: /api/security/csp-report` |
| 8 | Sin containerización | — | `Dockerfile` + `docker-compose.yml` |
| 9 | Sin OpenAPI spec | — | Documentar los 8 endpoints críticos |

**Controles positivos confirmados**

| Control | Ubicación |
|---------|-----------|
| HttpOnly cookie `nil_token` | `authRoutes.js` — `httpOnly: true` |
| `Secure` flag condicional (solo con TLS) | `authRoutes.js` |
| `SameSite=Lax` | `authRoutes.js` |
| Blacklist JTI en logout | `authRoutes.js` + `authService.js` |
| Bloqueo tras 5 intentos fallidos | `authService.js` |
| Anti-enumeración en login (timing uniforme) | `authService.js` |
| RADU server-side | `recordController.js:36-44` |
| Tenant isolation en ScopedDb | `scopedDb.js:30-79` |
| Path traversal protection en handlers | `handlerService.js:21-28` (regex) |
| `uncaughtException` / `unhandledRejection` | `server.js:172-181` |
| Health check con 503 si DB falla | `healthRoutes.js:37-43` |
| CORS warning si no configurado | `server.js:75-78` |
| 38 tests en módulos críticos (75%+ coverage) | `tests/` |

### 0.4 Madurez actual

| Dimensión | Puntaje | Comentario |
|-----------|---------|------------|
| Seguridad core | 9/10 | Auth robusto, tenant isolation, hardening básico, rate limiting completo |
| Observabilidad | 4/10 | Health check OK, sin structured logs ni métricas |
| Testing | 7/10 | Tests críticos presentes, coverage decente |
| Documentación | 8/10 | `.env.example` completo, README claro |
| CI/CD | 6/10 | GitHub Actions: tests + lint + .env.example en cada PR |
| Containerización | 1/10 | Sin Docker |
| API governance | 2/10 | Sin versioning ni OpenAPI |

**Madurez global estimada: 6.3/10** *(+0.5 por T1.1)*

> Nota: el plan estimaba 7.5/10 al completar Fase 0. La diferencia (2 puntos) refleja que Fase 1 — CI/CD, containerización, API governance — tiene mayor peso del esperado en la percepción de madurez operacional.

### 0.5 Próximos pasos recomendados

| Prioridad | Acción | Esfuerzo | Impacto |
|-----------|--------|----------|---------|
| ~~1~~ | ~~Rate limiting general en `/api/*` (T1.2)~~ | — | ✅ Completado en v2.4.2 |
| ~~1~~ | ~~CI/CD básico: GitHub Actions `npm test` en PRs (T1.1)~~ | — | ✅ Completado en v2.4.3 |
| 1 | Structured logging con pino (T1.4) | 1–2 días | Alto — habilita debugging y alerting en campo |

---

## 1. Objetivo General del Plan

### Estado actual (2026-03-18)

El sistema es un motor de formularios declarativos XML→UI funcionalmente completo, con arquitectura modular limpia, documentación de desarrollo excepcional y seguridad razonable para uso interno. La madurez técnica se estima en **6.5/10**.

Las debilidades principales no son funcionales sino de calidad de ingeniería: **cero cobertura de tests**, algunos vectores de seguridad sin mitigar en escenarios multi-handler, y ausencia total de infraestructura de CI/CD y observabilidad operacional. En el estado actual, el sistema es apto para uso interno con usuarios de confianza en red local. No es apto para exposición a internet sin pasar por las Fases 0 y 1 de este plan.

### Estado deseado al finalizar

- **Madurez objetivo: 8.5–9/10**
- Coverage de tests: ≥70% en servicios críticos (auth, record, scoped DB)
- Sin vulnerabilidades de severidad Alta o Crítica sin mitigar
- CI/CD básico activo: lint + tests en cada PR
- Observabilidad mínima: health check, structured logging, un runbook operacional
- CORS restrictivo en producción por defecto (no requiere configuración manual)

---

## 2. Fases y Milestones

---

### FASE 0 — Mitigación de riesgos críticos ("incendios")
**Duración estimada: 2–4 semanas**
**Objetivo: el sistema puede desplegarse en producción con confianza básica**
**Estado: ✅ COMPLETADA — 2026-03-19 (v2.4.0)**

---

#### T0.1 — Health check endpoint ✅

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar `GET /api/health` que retorne `{ status: 'ok', uptime, version, db: 'ok'\|'error' }` |
| **DoD** | Endpoint responde 200 en condiciones normales, 503 si la DB no responde |
| **Esfuerzo** | 2–3 horas |
| **Dependencias** | Ninguna |
| **Riesgo si NO se hace** | Sin health check, balanceadores de carga, contenedores y monitoreo externo no pueden detectar el estado real del proceso |
| **Criterios de aceptación** | `curl /api/health` retorna JSON con status, uptime y estado de DB; documentado en DOCS-INDEX |
| **Responsable hipotético** | Backend dev |

---

#### T0.2 — Configuración CORS restrictiva por defecto ✅

| Campo | Detalle |
|---|---|
| **Descripción** | Cambiar el valor por defecto de CORS de `'*'` a `'null'` (denegar todo) cuando `NIL_ALLOWED_ORIGIN` no está definido. Agregar warning al arrancar si el valor es wildcard. |
| **DoD** | Sin `NIL_ALLOWED_ORIGIN` en .env, el servidor arranca con CORS denegado y logea un aviso visible. El README y `.env.example` documentan el campo como obligatorio en producción. |
| **Esfuerzo** | 2–4 horas |
| **Dependencias** | Ninguna |
| **Riesgo si NO se hace** | Cualquier origen puede hacer requests autenticadas si el browser envía la cookie. Vector CSRF/CORS relevante en contextos de red compartida. |
| **Criterios de aceptación** | Test manual: sin `NIL_ALLOWED_ORIGIN`, un fetch desde origen diferente recibe error CORS. Con la variable correcta, funciona. |
| **Responsable hipotético** | Backend dev |

---

#### T0.3 — Auditoría y documentación de handlers existentes ✅

| Campo | Detalle |
|---|---|
| **Descripción** | Revisar todos los handlers en `apps/` del proyecto de demo y cualquier instalación cliente. Verificar que ninguno ejecuta queries sin usar la API de ScopedDb (`.find`, `.insert`, etc.). Documentar cuáles usan `.exec()` o `.prepare()` directamente y si sanitizan inputs. |
| **DoD** | Existe un inventario en `docs/` con: lista de handlers, métodos DB que usan, y resultado de la revisión (SAFE / NEEDS-REVIEW / UNSAFE). Handlers marcados UNSAFE tienen issue abierto o fix aplicado. |
| **Esfuerzo** | 1 día |
| **Dependencias** | Ninguna |
| **Riesgo si NO se hace** | Un handler que interpole datos de usuario en SQL raw es SQLi directo. Al ser código arbitrario, el impacto es crítico. |
| **Criterios de aceptación** | Documento de inventario creado. Ningún handler activo marcado como UNSAFE sin fix o mitigación documentada. |
| **Responsable hipotético** | Security champion / Backend dev senior |

---

#### T0.4 — Tests unitarios: servicios críticos ✅

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar tests unitarios mínimos para: `authService` (login, bloqueo, JWT), `scopedDb` (auto-inyección empresa_id, boundary empresa), `recordService` (save, navigate, permisos RADU). Usar el framework de testing más liviano posible (Node built-in test runner o Vitest sin bundler). |
| **DoD** | `npm test` ejecuta exitosamente. Coverage ≥ 70% en los tres módulos mencionados. Los tests corren en < 30 segundos. |
| **Esfuerzo** | 3–5 días |
| **Dependencias** | Ninguna (puede hacerse en paralelo con T0.1–T0.3) |
| **Riesgo si NO se hace** | Cualquier refactor rompe funcionalidad crítica (auth, multitenancy, CRUD) sin aviso. Es el riesgo de mayor impacto acumulado del proyecto. |
| **Criterios de aceptación** | CI ejecuta `npm test` y falla el merge si tests no pasan. Al menos un test de regresión por cada bug conocido. |
| **Responsable hipotético** | Backend dev (2 personas si es posible para pair-testing) |

**Casos de test mínimos a cubrir:**

```
authService:
  ✓ login con credenciales correctas → devuelve JWT válido
  ✓ login con contraseña incorrecta → LoginError.INVALID_CREDENTIALS
  ✓ login tras 5 intentos fallidos → LoginError.LOCKED
  ✓ JWT incluye publicToken en payload

scopedDb:
  ✓ insert() inyecta empresa_id automáticamente si tabla tiene columna
  ✓ find() filtra por empresa_id automáticamente
  ✓ empresa A no puede leer registros de empresa B (isolation test)
  ✓ tabla sin empresa_id → no inyecta ni filtra

recordService:
  ✓ save() con keyField vacío → INSERT
  ✓ save() con keyField existente → UPDATE
  ✓ navigate() retorna registro adyacente correcto
  ✓ navigate() en boundary (primero/último) → 404
```

---

#### T0.5 — Script de setup de entorno reproducible ✅

| Campo | Detalle |
|---|---|
| **Descripción** | Crear `.env.example` completo (todos los campos con descripción inline), y un script `scripts/setup.sh` que verifique prereqs (node version, directorios, permisos) y genere un .env inicial seguro (JWT_SECRET aleatorio, CORS configurado). |
| **DoD** | Un desarrollador nuevo puede hacer `git clone` + `./scripts/setup.sh` + `node start.js` sin consultar documentación adicional para el entorno básico. |
| **Esfuerzo** | 4–6 horas |
| **Dependencias** | T0.2 (para documentar NIL_ALLOWED_ORIGIN como requerido) |
| **Riesgo si NO se hace** | Configuraciones inseguras por defecto en deployments nuevos (JWT secret débil, CORS wildcard). |
| **Criterios de aceptación** | El script se probó en un entorno limpio. `.env.example` tiene todos los campos. JWT_SECRET generado con `openssl rand -hex 32`. |
| **Responsable hipotético** | DevOps / Backend dev |

---

### FASE 1 — Seguridad y calidad de prioridad media
**Duración estimada: 4–8 semanas adicionales (semanas 5–12 desde inicio)**
**Objetivo: el sistema es auditable y mantenible por un equipo**

---

#### T1.1 — CI/CD básico (lint + tests)

| Campo | Detalle |
|---|---|
| **Descripción** | Configurar pipeline de CI (GitHub Actions o similar) que ejecute en cada PR: (1) linting (ESLint con config mínima), (2) `npm test`, (3) check de `.env.example` actualizado |
| **DoD** | PRs no pueden mergearse si CI falla. El pipeline corre en < 3 minutos. |
| **Esfuerzo** | 2–3 días |
| **Dependencias** | T0.4 (tests deben existir primero) |
| **Riesgo si NO se hace** | Regresiones silenciosas en cada merge. La deuda de tests no tiene "diente" que la mantenga viva. |
| **Criterios de aceptación** | Badge de CI en README. Último PR mergeado muestra CI verde. |
| **Responsable hipotético** | DevOps / Backend dev |

---

#### T1.2 — Rate limiting general en API

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar rate limiting global (no solo en login) usando el mecanismo ya implementado en `logRoutes.js` como base: N requests/IP/minuto por defecto, configurable via env. Excluir rutas de assets estáticos. |
| **DoD** | Un cliente que excede el límite recibe 429. El límite es configurable sin redeployment. Documentado en ARCHITECTURE. |
| **Esfuerzo** | 1–2 días |
| **Dependencias** | Ninguna |
| **Riesgo si NO se hace** | La API es vulnerable a fuerza bruta en endpoints distintos a login (enumerate records, scraping de catálogos) y a DoS básico. |
| **Criterios de aceptación** | Test manual: 100 requests seguidas al mismo endpoint → las últimas reciben 429. Comportamiento documentado. |
| **Responsable hipotético** | Backend dev |

---

#### T1.3 — Refresh token / extensión de sesión

| Campo | Detalle |
|---|---|
| **Descripción** | Implementar uno de dos enfoques (elegir el más simple): (A) rolling sessions — renovar JWT en cada request válido con una nueva expiración de 8h; o (B) endpoint `POST /api/auth/refresh` que emite un nuevo access token si el existente expira pronto (< 30 min). |
| **DoD** | Un usuario activo no es desconectado por expiración de sesión durante uso normal de trabajo. |
| **Esfuerzo** | 3–5 días |
| **Dependencias** | T0.4 (tests de auth deben existir para no romper nada) |
| **Riesgo si NO se hacer** | Usuarios son desconectados abruptamente a las 8h de uso, perdiendo trabajo no guardado. Puede generar llamadas de soporte. |
| **Criterios de aceptación** | Test: iniciar sesión, esperar/simular expiración próxima, continuar usando la app → no se redirige a login. |
| **Responsable hipotético** | Backend dev |

---

#### T1.4 — Structured logging (migración a pino)

| Campo | Detalle |
|---|---|
| **Descripción** | Reemplazar `console.log/error` del backend por `pino` (o `pino-http` para Express). Configurar output JSON en producción, pretty-print en desarrollo. Esto permite que herramientas como Grafana Loki, Datadog o grep estructurado consuman los logs. |
| **DoD** | En producción (`NODE_ENV=production`), cada línea de log es JSON válido con campos: `level`, `time`, `msg`, `usuarioId?`, `empresaId?`. En desarrollo, el output es legible por humanos. |
| **Esfuerzo** | 2–3 días |
| **Dependencias** | T1.1 (CI para verificar que no se rompe nada) |
| **Riesgo si NO se hacer** | Los logs del archivo generado por `start.js` son texto libre, difícil de parsear para alertas automáticas o análisis de incidentes. |
| **Criterios de aceptación** | `NODE_ENV=production node server.js 2>&1 | jq .` funciona sin errores. Campos críticos (`level`, `time`, `msg`) siempre presentes. |
| **Responsable hipotético** | Backend dev |

---

#### T1.5 — OpenAPI spec mínima

| Campo | Detalle |
|---|---|
| **Descripción** | Documentar en OpenAPI 3.1 (YAML estático, no generado) los endpoints críticos: auth (`/login`, `/check`, `/logout`), CRUD (`/records/:table`), handler (`/handler/:h/after`), health. No es necesario cubrir 100% — el objetivo es que exista un contrato formal versionado. |
| **DoD** | Archivo `docs/api/openapi.yaml` válido. Se puede importar en Postman/Insomnia y ejecutar requests. Documentado en DOCS-INDEX. |
| **Esfuerzo** | 1–2 semanas |
| **Dependencias** | T1.1 (CI puede validar que el YAML es válido en cada commit) |
| **Riesgo si NO se hacer** | Sin contrato formal, cambios de API rompen clientes silenciosamente. Imposible garantizar backward-compatibility. |
| **Criterios de aceptación** | `npx @redocly/cli lint docs/api/openapi.yaml` pasa sin errores. Al menos 8 endpoints documentados. |
| **Responsable hipotético** | Backend dev + Frontend lead (revisión de contrato) |

---

#### T1.6 — Dockerfile y docker-compose

| Campo | Detalle |
|---|---|
| **Descripción** | Crear `Dockerfile` multi-stage (build + runtime), y `docker-compose.yml` para desarrollo local con volúmenes para datos y env. No requiere Kubernetes — el objetivo es reproducibilidad de entorno. |
| **DoD** | `docker compose up` levanta el sistema completo. La imagen de producción tiene < 200MB. Los datos persisten en volúmenes entre reinicios. |
| **Esfuerzo** | 1–2 días |
| **Dependencias** | T0.5 (.env.example debe estar completo) |
| **Riesgo si NO se hacer** | Deployments manuales son error-prone. Sin contenedización, los entornos de staging y producción divergen del de desarrollo. |
| **Criterios de aceptación** | El sistema corre identicamente en Docker y en bare-metal. CI puede construir la imagen sin errores. |
| **Responsable hipotético** | DevOps |

---

#### T1.7 — CSP reporting endpoint

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar `report-uri` o `report-to` al header CSP existente apuntando a `POST /api/security/csp-report`. Loguear violaciones (sin almacenar, solo a stdout para que queden en el log de archivo). |
| **DoD** | Header CSP incluye directiva de reporting. Las violaciones aparecen en el log del servidor con prefijo `[CSP]`. |
| **Esfuerzo** | 3–4 horas |
| **Dependencias** | T0.1 o T1.4 (para que el log sea útil) |
| **Riesgo si NO se hacer** | Las violaciones de CSP son silenciosas. Si un XSS es inyectado via un handler malicioso, no hay telemetría de detección. |
| **Criterios de aceptación** | Test: provocar violación CSP manual → aparece en log. El endpoint es público (no requiere auth) como exige la spec. |
| **Responsable hipotético** | Backend dev |

---

### FASE 2 — Deuda estructural y madurez operacional
**Duración estimada: 8–16 semanas adicionales (semanas 13–28 desde inicio)**
**Objetivo: el sistema es operable con confianza, mantenible a largo plazo, y escalable al equipo**

---

#### T2.1 — Tests de integración de API

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar tests de integración que levanten el servidor real (DB en memoria temporal), hagan requests HTTP y verifiquen respuestas. Cubrir flujos completos: login → CRUD → logout, RADU enforcement, multitenancy isolation. |
| **DoD** | Suite de integración corre en CI. Coverage de flujos críticos ≥ 80%. |
| **Esfuerzo** | 1–2 semanas |
| **Dependencias** | T0.4 (tests unitarios), T1.1 (CI) |
| **Riesgo si NO se hacer** | Los tests unitarios aíslan módulos pero no detectan problemas de integración (middleware mal ordenado, rutas conflictivas). |
| **Criterios de aceptación** | Un refactor de orden de middlewares es detectado por tests de integración antes de llegar a producción. |
| **Responsable hipotético** | Backend dev |

---

#### T2.2 — Tests e2e con Playwright

| Campo | Detalle |
|---|---|
| **Descripción** | Agregar 5–8 tests e2e que cubran los flujos de usuario más críticos: login/logout, cargar un form, guardar un registro, navegar ANT/SIG, ver un reporte. |
| **DoD** | Tests corren en CI (headless). Un cambio en el XML de formulario que rompe el renderizado es detectado. |
| **Esfuerzo** | 2–3 semanas |
| **Dependencias** | T1.6 (Docker simplifica el entorno de e2e en CI), T2.1 |
| **Riesgo si NO se hacer** | Los tests unitarios e de integración no pueden detectar regresiones en el renderizado UI o flujos de usuario. |
| **Criterios de aceptación** | Los 5+ tests e2e pasan en CI en < 5 minutos. Hay al menos un test de login completo y uno de CRUD completo. |
| **Responsable hipotético** | Frontend lead |

---

#### T2.3 — Migración gradual a TypeScript

| Campo | Detalle |
|---|---|
| **Descripción** | Configurar TypeScript en modo `allowJs: true` + `checkJs: true` primero (sin reescribir). Luego migrar módulos críticos uno a uno, comenzando por los servicios con mayor riesgo de regresión: `authService`, `scopedDb`, `recordService`. |
| **DoD** | Los 3 servicios críticos del backend están en `.ts`. `tsc` compila sin errores. CI incluye `tsc --noEmit`. |
| **Esfuerzo** | 4–6 semanas |
| **Dependencias** | T0.4 + T2.1 (los tests son red de seguridad durante la migración) |
| **Riesgo si NO se hacer** | Refactors futuros en JS puro son riesgosos. Los errores de tipo solo se descubren en runtime. |
| **Criterios de aceptación** | Los 3 módulos migrados no tienen `any` explícitos. Los tests existentes siguen pasando. |
| **Responsable hipotético** | Backend dev senior |

---

#### T2.4 — API versioning

| Campo | Detalle |
|---|---|
| **Descripción** | Prefixar todas las rutas actuales con `/api/v1/`. Mantener `/api/` sin prefijo como alias temporal (deprecated, con header `Deprecation: true`). Documentar política de versionado (major bump = breaking change). |
| **DoD** | Todas las rutas nuevas usan `/api/v1/`. El frontend actualizado usa `/api/v1/`. Los clientes viejos siguen funcionando via alias por 2 versiones. |
| **Esfuerzo** | 1–2 semanas |
| **Dependencias** | T1.5 (OpenAPI debe reflejar el versioning) |
| **Riesgo si NO se hacer** | Cualquier cambio de contrato en el futuro rompe todos los clientes sin posibilidad de deprecación gradual. |
| **Criterios de aceptación** | La spec OpenAPI usa `/api/v1/`. Un test verifica que el alias deprecated responde con el header correcto. |
| **Responsable hipotético** | Backend dev + Frontend lead |

---

#### T2.5 — Runbook operacional

| Campo | Detalle |
|---|---|
| **Descripción** | Crear `docs/operations/RUNBOOK.md` con procedimientos para: (1) inicio/parada del sistema, (2) backup y restore de DB, (3) rotación de JWT secret, (4) diagnóstico de errores usando los logs de archivo, (5) reseteo de usuario bloqueado, (6) qué hacer ante un crash (`[FATAL]` en logs). |
| **DoD** | Un operador sin conocimiento del código puede resolver los 6 escenarios usando solo el runbook. |
| **Esfuerzo** | 3–5 días |
| **Dependencias** | T0.4, T1.4 (para que los ejemplos de log del runbook sean reales) |
| **Riesgo si NO se hacer** | Un incidente en producción fuera del horario de un desarrollador requiere esperar a ese desarrollador. Sin runbook, el operador no puede actuar. |
| **Criterios de aceptación** | El runbook fue revisado por alguien que no lo escribió. Los comandos de ejemplo funcionan. |
| **Responsable hipotético** | Backend dev senior + DevOps |

---

#### T2.6 — ADRs para decisiones arquitecturales existentes

| Campo | Detalle |
|---|---|
| **Descripción** | Documentar en formato ADR (Architecture Decision Record) las 5–8 decisiones más importantes ya tomadas: (1) vanilla JS sin framework, (2) XML como DSL de formularios, (3) sql.js en proceso, (4) HttpOnly cookies vs localStorage, (5) ScopedDb auto-inyección, (6) handlers como código arbitrario. |
| **DoD** | 6+ ADRs en `docs/architecture/decisions/ADR-NNN-titulo.md`. Cada uno tiene: contexto, opciones consideradas, decisión, consecuencias. |
| **Esfuerzo** | 1 semana |
| **Dependencias** | Ninguna (puede hacerse en cualquier momento) |
| **Riesgo si NO se hacer** | Las decisiones se pierden con la rotación de equipo. Nuevos desarrolladores re-debaten lo ya decidido o revierten decisiones correctas. |
| **Criterios de aceptación** | Los 6 ADRs están escritos y referenciados desde ARCHITECTURE-ANALYSIS.md. |
| **Responsable hipotético** | Tech lead |

---

#### T2.7 — Separación CSS en capas

| Campo | Detalle |
|---|---|
| **Descripción** | Reorganizar el CSS de 1876 líneas en capas: `reset.css`, `base.css`, `components/*.css`, `themes/*.css`. No cambiar estilos — solo reorganizar. |
| **DoD** | El CSS está en múltiples archivos organizados por capa. El visual del sistema es idéntico al original. |
| **Esfuerzo** | 3–5 días |
| **Dependencias** | T2.2 (tests e2e como red de seguridad visual) |
| **Riesgo si NO se hacer** | Un archivo CSS de 1876 líneas tiene colisiones de especificidad difíciles de diagnosticar. Agregar nuevos componentes requiere leer todo el archivo. |
| **Criterios de aceptación** | Ningún archivo CSS nuevo supera 400 líneas. Los tests e2e pasan sin cambios visuales detectados. |
| **Responsable hipotético** | Frontend lead |

---

#### T2.8 — Estrategia de backup documentada e implementada

| Campo | Detalle |
|---|---|
| **Descripción** | Implementar backup automático de SQLite: script que copia el archivo `.db` a un directorio de backups con timestamp, retención configurable. Documentar restore. Agregar al runbook. |
| **DoD** | `scripts/backup.sh` ejecuta correctamente. Puede ser invocado desde cron o manualmente. El runbook incluye el procedimiento de restore probado. |
| **Esfuerzo** | 1 día |
| **Dependencias** | T2.5 (runbook) |
| **Riesgo si NO se hacer** | SQLite en archivo sin backup = pérdida total de datos ante fallo de disco. Es el riesgo de negocio más alto del sistema para clientes en producción. |
| **Criterios de aceptación** | El backup fue restaurado en un entorno de prueba exitosamente. El script está en CI para verificar que no se rompe. |
| **Responsable hipotético** | DevOps / Backend dev |

---

## 3. Timeline Aproximado

```
Semanas 1–2   | T0.1 Health check
              | T0.2 CORS restrictivo por defecto
              | T0.3 Auditoría handlers
              | T0.5 .env.example + setup.sh

Semanas 3–4   | T0.4 Tests unitarios (authService, scopedDb, recordService)
              | T2.6 ADRs (puede hacerse en paralelo, sin dependencias de código)

Semana 5      | T1.1 CI/CD básico (lint + npm test en PRs)
              | T1.2 Rate limiting general

Semanas 6–7   | T1.3 Refresh token / rolling sessions
              | T1.4 Structured logging (pino)

Semanas 8–9   | T1.7 CSP reporting endpoint
              | T1.6 Dockerfile + docker-compose

Semanas 10–12 | T1.5 OpenAPI spec mínima

Semanas 13–15 | T2.1 Tests de integración de API

Semanas 16–19 | T2.2 Tests e2e con Playwright

Semanas 20–25 | T2.3 Migración gradual a TypeScript (3 servicios críticos)

Semanas 22–24 | T2.4 API versioning (paralelo a T2.3 en frontend)
              | T2.5 Runbook operacional
              | T2.8 Backup automático

Semanas 25–28 | T2.7 Separación CSS en capas
              | Auditoría final + ajustes
```

> **Nota:** Las Fases 1 y 2 tienen alto grado de paralelización si el equipo tiene 2+ personas. Los tiempos asumen un desarrollador full-time; con 2 personas activas la duración total se reduce un 35–40%.

---

## 4. Resumen de Impacto Esperado

### Madurez estimada por fase

| Punto | Madurez |
|---|---|
| Estado actual (2026-03-18) | 6.5/10 |
| Al completar Fase 0 | 7.5/10 |
| Al completar Fase 1 | 8.5/10 |
| Al completar Fase 2 | 9.0/10 |

### Riesgos principales mitigados

| Riesgo | Mitigado en |
|---|---|
| Zero tests → regresiones silenciosas | T0.4, T2.1, T2.2 |
| CORS wildcard → CSRF/CORS en red compartida | T0.2 |
| Handlers con SQLi potencial | T0.3 |
| Sin CI → merges sin validación | T1.1 |
| Sesión fija 8h → UX en uso continuo | T1.3 |
| Sin health check → monitoreo ciego | T0.1 |
| Sin backup → pérdida total de datos | T2.8 |
| Logs no parseables → incidentes lentos | T1.4 |
| Sin runbook → operación dependiente de dev | T2.5 |
| Sin TypeScript → refactors riesgosos | T2.3 |

### Deuda técnica residual post-plan

Las siguientes áreas quedan fuera de este plan por costo/beneficio bajo para el perfil de uso interno:

- **OpenTelemetry / tracing distribuido** — no aplica a arquitectura monolítica
- **HSTS preload** — requiere certificado TLS + configuración de red fuera del alcance del código
- **Compliance formal (GDPR, PCI-DSS)** — depende del negocio del cliente final, no del motor
- **DuckDB-WASM CDN dependency** — el bloqueo de 2.5s es conocido y aceptado para reportes; la solución (self-hosting de WASM) puede hacerse cuando sea necesario

### Recomendaciones post-plan

1. **Auditoría de seguridad externa** — una vez completada la Fase 1, una revisión externa (pentesting básico, 1 día) valida el trabajo con ojos frescos.
2. **Monitoreo de producción** — al tener structured logging (T1.4), conectar a una herramienta de logs (incluso gratuita: Grafana Cloud free tier, Logtail, etc.) agrega alertas sin costo de desarrollo.
3. **Revisión de API versioning** — a los 6 meses de T2.4, revisar si los clientes viejos (alias deprecated) pueden ser removidos.
4. **Feedback de handlers en campo** — una vez en producción con más clientes, auditar handlers reales con el inventario de T0.3 como referencia.

---

## 5. Riesgos del Plan

### R1 — Subestimación de la suite de tests (T0.4)

**Probabilidad:** Alta
**Impacto:** Medio
**Descripción:** sql.js en memoria requiere setup/teardown cuidadoso. Los tests de multitenancy (isolation) son más complejos de lo estimado.
**Mitigación:** Empezar con los casos más simples y agregar cobertura incrementalmente. No bloquear T1.1 (CI) esperando cobertura perfecta — CI con tests básicos es mejor que sin CI.

### R2 — Resistencia a migración TypeScript (T2.3)

**Probabilidad:** Media
**Impacto:** Bajo-Medio
**Descripción:** La migración a TS puede encontrar resistencia si la curva de aprendizaje o el tiempo invertido no se justifican para un equipo pequeño.
**Mitigación:** T2.3 es Fase 2 — opcional si el proyecto no crece. La alternativa es mantener JSDoc consistente + tests robustos como sustituto parcial.

### R3 — Handlers de clientes existentes incompatibles con rate limiting (T1.2)

**Probabilidad:** Baja
**Impacto:** Alto
**Descripción:** Un handler legítimo puede generar muchas requests en burst (importación masiva, etc.) y ser bloqueado.
**Mitigación:** El límite debe ser configurable por env desde el día 1. Documentar el parámetro en `.env.example`. Ofrecer mecanismo de whitelist por IP interna.

### R4 — CI/CD en entorno sin internet (T1.1)

**Probabilidad:** Media (algunos clientes usan redes aisladas)
**Impacto:** Medio
**Descripción:** Si el sistema se despliega en redes sin acceso a GitHub Actions o npm registry, el CI tal como está diseñado no funciona.
**Mitigación:** Diseñar el CI para que pueda correr localmente también (`npm test` debe funcionar offline). Considerar Gitea + act como alternativa self-hosted.

### R5 — Scope creep en OpenAPI spec (T1.5)

**Probabilidad:** Alta
**Impacto:** Bajo
**Descripción:** Documentar todos los endpoints es tentador pero innecesario en primera iteración. El esfuerzo de 1–2 semanas puede escalar.
**Mitigación:** Definir desde el inicio cuáles endpoints son in-scope (los 8 listados en T1.5) y no agregar más hasta que esos estén terminados.

### R6 — Falta de tiempo para Fase 2 si Fase 0 toma más de lo esperado

**Probabilidad:** Media
**Impacto:** Bajo
**Descripción:** Si los tests (T0.4) toman más de lo estimado, la Fase 2 puede quedar indefinidamente postergada.
**Mitigación:** Tratar Fase 0 como no-negociable. Fase 1 como objetivo. Fase 2 como mejora continua. El sistema es deployable en producción al terminar Fase 0 — la Fase 2 mejora la ingeniería, no habilita el deployment.

---

*Documento generado: 2026-03-18. Próxima revisión sugerida: 2026-06-18 o al completar Fase 1.*
