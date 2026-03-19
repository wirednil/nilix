# Especificación de Menús - NILENGINE FDL

**Fuente:** Capítulo 18 del Manual de NILENGINE
**Propósito:** Referencia para implementar sistema de menús en Nilix

---

## 📋 Definición de Menús

Un menú se especifica en un archivo con extensión `.mn`. El archivo contiene información de los nombres de las opciones y qué hacer cuando el usuario elige cada una de ellas.

### Formato de Línea

```
Texto_opcion Tipo_de_opcion Argumentos
```

- **Texto_opcion**: Leyenda que se despliega en la ventana. Si incluye espacios, debe ir entre comillas dobles.
- **Tipo_de_opcion**: Especifica la acción a ejecutar
- **Argumentos**: Parámetros adicionales según el tipo

---

## 🔧 Tipos de Opción

### 1. MENU

Cuando se selecciona, despliega otro menú.

**Argumento:** Nombre del archivo con las especificaciones del nuevo menú.

```
"3. Otro menu" MENU otro
```

### 2. SHELL

Ejecuta un comando del sistema operativo. Cuando termina, el control vuelve al menú.

**Argumento:** Nombre del comando a ejecutar.

```
"2. Calculadora de UNIX" SHELL bc
```

### 3. PIPE

Ejecuta un comando y muestra la salida en una ventana.

**Argumentos:** `[filas] [columnas] comando argumentos`

```
"1. Listado del Directorio" PIPE 10 60 ls -lCF
```

**Nota:** No destinado a procesos interactivos. Solo para programas que envían salida a pantalla.

### 4. WCMD

Ejecuta un programa de aplicación con el Window Manager. Todo programa que necesite del WM debe ser indicado con este tipo.

**Argumento:** Programa a ejecutar con sus argumentos.

```
"4. Programa Aplicativo" WCMD doform formen4
```

### 5. BUILTIN

Ejecuta una función incorporada al Window Manager.

| Función | Descripción |
|---------|-------------|
| `GoToShell` | Va al Shell |
| `_print_scr` | Imprime la pantalla |
| `_print_ichset` | Imprime el juego de caracteres |
| `Calculator` | Despliega una calculadora |
| `Servmov` | Posiciona una ventana |

---

## 🔒 Permisos de Programas

Cuando se ejecuta un programa NILENGINE, es posible determinar dinámicamente qué operaciones tiene habilitadas:

| Permiso | Significado |
|---------|-------------|
| **A** | Adicionar (agregar nuevos datos) |
| **U** | Update (modificar datos existentes) |
| **D** | Delete (borrar datos existentes) |

### Sintaxis

Usar `!` seguido de las letras a inhibir:

```
cnt101 !D        # Sin permiso de borrar
cnt101 !ADU      # Solo consulta (read-only)
cnt101           # Todos los permisos (default)
```

### Ejemplo de Menú con Permisos

```
"1. Cuentas contables (consulta)" WCMD cnt101 !ADU
"2. Cuentas contables (completo)" WCMD cnt101
```

---

## 💡 Ayuda en los Menús

Cuando se solicita ayuda con `<AYUDA_APL>` en un menú, se despliega un archivo con el mismo nombre que el menú pero con extensión `.hlp`.

**Ubicación:** El archivo debe estar en un subdirectorio `hlp` que dependa de algún directorio en `PATH`.

**Ejemplo:**
- Menú: `/usr/aplicn/bin/menu.mn`
- Ayuda: `/usr/aplicn/bin/hlp/menu.hlp`

---

## 🔄 Adaptación a Nilix

### Mapeo de Tipos

| NILENGINE | Nilix | Descripción |
|---------|------------|-------------|
| MENU | `type="form"` | Cargar otro form en workspace |
| SHELL | N/A | No aplica (sandbox web) |
| PIPE | `type="api"` | Fetch + mostrar resultado |
| WCMD | `type="modal"` | Abrir form en modal |
| BUILTIN | `type="builtin"` | Funciones JS |

### Propuesta de Sintaxis XML

```xml
<menu id="main-menu" title="Menú Principal">
    <option label="Clientes" type="form" target="forms/clientes.xml"/>
    <option label="Facturas" type="form" target="forms/facturas.xml" permissions="RU"/>
    <option label="Reportes" type="api" endpoint="/api/reportes/generar"/>
    <option type="separator"/>
    <option label="Calculadora" type="builtin" function="calculator"/>
    <option label="Configuración" type="builtin" function="settings"/>
</menu>
```

### Propuesta de Permisos

```xml
<form id="clientes" title="Clientes" permissions="RWD">
    <!-- R = Read, W = Write, D = Delete -->
    <!-- Default: RWD (todos) -->
</form>
```

---

## 📚 Referencias

- **Archivo original:** `docs/07-archive/MForm.md` (spec completa de NILENGINE FDL)
- **Roadmap:** `docs/06-development/ROADMAP.md` (Features 10 y 11)
- **Manual:** `docs/06-development/MANUAL-DESARROLLO.md`

---

**Última actualización:** 2026-02-15
**Basado en:** NILENGINE Manual, Capítulo 18
