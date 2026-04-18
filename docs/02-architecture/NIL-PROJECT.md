# nil-project — Manifiesto de App Nilix

> Estado: **BORRADOR** — definición en progreso
> Última revisión: 2026-03-27

---

## 1. Concepto

`nil-project.yaml` es el manifiesto de una app construida sobre nilix.
Ocupa la capa intermedia entre la configuración del motor (nil-config) y
los datos de negocio de la app.

```
CAPA 1 — Motor nilix (nil-config en auth.db)
    JWT expiry, session timeout, audit mode,
    intentos de bloqueo, largo mínimo password

CAPA 2 — Proyecto / App  ← nil-project.yaml
    Nombre, versión, features habilitados,
    puertos, paths de DB, versión mínima de nilix

CAPA 3 — Negocio (forms, reports, handlers)
    Órdenes, carta, clientes, stock, etc.
```

Inspirado en `Cargo.toml` de Rust: define el proyecto, no el contenido.

---

## 2. Estructura de nil-project.yaml

```yaml
# nil-project.yaml
name: pizzeria-app
version: 1.0.0
description: "App de gestión para pizzerías"
nilix: ">=2.6.0"          # versión mínima del motor requerida

features:
  registro_publico: false  # habilita /register en puerto público
  public_reports:  true    # habilita reportes sin auth
  self_register:   false   # registro autogestionado por empresas

ports:
  app:   3000              # NIL_PORT — público
  admin: 3001              # NIL_ADMIN_PORT — interno (127.0.0.1)

db:
  app:  data/app.db        # base de datos de negocio
  auth: data/auth.db       # base de datos de sistema (usuarios, audit)

admin_cidr: null           # ej: "192.168.0.0/16" — restricción IP opcional

email:
  from: "no-reply@mi-app.com"
  subject_prefix: "[Pizzería App]"
  # SMTP config va en .env (secrets):
  # NIL_SMTP_HOST, NIL_SMTP_PORT, NIL_SMTP_USER, NIL_SMTP_PASS, NIL_SMTP_SECURE
```

---

## 3. Estructura estándar de proyecto

Generada por `nilix new <nombre-app>`:

```
my-app/
├── nil-project.yaml       ← manifiesto del proyecto
├── .env                   ← secrets (NIL_JWT_SECRET, etc.) — no commitear
├── .env.example           ← template sin secrets
├── start.js               ← entry point del servidor
├── setup.js               ← setup inicial (crea DBs, primer usuario)
│
├── data/                  ← generado en setup, no commitear
│   ├── auth.db
│   └── app.db
│
├── forms/                 ← formularios XML de la app
│   └── .gitkeep
│
├── reports/               ← reportes YAML de la app
│   └── .gitkeep
│
├── apps/                  ← handlers de negocio (.js)
│   └── .gitkeep
│
└── menu/
    └── menu.xml           ← menú base generado por scaffold
```

---

## 4. CLI — nilix new

```bash
nilix new pizzeria-app
```

El comando:
1. Crea el directorio `pizzeria-app/`
2. Genera `nil-project.yaml` con valores por defecto
3. Genera `.env.example` con todas las variables necesarias
4. Genera `start.js` y `setup.js` preconfigurados
5. Genera `menu/menu.xml` base (vacío, con estructura)
6. Crea directorios `forms/`, `reports/`, `apps/`, `data/`

Flujo post-scaffold:

```bash
cd pizzeria-app
cp .env.example .env
# editar .env con secrets
node setup.js     # crea DBs + primer usuario wizard/admin
node start.js     # levanta el servidor
```

---

## 5. Relación con nil-surfaces

`nil-project.yaml` es leído por el motor al arrancar. Impacta directamente
en el comportamiento de las superficies:

| Campo | Efecto en nil-surfaces |
|---|---|
| `ports.admin` | puerto donde escucha nil-setup/nil-admin/nil-audit |
| `features.registro_publico` | habilita/deshabilita `/register` en puerto público |
| `features.public_reports` | habilita/deshabilita reportes sin auth |
| `admin_cidr` | restricción IP para acceso a superficies internas |
| `nilix` (versión) | el motor verifica compatibilidad al arrancar |

Los `features` también son editables desde nil-admin (escribe en nil-project.yaml),
sin necesidad de reiniciar el servidor para algunos flags.

---

## 6. Relación con nil-config (auth.db)

`nil-project.yaml` y `nil-config` son complementarios, no redundantes:

| nil-project.yaml | nil-config (auth.db) |
|---|---|
| Configuración del proyecto/app | Configuración del sistema en runtime |
| Versionado en git (sin secrets) | Persiste en la DB |
| Define estructura y features | Define políticas de seguridad |
| Editado por el desarrollador | Editado desde nil-admin (UI) |
| Puertos, paths, feature flags | Password policy, session, audit mode |

---

## 7. Estado de implementación

| Componente | Estado |
|---|---|
| Spec de nil-project.yaml | ✅ Definido (este doc) |
| Lectura de nil-project.yaml en server.js | ⬜ Pendiente |
| CLI `nilix new` | ⬜ Futuro |
| Integración con nil-admin (editar features) | ⬜ Futuro |
| Verificación de versión `nilix: ">=x.x.x"` | ⬜ Futuro |
| Servicio de email (nodemailer + SMTP config) | ⬜ Futuro |
| `recovery.js` CLI (envío de recovery token) | ⬜ Futuro |
| `/nil-recovery` ruta pública (cambio de pass) | ⬜ Futuro |

---

## 8. Notas de diseño

- `nil-project.yaml` **no contiene secrets** — va en git sin riesgo
- Los secrets (JWT_SECRET, DB passwords si aplica) siguen en `.env`
- En ausencia del archivo, el motor usa defaults (compatibilidad hacia atrás)
- El nombre `nil-project` evita colisiones con otros manifiestos del ecosistema JS
  (`package.json`, `tsconfig.json`, etc.)
