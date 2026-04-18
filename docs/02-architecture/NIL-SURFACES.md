# Nilix — Superficies de Sistema (nil-surfaces)

> Estado: **BORRADOR** — definición en progreso
> Última revisión: 2026-03-27

---

## 1. Visión general

Nilix expone cuatro superficies separadas con responsabilidades estrictamente aisladas.
Tres son de gestión interna del sistema; una es la app de negocio expuesta al público.

```
┌─────────────────────────────────────────────────────────┐
│                        NILIX                            │
│                                                         │
│  NIL_ADMIN_PORT (interno)   │   NIL_PORT (público)      │
│  ─────────────────────────  │  ─────────────────────    │
│  /nil-setup  (wizard)       │  /           (app)        │
│  /nil-admin  (admin)        │  /nil-login               │
│  /nil-audit  (auditor)      │                           │
│                             │                           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Superficies

### 2.1 nil-setup
- **Ruta:** `/nil-setup`
- **Puerto:** `NIL_ADMIN_PORT` (interno)
- **Rol requerido:** `wizard` (primera vez: abierto sin auth si DB vacía)
- **Responsabilidad:** bootstrapping y gestión de usuarios de sistema
- **Crea usuarios con roles:** `wizard`, `admin`, `auditor`
- **NO puede crear:** `operador`

### 2.2 nil-admin
- **Ruta:** `/nil-admin`
- **Puerto:** `NIL_ADMIN_PORT` (interno)
- **Rol requerido:** `admin`
- **Responsabilidad:** configuración de la empresa + gestión de usuarios de la app
- **Crea usuarios con roles:** `operador` (con permisos RADU variables)
- **NO puede crear:** `wizard`, `admin`, `auditor`

### 2.3 nil-audit
- **Ruta:** `/nil-audit`
- **Puerto:** `NIL_ADMIN_PORT` (interno)
- **Rol requerido:** `auditor`
- **Responsabilidad:** lectura de logs de auditoría (solo lectura, sin acciones)
- **Ve logs de:** app (operadores), nil-admin, nil-setup

### 2.4 App de negocio
- **Ruta:** `/`
- **Puerto:** `NIL_PORT` (público)
- **Rol requerido:** `operador`
- **Responsabilidad:** formularios y reportes de la app custom
- **NO puede acceder a:** nil-setup, nil-admin, nil-audit ni sus APIs

---

## 3. Roles

| Rol | Superficie | Creado por | Puede crear |
|---|---|---|---|
| `wizard` | nil-setup | nil-setup (first-run) o wizard existente | wizard, admin, auditor |
| `admin` | nil-admin | nil-setup (wizard) | operador |
| `auditor` | nil-audit | nil-setup (wizard) | — |
| `operador` | app (/) | nil-admin (admin) | — |

### "app-admin"
No es un rol separado. Es un `operador` con `permisos='RADU'` (acceso completo
a la app). nil-admin puede marcar a un operador como "administrador de la app"
seteando sus permisos a `RADU`.

---

## 4. Aislamiento estricto

### 4.1 Por superficie
- Usuarios `wizard`/`admin`/`auditor` → **no pueden** ver ni ejecutar forms/reportes de la app
- Usuarios `operador` → **no pueden** acceder a nil-setup, nil-admin, nil-audit

### 4.2 Por puerto
- `NIL_PORT` (ej: 3000) → solo sirve `/`, `/nil-login` y `/api/app/*`
- `NIL_ADMIN_PORT` (ej: 3001) → solo sirve `/nil-*` y `/api/wizard/*`, `/api/admin/*`, `/api/audit/*`
- Binding: `NIL_ADMIN_PORT` bindea a `127.0.0.1` por defecto

### 4.3 Fallback (sin NIL_ADMIN_PORT)
Si `NIL_ADMIN_PORT` no está configurado, todo corre en el mismo puerto.
Se puede usar `NIL_ADMIN_CIDR` como segunda línea de defensa:
```
NIL_ADMIN_CIDR=192.168.0.0/16
```
Middleware Express rechaza con 403 cualquier IP fuera del CIDR que
intente acceder a rutas de administración.

---

## 5. Nombres reservados

Los siguientes strings **no pueden usarse como nombre de usuario** en ningún rol:

```
nil-wizard
nil-admin
nil-audit
nil-*  (cualquier prefijo nil-)
```

Validación: `usersController`, `setupController` y cualquier endpoint que
cree o edite usuarios debe rechazar estos nombres con HTTP 400.

---

## 6. Deployment

### Sin infraestructura (mínimo)
```
Servidor:
  :3000  → abierto (app pública)
  :3001  → 127.0.0.1 only (admin)

Acceso admin:
  SSH tunnel: ssh -L 3001:localhost:3001 user@servidor
  Browser:    http://localhost:3001/nil-setup
```

### Con nginx (recomendado)
```nginx
# /etc/nginx/sites-available/miapp
server {
    listen 80;
    location / { proxy_pass http://127.0.0.1:3000; }
    # :3001 nunca se expone — no hay location para él
}
```

### Con VPN
Abrir `:3001` solo a la IP/rango de la VPN en el firewall.

---

## 7. Superficie de sistema — nil-sys

En lugar de tres URLs separadas por rol, existe una única superficie de sistema
controlada por menú. El acceso a cada sección está determinado por RADU,
no por la URL — consistente con la filosofía general de nilix.

```
/nil-sys  →  wizard + admin + auditor
             nil-sys.xml filtra ítems por permissions= (RADU)

/         →  operador (app de negocio)
```

### Mapeo rol → permisos → visibilidad en nil-sys.xml

```
rol       permisos    ve en nil-sys
────────────────────────────────────────────
wizard    RADU        todo (RADU + RAU + R)
admin     RAU         secciones RAU y R
auditor   R           solo secciones R
```

### nil-sys.xml

```xml
<menu>
  <option type="separator" label="WIZARD"/>
  <option type="form"   label="Usuarios sistema"
          target="forms/nil/usuarios_sistema.xml"   permissions="RADU"/>

  <option type="separator" label="ADMINISTRACIÓN"/>
  <option type="form"   label="Configuración"
          target="forms/nil/empresa_config.xml"      permissions="RAU"/>
  <option type="form"   label="Operadores"
          target="forms/nil/operadores.xml"           permissions="RAU"/>

  <option type="separator" label="AUDITORÍA"/>
  <option type="report" label="Audit Log"
          target="reports/nil/audit_log.yaml"         permissions="R"/>
  <option type="report" label="Usuarios"
          target="reports/nil/usuarios.yaml"           permissions="R"/>
</menu>
```

`menuService` ya filtra por `permissions=` — no requiere cambios.

### Flujo post-login

```
/nil-login → autenticación JWT
    ↓
  rol?
  ├── wizard / admin / auditor  →  /nil-sys
  └── operador                  →  /
```

### Excepción: /nil-setup
Primera ejecución únicamente. Accesible sin auth cuando auth.db está vacío.
Una vez configurado el sistema, redirige a /nil-login.

---

## 8. Audit log — scope ✅ RESUELTO

Registra todos los movimientos de todos los usuarios — operadores y usuarios de sistema.

| Evento | Estado |
|---|---|
| Requests API app (operadores) | ✓ implementado |
| Requests API admin/wizard (nil-*) | ✓ implementado (auditLog middleware) |
| Login exitoso | ⬜ pendiente (ruta pública, fuera de verifyToken) |
| Login fallido / cuenta bloqueada | ⬜ pendiente |
| Logout | ⬜ pendiente |
| Creación de usuario (quién, qué rol) | ⬜ pendiente |
| Desactivación / cambio de estado | ⬜ pendiente |
| Cambio de contraseña | ⬜ pendiente |
| Envío de recovery token | ⬜ pendiente |
| Aprobación de empresa pendiente | ⬜ futuro (Fase 2) |

---

## 9. Preguntas abiertas

### P1 — Wizard cross-tenant ✅ RESUELTA
**Decisión:** nilix NO gestiona multi-tenancy. Eso es responsabilidad de la app.

```
NILIX (motor)
    nil-wizard/nil-admin/nil-audit → gestionan el deployment
    Un deployment = una app = un auth.db

PIZZERIA-APP (ejemplo multi-tenant sobre nilix)
    Gestiona sus propios tenants (empresa_id=1,2,3...) desde la app
    Registro de pizzerías → form de la app
    Operarios por pizzería → admin de la app (permisos RADU)
    nilix provee los primitivos: empresa_id en JWT, ScopedDb, RADU
    la app implementa su lógica multi-tenant encima

DUEÑO DE LA APP (capa futura)
    Visibilidad cross-tenant de su app (compliance pendiente)
    No es un rol nilix — es un concepto de la app
```

El wizard siempre gestiona el deployment completo (un solo contexto de sistema).

---

### P2 — Creación de empresas y password inicial ✅ RESUELTA

**Decisión:** dos fases.

#### Fase 1 — Alta manual (implementación inmediata)
El dueño de la app crea empresa + admin desde nil-admin.
Define la contraseña y la comunica al admin de la empresa por fuera (red interna / soporte).

```
Dueño → nil-admin → Nueva empresa → Nombre + admin + contraseña
                                    ↓
                             empresa activo=1, admin listo para usar
```

#### Fase 2 — Registro público (implementación futura)
Toggle en nil_config controlado desde nil-admin:

```
nil-admin → Configuración → Registro público: [ON/OFF]
                            nil_config: registro_publico = true/false
```

Cuando está ON:
- `/register` se expone en el puerto público (`NIL_PORT`)
- El dueño de la pizzería completa nombre del comercio + usuario admin + contraseña
- Empresa se crea con `activo=0` (pendiente de aprobación)
- Dueño de la app aprueba desde nil-admin → `activo=1`

Cuando está OFF:
- `/register` devuelve 404

Flujo completo Fase 2:
```
1. Pizzería "Don José" entra a /register (público)
2. Completa datos → empresa activo=0 creada
3. Dueño de app → nil-admin → "Pendientes" → aprueba Don José
4. Don José puede loguearse con su admin
5. Don José crea sus propios operadores desde la app
6. Dueño de app no interviene más (salvo soporte)
```

---

### P3 — Self-management ✅ RESUELTA
**Decisión:** sí. Cada usuario puede cambiar su propia contraseña desde su superficie.
Endpoint compartido: `POST /api/auth/change-password` (autenticado, cualquier rol).

---

### P4 — Alcance del audit log ✅ RESUELTA
Ver sección 8. Scope completo: todos los movimientos de todos los usuarios.

---

### P5 — Cambio de rol post-creación ✅ RESUELTA
**Decisión:** sí, con restricciones de cascada.
- `wizard` puede cambiar el rol de cualquier usuario del sistema
- `admin` puede cambiar permisos RADU de operadores (no su rol)
- Cambio de rol queda registrado en audit log

---

### P6 — Múltiples usuarios por rol ✅ RESUELTA
**Decisión:** sin restricción. Puede haber múltiples wizard, admin y auditor.
La redundancia de wizards es la primera línea de defensa contra lockout.

---

### P7 — Recovery de lockout ✅ RESUELTA
**Decisión:** recovery por otro wizard + ciclo de vida de usuarios.

#### Recovery flow — dos vías, mismo resultado

Ambas vías generan un token de un solo uso, lo guardan en auth.db
y envían un email al usuario con el link de recuperación.

**Vía 1 — CLI (emergencia / sin acceso a nil-setup):**
```bash
# Sysadmin con acceso SSH al servidor
node recovery.js --usuario <usuario>
# Genera token → envía email → imprime confirmación
```
Útil cuando todos los wizards están bloqueados o no hay acceso al UI.

**Vía 2 — nil-setup (flujo normal):**
```
Wizard → nil-setup → Usuarios → [usuario] → "Enviar recovery"
→ Genera token → envía email automáticamente
```
Cualquier wizard puede disparar recovery para cualquier usuario del sistema.

**El usuario recibe:**
```
Asunto: Recuperación de contraseña — [nombre-app]
Cuerpo:  Link: https://app.com/nil-recovery?token=XXXX
         Vigencia: 3 días. Pasado ese plazo, la cuenta queda bloqueada.
```

**Requisito:** el usuario debe tener email registrado en auth.db.
Sin email → solo recuperable vía CLI con intervención manual.

#### Ciclo de vida de estados
Los usuarios **nunca se eliminan** — solo cambian de estado.

```
                    failed_attempts >= max
activo ─────────────────────────────────→ bloqueado
  ↑                                           │
  │  wizard desbloquea                        │  3 meses sin actividad
  │  o usuario hace recovery                  ↓
  └──────────────────────────────────── inactivo
                                    (solo wizard puede reactivar)

activo ──→ recovery_pendiente ──→ activo     (recovery en tiempo)
                    │
                    │  3 días sin cambiar contraseña
                    ↓
                bloqueado
```

#### Estados en auth.db
```sql
estado TEXT NOT NULL DEFAULT 'activo'
-- valores: 'activo' | 'bloqueado' | 'inactivo' | 'recovery_pendiente'
blocked_at      TEXT   -- timestamp cuando pasó a bloqueado
recovery_token  TEXT   -- token hasheado (un solo uso)
recovery_exp    TEXT   -- expiry del token (3 días)
```

#### Lockout total (todos los wizards bloqueados)
Si todos los wizards pierden acceso simultáneamente:
```bash
# Desde el servidor, con acceso físico al archivo auth.db
node nilix-recover.js --usuario <wizard-user>
# Interactivo: pide nueva contraseña, desbloquea el usuario
# No destructivo — no toca otros datos
```

---

## 10. nil-project.yaml — capa intermedia

Entre `nil-config` (motor) y la app de negocio existe una capa de configuración
de proyecto gestionada por `nil-project.yaml`. Ver doc completo:
→ [NIL-PROJECT.md](./NIL-PROJECT.md)

Impacto directo en nil-surfaces: puertos, feature flags, admin CIDR.

---

## 11. Estado de implementación

> **Nota:** el diseño original contemplaba SPAs separadas (`nil-admin.html`, `nil-audit.html`).
> Se adoptó en cambio una superficie unificada `/nil-sys` con filtrado RADU por menú.
> Los ítems de SPAs separadas ya no aplican.

### Infraestructura base

| Componente | Estado |
|---|---|
| `nil-setup.html` + setupController/setupRoutes (first-run) | ✅ Implementado |
| `nil-sys.html` + `js/nil-sys.js` (superficie unificada) | ✅ Implementado |
| `nilController.js` + `nilRoutes.js` (`/api/nil/*`) | ✅ Implementado |
| `adminController.js` + `adminRoutes.js` (`/api/admin/*`) | ✅ Implementado |
| `auditLog` middleware | ✅ Implementado |
| Roles `wizard` / `admin` / `auditor` en `verifyToken` | ✅ Implementado |
| Aislamiento por rol (`requireNilSys`, `requireAdmin`) | ✅ Implementado |

### Formularios de sistema (`sys/form/`)

| Formulario | Estado |
|---|---|
| `nil-wizard.xml` — ABM usuarios sistema (`database="auth" table="usuarios"`) | ✅ Implementado |
| `nil-users.xml` — ABM operadores (rol `admin`) | ✅ Implementado |
| `nil-config.xml` — config empresa + nil_config (rol `admin`) | ✅ Implementado |
| `nil-audit.yaml` — Audit Log (rol `auditor`) | ✅ Implementado |
| `nil-users.yaml` — Usuarios del sistema (rol `auditor`) | ✅ Implementado |

### Pendiente

| Componente | Estado |
|---|---|
| Post-login redirect por rol (`/nil-sys` vs `/`) | ⬜ Pendiente |
| Máquina de estados en `authService.js` (campo `estado`) | ⬜ Pendiente |
| Política de contraseñas al login (`force_change`, `pass_to`, `warn_date`) | ⬜ Pendiente |
| Recovery de contraseña (nodemailer + `recovery_token` / `recovery_exp`) | ⬜ Pendiente |
| Nombres reservados `nil-*` (validación en alta de usuario) | ⬜ Pendiente |
| Dual-port (`NIL_ADMIN_PORT`) | ⬜ Pendiente |
| `NIL_ADMIN_CIDR` middleware | ⬜ Pendiente |

### Fase 2 (futuro)

| Componente | Estado |
|---|---|
| `nil_config: registro_publico` toggle | ⬜ Futuro |
| `/register` ruta pública condicional | ⬜ Futuro |
| Empresas pendientes de aprobación | ⬜ Futuro |
