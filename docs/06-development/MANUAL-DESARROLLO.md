# 📘 MANUAL DE DESARROLLO - NILIX

**Versión:** 2026-03-11 (v2.3.0)
**Propósito:** Guía exhaustiva para desarrollo, debugging y extensión de Nilix

---

## 🎯 ¿QUÉ ES NILIX?

Nilix es un **motor multi-parser para aplicaciones de negocio** con estética terminal. Parsea formularios desde XML (nil-form), reportes desde YAML (nil-report) y navegación desde menús estructurados (nil-explorer). Datos persistidos en SQLite multi-tenant (nil-data). Lógica de negocio via handlers JS (nil-handler). Servidor Express orquestador (nil-runtime).

### Submódulos

| Submódulo | Rol | Directorio clave |
|-----------|-----|-----------------|
| **nil-form** | Forms XML, CRUD, validación | `js/components/form/`, `js/components/xmlParser/` |
| **nil-report** | Reportes YAML, DuckDB-WASM | `js/components/report/` |
| **nil-explorer** | Menú, navegación, file tree | `src/services/menuService.js`, `js/components/FileExplorer.js` |
| **nil-data** | SQLite scoped multi-tenant | `src/services/scopedDb.js`, `src/services/database.js` |
| **nil-handler** | Hooks de negocio | `src/services/handlerService.js` |
| **nil-runtime** | Express, rutas, middleware | `server.js`, `src/routes/`, `src/middleware/` |

### Filosofía de Diseño
- **Declarativo**: Formularios en XML, reportes en YAML
- **Terminal/Brutalista**: Estética inspirada en terminales clásicas (green phosphor, monospace, cero adornos)
- **Multi-tenant nativo**: ScopedDb auto-inyecta `empresa_id` en todas las queries
- **Sin frameworks frontend**: JavaScript vanilla, HTML/CSS puros
- **Responsive**: Cards multifield en móvil, sticky bottom nav

---

## 📋 TIPOS DE CAMPO SOPORTADOS

| Tipo | Descripción | Desde |
|------|-------------|-------|
| `text` | Campo de texto | v0.1.0 |
| `number` | Campo numérico | v0.1.0 |
| `date` | Selector de fecha | v0.1.0 |
| `textarea` | Texto multilínea | v0.5.0 |
| `checkbox` | Casilla de verificación | v0.5.0 |
| `multifield` | Grid/Tabla editable | v0.8.0 |
| `select` | Dropdown con opciones | v0.12.0 |

---

## 📁 ARQUITECTURA DEL PROYECTO

```
nilix/
├── server.js              # nil-runtime: Express + env NIL_* + TLS + mounts
├── index.html             # SPA: workspace + fileExplorer + header
├── login.html             # Login público (salta si ya autenticado)
├── report.html            # Viewer reportes YAML
├── package.json           # v2.3.0 — name: nilix
│
├── js/                    # Frontend ES modules
│   ├── main.js            # Guard auth (nil_token cookie) + init menu
│   ├── components/
│   │   ├── FormRenderer.js    # Coordinador: delega a form/ modules
│   │   ├── FileExplorer.js    # Render menú + badges RADU
│   │   ├── Workspace.js       # loadItem + public report URL
│   │   ├── form/              # nil-form — 6 módulos:
│   │   │   ├── FormContext.js          # Estado compartido del form
│   │   │   ├── LayoutProcessor.js      # Containers + is= expressions
│   │   │   ├── ValidationCoordinator.js # keyField, loadRecord, navigate
│   │   │   ├── HandlerBridge.js        # after() → populate/appendRow
│   │   │   └── SubmitManager.js        # CRUD buttons + RADU guard
│   │   ├── xmlParser/         # Parser XML → FormContext
│   │   ├── report/            # nil-report: ReportEngine + ReportRenderer
│   │   │   ├── ReportEngine.js         # YAML parse + DuckDB-WASM
│   │   │   ├── DataSourceManager.js    # multi-datasource + public mode
│   │   │   └── ReportRenderer.js       # Zones + control breaks
│   │   └── fieldRenderer/     # Módulos de campos
│   │       ├── InputField.js           # text, number, date, select...
│   │       ├── Multifield.js           # Grid + stepper + appendRow
│   │       └── ...
│   ├── services/
│   │   ├── LookupService.js       # in-table validation
│   │   ├── TableCache.js          # Cache prefix nil_catalog_
│   │   ├── ExpressionEngine.js    # sum/avg/count + aritmética
│   │   └── themeService.js        # Toggle tema
│   ├── api/
│   │   └── client.js          # authFetch() con cookie automática
│   └── utils/
│       ├── Validator.js        # Validaciones inline
│       └── RADU.js             # canRead/canAdd/canDelete/canUpdate
│
├── src/                   # Backend Node.js
│   ├── services/
│   │   ├── database.js        # sql.js — app DB (NIL_DB_FILE)
│   │   ├── authDatabase.js    # sql.js — auth DB (NIL_AUTH_DB)
│   │   ├── authService.js     # login + JWT + bcrypt + rate-limit
│   │   ├── scopedDb.js        # ScopedDb(rawDb, empresaId)
│   │   ├── handlerService.js  # Carga handlers desde NIL_APP_DIR/apps/
│   │   ├── menuService.js     # Parsea menu.xml + authorizedDirs
│   │   ├── schemaService.js   # hasColumn para detección tenant
│   │   └── recordService.js   # CRUD + navigate (PAG_SIG/ANT)
│   ├── controllers/
│   │   ├── recordController.js       # /api/records CRUD + RADU
│   │   ├── filesystemController.js   # /api/menu + /api/files/content
│   │   └── publicReportController.js # /api/public/report-data
│   ├── routes/
│   │   ├── apiRoutes.js        # Monta todas las rutas autenticadas
│   │   ├── authRoutes.js       # POST /login, /logout, GET /check
│   │   ├── recordRoutes.js     # GET/POST/PUT/DELETE /api/records/:table
│   │   └── publicReportRoutes.js
│   └── middleware/
│       ├── verifyToken.js     # JWT desde cookie nil_token
│       └── auditLog.js        # Log write ops (POST/PUT/DELETE)
│
├── utils/
│   ├── init-auth.js       # Schema auth.db + 3 empresas + 3 usuarios demo
│   └── init-pizzeria.js   # Schema app DB + 3 empresas + ~120 productos
│
├── forms/                 # Motor forms (parte del repo)
│   └── login.xml          # Form de login (action="/api/auth/login")
│
├── css/
│   └── styles.css         # Estilos nil-report + nil-form + responsive
│
└── docs/                  # Documentación
    ├── 01-getting-started/
    ├── 02-architecture/
    ├── 03-reference/
    ├── 04-guides/
    ├── 05-specs/
    ├── 06-development/
    └── 07-archive/

# App externa (ejemplo: pizzería)
/opt/wc/pizzeria/
├── menu.xml               # Definición de menú (NIL_MENU_FILE)
├── form/                  # Formularios de la app
│   ├── producto_nuevo.xml
│   ├── precios.xml
│   └── pos.xml
├── apps/                  # Handlers JS de negocio
│   ├── producto_nuevo.handler.js
│   └── venta_handler.js
├── reports/               # Reportes YAML
│   └── carta.yaml
└── dbase/
    └── pizzeria.db        # App DB (NIL_DB_FILE)
```

### 🔍 Dónde Está Cada Cosa

| Feature | Archivo Principal | Líneas |
|---------|-------------------|--------|
| **Sidebar toggle** | `main.js` | 13-41 |
| **Renderizado de campos** | `FormRenderer.js` | 350-450 |
| **in-table config** | `FormRenderer.js` | 508-545 |
| **in-table validation** | `FormRenderer.js` | 405-448 |
| **Dynamic select** | `fieldRenderer/InputField.js` | 35-58, 185-255 |
| **Lookup API** | `LookupService.js` | Todo |
| **Caché catálogos** | `TableCache.js` | Todo |
| **Backend database** | `src/services/database.js` | Todo |
| **Backend queries** | `src/services/catalogService.js` | Todo |
| **Backend controller** | `src/controllers/catalogController.js` | Todo |
| **Help tooltips** | `FormRenderer.js` + `styles.css` | 346-388 |
| **Estilos brutalist** | `styles.css` | 100-450 |

---

## ⚙️ CONFIGURACIÓN — Variables de Entorno (NIL_*)

Copia `.env.example` a `.env` y configura:

```bash
# nil-runtime
NIL_PORT=3000
NIL_MENU_FILE=/opt/wc/pizzeria/menu.xml
NIL_APP_DIR=     # auto-derived: dirname(NIL_MENU_FILE)
NIL_DB_FILE=/opt/wc/pizzeria/dbase/pizzeria.db

# nil-data / auth
NIL_AUTH_DB=data/auth.db
NIL_JWT_SECRET=cambia-esto-en-produccion
NIL_JWT_EXPIRY=8h

# TLS (opcional)
NIL_TLS_CERT=/path/to/cert.pem
NIL_TLS_KEY=/path/to/key.pem

# CORS (opcional)
NIL_ALLOWED_ORIGIN=https://mi-dominio.com

# Migración desde v2.2.x (solo dev)
# NIL_COMPAT_SPACE_FORM=1
```

### Quick Start

```bash
npm install --no-bin-links   # --no-bin-links si el FS no soporta symlinks
node utils/init-auth.js      # Crea auth.db con 3 empresas demo
node utils/init-pizzeria.js  # Crea pizzeria.db con datos demo
node server.js               # → http://localhost:3000
# Login: admin / demo1234
```

---

## 🗺️ MAPEO NILIX FDL → NILIX XML

### Estructura General

#### NILIX FDL:
```
%form
    use biblio;
    window label "Título", border standard;
    messages
        MSG1: "Mensaje de ayuda";
    end messages;

%fields
    codigo: libros., not null, > 0;
    titulo: libros., description MSG1;
```

#### Nilix XML:
```xml
<form title="Título" database="biblio">
    <form-attributes>
        <use>biblio</use>
        <window border="single"/>
        <messages>
            <message id="MSG1">Mensaje de ayuda</message>
        </messages>
    </form-attributes>

    <layout>
        <field id="codigo" label="Código" type="number">
            <validation>
                <required>true</required>
                <check>&gt; 0</check>
            </validation>
        </field>

        <field id="titulo" label="Título" type="text">
            <attributes>
                <help>MSG1</help>
            </attributes>
        </field>
    </layout>
</form>
```

---

## ✅ FEATURES IMPLEMENTADOS

### 1. Campos Básicos (100% Implementado)

| Tipo FDL | Tipo Nilix | HTML Resultante | Notas |
|--------------|-----------------|-----------------|-------|
| `char(N)` | `type="text"` | `<input type="text">` | Con `size="N"` |
| `num(N,D)` | `type="number"` | `<input type="number">` | Decimales con `step` |
| `date` | `type="date"` | `<input type="date">` | Width: 17ch |
| `time` | `type="time"` | `<input type="time">` | - |
| `email` | `type="email"` | `<input type="email">` | Validación HTML5 |
| `tel` | `type="tel"` | `<input type="tel">` | - |
| Textarea | `type="textarea"` | `<textarea>` | Default: 3 rows |

**Archivo:** `FormRenderer.js` líneas 350-450

**Ejemplo:**
```xml
<field id="nombre" label="Nombre" type="text" size="50"/>
<field id="edad" label="Edad" type="number"/>
<field id="fecha" label="Fecha" type="date"/>
<field id="mensaje" label="Mensaje" type="textarea" rows="5"/>
```

---

### 2. Atributos de Campo (95% Implementado)

#### ✅ Implementados:

| Atributo FDL | Nilix XML | Comportamiento |
|------------------|----------------|----------------|
| `not null` | `<required>true</required>` | Campo obligatorio |
| `display only` | `display-only="true"` | Campo readonly |
| `skip` | `skip="true"` | Campo no focuseable |
| `default <valor>` | `<default>valor</default>` | Valor por defecto |
| `check <expr>` | `<check>expr</check>` | Validación personalizada |
| `description MSG` | `<help>MSG</help>` | Tooltip con [?] icon |
| `> < >= <= == !=` | `<check>&gt; 10</check>` | Operadores relacionales |
| `between A and B` | `<between min="A" max="B"/>` | Rango de valores |

**Archivo:** `Validator.js` (validaciones) + `FormRenderer.js` (renderizado)

**Ejemplo:**
```xml
<field id="precio" label="Precio" type="number">
    <validation>
        <required>true</required>
        <check>&gt; 0</check>
        <between min="1" max="10000"/>
    </validation>
</field>

<field id="email" label="Email" type="email">
    <attributes>
        <help>EMAIL_HELP</help>
    </attributes>
    <validation>
        <required>true</required>
    </validation>
</field>
```

#### ⚠️ Parcialmente Implementados:

| Atributo | Estado | Falta |
|----------|--------|-------|
| `autoenter` | ❌ No | Auto-avanzar al completar campo |
| `mask <string>` | ❌ No | Máscaras de entrada (ej: `(___) ___-____`) |
| `length <N>` | ❌ No | Longitud real vs longitud visual |

---

### 3. Multifields (80% Implementado)

**Archivo:** `FormRenderer.js` líneas 744-950

#### ✅ Fase 1: Multifield → Textarea (100%)

**Detección:** 1 campo hijo = textarea

**FDL original:**
```
RENG: rows 500, display 10;
texto:;
```

**Nilix:**
```xml
<field id="RENG" type="multifield" rows="500" display="10">
    <field id="texto" type="text"/>
</field>
```

**Resultado:** `<textarea>` con:
- `rows="10"` (display)
- `maxlength="40000"` (500 × 80 chars/línea)
- `readonly` si hijo tiene `display-only="true"`

**Líneas clave:**
- Detección: `isTextareaMultifield()` línea ~744
- Renderizado: `renderTextareaFromMultifield()` línea ~786

---

#### ✅ Fase 2: Multifield → Grid/Tabla (80%)

**Detección:** Múltiples campos hijos = grid

**FDL original:**
```
RENGS: rows 50, display 7;
nume: display only;
rte: skip;
fec: skip;
```

**Nilix:**
```xml
<field id="RENGS" type="multifield" rows="50" display="7">
    <field id="nume" label="No" type="number" display-only="true"/>
    <field id="rte" label="Remitente" type="text" skip="true"/>
    <field id="fec" label="Fecha" type="date" skip="true"/>
</field>
```

**Resultado:** `<table>` con:
- Encabezados desde `label` de cada campo
- Inputs en celdas (readonly según `display-only` o `skip`)
- Navegación: botones Anterior/Siguiente
- Indicador: "1-7 de 50"

**Líneas clave:**
- Detección: `isGridMultifield()` línea ~755
- Renderizado: `renderGridFromMultifield()` línea ~822

**⚠️ Limitaciones actuales:**
- ❌ No carga/guarda datos dinámicamente (falta backend)
- ❌ No soporta agregar/eliminar filas
- ❌ Navegación estática (no pagina datos reales)

---

### 4. Containers (100% Implementado)

**Archivo:** `FormRenderer.js` líneas 600-700

#### Vertical (default):
```xml
<container type="vertical">
    <field id="nombre" label="Nombre" type="text"/>
    <field id="email" label="Email" type="email"/>
</container>
```

Labels **arriba** de inputs (brutalist style).

#### Horizontal:
```xml
<container type="horizontal">
    <field id="dia" label="Día" type="number" size="2"/>
    <field id="mes" label="Mes" type="number" size="2"/>
    <field id="año" label="Año" type="number" size="4"/>
</container>
```

Campos en fila, labels arriba de cada input.

**CSS:** `.container-horizontal` en `styles.css` línea ~300

---

### 5. Border (Recuadros) - 100% Implementado

**Archivo:** `FormRenderer.js` línea ~737

**Qué es:** Tag `<border>` que dibuja un recuadro alrededor de campos, similar a los boxes.

**Sintaxis:**
```xml
<border>
    <field id="orderno" label="Número de Factura" type="text" size="5"/>
</border>
```

**Resultado HTML:**
```html
<div class="border-box">
    <!-- Campos renderizados aquí -->
</div>
```

**CSS:** `.border-box` en `styles.css` línea ~347
- Border: 2px solid
- Border-radius: 0 (brutalist)
- Padding: 1rem
- Display: inline-block

**Uso en containers horizontales:**
```xml
<container type="horizontal">
    <border>
        <field id="campo1" label="Campo 1" type="text"/>
    </border>
    <field id="campo2" label="Campo 2" type="text" align="right"/>
</container>
```

**Líneas clave:**
- Detección: `processNode()` línea ~701 (case 'BORDER')
- Renderizado: `renderBorder()` línea ~737

---

### 6. Alineación de Campos (align) - 100% Implementado

**Archivo:** `FormRenderer.js` línea ~1074 (extractFieldConfig)

**Qué es:** Atributo `align` que permite alinear campos a la izquierda, centro o derecha del contenedor.

**Sintaxis:**
```xml
<field id="fecha" label="Fecha" type="date" align="right"/>
```

**Valores soportados:**
- `align="left"` (default) - Alineado a la izquierda
- `align="center"` - Centrado
- `align="right"` - Alineado a la derecha

**Implementación:**
1. Extracción: `extractFieldConfig()` agrega `align` al config
2. Renderizado: `renderInputField()` línea ~586 aplica clase CSS
3. CSS: `.field-align-right` y `.field-align-center` en `styles.css` línea ~359

**CSS:**
```css
.field-align-right {
    margin-left: auto !important;
    margin-right: 0 !important;
}

.field-align-center {
    margin-left: auto !important;
    margin-right: auto !important;
}
```

**Uso típico:**
- Fechas en esquina superior derecha
- Totales alineados a la derecha
- Layouts complejos nativo

---

### 5. Sistema de Ayuda (100% Implementado)

**Archivo:** `FormRenderer.js` líneas 346-388 + `styles.css` líneas 475-548

#### Comportamiento:
1. Icono `[?]` en **verde phosphor** (#00ff00) antes de cada label
2. Click en `[?]` → tooltip terminal-style
3. ESC o click fuera → cierra tooltip

**Estructura HTML:**
```html
<label>
    <span class="help-icon">[?]</span> NOMBRE COMPLETO
</label>
<div class="help-tooltip">
    <div class="help-prompt">&gt; help nombre</div>
    <div class="help-msg">Ingrese su nombre completo</div>
</div>
```

**CSS Clave:**
- `.help-icon`: verde phosphor con hover glow
- `.help-tooltip`: ventana negra con borde verde, z-index 9999
- Event bubbling prevention: `e.stopPropagation()` línea ~382

---

### 6. Validaciones (70% Implementado)

**Archivo:** `Validator.js` + `ExpressionEngine.js`

#### ✅ Implementados:

| Validación | Sintaxis XML | Ejemplo |
|------------|--------------|---------|
| **Required** | `<required>true</required>` | Campo obligatorio |
| **Check expr** | `<check>this &gt; 10</check>` | Expresiones simples |
| **Between** | `<between min="1" max="100"/>` | Rangos |
| **Operadores** | `&gt;`, `&lt;`, `&gt;=`, `&lt;=`, `==`, `!=` | Comparaciones |

#### ⚠️ Parcialmente Implementados:

| Validación | Estado | Falta |
|------------|--------|-------|
| `in (valores)` | ❌ No | Lista de valores permitidos con menú dropdown |
| `unique` (multifield) | ❌ No | Verificar valores únicos en columnas |
| Expresiones complejas | ⚠️ Parcial | Referencias a otros campos (`campo1 > campo2`) |

---

### 7. in-table: Validación contra BD (v0.13.0 - 100% blur, v0.14.0 - dynamic select)

**Archivos:** 
- `FormRenderer.js` líneas 405-448 (extractInTableConfig, validateInTable)
- `LookupService.js` (getCatalog, validateAndCopy)
- `TableCache.js` (caché localStorage)
- `fieldRenderer/InputField.js` líneas 35-58, 185-255 (dynamic select)

#### Sintaxis XML

**Select dinámico (v0.14.0):**
```xml
<field id="clieno" label="Cliente" type="select" size="6">
    <in-table table="clientes" key="clieno" display="nombre">
        <copy from="nombre" to="nombre"/>
        <copy from="direc" to="direc"/>
    </in-table>
</field>
```

**Validación en blur (v0.13.0):**
```xml
<field id="prov" label="Provincia" type="text" size="2">
    <validation>
        <in-table table="provin" key="codpro">
            <copy from="nombre" to="prov_nombre"/>
        </in-table>
    </validation>
</field>
```

#### Lógica de type="select"

| Sub-elemento | Resultado |
|--------------|-----------|
| `<options>` | Select estático |
| `<in-table>` | Select dinámico (carga desde BD al focus) |

#### Comportamiento dynamic select

1. Campo se renderiza como `<select>` vacío
2. Al hacer **focus** → GET `/api/catalogs/:table`
3. Opciones: `<option value="key">display</option>`
4. Al **seleccionar** → copia campos con `<copy>`
5. Segunda vez → usa caché (24h TTL)

#### Tablas disponibles (ALLOWED_TABLES)

| Tabla | Clave | Campos |
|-------|-------|--------|
| provin | codpro | nombre |
| local | codpro+codloc | nombre |
| clientes | clieno | nombre, direc, telef, cuit |
| items | itemno | descri, precio, stock |
| ordenes | nroord | fecha, clieno, total |
| movim | nroord+linea | itemno, cant, precio |

#### API Endpoints

```bash
# Listar tablas
GET /api/catalogs/tables

# Obtener tabla completa
GET /api/catalogs/clientes

# Validar clave
GET /api/catalogs/clientes/clieno/1
```

---

### 8. Estilos Terminal/Brutalist (100% Implementado)

**Archivo:** `styles.css` líneas 100-450

#### Características:
- ✅ `border-radius: 0` (sin esquinas redondeadas)
- ✅ Bordes gruesos: 2-3px sólidos
- ✅ Fuente monospace: JetBrains Mono, Courier New
- ✅ Labels uppercase con letter-spacing
- ✅ Verde phosphor (#00ff00) para:
  - Help icons `[?]`
  - Placeholder text (dark mode)
  - Tooltips prompt
- ✅ Padding compacto: 0.4rem en inputs
- ✅ Sin sombras decorativas
- ✅ Alto contraste

**Paleta de colores:**
```css
--bg-color: #1a1a1a;           /* Fondo terminal */
--text-color: #e0e0e0;         /* Texto principal */
--border-color: #333;          /* Bordes */
--input-border: #555;          /* Bordes inputs */
--help-icon-color: #00ff00;    /* Verde phosphor */
```

---

## ❌ FEATURES PENDIENTES

### 1. Atributo `is` (Campos Virtuales) - PRIORIDAD ALTA

**Qué es:** Campos calculados cuyo valor resulta de una expresión.

**FDL original:**
```
total: is precio * cantidad;
fecha_texto: is descr(tipo_fecha);
```

**Funciones del atributo `is`:**
- `sum(campo)` - Suma de columna en multifield
- `avg(campo)` - Promedio
- `max(campo)`, `min(campo)` - Máximo/mínimo
- `count(campo)` - Contar filas
- `descr(campo)` - Descripción de un valor `in (lista)`
- `help(tecla)` - Nombre de tecla de función
- `num(expr)`, `date(expr)`, `time(expr)` - Conversiones

**Ejemplo de uso:**
```
%fields
    precio:;
    cantidad:;
    total: is precio * cantidad, display only;
```

**Implementación pendiente:**
- ✅ `ExpressionEngine.js` ya existe (evalúa expresiones)
- ❌ Falta: Auto-recalcular cuando cambian campos referenciados
- ❌ Falta: Funciones agregadas (sum, avg, etc.) para multifields

**Dónde implementar:**
- `FormRenderer.js`: Detectar `<is>expr</is>` en XML
- `ExpressionEngine.js`: Agregar funciones (sum, avg, etc.)
- Event listeners: Re-calcular al cambiar campos dependientes

---

### 2. Atributo `in (valores)` con Menú - ⚠️ PARCIAL (select implementado)

**Qué es:** Lista cerrada de valores con selector tipo menú.

**FDL original:**
```
tipo: in (1:"Proveedor", 2:"Cliente", 3:"Empleado");
```

**Nilix XML (select estático - ✅ implementado v0.12.0):**
```xml
<field id="tipo" label="Tipo" type="select">
    <options>
        <option value="1">Proveedor</option>
        <option value="2">Cliente</option>
        <option value="3">Empleado</option>
    </options>
</field>
```

**Falta (baja prioridad):**
- ❌ Menú popup con F1 para campos text
- ❌ Validación `in (valores)` sin ser select

---

### 3. Atributo `in tabla` (Lookups en BD) - ✅ IMPLEMENTADO (v0.13.0 + v0.14.0)

**Qué es:** Validar contra una tabla de base de datos + menú de selección dinámico.

**FDL original:**
```
autor: in autores:(nombre);
```

**Nilix XML:**

Select dinámico (carga al focus):
```xml
<field id="autor" label="Autor" type="select">
    <in-table table="autores" key="id" display="nombre">
        <copy from="nombre" to="desc_autor"/>
    </in-table>
</field>
```

Validación en blur:
```xml
<field id="autor" label="Autor" type="text" size="4">
    <validation>
        <in-table table="autores" key="id">
            <copy from="nombre" to="desc_autor"/>
        </in-table>
    </validation>
</field>
```

**Archivos implementados:**
- ✅ `src/services/database.js` - Conexión sql.js
- ✅ `src/services/catalogService.js` - Queries + whitelist
- ✅ `src/controllers/catalogController.js` - API controller
- ✅ `src/routes/catalogRoutes.js` - GET /api/catalogs/:table
- ✅ `js/services/LookupService.js` - Validación + copy
- ✅ `js/services/TableCache.js` - Caché localStorage 24h
- ✅ `FormRenderer.js` - extractInTableConfig(), validateInTable()
- ✅ `fieldRenderer/InputField.js` - attachDynamicSelectHandlers()

**API disponible:**
```
GET /api/catalogs/tables         → Lista tablas permitidas
GET /api/catalogs/:table         → Todos los registros
GET /api/catalogs/:table/:key/:value → Validar clave
```

**Sintaxis XML propuesta:**
```xml
<field id="autor" label="Autor" type="lookup">
    <lookup table="autores" key="codigo" display="nombre"/>
</field>
```

---

### 4. Subformularios - PRIORIDAD MEDIA

**Qué es:** Formulario popup asociado a un campo.

**FDL original:**
```
codigo: subform "detalle_cliente";
```

**Comportamiento:**
- Al completar campo → abre ventana con subformulario
- Captura datos adicionales
- Cierra ventana → vuelve al form principal

**Casos de uso:**
1. Datos relacionados no esenciales
2. Formularios con múltiples vistas
3. Datos condicionales según valor de campo

**Dónde implementar:**
- `FormRenderer.js`: Detectar `<subform>` tag
- Nuevo archivo: `SubformManager.js`
- Renderizar como modal overlay
- Pasar datos entre form principal y subform

**Sintaxis XML propuesta:**
```xml
<field id="cliente" label="Cliente" type="number">
    <subform src="detalle_cliente.xml" trigger="blur"/>
</field>
```

---

### 5. Campos Agrupados (Grouped Fields) - PRIORIDAD BAJA

**Qué es:** Grupo de campos con validación cruzada.

**FDL original:**
```
{ __/__/__ __/__/__ }

%fields
agrup: check fecha_hasta >= fecha_desde;
fecha_desde:;
fecha_hasta:;
```

**Comportamiento:**
- Validación se aplica al salir del grupo completo
- Permite movimiento entre campos del grupo sin validar
- Útil para campos interdependientes

**Dónde implementar:**
- `FormRenderer.js`: Detectar `<group>` container
- `Validator.js`: Validaciones a nivel grupo
- CSS: Borde visual alrededor del grupo

**Sintaxis XML propuesta:**
```xml
<group id="rango_fechas">
    <validation>
        <check>fecha_hasta &gt;= fecha_desde</check>
    </validation>
    <field id="fecha_desde" label="Desde" type="date"/>
    <field id="fecha_hasta" label="Hasta" type="date"/>
</group>
```

---

### 6. Zona de Claves (Key Zone) - PRIORIDAD BAJA

**Qué es:** División del formulario en clave + datos.

**FDL original:**
```
Código: ____.  |  <-- Zona de clave
---------------   <-- Delimitador
Nombre: ______    <-- Zona de datos
```

**Comportamiento:**
1. Usuario completa clave
2. Sistema busca registro en BD
3. Si existe → llena datos
4. Si no existe → permite alta

**Dónde implementar:**
- `FormRenderer.js`: Detectar delimitador `|`
- Nuevo: `CRUDService.js` para operaciones BD
- Modo: NEW, EDIT, DELETE

**Sintaxis XML propuesta:**
```xml
<layout>
    <key-zone>
        <field id="codigo" label="Código" type="number"/>
    </key-zone>
    <data-zone>
        <field id="nombre" label="Nombre" type="text"/>
        <field id="descripcion" label="Descripción" type="textarea"/>
    </data-zone>
</layout>
```

---

### 7. Operaciones Multifield Avanzadas - PRIORIDAD BAJA

**Falta:**
- ❌ Agregar filas (`ignore add` para deshabilitar)
- ❌ Eliminar filas (`ignore delete`)
- ❌ Insertar filas (`ignore insert`)
- ❌ Atributo `unique` en columnas

**FDL original:**
```
multip: rows 100, display 5, ignore delete;
campo1: unique;
```

**Dónde implementar:**
- `FormRenderer.js` línea ~822: Método `renderGridFromMultifield`
- Agregar botones [+] [-] [Insert] según atributos
- Event listeners para CRUD de filas
- Validación `unique` en `Validator.js`

---

### 8. Máscaras de Entrada (`mask`) - PRIORIDAD BAJA

**Qué es:** Formato de entrada con caracteres fijos.

**FDL original:**
```
telefono: mask "(___) ___-____";
cuit: mask "__-________-_";
```

**Dónde implementar:**
- `FormRenderer.js`: Detectar `<mask>` attribute
- Usar librería: `imask.js` o similar
- O implementar custom input masking

**Sintaxis XML propuesta:**
```xml
<field id="telefono" label="Teléfono" type="tel">
    <attributes>
        <mask>(___) ___-____</mask>
    </attributes>
</field>
```

---

### 9. Campos de Referencia (Polimórficos) - PRIORIDAD MUY BAJA

**Qué es:** Campo que cambia de tipo dinámicamente.

**FDL original:**
```
b: reference(r1..r4), is cod;
r1: internal char(10);
r2: internal num(4);
r3: internal time;
r4: internal date;
```

Si `cod == 1` → `b` es char(10)
Si `cod == 2` → `b` es num(4)
etc.

**Dónde implementar:**
- Extremadamente complejo
- Requiere re-renderizado dinámico del campo
- No prioritario para versión inicial

---

## 🛠️ GUÍA: DÓNDE HACER CADA TIPO DE CAMBIO

### 📝 Agregar un Nuevo Tipo de Campo

**Ejemplo:** Agregar `type="color"` para selector de color.

1. **FormRenderer.js** línea ~400:
```javascript
if (type === 'color') {
    inputEl = createElement('input');
    inputEl.type = 'color';
    inputEl.style.width = '60px';
    inputEl.style.height = '40px';
}
```

2. **styles.css** línea ~415:
```css
input[type="color"] {
    cursor: pointer;
    border: 2px solid var(--input-border);
    padding: 0;
}
```

3. **Documentación:** Actualizar este manual en sección "Campos Básicos"

---

### 🎨 Cambiar Estilos (Colores, Fuentes, Spacing)

**Archivo:** `styles.css`

| Cambio Deseado | Línea Aproximada | Variable/Selector |
|----------------|------------------|-------------------|
| Color de fondo | ~50 | `--bg-color` |
| Color de texto | ~51 | `--text-color` |
| Color de bordes | ~52 | `--border-color` |
| Fuente monospace | ~45 | `--label-font` |
| Padding de inputs | ~420 | `input, textarea { padding: ... }` |
| Ancho de labels | ~370 | `label { min-width: ... }` |
| Color help icon | ~475 | `.help-icon { color: #00ff00 }` |
| Tamaño de tooltips | ~525 | `.help-tooltip { min-width: ... }` |

**Ejemplo - Cambiar color de ayuda a azul:**
```css
/* Línea ~475 */
.help-icon {
    color: #00aaff; /* Cambiar de #00ff00 */
}
```

---

### ✔️ Agregar una Nueva Validación

**Ejemplo:** Validar que un campo sea múltiplo de 5.

1. **Validator.js**:
```javascript
validateMultipleOf(value, multiple) {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return num % multiple === 0;
}
```

2. **FormRenderer.js** línea ~650 (en método `attachValidation`):
```javascript
const multipleOf = validationXml.querySelector('multipleOf');
if (multipleOf) {
    const multiple = parseInt(multipleOf.textContent);
    if (!this.validator.validateMultipleOf(inputEl.value, multiple)) {
        isValid = false;
        errorMsg = `Debe ser múltiplo de ${multiple}`;
    }
}
```

3. **XML:**
```xml
<field id="cantidad" label="Cantidad" type="number">
    <validation>
        <multipleOf>5</multipleOf>
    </validation>
</field>
```

---

### 📊 Modificar Comportamiento de Multifields

**Archivo:** `FormRenderer.js`

| Cambio | Método | Línea Aprox |
|--------|--------|-------------|
| Detección tipo multifield | `isTextareaMultifield()`, `isGridMultifield()` | 744-758 |
| Textarea: rows, maxlength | `renderTextareaFromMultifield()` | 786-816 |
| Grid: columnas, headers | `renderGridFromMultifield()` | 822-900 |
| Grid: navegación (botones) | `renderGridFromMultifield()` | 900-950 |
| Grid: agregar/eliminar filas | ❌ No implementado | - |

**Ejemplo - Cambiar cálculo de maxlength para textarea:**
```javascript
// Línea ~795
const maxLength = rows * 80; // Original

// Cambiar a 100 caracteres por línea:
const maxLength = rows * 100;
```

---

### 🔧 Agregar un Nuevo Atributo de Campo

**Ejemplo:** Agregar `placeholder="texto"` como atributo XML.

1. **XML:**
```xml
<field id="nombre" label="Nombre" type="text">
    <attributes>
        <placeholder>Ingrese su nombre aquí</placeholder>
    </attributes>
</field>
```

2. **FormRenderer.js** línea ~450:
```javascript
// Después de crear el inputEl
const attributesXml = fieldXml.querySelector('attributes');
if (attributesXml) {
    const placeholderXml = attributesXml.querySelector('placeholder');
    if (placeholderXml) {
        inputEl.placeholder = placeholderXml.textContent;
    }
}
```

---

### 🪟 Modificar el Sistema de Tooltips

**Archivos:** `FormRenderer.js` + `styles.css`

**Cambios comunes:**

1. **Cambiar posición del tooltip (arriba en vez de abajo):**

`styles.css` línea ~520:
```css
.help-tooltip {
    position: absolute;
    bottom: 100%; /* Cambiar de 'top: 100%' */
    left: 0;
}
```

2. **Cambiar icono de `[?]` a `ⓘ`:**

`FormRenderer.js` línea ~350:
```javascript
const createHelpIcon = (fieldId) => {
    const icon = createElement('span');
    icon.className = 'help-icon';
    icon.textContent = 'ⓘ'; // Cambiar de '[?]'
    return icon;
}
```

3. **Tooltip permanente (sin click):**

`FormRenderer.js` línea ~380:
```javascript
// Cambiar de 'click' a 'mouseenter'
helpIcon.addEventListener('mouseenter', (e) => {
    showHelpTooltip(helpIcon);
});

helpIcon.addEventListener('mouseleave', (e) => {
    hideHelpTooltip(helpIcon);
});
```

---

### 🗄️ Integrar con Backend (Persistencia Real)

**Actualmente:** `PersistenceService.js` usa LocalStorage (datos temporales).

**Para backend real:**

1. **Crear `APIService.js`:**
```javascript
class APIService {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async saveForm(formId, data) {
        const response = await fetch(`${this.baseURL}/forms/${formId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }

    async loadForm(formId, key) {
        const response = await fetch(`${this.baseURL}/forms/${formId}/${key}`);
        return response.json();
    }
}
```

2. **Modificar `FormRenderer.js` línea ~1000 (método save):**
```javascript
// Reemplazar:
this.persistenceService.saveFormData(formId, data);

// Con:
await this.apiService.saveForm(formId, data);
```

3. **Configurar en `main.js`:**
```javascript
const apiService = new APIService('http://localhost:8000/api');
const renderer = new FormRenderer(validator, apiService);
```

---

## 🐛 DEBUGGING: PROBLEMAS COMUNES

### Problema: "El tooltip no se muestra"

**Causas posibles:**
1. `overflow: hidden` en contenedor padre
   - **Solución:** `styles.css` línea ~300, cambiar a `overflow: visible`

2. `z-index` muy bajo
   - **Solución:** `styles.css` línea ~520, aumentar `z-index: 9999`

3. Event bubbling cierra tooltip inmediatamente
   - **Solución:** `FormRenderer.js` línea ~382, agregar `e.stopPropagation()`

**Debugging:**
```javascript
// FormRenderer.js línea ~380
helpIcon.addEventListener('click', (e) => {
    console.log('Help icon clicked', e.target);
    e.preventDefault();
    e.stopPropagation();
    toggleHelpTooltip(helpIcon);
    console.log('Tooltip display:', tooltip.style.display); // Debe ser 'block'
});
```

---

### Problema: "Los campos date están muy estrechos"

**Causa:** Width insuficiente para formato dd/mm/yyyy + icono calendario.

**Solución:**
`FormRenderer.js` línea ~417:
```javascript
if (type === 'date') {
    inputEl.style.width = '17ch'; // Ajustar según necesidad
}
```

**Valores recomendados:**
- `15ch`: Ajustado (puede rozar)
- `17ch`: Cómodo (actual)
- `20ch`: Espacioso

---

### Problema: "El multifield no detecta si es textarea o grid"

**Causa:** Selector CSS incorrecto para contar campos hijos.

**Debugging:**
`FormRenderer.js` línea ~745:
```javascript
isTextareaMultifield(multifieldXml) {
    const childFields = multifieldXml.querySelectorAll(':scope > field');
    console.log('Child fields count:', childFields.length);
    console.log('Child fields:', childFields);
    return childFields.length === 1;
}
```

**Verificar:**
- ¿El XML tiene la estructura correcta?
- ¿Hay espacios en blanco creando nodos extra?

---

### Problema: "Las validaciones no funcionan"

**Debugging:**

1. **Verificar que el validator está registrado:**
```javascript
// FormRenderer.js línea ~650
console.log('Attaching validation to:', fieldId);
console.log('Validation XML:', validationXml);
```

2. **Verificar sintaxis XML:**
```xml
<!-- ✅ Correcto -->
<check>&gt; 10</check>

<!-- ❌ Incorrecto (no escapa >) -->
<check>> 10</check>
```

3. **Ver errores en consola del navegador (F12)**

---

### Problema: "Los estilos no se aplican"

**Causas:**

1. **Especificidad CSS baja:**
```css
/* ❌ Bajo (puede ser sobrescrito) */
.input-group input {
    border: 2px solid red;
}

/* ✅ Alto (más específico) */
.terminal-window .input-group input[type="text"] {
    border: 2px solid red !important;
}
```

2. **Cache del navegador:**
   - Solución: `Ctrl + Shift + R` (hard reload)

3. **CSS no cargado:**
   - Verificar en Network tab (F12) que `styles.css` se descargó

---

## 📋 CHECKLIST: IMPLEMENTAR UN FEATURE NUEVO

### Ejemplo: Implementar `type="select"` con opciones

#### 1. ✅ Diseñar la Sintaxis XML
```xml
<field id="pais" label="País" type="select">
    <options>
        <option value="AR">Argentina</option>
        <option value="BR">Brasil</option>
        <option value="CL">Chile</option>
    </options>
</field>
```

#### 2. ✅ Implementar Renderizado

**Archivo:** `FormRenderer.js` línea ~400

```javascript
if (type === 'select') {
    inputEl = createElement('select');

    const optionsXml = fieldXml.querySelector('options');
    if (optionsXml) {
        const options = optionsXml.querySelectorAll('option');
        options.forEach(optXml => {
            const option = createElement('option');
            option.value = optXml.getAttribute('value');
            option.textContent = optXml.textContent;
            inputEl.appendChild(option);
        });
    }
}
```

#### 3. ✅ Agregar Estilos

**Archivo:** `styles.css` línea ~440

```css
select {
    border: 2px solid var(--input-border);
    background: var(--bg-color);
    color: var(--text-color);
    padding: 0.4rem;
    border-radius: 0; /* Brutalist */
    font-family: var(--label-font);
    cursor: pointer;
}

select:focus {
    outline: 2px solid var(--help-icon-color);
    outline-offset: 2px;
}
```

#### 4. ✅ Validar Funcionamiento

```javascript
// En browser console
const select = document.querySelector('#pais');
console.log('Selected value:', select.value);
```

#### 5. ✅ Documentar

Agregar a este manual:
- Sección "Campos Básicos" → nueva fila para `select`
- Sección "Ejemplos" → ejemplo completo

#### 6. ✅ Crear Formulario de Prueba

**Archivo:** `forms/apps/test-select.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="test-select" title="Test: Select Fields">
    <layout>
        <field id="pais" label="País" type="select">
            <options>
                <option value="AR">Argentina</option>
                <option value="BR">Brasil</option>
            </options>
            <validation>
                <required>true</required>
            </validation>
        </field>
    </layout>
</form>
```

**Probar:** `http://localhost:3000/?form=test-select`

---

## 📚 REFERENCIA RÁPIDA: SINTAXIS XML

### Estructura Mínima

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="mi-form" title="Título del Form">
    <layout>
        <field id="campo1" label="Campo 1" type="text"/>
    </layout>
</form>
```

### Campo Completo con Todos los Atributos

```xml
<field id="precio" label="Precio Unitario" type="number" size="10">
    <attributes>
        <help>HELP_PRECIO</help>
        <default>100</default>
    </attributes>
    <validation>
        <required>true</required>
        <check>&gt; 0</check>
        <between min="1" max="99999"/>
    </validation>
</field>
```

### Container Horizontal

```xml
<container type="horizontal">
    <field id="dia" label="Día" type="number" size="2"/>
    <field id="mes" label="Mes" type="number" size="2"/>
    <field id="anio" label="Año" type="number" size="4"/>
</container>
```

### Multifield → Textarea

```xml
<field id="mensaje" type="multifield" rows="500" display="10">
    <field id="texto" type="text"/>
</field>
```

### Multifield → Grid

```xml
<field id="items" label="Items" type="multifield" rows="50" display="7">
    <field id="codigo" label="Código" type="number"/>
    <field id="descripcion" label="Descripción" type="text"/>
    <field id="cantidad" label="Cantidad" type="number"/>
</field>
```

### Mensajes de Ayuda

```xml
<messages>
    <message id="HELP_NOMBRE">Ingrese nombre completo</message>
    <message id="HELP_EMAIL">Email válido (usuario@dominio.com)</message>
</messages>

<layout>
    <field id="nombre" label="Nombre" type="text">
        <attributes>
            <help>HELP_NOMBRE</help>
        </attributes>
    </field>
</layout>
```

---

## Comparación de sintaxis

### Campos Simples

| Feature | NILIX FDL | Nilix XML |
|---------|-------------|----------------|
| Campo texto | `nombre: char(50);` | `<field id="nombre" type="text" size="50"/>` |
| Campo número | `edad: num(3);` | `<field id="edad" type="number" size="3"/>` |
| Campo fecha | `fecha: date;` | `<field id="fecha" type="date"/>` |
| Campo obligatorio | `codigo: not null;` | `<required>true</required>` |
| Campo readonly | `campo: display only;` | `display-only="true"` |
| Campo skip | `campo: skip;` | `skip="true"` |
| Valor por defecto | `fecha: default today;` | `<default>today</default>` |
| Mensaje de ayuda | `campo: description MSG1;` | `<help>MSG1</help>` |

### Validaciones

| Feature | NILIX FDL | Nilix XML |
|---------|-------------|----------------|
| Mayor que | `precio: > 0;` | `<check>&gt; 0</check>` |
| Rango | `edad: between 18 and 99;` | `<between min="18" max="99"/>` |
| Lista de valores | `tipo: in (1:"A", 2:"B");` | ❌ No implementado |
| Lookup en tabla | `autor: in autores:(nombre);` | ❌ No implementado |
| Expresión compleja | `total: check this < 10000;` | `<check>this &lt; 10000</check>` |

### Multifields

| Feature | NILIX FDL | Nilix XML |
|---------|-------------|----------------|
| Definir multifield | `campo: rows 50, display 7;` | `<field type="multifield" rows="50" display="7">` |
| Campos del multifield | Definidos después | `<field>` hijos dentro del multifield |
| Textarea (1 campo) | ✅ Auto-detectado | ✅ Auto-detectado |
| Grid (N campos) | ✅ Auto-detectado | ✅ Auto-detectado |
| Agregar/eliminar filas | ✅ Soportado | ❌ No implementado |

### Features Avanzados

| Feature | FDL original | NILIX |
|---------|---------|------------|
| Subformularios | ✅ `subform "nombre"` | ❌ No implementado |
| Campos virtuales (is) | ✅ `campo: is expr;` | ⚠️ Parcial (ExpressionEngine existe) |
| Zona de claves | ✅ Delimitador `\|` | ❌ No implementado |
| Campos agrupados | ✅ `{ campos }` | ❌ No implementado |
| Máscaras de entrada | ✅ `mask "patrón"` | ❌ No implementado |

---

## 🎓 CONCEPTOS CLAVE

### 1. Zona de Claves vs Zona de Datos

Un formulario puede dividirse en dos zonas:

- **Zona de Claves:** Campos para buscar un registro existente
- **Zona de Datos:** Campos del registro completo

**Delimitador:** Barra vertical `|` en la imagen del form

**Flujo:**
1. Usuario completa zona de claves
2. Sistema busca registro en BD
3. Si existe → carga datos en zona de datos
4. Si no existe → modo alta (campos en blanco)

**Operaciones:**
- `LEER`: Buscar por clave
- `LEER_SIG`: Siguiente registro
- `LEER_ANT`: Registro anterior
- `AGREGAR`: Alta nuevo registro
- `ACTUALIZAR`: Modificar existente
- `REMOVER`: Borrar registro
- `IGNORAR`: Cancelar cambios

**No implementado en Nilix.**

---

### 2. Campos Múltiples (Multifields)

**Qué son:** Matriz de campos (filas × columnas).

**Dimensiones:**
- **Columnas:** Cantidad de campos definidos
- **Filas totales:** Atributo `rows`
- **Filas visibles:** Atributo `display`

**Campo Rector:** Primera columna del multifield.

**Operaciones:**
- PgUp/PgDn: Navegar páginas
- Delete: Borrar fila
- Insert: Insertar fila
- Add: Agregar al final

**En Nilix:**
- ✅ Renderizado básico (textarea y grid)
- ❌ Operaciones CRUD de filas

---

### 3. Campos Agrupados (Grouped Fields)

**Qué son:** Conjunto de campos con validación cruzada.

**Sintaxis FDL:**
```
{ campo1 campo2 campo3 }

%fields
agrup: check campo2 > campo1;
campo1:;
campo2:;
campo3:;
```

**Comportamiento:**
- Validación se aplica al salir del grupo
- Permite movimiento entre campos sin validar
- Útil para fechas desde/hasta, rangos, etc.

**Casos de uso:**
1. Rango de fechas (hasta ≥ desde)
2. Coordenadas (lat/lon válidas juntas)
3. Comprobantes (tipo + número = único)

**No implementado en Nilix.**

---

### 4. Atributo `is` (Campos Virtuales)

**Qué es:** Campo calculado dinámicamente.

**Sintaxis:**
```
total: is precio * cantidad, display only;
```

**Características:**
- Siempre `display only` (readonly)
- Se recalcula al cambiar campos referenciados
- Puede usar funciones agregadas (sum, avg, etc.)

**Funciones disponibles:**

| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `sum(campo)` | Suma de columna en multifield | `total: is sum(subtotal);` |
| `avg(campo)` | Promedio | `promedio: is avg(notas);` |
| `max(campo)` | Máximo | `max_precio: is max(precio);` |
| `min(campo)` | Mínimo | `min_stock: is min(cantidad);` |
| `count(campo)` | Contar filas | `items: is count(codigo);` |
| `descr(campo)` | Descripción de valor `in` | `tipo_desc: is descr(tipo);` |
| `num(expr)` | Convertir a número | `num_dias: is num($VAR);` |

**Parcialmente implementado en Nilix** (existe `ExpressionEngine.js` pero falta integración completa).

---

### 5. Validación `in tabla`

**Qué es:** Validar que un valor existe en una tabla de BD.

**Sintaxis completa:**
```
campo: [not] in tabla [by indice] [(clave1, clave2)] :(desc1, desc2);
```

**Componentes:**
- `tabla`: Tabla de BD para validar
- `by indice`: Índice a usar (default: clave primaria)
- `(clave1, clave2)`: Valores para completar clave compuesta
- `:(desc1, desc2)`: Campos a mostrar en menú y copiar al form

**Ejemplo simple:**
```
autor: in autores:(nombre);
```

**Ejemplo con clave compuesta:**
```
tipo:;
codigo: in grales(tipo):(descripcion);
```
→ Busca en `grales` donde tipo=<valor_tipo> AND codigo=<valor_codigo>

**Campos Descripción:**
Campos de la tabla que se copian automáticamente al form si:
1. Están asociados a la tabla lookup
2. Aparecen después del campo con `in tabla`
3. Tienen `skip` o `display only`

**Ejemplo completo:**
```
autor: libros., in autores:(nombre);
nombre_autor: autores.nombre, display only;
```

**No implementado en Nilix** (requiere backend).

---

## 🚀 ROADMAP SUGERIDO

### Fase 1: Completar Core (1-2 semanas)

- [ ] Implementar `type="select"` con `<options>`
- [ ] Implementar atributo `is` completo (campos virtuales)
- [ ] Agregar funciones agregadas (sum, avg, max, min, count) para multifields
- [ ] Testing exhaustivo de multifields
- [ ] Fix: Navegación real en grids (cargar datos dinámicamente)

### Fase 2: Validaciones Avanzadas (1 semana)

- [ ] Implementar `in (valores)` con menú dropdown
- [ ] Implementar máscaras de entrada (`mask`)
- [ ] Validaciones cross-field (referenciar otros campos en check)
- [ ] Atributo `unique` en multifields

### Fase 3: Backend Integration (2-3 semanas)

- [ ] Crear API REST para CRUD
- [ ] Implementar `in tabla` (lookups en BD)
- [ ] Zona de claves (key zone) con operaciones LEER/AGREGAR/etc
- [ ] Persistencia real (reemplazar LocalStorage)

### Fase 4: Features Avanzados (2-3 semanas)

- [ ] Subformularios (popup forms)
- [ ] Campos agrupados (grouped fields)
- [ ] Operaciones multifield: agregar/eliminar/insertar filas
- [ ] Campos de referencia (polimórficos)

### Fase 5: UX y Polish (1 semana)

- [ ] Mensajes de error mejorados
- [ ] Loading states y spinners
- [ ] Keyboard navigation completa
- [ ] Accesibilidad (ARIA labels, screen readers)
- [ ] Modo responsive (mobile-friendly)

---

## 📖 RECURSOS ADICIONALES

### Documentos Clave

1. **MForm.txt** (`agent/MForm.txt`)
   - Especificación completa de NILIX FDL
   - Referencia autoritativa para features

2. **MULTIFIELD-GUIDE.md** (`forms/MULTIFIELD-GUIDE.md`)
   - Guía detallada de multifields
   - Ejemplos de uso

3. **Este Manual** (`MANUAL-DESARROLLO.md`)
   - Referencia completa del proyecto
   - Actualizar con cada feature nuevo

### Formularios de Prueba

| Archivo | Propósito |
|---------|-----------|
| `forms/simple-form.xml` | Ejemplo básico de todos los campos |
| `forms/apps/test-multifield.xml` | Testing de multifields (textarea y grid) |
| `forms/apps/imail.xml` | Caso real (emails) |

### Archivos de Código Críticos

| Archivo | LOC | Complejidad | Importancia |
|---------|-----|-------------|-------------|
| `FormRenderer.js` | ~1200 | Alta | ⭐⭐⭐⭐⭐ |
| `styles.css` | ~800 | Media | ⭐⭐⭐⭐ |
| `Validator.js` | ~400 | Media | ⭐⭐⭐⭐ |
| `ExpressionEngine.js` | ~300 | Alta | ⭐⭐⭐ |
| `main.js` | ~200 | Baja | ⭐⭐ |

---

## 🆘 CONTACTO Y SOPORTE

### Debugging Checklist

Antes de investigar un bug:

1. ✅ Abrir consola del navegador (F12)
2. ✅ Ver errores en pestaña Console
3. ✅ Verificar que el XML esté bien formado
4. ✅ Probar con `simple-form.xml` (formulario mínimo)
5. ✅ Hard reload (Ctrl+Shift+R) para limpiar cache
6. ✅ Verificar que `styles.css` y `FormRenderer.js` se cargaron

### Git Workflow Recomendado

```bash
# Crear branch para feature nuevo
git checkout -b feature/select-field

# Hacer commits pequeños y descriptivos
git commit -m "feat: Add basic select field rendering"
git commit -m "style: Add brutalist styles for select"
git commit -m "docs: Update manual with select field docs"

# Merge a main cuando esté completo y testeado
git checkout main
git merge feature/select-field
```

---

## 📝 CHANGELOG

### 2026-02-01

**Features Implementados:**
- ✅ Multifield auto-detection (Fase 1: textarea, Fase 2: grid)
- ✅ Sistema de help tooltips con `[?]` icon
- ✅ Estilos brutalist/terminal completos
- ✅ Containers horizontales y verticales
- ✅ Validaciones básicas (required, check, between)
- ✅ Campos: text, number, date, time, email, tel, textarea
- ✅ Atributos: required, display-only, skip, default, help

**Bugs Corregidos:**
- ✅ Date field width (calendar icon overlap)
- ✅ Help tooltips visibility (overflow y event bubbling)
- ✅ Duplicate textarea logic (now uses explicit `type="textarea"`)

**Documentación Creada:**
- ✅ `MULTIFIELD-GUIDE.md`
- ✅ `MANUAL-DESARROLLO.md` (este documento)

---

## 🎯 RESUMEN EJECUTIVO

### ¿Qué Funciona Hoy?

✅ Formularios básicos con campos text, number, date, textarea
✅ Validaciones simples (required, check, between)
✅ Multifields automáticos (textarea y grid)
✅ Help tooltips estilo terminal
✅ Estilos brutalist completos
✅ Containers horizontal/vertical

### ¿Qué Falta?

✅ Campos `select` con opciones **HECHO v0.12.0**
❌ Atributo `is` (campos virtuales) completo
❌ Validación `in (valores)` y `in tabla`
❌ Subformularios
❌ Backend real (actualmente LocalStorage)
❌ Zona de claves (CRUD operations)
❌ Máscaras de entrada

### Prioridad Inmediata

1. **Backend API** → Para datos persistentes
2. **Atributo `is` completo** → Necesario para cálculos
3. **`in tabla` lookups** → Feature killer
4. **`in (valores)` con menú** → Dropdowns avanzados

---

**Última actualización:** 2026-02-21
**Mantenido por:** Claude Code / GLM
**Versión Nilix:** 0.18.0 (Handler System + Multi-table)

---

## 🔄 SISTEMAS DINÁMICOS (v0.16.0 - v0.18.0)

### ⭐ exp.js - Sistema de Carga de Datos Dinámico

**Ubicación:** `utils/exp.js`

**Qué hace:** Importa datos desde archivos TSV (Tab-Separated Values) a SQLite sin modificar código.

**Uso:**
```bash
# Formato: node utils/exp.js <tabla> <archivo.tsv>
node utils/exp.js demo_clientes forms/demo/demo_clientes.dat

# El archivo TSV:
# - Primera línea = nombres de columnas
# - Líneas siguientes = datos
# - Separador = tabulador
```

**Ventajas:**
- ✅ Agregar catálogos sin tocar código
- ✅ Datos de demo fácilmente editables
- ✅ Migración de datos legacy simple
- ⚠️ `scripts/initCatalogsDB.js` está **obsoleto** - usar exp.js

---

### ⭐ schemaService - Detección Dinámica de Esquemas

**Ubicación:** `src/services/schemaService.js`

**Qué hace:** Detecta tablas y columnas automáticamente usando `sqlite_master` y `PRAGMA table_info()`.

**Métodos clave:**
```javascript
// Verificar si tabla existe
schemaService.tableExists('demo_productos'); // true/false

// Listar todas las tablas
schemaService.getAllTables(); // ['demo_productos', 'demo_categorias', ...]

// Obtener columnas de una tabla
schemaService.getTableColumns('demo_productos'); // [{name, type, ...}, ...]
```

**Ventajas:**
- ✅ Cero configuración para nuevas tablas
- ✅ Validación automática de campos
- ✅ Compatible con cualquier esquema

---

### ⚠️ Advertencia: SQLite en Memoria

**El sistema usa sql.js (SQLite compilado a JavaScript) en memoria:**

**Limitaciones:**
- ❌ Datos solo persisten mientras el servidor corre
- ❌ No soporta múltiples conexiones concurrentes
- ❌ No es adecuado para producción multi-usuario

**Persistencia actual:**
- Exportación manual a `data/catalogs.db` con `saveDatabase()`
- Para producción: migrar a PostgreSQL/MySQL

**Cuándo usar:**
- ✅ Desarrollo local
- ✅ Demos y prototipos
- ✅ Testing
- ❌ Producción con usuarios reales

