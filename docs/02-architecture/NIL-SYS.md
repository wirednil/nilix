# NIL-SYS — Sistema de Usuarios

Documentación de la capa de gestión de usuarios del motor nilix.
Cubre el esquema de la tabla `usuarios`, el ciclo de vida de un usuario,
la política de contraseñas y los roles del sistema.

---

## Tabla `usuarios`

Almacenada en `auth.db` (path configurado por `NIL_AUTH_DB` en `.env`).
Todos los usuarios del sistema y de la app viven en esta tabla,
diferenciados por `rol` y agrupados por `empresa_id`.

> **Convención `empresa_id = 0`:** los usuarios de nil-sys (`wizard`, `admin`, `auditor`)
> tienen `empresa_id = 0`. Este valor está reservado y nunca corresponde a una empresa real
> (AUTOINCREMENT empieza en 1). Los operadores tienen `empresa_id = N` donde N es el ID de
> su empresa. Esta separación permite que un wizard vea operadores de todos los tenants
> (`WHERE empresa_id > 0`) sin colisionar con sus propios datos.

```sql
CREATE TABLE usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id),

    -- Identidad
    nombre          TEXT NOT NULL,
    usuario         TEXT NOT NULL UNIQUE,
    email           TEXT,
    password_hash   TEXT NOT NULL,

    -- Rol y permisos
    rol             TEXT NOT NULL DEFAULT 'operador',
    permisos        TEXT NOT NULL DEFAULT 'RADU',

    -- Estado
    activo          INTEGER NOT NULL DEFAULT 1,
    estado          TEXT    NOT NULL DEFAULT 'activo',
    failed_attempts INTEGER NOT NULL DEFAULT 0,

    -- Política de contraseña
    force_change    INTEGER NOT NULL DEFAULT 0,
    never_exp       INTEGER NOT NULL DEFAULT 1,
    exp_days        INTEGER,
    pass_from       TEXT,
    pass_to         TEXT,
    warn_date       TEXT,
    warn_days       INTEGER,
    allow_change    TEXT NOT NULL DEFAULT 'always',

    -- Auditoría
    creator_id      INTEGER REFERENCES usuarios(id),
    modifier_id     INTEGER REFERENCES usuarios(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)
```

### Campos — detalle

#### Identidad

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | TEXT | Nombre completo |
| `usuario` | TEXT UNIQUE | Nombre de login (3-30 chars, `[a-zA-Z0-9_-]`) |
| `email` | TEXT | Email principal (usado para recovery) |
| `password_hash` | TEXT | bcrypt, mínimo 8 caracteres |

> **Nombres reservados:** el prefijo `nil-` está reservado para cuentas del motor.
> No puede usarse como `usuario` al crear desde la app.

#### Rol y permisos

| Campo | Valores | Descripción |
|---|---|---|
| `rol` | `wizard` `admin` `auditor` `operador` | Rol del usuario en el sistema |
| `permisos` | `RADU` `RAU` `RA` `R` | Permisos globales sobre el menú (RADU) |

Al cambiar `rol`, `permisos` se actualiza automáticamente según la tabla canónica:

| Rol | Permisos asignados |
|---|---|
| `wizard` | `RADU` |
| `admin` | `RAU` |
| `auditor` | `R` |
| `operador` | `RADU` (configurable) |

#### Estado

| Campo | Tipo | Descripción |
|---|---|---|
| `activo` | 0/1 | Shorthand rápido para habilitar/deshabilitar sin cambiar estado |
| `estado` | TEXT | Estado completo del ciclo de vida (ver máquina de estados) |
| `failed_attempts` | INTEGER | Contador de intentos de login fallidos |

#### Política de contraseña

Inspirada en la tabla `perUser` de INA. Permite configurar expiración y
comportamiento del cambio de contraseña por usuario.

| Campo | Tipo | Descripción |
|---|---|---|
| `force_change` | 0/1 | Forzar cambio de contraseña en el primer login |
| `never_exp` | 0/1 | La contraseña nunca expira (override de `exp_days`) |
| `exp_days` | INTEGER | Días de vigencia de la contraseña desde `pass_from` |
| `pass_from` | TEXT (fecha) | Fecha desde la que la contraseña es válida |
| `pass_to` | TEXT (fecha) | Fecha límite de vigencia (calculada: `pass_from + exp_days`) |
| `warn_date` | TEXT (fecha) | Fecha a partir de la cual se avisa al usuario |
| `warn_days` | INTEGER | Días antes de `pass_to` en que se emite el aviso |
| `allow_change` | TEXT | `always` / `expiration` / `never` |

> **Estado actual:** los campos de política de contraseña están definidos en
> el esquema pero aún no son evaluados por el motor en tiempo de login.
> Implementación pendiente en `authService.js`.

#### Auditoría

| Campo | Descripción |
|---|---|
| `creator_id` | ID del usuario que creó este registro |
| `modifier_id` | ID del último usuario que lo modificó |
| `created_at` | Timestamp de creación (localtime) |
| `updated_at` | Timestamp de última modificación (localtime) |

---

## Roles del sistema

```
wizard   > admin   > auditor   > operador
```

| Rol | Accede a | Puede crear |
|---|---|---|
| `wizard` | nil-sys completo (RADU) | wizard, admin, auditor |
| `admin` | ADMINISTRACIÓN + AUDITORÍA (RAU) | operadores |
| `auditor` | AUDITORÍA (R, solo lectura) | — |
| `operador` | App (según permisos RADU) | — |

Los roles `wizard`, `admin` y `auditor` son **usuarios del sistema** — acceden
por `/nil-sys`. Los `operador` son **usuarios de la app** — acceden por `/`.

---

## Máquina de estados del usuario

```
                  ┌─────────┐
     (crear)      │  activo │ ◄──────────────────────────────┐
   ─────────────► └────┬────┘                                 │
                       │                                       │
          5 intentos   │              wizard reactiva         │
          fallidos     ▼                                       │
                  ┌──────────┐   recovery enviado   ┌─────────────────────┐
                  │ bloqueado├─────────────────────► │  recovery_pendiente │
                  └──────────┘                       └──────────┬──────────┘
                                                                 │
                                          cambió contraseña ─────┤
                                          (dentro de 3 días)     │
                                                                 ▼
                                                            ┌─────────┐
                                          3 días sin        │  activo │
                                          cambiar ─────────►└─────────┘
                                                     ↓
                                             ┌──────────┐
                                             │ bloqueado│  (vuelve a bloqueado)
                                             └──────────┘
                       │
          3 meses sin  │
          actividad    ▼
                  ┌──────────┐
                  │ inactivo │   (solo wizard puede reactivar)
                  └──────────┘
```

| Estado | Descripción | Puede loguearse |
|---|---|---|
| `activo` | Normal | ✅ |
| `bloqueado` | Demasiados intentos fallidos | ❌ |
| `recovery_pendiente` | Token de recovery enviado, esperando cambio | ❌ |
| `inactivo` | Sin actividad por 3 meses | ❌ |

> **Estado actual:** la máquina de estados está documentada pero no
> implementada. `authService.js` solo evalúa `activo=1` y `failed_attempts`.
> La columna `estado` existe en el schema (migración aplicada vía `authDatabase.js`)
> pero las transiciones aún no son evaluadas en tiempo de login.

---

## Ciclo de vida — creación y recovery

### Creación de usuario

1. Wizard crea usuario desde `sys/form/nil-wizard.xml`
2. `POST /api/records/auth/usuarios` → `authRecordService.upsert` hashea password
3. `nil-wizard.js::beforeSave` asigna `permisos` según rol; `authRecordService.upsert` fuerza `empresa_id = 0` para usuarios sistema
4. Si `force_change=1` → en el próximo login se redirige a pantalla de cambio de contraseña

### Recovery de contraseña

1. Otro wizard inicia el recovery desde nil-sys
2. `recovery.js` genera token (UUID, 3 días de vigencia) y lo envía por email
3. Usuario recibe link con token → cambia contraseña
4. Estado pasa de `recovery_pendiente` → `activo`
5. Si no cambia en 3 días → estado vuelve a `bloqueado`

> **Estado actual:** recovery no implementado. Requiere `nodemailer` +
> columnas `recovery_token` y `recovery_exp` en `usuarios`.

---

## CRUD de usuarios sistema

El CRUD de usuarios del sistema usa el **pipeline estándar** del motor (`/api/records/:db/:table`) apuntando a `auth.db`:

```xml
<form database="auth" table="usuarios" handler="@auth:nil-wizard">
```

Esto resuelve a:
- `GET  /api/records/auth/usuarios?keyField=id&id=N` — cargar registro
- `POST /api/records/auth/usuarios`                  — alta
- `POST /api/records/auth/usuarios/:id`              — actualizar (upsert)

El handler `@auth:nil-wizard` (`src/handlers/auth/nil-wizard.js`) aporta:
- `after()` — enable/disable de campos según create vs update; toggle expiración
- `beforeSave()` — calcula `permisos` desde `rol`; normaliza booleans

`authRecordService` maneja el hasheo de contraseñas, el scoping por `empresa_id` y la auditoría de `modifier_id`.

## Endpoints `/api/nil/`

| Método | Path | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/nil/menu` | wizard/admin/auditor | Menú filtrado por permisos |
| `GET` | `/api/nil/usuarios` | wizard/admin/auditor | Catálogo para `<in-table url=...>` |
| `GET` | `/api/nil/operadores` | wizard/admin | Catálogo de operadores para selector |

> Los endpoints `/api/nil/` son solo catálogos para selectores de formulario.
> El CRUD real va por `/api/records/auth/:table`.

### Pendiente de migrar desde `/api/admin/`

| Endpoint legacy | Nuevo endpoint | Estado |
|---|---|---|
| `GET /api/admin/empresa` | `GET /api/nil/empresa` | ⏳ pendiente |
| `POST /api/admin/empresa` | `POST /api/nil/empresa` | ⏳ pendiente |
| `GET /api/admin/audit-log` | `GET /api/nil/audit-log` | ⏳ pendiente |

Una vez migrados, se puede retirar `adminRoutes` de `server.js`.

---

## Archivos relevantes

| Archivo | Descripción |
|---|---|
| `src/services/authDatabase.js` | Init, get, save de auth.db; migraciones de columnas |
| `src/services/authService.js` | Login, JWT, bcrypt |
| `src/services/authRecordService.js` | CRUD genérico sobre auth.db (pipeline estándar) |
| `src/middleware/verifyToken.js` | Extrae rol/permisos del JWT |
| `src/controllers/nilSysController.js` | Catálogos para `<in-table url=...>` |
| `src/controllers/nilController.js` | Menú con filtro RADU |
| `src/controllers/recordController.js` | CRUD app DB con RADU server-side |
| `src/controllers/authRecordController.js` | CRUD auth DB (usuarios, usuario_permisos) |
| `src/routes/authRecordRoutes.js` | Rutas `/api/records/auth/*` |
| `src/routes/nilRoutes.js` | Rutas `/api/nil/*` (catálogos + menú) |
| `src/handlers/auth/nil-wizard.js` | Handler nil-wizard: enable/disable + permisos |
| `sys/nil-sys.xml` | Menú del sistema con permisos |
| `sys/form/nil-wizard.xml` | Form usuarios sistema (`database="auth" table="usuarios"`) |
| `sys/form/operadores.xml` | Form operadores |
| `nil-sys.html` + `js/nil-sys.js` | SPA del sistema |
