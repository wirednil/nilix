# Índice de documentación — Nilix

**Última actualización:** 2026-04-06

---

## Por dónde empezar

| Quiero... | Documento |
|---|---|
| Entender el proyecto | [`README.md`](README.md) |
| Usar el sistema nil (wizard/admin/auditor) | [`04-guides/NILSYS-GUIDE.md`](../04-guides/NILSYS-GUIDE.md) |
| Escribir formularios XML | [`04-guides/GUIA-XML.md`](../04-guides/GUIA-XML.md) |
| Escribir reportes YAML | [`03-reference/NIL-REPORT.md`](../03-reference/NIL-REPORT.md) |
| Entender la arquitectura general | [`02-architecture/NIL-SURFACES.md`](../02-architecture/NIL-SURFACES.md) |
| Ver qué cambió recientemente | [`03-reference/CHANGELOG.md`](../03-reference/CHANGELOG.md) |

---

## Estructura completa

### 01-getting-started

| Archivo | Descripción |
|---|---|
| `README.md` | Quick start, ejemplos, estado del proyecto |
| `DOCS-INDEX.md` | Este archivo |

### 02-architecture

| Archivo | Descripción |
|---|---|
| `NIL-SURFACES.md` | Superficies del sistema (nil-sys, app), roles, deployment |
| `NIL-SYS.md` | Schema de usuarios, roles, política de contraseñas, máquina de estados |
| `NIL-PROJECT.md` | Capa de configuración `nil-project.yaml` |
| `SECURITY-AUDIT-PLAN.md` | Plan de auditoría de seguridad |
| `HANDLER-AUDIT.md` | Análisis de handlers existentes |

### 03-reference

| Archivo | Descripción |
|---|---|
| `nil-form.md` | Referencia completa del formato XML de formularios |
| `NIL-REPORT.md` | Referencia completa del motor de reportes YAML |
| `AUTH.md` | Autenticación: JWT, HttpOnly cookie, flujo de login |
| `RADU_Pattern_Documentation.md` | Patrón RADU de permisos |
| `CODE-MAP.md` | Mapa de archivos y funciones del codebase |
| `CHANGELOG.md` | Historial de versiones |

### 04-guides

| Archivo | Descripción |
|---|---|
| `NILSYS-GUIDE.md` | Guía operativa de nil-sys (wizard, admin, auditor) |
| `GUIA-XML.md` | Guía práctica para escribir formularios XML |
| `MULTIFIELD-GUIDE.md` | Guía de campos multifield / grids |

### 05-specs

| Archivo | Descripción |
|---|---|
| `MENUS-SPEC.md` | Especificación del sistema de menús |
| `REP/REP-SPEC.md` | Especificación del motor de reportes |

### 06-development

| Archivo | Descripción |
|---|---|
| `MANUAL-DESARROLLO.md` | Manual de desarrollo y arquitectura interna |
| `ROADMAP.md` | Features pendientes y plan de implementación |
| `PRODUCTION-READINESS-PLAN.md` | Checklist de producción |

### 07-archive

Documentos históricos y sesiones anteriores. No reflejan el estado actual.

---

## Documentos clave por tema

| Tema | Documento |
|---|---|
| Formularios XML (`<form>`, `<field>`, handlers) | `03-reference/nil-form.md` |
| Reportes YAML (dataSources, zones, templates) | `03-reference/NIL-REPORT.md` |
| Permisos RADU | `03-reference/RADU_Pattern_Documentation.md` |
| Usuarios y roles (schema, estados) | `02-architecture/NIL-SYS.md` |
| Superficies nil-sys / app | `02-architecture/NIL-SURFACES.md` |
| Cómo usar nil-sys como wizard/admin | `04-guides/NILSYS-GUIDE.md` |
| Auth y cookies | `03-reference/AUTH.md` |
| Qué archivo toca qué función | `03-reference/CODE-MAP.md` |
