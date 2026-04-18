# NILSYS-GUIDE — Guía de uso del sistema nil

Guía operativa para usuarios de sistema: **wizard**, **admin** y **auditor**.
No cubre desarrollo ni configuración de infraestructura — ver `NIL-SURFACES.md` y `NIL-SYS.md`.

---

## 1. Acceso

El sistema nil vive en `/nil-sys`. Para entrar:

1. Abrir `/nil-login` en el navegador
2. Ingresar usuario y contraseña
3. El sistema redirige automáticamente:
   - `wizard` / `admin` / `auditor` → `/nil-sys`
   - `operador` → `/` (app de negocio)

> Los usuarios de sistema tienen `empresa_id = 0` — no pertenecen a ninguna empresa real.
> No pueden acceder a formularios ni reportes de la app (`/`).

---

## 2. Qué ve cada rol

El menú de `/nil-sys` se filtra por permisos RADU. Cada rol ve solo lo que le corresponde:

```
WIZARD
  Usuarios sistema      [nil-wizard.xml]    RADU

ADMINISTRACIÓN
  Configuración         [nil-config.xml]    RAU
  Usuarios app          [nil-users.xml]     RAU

AUDITORÍA
  Audit Log             [nil-audit.yaml]    R
  Usuarios              [nil-users.yaml]    R
```

| Sección | wizard | admin | auditor |
|---|---|---|---|
| Usuarios sistema | ✅ | — | — |
| Configuración | ✅ | ✅ | — |
| Usuarios app | ✅ | ✅ | — |
| Audit Log | ✅ | ✅ | ✅ |
| Usuarios (reporte) | ✅ | ✅ | ✅ |

---

## 3. Wizard — gestión de usuarios sistema

El wizard gestiona los usuarios que acceden a `/nil-sys`: otros wizards, admins y auditores.

### Crear un usuario sistema

1. Ir a **Usuarios sistema**
2. Completar **IDENTIDAD**: nombre completo, email, ID de usuario
3. Seleccionar **ROL**: Wizard / Admin / Auditor
   - El campo **Permisos** se completa automáticamente según el rol
4. Ingresar **CONTRASEÑA** inicial
5. Configurar opciones de contraseña si aplica (ver sección 3.1)
6. Presionar **ENVIAR**

> El ID de usuario no puede modificarse una vez creado.
> No pueden crearse usuarios con prefijo `nil-` (nombre reservado).

### Modificar un usuario sistema

1. Buscar por el selector **ID** (muestra usuario al lado)
2. Modificar los campos necesarios
3. Contraseña: dejar vacío para no cambiar
4. Presionar **ENVIAR**

### Desactivar / reactivar

- Campo **Activo** (checkbox en sección ESTADO): desmarcar para deshabilitar login
- Campo **Estado**: informativo — refleja el estado de la cuenta (activo / bloqueado / inactivo)
- **Intentos fallidos**: visible al cargar un usuario existente; el wizard puede resetearlo a 0

### 3.1 Política de contraseñas

| Campo | Descripción |
|---|---|
| **Forzar cambio** | El usuario debe cambiar la contraseña en su próximo login |
| **Permite cambio** | `Siempre` / `Al vencer` / `Nunca` |
| **Nunca expira** | Si está marcado, los campos de expiración se deshabilitan |
| **Vigencia (días)** | Días de validez desde "Válida desde" |
| **Válida desde** | Fecha de inicio de vigencia (default: hoy) |
| **Válida hasta** | Calculado automáticamente: `Válida desde + Vigencia` |
| **Avisar (días antes)** | Días previos a vencimiento para mostrar aviso |
| **Fecha de aviso** | Calculado automáticamente: `Válida hasta - Días de aviso` |

> La evaluación de expiración en el login está pendiente de implementación.

---

## 4. Admin — configuración y operadores

### 4.1 Configuración de la empresa

Ir a **Configuración** (`nil-config.xml`).

**DATOS DE LA EMPRESA** — nombre, CUIT, email, teléfono, dirección, horario.

**SEGURIDAD**:
| Campo | Descripción | Default |
|---|---|---|
| Intentos antes de bloqueo | Máximo de intentos fallidos antes de bloquear cuenta | 5 |
| Largo mínimo contraseña | Mínimo de caracteres para contraseñas nuevas | 8 |
| Expiración de sesión | Duración del JWT (ej: `8h`, `24h`, `7d`) | `8h` |

**AUDITORÍA**:
| Campo | Descripción |
|---|---|
| Registrar auditoría | Activa / desactiva el middleware de audit log |
| Registrar | `Todo` / `Solo escrituras` / `Solo errores` |

**REPORTES** — título, subtítulo y pie de página para reportes impresos.

### 4.2 Gestión de operadores

Ir a **Usuarios app** (`nil-users.xml`). Aquí se gestionan los usuarios que acceden a la app de negocio (`/`).

**Crear operador:**
1. Completar nombre, usuario, email
2. Seleccionar **Permisos** RADU:
   - `RADU` — acceso completo (admin de la app)
   - `RAU` — lectura, alta y modificación (sin borrar)
   - `RA` — lectura y alta solamente
   - `R` — solo lectura
3. Ingresar contraseña inicial
4. Presionar **ENVIAR**

> No hay un rol "admin de app" separado — es un operador con `permisos=RADU`.

---

## 5. Auditor — lectura de logs

### Audit Log (`nil-audit.yaml`)

Muestra todas las llamadas a la API registradas: timestamp, usuario, método HTTP, path, status, tiempo de respuesta e IP.

- Carga los últimos 500 registros
- Scroll infinito
- Incluye operaciones de operadores y de usuarios sistema

### Usuarios (`nil-users.yaml`)

Listado de todos los usuarios del sistema (wizard, admin, auditor) con ID, nombre, usuario, email, rol, estado activo y fecha de creación. Solo lectura.

---

## 6. Tareas comunes

### Desbloquear una cuenta

1. Ir a **Usuarios sistema** (si es wizard/admin/auditor) o **Usuarios app** (si es operador)
2. Buscar el usuario por ID
3. En sección ESTADO: marcar **Activo** y resetear **Intentos fallidos** a 0
4. Guardar

### Resetear contraseña

1. Buscar el usuario
2. Ingresar nueva contraseña en el campo **Contraseña**
3. Opcionalmente marcar **Forzar cambio** para que el usuario la cambie al entrar
4. Guardar

### Cambiar permisos de un operador

1. Ir a **Usuarios app**
2. Buscar el operador
3. Cambiar el selector **Permisos**
4. Guardar — el cambio toma efecto en el próximo login del operador

---

## 7. Estado de implementación

| Funcionalidad | Estado |
|---|---|
| Login y redirect por rol | ⬜ Pendiente |
| Gestión usuarios sistema (nil-wizard.xml) | ✅ Implementado |
| Gestión operadores (nil-users.xml) | ⚠️ Pendiente migración a pipeline estándar |
| Configuración empresa (nil-config.xml) | ✅ Implementado (endpoints `/api/admin/`) |
| Audit Log (nil-audit.yaml) | ✅ Implementado |
| Reporte usuarios (nil-users.yaml) | ✅ Implementado |
| Evaluación expiración de contraseña al login | ⬜ Pendiente |
| Máquina de estados (bloqueado / inactivo) | ⬜ Pendiente |
| Recovery de contraseña por email | ⬜ Pendiente |
