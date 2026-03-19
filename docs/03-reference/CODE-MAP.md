# 🗺️ MAPA DE CÓDIGO - NILIX (v2.3.0)

**Propósito:** Índice detallado de líneas de código para navegación rápida
**Última actualización:** 2026-03-11 (v2.3.0 — Nilix Rebranding + Reporte de Ventas)

---

## 📍 ESTRUCTURA PRINCIPAL

```
nilix/
├── server.js                     # nil-runtime — Express + helmet + TLS + compat bridge SF_→NIL_
├── index.html                    # Entry point: header global + layout + CRT toggle
├── login.html                    # Página pública de login
├── report.html                   # Visor de reportes YAML
├── package.json                  # Dependencias
├── .env.example                  # Template con todas las vars NIL_
│
├── js/                           # nil-form + nil-report + nil-explorer frontend
│   ├── main.js                   # ~140 líneas — guard auth + getMenu() + sidebar + CRT
│   ├── api/
│   │   └── client.js             # authFetch() cookie-based; logout(); getMenu(); getFile()
│   ├── components/
│   │   ├── FormRenderer.js       # ~105 líneas — orquestador delgado (v0.21.0)
│   │   ├── FileExplorer.js       # Renderiza ítems de menú (separator/form/report/menu)
│   │   ├── Workspace.js          # loadItem() → FormRenderer o ReportEngine
│   │   ├── form/                 # nil-form modular (v0.21.0)
│   │   │   ├── FormContext.js            # ~73 líneas — estado central, AbortController
│   │   │   ├── LayoutProcessor.js        # ~180 líneas — XML → DOM recursivo, is= virtual
│   │   │   ├── ValidationCoordinator.js  # ~125 líneas — lookups, copy-fields, loadRecord, PAG_SIG/ANT
│   │   │   ├── HandlerBridge.js          # ~100 líneas — POST /api/handler/:handler/after
│   │   │   └── SubmitManager.js          # ~123 líneas — botones CRUD, RADU enforcement
│   │   ├── fieldRenderer/        # Renderizado de campos
│   │   │   ├── index.js          # Exports
│   │   │   ├── Label.js          # ~120 líneas
│   │   │   ├── InputField.js     # ~220 líneas (delega a Autocomplete)
│   │   │   ├── Autocomplete.js   # ~250 líneas (v0.15.0)
│   │   │   ├── Checkbox.js       # ~30 líneas
│   │   │   └── Multifield.js     # ~380 líneas (appendRow, stepper, data-label, mobile cards)
│   │   └── report/               # nil-report — DuckDB-WASM backend (v0.20.0+)
│   │       ├── ReportEngine.js           # ~275 líneas — orquestador principal v2.0
│   │       ├── ReportRenderer.js         # ~270 líneas — zonas → HTML
│   │       ├── AccumulatorManager.js     # ~112 líneas — sum/avg/count/min/max
│   │       ├── BreakDetector.js          # ~66 líneas — control breaks
│   │       ├── ExpressionEvaluator.js    # ~155 líneas — safe parser sin eval
│   │       ├── DataSourceManager.js      # ~315 líneas — DuckDB/JS dual, date normalization
│   │       ├── DuckDBAdapter.js          # ~165 líneas — DuckDB-WASM CDN wrapper
│   │       ├── QueryBuilder.js           # ~175 líneas — YAML → SQL compiler
│   │       ├── parsers/YamlParser.js     # ~120 líneas — YAML → ReportSchema
│   │       └── index.js                  # Exports
│   ├── services/
│   │   ├── LookupService.js      # ~85 líneas — lookup BD + cache invalidation
│   │   ├── TableCache.js         # ~70 líneas — cache nil_catalog_* con invalidación
│   │   ├── RecordService.js      # ~60 líneas — CRUD frontend (v0.16.0)
│   │   └── themeService.js       # Toggle tema dark/light
│   └── utils/
│       ├── validator.js          # Validaciones inline (min/max/pattern/check/between)
│       ├── ExpressionEngine.js   # Expresiones dinámicas + agregados is=
│       └── RADU.js               # canRead/canAdd/canDelete/canUpdate/canWrite (v0.29.0)
│
├── src/                          # nil-runtime backend Node.js
│   ├── routes/
│   │   ├── apiRoutes.js          # Rutas generales
│   │   ├── authRoutes.js         # /auth/login, /auth/logout, /auth/check
│   │   ├── catalogRoutes.js      # GET /api/catalogs/:table
│   │   ├── recordRoutes.js       # CRUD /api/records/:table
│   │   ├── handlerRoutes.js      # /api/handler/:handler/*
│   │   └── publicReportRoutes.js # /api/public/report-data (sin auth)
│   ├── controllers/
│   │   ├── catalogController.js        # Lista catálogos + cache headers
│   │   ├── recordController.js         # CRUD con RADU server-side
│   │   ├── handlerController.js        # Ejecuta handlers con ScopedDb
│   │   ├── filesystemController.js     # getMenu, getContent con authorizedDirs
│   │   └── publicReportController.js   # isReportPublic + resolveEmpresaId
│   ├── services/
│   │   ├── database.js           # sql.js SQLite + saveDatabase()
│   │   ├── authDatabase.js       # auth.db separado + token_blacklist + cleanup
│   │   ├── authService.js        # login() bcrypt+JWT; LoginError; bloqueo 5 intentos
│   │   ├── scopedDb.js           # createScopedDb(rawDb, empresaId) — nil-data
│   │   ├── menuService.js        # Parsea menu.xml recursivo; authorizedDirs; tablePermissions
│   │   ├── handlerService.js     # Carga handlers dinámicos desde $NIL_APP_DIR/apps/
│   │   ├── catalogService.js     # Queries catálogos con whitelist
│   │   ├── recordService.js      # CRUD SQL + navigate (PAG_SIG/ANT)
│   │   └── schemaService.js      # hasColumn(), getAllTables(), tableExists()
│   └── middleware/
│       ├── verifyToken.js        # Lee nil_token cookie → req.empresaId/usuarioId/rol
│       └── auditLog.js           # Registra escrituras + errores con usuarioId+empresaId
│
├── forms/                        # XML del motor (login.xml, etc.)
│   └── login.xml                 # Form login (parte del motor)
│
├── utils/
│   ├── init-auth.js              # Schema auth.db + 3 empresas + 3 usuarios demo
│   ├── init-pizzeria.js          # Demo data: categorías + productos + empresa_config
│   └── exp.js                    # TSV → SQLite
│
├── data/
│   └── auth.db                   # Motor-owned: empresas + usuarios + token_blacklist
│
├── docs/                         # 📚 Documentación
│   ├── 01-getting-started/
│   ├── 02-architecture/          # ANALYSIS-HIERARCHY.md (doc maestra)
│   ├── 03-reference/             # CODE-MAP, CHANGELOG, AUTH, RADU, COMPARATIVA
│   ├── 04-guides/                # GUIA-XML.md, MULTIFIELD-GUIDE.md
│   ├── 05-specs/                 # MENUS-SPEC.md, REP/REP-SPEC.md
│   ├── 06-development/           # ROADMAP.md, MANUAL-DESARROLLO.md
│   └── 07-archive/               # Docs históricos + sessions
│
└── css/
    └── styles.css                # nil-report + nil-form + neobrutalismo terminal
    └── styles.css           # ~1,500 líneas
```

---

## 📍 Autocomplete.js - COMPONENTE NUEVO (v0.15.0)

### createAutocomplete (Líneas 12-55)
```javascript
// Crea el wrapper con input + botón + dropdown
export function createAutocomplete({ id, size, isRequired, isSkip, lookupConfig, selectOptions, defaultValue }) {
    const wrapper = createElement('div', 'autocomplete-wrapper');
    const inputEl = createElement('input');
    const btnEl = createElement('button', 'autocomplete-btn');
    const dropdownEl = createElement('div', 'autocomplete-dropdown');
    // ...
}
```

### attachAutocompleteHandlers (Líneas 57-310)
```javascript
// Handlers principales:
// - loadCatalog() - Carga datos (BD o estáticos)
// - renderOptions() - Renderiza items del dropdown
// - selectItem() - Selecciona item y copia campos
// - openDropdown() / closeDropdown()
// - Tab validation - Valida y carga en Tab
// - F1 - Abre dropdown (estilo terminal)
// - Navegación ↑↓ + Enter
```

### Funciones clave:
- **Línea ~58-87:** `loadCatalog()` - Carga catálogo (BD o estático)
- **Línea ~89-95:** `getKeyField()` / `getDisplayField()` - Campos dinámicos
- **Línea ~97-145:** `renderOptions()` - Renderiza opciones filtradas
- **Línea ~155-172:** `selectItem()` - Selecciona y copia campos
- **Línea ~226-255:** Tab validation - Valida y carga datos
- **Línea ~265-290:** Navegación keyboard (↑↓, Enter, Escape)

**Para modificar:**
- **Texto placeholder:** Línea ~125
- **Filtrado:** Línea ~107-113
- **Formato de item:** Línea ~122-136
- **Tab behavior:** Línea ~233-255

---

## 📍 main.js - INICIALIZACIÓN (v0.11.0)

### Theme Toggle Global (Líneas 10-18)

```javascript
// Línea ~10-13: Referencia al botón de tema en header global
const themeBtn = document.getElementById('theme-btn');
if (themeBtn) {
    themeBtn.textContent = isDark() ? '☀️' : '🌙';
    themeBtn.addEventListener('click', () => {
        toggleTheme();
        themeBtn.textContent = isDark() ? '☀️' : '🌙';
    });
}
```

### Sidebar Toggle (Líneas 20-48)

```javascript
// Línea ~20-23: Referencias DOM
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const MOBILE_BREAKPOINT = 650;

// Línea ~26-35: Event listener toggle
sidebarToggle.addEventListener('click', () => { ... });

// Línea ~37-46: Resize listener (limpia clases al cambiar tamaño)
window.addEventListener('resize', () => { ... });
```

### Auto-cierre en móvil (Líneas 73-77)

```javascript
// Al seleccionar archivo .xml en móvil, cerrar sidebar
if (window.innerWidth <= MOBILE_BREAKPOINT && node.name?.endsWith('.xml')) {
    sidebar.classList.remove('open');
    sidebarToggle.classList.remove('active');
}
```

**Para modificar:**
- **Breakpoint:** Línea 22 → `MOBILE_BREAKPOINT = 650`
- **Icono tema:** Línea 13 → `themeBtn.textContent`
- **Animación hamburguesa:** `styles.css` líneas ~141-163

---

## 📍 styles.css - GLOBAL HEADER (v0.11.0)

### Global Header (Líneas ~73-115)

```css
/* Línea ~73: Layout del sistema */
#os-interface {
    display: flex;
    height: calc(100vh - 48px); /* Altura menos header */
    width: 100vw;
}

/* Línea ~81: Header global */
#global-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 48px;
    padding: 0 1rem;
    background: var(--sidebar-bg);
    border-bottom: 2px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 1002;
}

/* Línea ~96: Título */
.header-title {
    font-family: var(--label-font);
    font-size: 1.2rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--text-color);
}
```

### Hamburguesa Button (Líneas ~122-163)

```css
/* Línea ~125: Botón dentro del header */
.hamburger-btn {
    background: transparent;
    border: 2px solid var(--border-color);
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* Línea ~141: Animación a X cuando está activo */
.hamburger-btn.active span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
}
```

### Mobile Responsive (Líneas ~1150-1200)

```css
/* Línea ~1150: Media query móvil */
@media (max-width: 650px) {
    /* Sidebar debajo del header */
    #sidebar {
        position: fixed;
        left: 0;
        top: 48px;  /* Debajo del header */
        height: calc(100vh - 48px);
    }
    
    /* Header compacto */
    .header-title { font-size: 1rem; letter-spacing: 1px; }
    #global-header { padding: 0 0.5rem; }
}
```

**Para modificar:**
- **Altura header:** `styles.css` línea ~88 → `height: 48px`
- **Estilo título:** `styles.css` líneas ~96-105
- **Sidebar en móvil:** `styles.css` línea ~1163 → `top: 48px`

---

## 📍 UiComponents.js - HEADER DEL FORM (v0.11.0)

### createHeader (Líneas 22-35)

```javascript
// Solo crea título y db-info, SIN toggle de tema
createHeader({ title, database }) {
    const header = createElement('div', 'window-header');
    
    const infoDiv = createElement('div', '', '', [
        createElement('span', 'window-title', title),
        createElement('span', 'db-info', `DB: ${database}`)
    ]);

    header.appendChild(infoDiv);
    return header;
}
```

**Nota:** El toggle de tema ahora está en el header global (ver `main.js`)

---

## 📍 index.html - ESTRUCTURA (v0.11.0)

```html
<body>
    <!-- Header Global (Brutalist) -->
    <header id="global-header">
        <div class="header-left">
            <button id="sidebar-toggle" class="hamburger-btn">...</button>
            <h1 class="header-title">NILIX</h1>
        </div>
        <div class="header-right">
            <button id="theme-btn" class="theme-toggle"></button>
        </div>
    </header>

    <!-- Interfaz Principal -->
    <div id="os-interface">
        <aside id="sidebar">...</aside>
        <main id="workspace">...</main>
    </div>
</body>
```

---

## 📍 InputField.js - SELECT (v0.12.0)

### createInputElement - Select (Líneas 34-68)

```javascript
// Línea ~34-68: Detectar y renderizar select
if (type === 'select') {
    inputEl = createElement('select');
    
    // Opción vacía si no es requerido
    if (!isRequired) {
        const emptyOpt = createElement('option');
        emptyOpt.textContent = '-- Seleccione --';
        inputEl.appendChild(emptyOpt);
    }
    
    // Agregar opciones del XML
    selectOptions.forEach(opt => {
        const option = createElement('option');
        option.value = opt.value;
        option.textContent = opt.textContent;
        inputEl.appendChild(option);
    });
}
```

**Para modificar:**
- **Texto opción vacía:** Línea ~45 → `'-- Seleccione --'`
- **Agregar atributos a option:** Línea ~52

---

## 📍 FormRenderer.js - EXTRACT OPTIONS (v0.12.0)

### extractFieldConfig - Select Options (Líneas 465-478)

```javascript
// Línea ~465-478: Extraer opciones para select
if (type === 'select') {
    const optionsXml = fieldXml.querySelectorAll('options > option');
    if (optionsXml.length > 0) {
        selectOptions = Array.from(optionsXml).map(opt => ({
            value: opt.getAttribute('value'),
            textContent: opt.textContent.trim()
        }));
    }
}
```

---

## 📍 styles.css - SELECT (v0.12.0)

### Select Brutalist Styles (Líneas ~558-600)

```css
select {
    background-color: var(--input-bg);
    border: 2px solid var(--input-border);
    border-radius: 0; /* Brutalist */
    appearance: none;
    background-image: url("data:image/svg+xml,..."); /* Arrow verde */
    cursor: pointer;
}
```

**Para modificar:**
- **Color arrow SVG:** Línea ~567 → `fill='%2300ff00'`
- **Padding:** Línea ~562 → `padding: 0.4rem 2rem 0.4rem 0.5rem`

### SECCIÓN 1: Helpers y Utilidades (Líneas 1-200)

```javascript
// Línea ~10-20: createElement helper
const createElement = (tag) => document.createElement(tag);

// Línea ~25-60: createHelpIcon
// Crea el icono [?] verde phosphor
const createHelpIcon = (fieldId) => { ... }

// Línea ~65-110: toggleHelpTooltip
// Toggle visibility del tooltip de ayuda
const toggleHelpTooltip = (helpIcon) => { ... }

// Línea ~115-145: createHelpTooltip
// Crea el tooltip terminal-style
const createHelpTooltip = (fieldId, helpMsg) => { ... }

// Línea ~150-200: Event listeners para tooltips
// ESC key, click outside, etc.
document.addEventListener('keydown', (e) => { ... });
document.addEventListener('click', (e) => { ... });
```

**Para modificar:**
- **Icono de ayuda:** Línea ~30 → `icon.textContent = '[?]'`
- **Color del icono:** `styles.css` línea ~475
- **Posición tooltip:** `styles.css` línea ~520
- **Comportamiento toggle:** Línea ~70-90

---

### SECCIÓN 2: FormRenderer Class Constructor (Líneas 200-250)

```javascript
// Línea ~205: Class definition
class FormRenderer {
    constructor(validator, persistenceService, expressionEngine) {
        this.validator = validator;
        this.persistence = persistenceService;
        this.expressions = expressionEngine;
        this.messages = {};
        this.formData = {};
    }
}
```

**Para modificar:**
- **Agregar nueva dependencia:** Línea ~207 (ej: `this.apiService = apiService`)
- **Inicializar estado:** Línea ~210-215

---

### SECCIÓN 3: Parsing XML (Líneas 250-340)

```javascript
// Línea ~255: loadForm
async loadForm(formPath) {
    const response = await fetch(formPath);
    const xmlText = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, 'text/xml');
}

// Línea ~280: parseMessages
// Extrae mensajes de ayuda del XML
parseMessages(formXml) {
    const messagesSection = formXml.querySelector('messages');
    if (!messagesSection) return {};

    const messages = {};
    messagesSection.querySelectorAll('message').forEach(msg => {
        const id = msg.getAttribute('id');
        messages[id] = msg.textContent;
    });
    return messages;
}

// Línea ~310: extractFormConfig
// Extrae atributos del form (title, database, etc.)
extractFormConfig(formXml) { ... }
```

**Para modificar:**
- **Agregar nuevo atributo de form:** Línea ~315-330
- **Cambiar formato de mensajes:** Línea ~285-305

---

### SECCIÓN 4: Label Creation (Líneas 340-390)

```javascript
// Línea ~346: createLabel
const createLabel = (id, labelTxt, isRequired, helpId, messages) => {
    const labelEl = createElement('label');
    labelEl.htmlFor = id;

    // Línea ~355: Agregar help icon si existe
    if (helpId && messages[helpId]) {
        const helpIcon = createHelpIcon(id);
        labelEl.appendChild(helpIcon);
        labelEl.appendChild(document.createTextNode(' '));

        // Línea ~365: Event listener para tooltip
        helpIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // ⚠️ CRÍTICO: previene cierre inmediato
            toggleHelpTooltip(helpIcon);
        });

        // Línea ~375: Crear tooltip
        const tooltip = createHelpTooltip(id, messages[helpId]);
        labelEl.appendChild(tooltip);
    }

    // Línea ~385: Texto del label
    labelEl.appendChild(document.createTextNode(labelTxt));
    if (isRequired) {
        labelEl.appendChild(document.createTextNode(' *'));
    }

    return labelEl;
};
```

**Para modificar:**
- **Posición del icono [?]:** Línea ~355 (antes o después del texto)
- **Asterisco de required:** Línea ~387
- **Tooltip trigger:** Línea ~365 (click → hover)

---

### SECCIÓN 5: Input Field Rendering (Líneas 390-550)

```javascript
// Línea ~395: renderInputField (MÉTODO PRINCIPAL)
renderInputField(config, messages, parentContainer) {
    const {
        id, type, label, size, isRequired, isSkip,
        displayOnly, defaultValue, helpId, validationXml, rows
    } = config;

    // Línea ~405: Input group container
    const inputGroup = createElement('div');
    inputGroup.className = 'input-group';

    // Línea ~410: Crear input según tipo
    let inputEl;

    // Línea ~415: Textarea
    if (type === 'textarea') {
        inputEl = createElement('textarea');
        inputEl.style.width = '100%';
        inputEl.style.maxWidth = '100%';
        inputEl.rows = rows || 3; // ⚠️ Default: 3 líneas
    }
    // Línea ~425: Otros tipos
    else {
        inputEl = createElement('input');
        inputEl.type = type;
    }

    inputEl.id = id;
    inputEl.name = id;

    // Línea ~440: Size/width
    if (size) {
        if (type === 'textarea') {
            inputEl.maxLength = parseInt(size);
        } else {
            inputEl.size = parseInt(size);
        }
    }

    // Línea ~455: Width específico por tipo
    if (type === 'date') {
        inputEl.style.width = '17ch'; // ⚠️ Ajustado para dd/mm/yyyy
        inputEl.style.maxWidth = '17ch';
    } else if (type === 'time') {
        inputEl.style.width = '12ch';
    } else if (type === 'number') {
        inputEl.style.width = size ? `${size + 2}ch` : '15ch';
    }

    // Línea ~475: Display only (readonly)
    if (displayOnly) {
        inputEl.readOnly = true;
        inputEl.classList.add('display-only');
    }

    // Línea ~485: Skip (no focuseable)
    if (isSkip) {
        inputEl.tabIndex = -1;
        inputEl.readOnly = true;
        inputEl.classList.add('skip-field');
    }

    // Línea ~495: Default value
    if (defaultValue) {
        if (defaultValue === 'today') {
            inputEl.value = new Date().toISOString().split('T')[0];
        } else {
            inputEl.value = defaultValue;
        }
    }

    // Línea ~510: Label
    if (label) {
        const labelEl = createLabel(id, label, isRequired, helpId, messages);
        inputGroup.appendChild(labelEl);
    }

    // Línea ~520: Append input
    inputGroup.appendChild(inputEl);

    // Línea ~525: Validaciones
    if (validationXml) {
        this.attachValidation(inputEl, validationXml, id);
    }

    // Línea ~535: Append to parent
    parentContainer.appendChild(inputGroup);

    return inputEl;
}
```

**Para modificar:**
- **Agregar nuevo tipo de input:** Línea ~410-430
- **Cambiar default de textarea:** Línea ~420
- **Ajustar width de date:** Línea ~455
- **Modificar placeholder:** Línea ~500 (agregar `inputEl.placeholder`)

---

### SECCIÓN 6: Container Rendering (Líneas 550-650)

```javascript
// Línea ~555: renderContainer
renderContainer(containerXml, parentEl) {
    const type = containerXml.getAttribute('type') || 'vertical';

    // Línea ~560: Crear container div
    const containerDiv = createElement('div');
    containerDiv.className = `container-${type}`;

    // Línea ~565: Aligned labels (solo vertical)
    const alignedLabels = containerXml.getAttribute('aligned_labels');
    if (type === 'vertical' && alignedLabels === 'true') {
        containerDiv.classList.add('aligned-labels');
    }

    // Línea ~575: Renderizar campos hijos
    containerXml.querySelectorAll(':scope > field').forEach(fieldXml => {
        this.renderField(fieldXml, containerDiv);
    });

    // Línea ~585: Renderizar sub-containers
    containerXml.querySelectorAll(':scope > container').forEach(subXml => {
        this.renderContainer(subXml, containerDiv);
    });

    // Línea ~595: Append to parent
    parentEl.appendChild(containerDiv);
}
```

**Para modificar:**
- **Agregar nuevo tipo de container:** Línea ~560
- **Cambiar comportamiento aligned_labels:** Línea ~565-573
- **Agregar nesting limit:** Línea ~575 (contador de profundidad)

---

### SECCIÓN 7: Validaciones (Líneas 650-740)

```javascript
// Línea ~655: attachValidation
attachValidation(inputEl, validationXml, fieldId) {
    inputEl.addEventListener('blur', () => {
        let isValid = true;
        let errorMsg = '';

        // Línea ~665: Required
        const requiredXml = validationXml.querySelector('required');
        if (requiredXml && requiredXml.textContent === 'true') {
            if (!inputEl.value.trim()) {
                isValid = false;
                errorMsg = 'Este campo es obligatorio';
            }
        }

        // Línea ~680: Check expression
        const checkXml = validationXml.querySelector('check');
        if (checkXml && inputEl.value) {
            const expr = checkXml.textContent;
            const result = this.expressions.evaluate(expr, {
                this: inputEl.value,
                ...this.formData
            });

            if (!result) {
                isValid = false;
                errorMsg = `Validación falló: ${expr}`;
            }
        }

        // Línea ~700: Between
        const betweenXml = validationXml.querySelector('between');
        if (betweenXml && inputEl.value) {
            const min = parseFloat(betweenXml.getAttribute('min'));
            const max = parseFloat(betweenXml.getAttribute('max'));
            const val = parseFloat(inputEl.value);

            if (val < min || val > max) {
                isValid = false;
                errorMsg = `Debe estar entre ${min} y ${max}`;
            }
        }

        // Línea ~720: Mostrar error
        if (!isValid) {
            inputEl.classList.add('error');
            this.showError(fieldId, errorMsg);
        } else {
            inputEl.classList.remove('error');
            this.hideError(fieldId);
        }
    });
}

// Línea ~738: showError
showError(fieldId, message) { ... }
```

**Para modificar:**
- **Agregar nueva validación:** Línea ~700-715 (similar a between)
- **Cambiar trigger:** Línea ~656 ('blur' → 'input')
- **Personalizar mensajes:** Línea ~670, 690, 710

---

### SECCIÓN 8: Multifield Detection (Líneas 740-780)

```javascript
// Línea ~744: isTextareaMultifield
// Detecta si multifield es textarea (1 campo hijo)
isTextareaMultifield(multifieldXml) {
    const childFields = multifieldXml.querySelectorAll(':scope > field');
    return childFields.length === 1;
}

// Línea ~755: isGridMultifield
// Detecta si multifield es grid (múltiples campos hijos)
isGridMultifield(multifieldXml) {
    const childFields = multifieldXml.querySelectorAll(':scope > field');
    return childFields.length > 1;
}

// Línea ~767: renderMultifield (ROUTER)
// Decide qué tipo de multifield renderizar
renderMultifield(fieldXml, parentContainer, config) {
    if (this.isTextareaMultifield(fieldXml)) {
        this.renderTextareaFromMultifield(fieldXml, parentContainer, config);
    } else if (this.isGridMultifield(fieldXml)) {
        this.renderGridFromMultifield(fieldXml, parentContainer, config);
    } else {
        console.warn(`⚠️ Multifield sin campos hijos: ${config.id}`);
    }
}
```

**Para modificar:**
- **Cambiar criterio de detección:** Línea ~745 o ~756
- **Agregar tercer tipo:** Línea ~770 (ej: list view)

---

### SECCIÓN 9: Multifield → Textarea (Líneas 780-820)

```javascript
// Línea ~786: renderTextareaFromMultifield
renderTextareaFromMultifield(fieldXml, parentContainer, config) {
    const childField = fieldXml.querySelector(':scope > field');
    const childId = childField.getAttribute('id');

    // Línea ~795: Extraer atributos
    const rows = parseInt(fieldXml.getAttribute('rows')) || 100;
    const display = parseInt(fieldXml.getAttribute('display')) || 10;
    const displayOnly = childField.getAttribute('display-only') === 'true';

    // Línea ~805: Calcular maxLength
    // Fórmula: rows × 80 caracteres/línea
    const maxLength = rows * 80;

    // Línea ~810: Config para renderInputField
    const textareaConfig = {
        id: childId,
        type: 'textarea',
        label: config.label,
        size: maxLength,
        rows: display, // ⚠️ Display = filas visibles
        isRequired: false,
        isSkip: displayOnly,
        displayOnly: displayOnly,
        helpId: config.helpId
    };

    // Línea ~825: Renderizar como textarea normal
    this.renderInputField(textareaConfig, this.messages, parentContainer);
}
```

**Para modificar:**
- **Cambiar cálculo maxLength:** Línea ~805 (ej: `rows * 100`)
- **Default rows si no especificado:** Línea ~795
- **Agregar scroll behavior:** Agregar CSS custom

---

### SECCIÓN 10-B: Multifield — Funciones post-v1.7.0 (mobile + POS)

```javascript
// _getColumns(thead) — extrae metadatos de columnas desde <th>
// v1.7.0: agrega col.size (data-size) para stepper
// v1.9.0: agrega col.label (textContent) para data-label en cards móvil
{
    id, label, isSkip, isUnique, type, isExpr, check, size
}

// _buildRow(multifieldId, columns, rowData, absoluteIndex)
// v1.9.0: row.dataset.empty = 'true' si !rowData (fila filler → oculta en móvil)
// v1.9.0: td.dataset.label = col.label (alimenta CSS content: attr(data-label))
// v1.9.0: actionTd.dataset.label = '' (celda acción sin label)

// _buildStepperCell(multifieldId, col, rowData, absoluteIndex)
// v1.7.0: usa col.size para ancho (size+0.5)ch, max 10^size-1, zero-pad padStart(size,'0')

// Multifield.appendRow(fieldId, rowData, formEl) — static (v1.8.0)
// Agrega una sola fila al carrito sin reemplazar las existentes
// Llamado desde ValidationCoordinator cuando result.appendRow está presente
static appendRow(fieldId, rowData, formEl) {
    const grid = formEl.querySelector(`[data-multifield-id="${fieldId}"]`);
    // push rowData a allRows → _rerenderGrid
}
```

### SECCIÓN 10: Multifield → Grid (Líneas 820-1050)

```javascript
// Línea ~822: renderGridFromMultifield (MÉTODO LARGO)
renderGridFromMultifield(fieldXml, parentContainer, config) {
    const childFields = fieldXml.querySelectorAll(':scope > field');
    const rows = parseInt(fieldXml.getAttribute('rows')) || 10;
    const display = parseInt(fieldXml.getAttribute('display')) || 5;

    // Línea ~835: Container principal
    const gridContainer = createElement('div');
    gridContainer.className = 'multifield-grid';
    gridContainer.id = config.id;

    // Línea ~845: Label del multifield
    if (config.label) {
        const labelEl = createElement('label');
        labelEl.textContent = config.label.toUpperCase();
        gridContainer.appendChild(labelEl);
    }

    // Línea ~860: Crear tabla
    const table = createElement('table');
    table.className = 'multifield-table';

    // Línea ~870: THEAD (encabezados)
    const thead = createElement('thead');
    const headerRow = createElement('tr');

    childFields.forEach(fieldXml => {
        const th = createElement('th');
        const label = fieldXml.getAttribute('label') || fieldXml.getAttribute('id');
        th.textContent = label;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Línea ~895: TBODY (filas de datos)
    const tbody = createElement('tbody');

    for (let i = 0; i < display; i++) {
        const tr = createElement('tr');
        tr.setAttribute('data-row-index', i);

        // Línea ~905: Celdas (una por campo hijo)
        childFields.forEach(fieldXml => {
            const td = createElement('td');

            const fieldId = fieldXml.getAttribute('id');
            const fieldType = fieldXml.getAttribute('type') || 'text';
            const displayOnly = fieldXml.getAttribute('display-only') === 'true';
            const skip = fieldXml.getAttribute('skip') === 'true';

            // Línea ~920: Input en celda
            const input = createElement('input');
            input.type = fieldType;
            input.name = `${config.id}_${fieldId}_${i}`;
            input.className = 'multifield-cell-input';

            // Línea ~930: Readonly si display-only o skip
            if (displayOnly || skip) {
                input.readOnly = true;
                input.tabIndex = -1;
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    gridContainer.appendChild(table);

    // Línea ~955: Controles de navegación (si rows > display)
    if (rows > display) {
        const controls = createElement('div');
        controls.className = 'multifield-controls';

        // Línea ~965: Botón Anterior
        const prevBtn = createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = '← Anterior';
        prevBtn.className = 'multifield-nav-btn';
        prevBtn.disabled = true; // Primera página

        // Línea ~975: Indicador (ej: "1-7 de 50")
        const indicator = createElement('span');
        indicator.className = 'multifield-indicator';
        indicator.textContent = `1-${display} de ${rows}`;

        // Línea ~985: Botón Siguiente
        const nextBtn = createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = 'Siguiente →';
        nextBtn.className = 'multifield-nav-btn';

        // Línea ~995: Event listeners
        let currentPage = 0;
        const totalPages = Math.ceil(rows / display);

        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                // ⚠️ TODO: Cargar datos de página anterior
                updateIndicator();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                currentPage++;
                // ⚠️ TODO: Cargar datos de página siguiente
                updateIndicator();
            }
        });

        // Línea ~1020: Actualizar indicador
        const updateIndicator = () => {
            const start = currentPage * display + 1;
            const end = Math.min((currentPage + 1) * display, rows);
            indicator.textContent = `${start}-${end} de ${rows}`;

            prevBtn.disabled = currentPage === 0;
            nextBtn.disabled = currentPage === totalPages - 1;
        };

        // Línea ~1035: Append controles
        controls.appendChild(prevBtn);
        controls.appendChild(indicator);
        controls.appendChild(nextBtn);
        gridContainer.appendChild(controls);
    }

    // Línea ~1045: Append to parent
    parentContainer.appendChild(gridContainer);
}
```

**Para modificar:**
- **Headers de tabla:** Línea ~870-890
- **Estructura de celda:** Línea ~905-940
- **Botones de navegación:** Línea ~965-1010
- **Carga dinámica de datos:** Línea ~1000 (agregar fetch)
- **Agregar botones CRUD:** Línea ~1040 (antes de append)

---

## 📍 styles.css - ÍNDICE COMPLETO

### SECCIÓN 1: Variables CSS (Líneas 1-60)

```css
/* Línea ~10: Root variables */
:root {
    --bg-color: #1a1a1a;              /* Fondo terminal */
    --text-color: #e0e0e0;            /* Texto principal */
    --border-color: #333;             /* Bordes containers */
    --input-border: #555;             /* Bordes inputs */
    --label-font: 'JetBrains Mono', 'Courier New', monospace;
    --help-icon-color: #00ff00;       /* Verde phosphor */
    --help-bg: #0a0a0a;               /* Fondo tooltips */
    --error-color: #ff4444;           /* Rojo para errores */
}

/* Línea ~30: Dark mode (default) */
body {
    background: var(--bg-color);
    color: var(--text-color);
    font-family: var(--label-font);
    margin: 0;
    padding: 20px;
}
```

**Para modificar:**
- **Cambiar color phosphor:** Línea ~17 (ej: `#00aaff` para azul)
- **Cambiar fuente:** Línea ~16 (agregar nueva fuente)
- **Light mode:** Agregar media query después línea ~40

---

### SECCIÓN 2: Terminal Window (Líneas 60-150)

```css
/* Línea ~65: Terminal window principal */
.terminal-window {
    border: 3px solid var(--border-color); /* ⚠️ Brutalist: 3px */
    border-radius: 0;                       /* ⚠️ Sin esquinas redondeadas */
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
    background: var(--bg-color);
    box-shadow: none;                       /* ⚠️ Sin sombras */
    overflow: visible;                      /* ⚠️ Para tooltips */
}

/* Línea ~85: Form title */
.form-title {
    font-family: var(--label-font);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 1.2rem;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
}
```

**Para modificar:**
- **Grosor de borde:** Línea ~66
- **Padding interno:** Línea ~68
- **Max width:** Línea ~69
- **Shadow (desactivado):** Línea ~72

---

### SECCIÓN 3: Containers (Líneas 150-250)

```css
/* Línea ~155: Container vertical (default) */
.container-vertical {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
}

/* Línea ~170: Container horizontal */
.container-horizontal {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    align-items: flex-start; /* ⚠️ Labels arriba */
    margin-bottom: 1rem;
}

/* Línea ~185: Campos en horizontal */
.container-horizontal .input-group {
    flex: 0 0 auto; /* No crecer, no encoger */
}

/* Línea ~195: Labels aligned (vertical only) */
.aligned-labels {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem 1rem;
    align-items: start;
}

.aligned-labels label {
    grid-column: 1;
    justify-self: end;
    padding-top: 0.4rem;
}

.aligned-labels input,
.aligned-labels textarea {
    grid-column: 2;
}
```

**Para modificar:**
- **Gap entre campos:** Línea ~158 o ~173
- **Alineación horizontal:** Línea ~175
- **Grid columns en aligned:** Línea ~198

---

### SECCIÓN 4: Input Groups y Labels (Líneas 250-380)

```css
/* Línea ~255: Input group */
.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    overflow: visible; /* ⚠️ Para tooltips */
}

/* Línea ~270: Labels */
label {
    font-family: var(--label-font);
    text-transform: uppercase;        /* ⚠️ Brutalist */
    font-size: 0.85rem;
    letter-spacing: 0.5px;            /* ⚠️ Spacing */
    color: var(--text-color);
    font-weight: 500;
    position: relative;               /* Para tooltips */
}

/* Línea ~290: Asterisco required */
label::after {
    /* Se renderiza directamente en JS, no con ::after */
}
```

**Para modificar:**
- **Uppercase labels:** Línea ~272 (eliminar para normal case)
- **Tamaño de fuente:** Línea ~273
- **Letter spacing:** Línea ~274

---

### SECCIÓN 5: Inputs y Textareas (Líneas 380-500)

```css
/* Línea ~385: Inputs generales */
input,
textarea,
select {
    font-family: var(--label-font);
    background: var(--bg-color);
    color: var(--text-color);
    border: 2px solid var(--input-border); /* ⚠️ Brutalist: 2px */
    border-radius: 0;                       /* ⚠️ Sin redondeo */
    padding: 0.4rem !important;             /* ⚠️ Compacto */
    font-size: 0.95rem;
    transition: none;                       /* ⚠️ Sin animaciones */
}

/* Línea ~410: Focus state */
input:focus,
textarea:focus,
select:focus {
    outline: 2px solid var(--help-icon-color); /* Verde phosphor */
    outline-offset: 2px;
    border-color: var(--help-icon-color);
}

/* Línea ~425: Placeholder */
input::placeholder,
textarea::placeholder {
    color: var(--help-icon-color);  /* ⚠️ Verde phosphor */
    opacity: 0.5;
}

/* Línea ~440: Display only (readonly) */
input.display-only,
textarea.display-only {
    background: #0a0a0a;
    border-color: #444;
    cursor: not-allowed;
    color: #999;
}

/* Línea ~455: Skip field */
.skip-field {
    opacity: 0.6;
    pointer-events: none;
}
```

**Para modificar:**
- **Padding de inputs:** Línea ~393
- **Grosor de borde:** Línea ~392
- **Color de placeholder:** Línea ~427
- **Focus outline:** Línea ~413

---

### SECCIÓN 6: Help System (Tooltips) (Líneas 500-600)

```css
/* Línea ~505: Help icon [?] */
.help-icon {
    font-family: var(--label-font);
    font-size: 0.75rem;
    color: var(--help-icon-color);  /* ⚠️ Verde phosphor #00ff00 */
    cursor: pointer;
    padding: 0;
    margin-right: 0.3rem;
    display: inline-block;
    border: none;
    background: none;
    transition: text-shadow 0.2s;
}

/* Línea ~525: Hover effect */
.help-icon:hover {
    text-shadow: 0 0 8px rgba(0, 255, 0, 0.6); /* ⚠️ Glow effect */
}

/* Línea ~535: Tooltip container */
.help-tooltip {
    position: absolute;
    top: 100%;              /* ⚠️ Debajo del label */
    left: 0;
    z-index: 9999;          /* ⚠️ Máxima prioridad */
    background: var(--help-bg);
    border: 2px solid var(--help-icon-color);
    padding: 0.5rem;
    min-width: 250px;
    max-width: 400px;
    margin-top: 0.3rem;
    display: none;          /* Hidden by default */
    font-family: var(--label-font);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* Línea ~560: Tooltip visible */
.help-tooltip.visible {
    display: block;
}

/* Línea ~570: Help prompt ("> help campo") */
.help-prompt {
    color: var(--help-icon-color);
    margin-bottom: 0.3rem;
    font-weight: bold;
    font-size: 0.8rem;
}

/* Línea ~585: Help message */
.help-msg {
    color: var(--text-color);
    font-size: 0.75rem;        /* ⚠️ Más pequeño */
    padding: 1px 5px;          /* ⚠️ Padding minimal */
    line-height: 1.4;
    word-wrap: break-word;
    max-width: 100%;
}
```

**Para modificar:**
- **Color del icono:** Línea ~509
- **Posición tooltip:** Línea ~537-538 (top/bottom)
- **Tamaño tooltip:** Línea ~543-544
- **Glow intensity:** Línea ~527
- **Prompt style:** Línea ~572-576

---

### SECCIÓN 7: Multifield Styles (Líneas 600-800)

```css
/* Línea ~605: Multifield grid container */
.multifield-grid {
    border: 2px solid var(--border-color);
    border-radius: 0;               /* Brutalist */
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--bg-color);
    overflow-x: auto;               /* Scroll horizontal si necesario */
}

/* Línea ~625: Multifield table */
.multifield-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--label-font);
    font-size: 0.9rem;
}

/* Línea ~640: Table headers */
.multifield-table thead {
    background: var(--border-color);
    color: var(--bg-color);         /* ⚠️ Invertido */
}

.multifield-table th {
    padding: 0.5rem;
    text-align: left;
    text-transform: uppercase;
    font-weight: 600;
    border: 1px solid var(--input-border);
}

/* Línea ~665: Table body */
.multifield-table td {
    padding: 0.3rem;
    border: 1px solid var(--input-border);
}

/* Línea ~680: Row hover */
.multifield-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
}

/* Línea ~690: Cell inputs */
.multifield-cell-input {
    width: 100%;
    padding: 0.3rem !important;     /* ⚠️ Más compacto que inputs normales */
    border: 1px solid var(--input-border);
    border-radius: 0;
    background: var(--bg-color);
    color: var(--text-color);
    font-family: var(--label-font);
    font-size: 0.85rem;
}

/* Línea ~710: Cell input readonly */
.multifield-cell-input:read-only {
    background: #0a0a0a;
    border-color: #444;
    color: #999;
}

/* Línea ~725: Navigation controls */
.multifield-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--help-bg);
    border-top: 2px solid var(--border-color);
    margin-top: 0.5rem;
}

/* Línea ~745: Nav buttons */
.multifield-nav-btn {
    background: var(--bg-color);
    color: var(--text-color);
    border: 2px solid var(--input-border);
    border-radius: 0;               /* Brutalist */
    padding: 0.4rem 1rem;
    cursor: pointer;
    font-family: var(--label-font);
    font-size: 0.85rem;
    transition: none;
}

.multifield-nav-btn:hover:not(:disabled) {
    background: var(--border-color);
    border-color: var(--help-icon-color);
}

.multifield-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* Línea ~780: Indicator */
.multifield-indicator {
    font-family: var(--label-font);
    font-size: 0.85rem;
    color: var(--text-color);
}
```

**Para modificar:**
- **Header background:** Línea ~642
- **Cell padding:** Línea ~693
- **Row hover effect:** Línea ~681
- **Button styles:** Línea ~746-763

---

### SECCIÓN 8: Buttons (Submit/Clear) (Líneas 800-900)

```css
/* Línea ~805: Form buttons */
.form-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
    justify-content: flex-start;
}

/* Línea ~820: Button base */
button[type="submit"],
button[type="reset"],
.btn {
    font-family: var(--label-font);
    background: var(--bg-color);
    color: var(--text-color);
    border: 2px solid var(--input-border);
    border-radius: 0;               /* Brutalist */
    padding: 0.6rem 1.5rem;
    cursor: pointer;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: none;
}

/* Línea ~850: Button hover */
button[type="submit"]:hover,
button[type="reset"]:hover {
    background: var(--border-color);
    border-color: var(--help-icon-color);
}

/* Línea ~865: Submit button (primary) */
button[type="submit"] {
    border-color: var(--help-icon-color);
    color: var(--help-icon-color);
}
```

**Para modificar:**
- **Button padding:** Línea ~827
- **Hover effect:** Línea ~852-854
- **Primary color:** Línea ~866-868

---

### SECCIÓN 9: Error States (Líneas 900-950)

```css
/* Línea ~905: Error input */
input.error,
textarea.error {
    border-color: var(--error-color);
    border-width: 2px;
}

/* Línea ~920: Error message */
.error-message {
    color: var(--error-color);
    font-size: 0.75rem;
    margin-top: 0.2rem;
    font-family: var(--label-font);
    display: none;
}

.error-message.visible {
    display: block;
}
```

**Para modificar:**
- **Error color:** Variable línea ~19
- **Error border:** Línea ~907-908
- **Message size:** Línea ~922

---

## 📍 Validator.js - ÍNDICE

```javascript
// Línea ~5: Class definition
class Validator {
    constructor() {
        this.rules = {};
    }

    // Línea ~15: validateRequired
    validateRequired(value) {
        return value !== null && value !== undefined && value.trim() !== '';
    }

    // Línea ~25: validateNumeric
    validateNumeric(value, min, max) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (min !== undefined && num < min) return false;
        if (max !== undefined && num > max) return false;
        return true;
    }

    // Línea ~40: validateEmail
    validateEmail(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    // Línea ~50: validateDate
    validateDate(value) {
        const date = new Date(value);
        return !isNaN(date.getTime());
    }

    // Línea ~60: validateBetween
    validateBetween(value, min, max) {
        const num = parseFloat(value);
        return num >= min && num <= max;
    }

    // Línea ~70: validatePattern (regex)
    validatePattern(value, pattern) {
        const regex = new RegExp(pattern);
        return regex.test(value);
    }
}
```

**Para agregar validación:**
```javascript
// Línea ~80: Nueva validación
validateMultipleOf(value, multiple) {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    return num % multiple === 0;
}
```

---

## 📍 ExpressionEngine.js - ÍNDICE

```javascript
// Línea ~5: Class definition
class ExpressionEngine {
    constructor() {
        this.context = {};
    }

    // Línea ~15: evaluate
    evaluate(expr, context) {
        // Reemplazar 'this' por valor actual
        let processedExpr = expr.replace(/this/g, context.this);

        // Evaluar expresión
        try {
            return eval(processedExpr);
        } catch (e) {
            console.error('Expression error:', e);
            return false;
        }
    }

    // Línea ~35: evaluateWithFields
    // Permitir referencias a otros campos
    evaluateWithFields(expr, formData) {
        const context = { ...formData };

        // Reemplazar nombres de campos por sus valores
        for (const [key, value] of Object.entries(formData)) {
            expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
        }

        return this.evaluate(expr, context);
    }
}
```

**Para agregar funciones:**
```javascript
// Línea ~55: Funciones agregadas para multifields
sum(fieldId, multifieldData) {
    return multifieldData[fieldId].reduce((acc, val) => acc + val, 0);
}

avg(fieldId, multifieldData) {
    const values = multifieldData[fieldId];
    return this.sum(fieldId, multifieldData) / values.length;
}
```

---

## 🎯 QUICK REFERENCE: CAMBIOS COMUNES

### Cambio: Agregar type="select"

1. **FormRenderer.js** línea ~400:
```javascript
if (type === 'select') {
    inputEl = createElement('select');
    // ... (ver sección completa en manual)
}
```

2. **styles.css** línea ~440:
```css
select {
    border: 2px solid var(--input-border);
    /* ... */
}
```

---

### Cambio: Modificar color theme

**styles.css** líneas 10-20:
```css
:root {
    --bg-color: #1a1a1a;        /* ← Cambiar aquí */
    --text-color: #e0e0e0;      /* ← Cambiar aquí */
    --help-icon-color: #00ff00; /* ← Verde phosphor */
}
```

---

### Cambio: Width de campos date

**FormRenderer.js** línea ~455:
```javascript
if (type === 'date') {
    inputEl.style.width = '17ch'; // ← Ajustar aquí
}
```

---

### Cambio: Default rows de textarea

**FormRenderer.js** línea ~420:
```javascript
inputEl.rows = rows || 3; // ← Cambiar default aquí
```

---

### Cambio: Tooltip position (arriba en vez de abajo)

**styles.css** línea ~537:
```css
.help-tooltip {
    bottom: 100%; /* Cambiar de 'top: 100%' */
    top: auto;
}
```

---

### Cambio: Agregar nueva validación

**Validator.js** línea ~80:
```javascript
validateCustomRule(value, params) {
    // Tu lógica aquí
}
```

**FormRenderer.js** línea ~700:
```javascript
const customXml = validationXml.querySelector('custom');
if (customXml) {
    const params = customXml.getAttribute('params');
    if (!this.validator.validateCustomRule(inputEl.value, params)) {
        isValid = false;
        errorMsg = 'Validación personalizada falló';
    }
}
```

---

## 📊 ESTADÍSTICAS DE CÓDIGO (v0.16.0)

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| FormRenderer.js | ~680 | Orquestador + in-table + CRUD |
| fieldRenderer/ | ~820 | Módulo de campos |
| Autocomplete.js | ~250 | Componente autocomplete (v0.15.0) |
| InputField.js | ~220 | Renderizado de inputs |
| styles.css | ~1,500 | Estilos Monospace Web |
| main.js | ~140 | Theme + sidebar + CRT |
| xmlParser/ | ~80 | Parsing XML |
| uiComponents/ | ~70 | Header y botones |
| LookupService.js | ~85 | Validación catálogos |
| TableCache.js | ~70 | Caché localStorage |
| RecordService.js (frontend) | ~60 | Cliente API CRUD (v0.16.0) |
| database.js | ~50 | Conexión sql.js |
| catalogService.js | ~90 | Queries con whitelist |
| recordService.js (backend) | ~100 | CRUD SQL (v0.16.0) |
| catalogController.js | ~65 | API controller |
| recordController.js | ~80 | CRUD controller (v0.16.0) |
| catalogRoutes.js | ~10 | Rutas /api/catalogs |
| recordRoutes.js | ~20 | Rutas /api/records (v0.16.0) |
| initCatalogsDB.js | ~180 | Script inicialización BD |
| Validator.js | ~120 | Validaciones |
| ExpressionEngine.js | ~340 | Expresiones |

**Total Frontend:** ~3,700 líneas
**Total Backend:** ~500 líneas
**Total:** ~4,200 líneas

---

## 📍 CRUD Module (v0.16.0 - Planificado)

### Backend - recordService.js (NUEVO)

```javascript
// src/services/recordService.js
const { getDatabase } = require('./database');

function findById(tableName, id) { ... }
function insert(tableName, data) { ... }
function update(tableName, id, data) { ... }
function getPrimaryKey(tableName) { ... }

module.exports = { findById, insert, update, getPrimaryKey };
```

### Backend - recordController.js (NUEVO)

```javascript
// src/controllers/recordController.js
const recordService = require('../services/recordService');

function getRecord(req, res) { ... }     // GET /api/records/:table/:id
function createRecord(req, res) { ... }  // POST /api/records/:table
function updateRecord(req, res) { ... }  // PUT /api/records/:table/:id

module.exports = { getRecord, createRecord, updateRecord };
```

### Backend - recordRoutes.js (NUEVO)

```javascript
// src/routes/recordRoutes.js
const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');

router.get('/:table/:id', recordController.getRecord);
router.post('/:table', recordController.createRecord);
router.put('/:table/:id', recordController.updateRecord);

module.exports = router;
```

### Frontend - RecordService.js (NUEVO)

```javascript
// js/services/RecordService.js
const API_BASE = '/api/records';

class RecordService {
    static async load(table, id) { ... }
    static async create(table, data) { ... }
    static async update(table, id, data) { ... }
    static async save(table, data, id = null) { ... }
}

export default RecordService;
```

### FormRenderer.js - Modificaciones

```javascript
// js/components/FormRenderer.js
class FormRenderer {
    constructor(...) {
        this.currentMode = 'new';      // 'new' | 'edit'
        this.currentRecordId = null;   // ID del registro en edición
        this.currentTable = null;      // Tabla asociada
    }
    
    async loadRecord(table, id) {
        const record = await RecordService.load(table, id);
        this.populateForm(record);
        this.currentMode = 'edit';
        this.currentRecordId = id;
    }
    
    populateForm(data) {
        Object.entries(data).forEach(([fieldId, value]) => {
            const field = this.container.querySelector(`#${fieldId}`);
            if (field) field.value = value;
        });
    }
    
    async handleSubmit(formData) {
        if (this.currentMode === 'edit') {
            await RecordService.update(this.currentTable, this.currentRecordId, formData);
        } else {
            await RecordService.create(this.currentTable, formData);
        }
    }
}
```

---

## 🔍 BÚSQUEDA RÁPIDA (v0.16.0)

### Por Feature:

- **:root variables:** styles.css:23-67
- **Dark mode #000000:** styles.css:67-96
- **Monospace font:** styles.css:40-45 (font-family, optical-sizing)
- **Input sizing:** styles.css:660-695 (height, padding ch)
- **Label-input gap:** styles.css:527-533 (gap: 0)
- **CRT toggle:** main.js:25-50
- **CRT scanlines:** styles.css:104-116
- **Cursor blink:** styles.css:119-128
- **Autofill override:** styles.css:698-715
- **Dark mode shadow:** styles.css:90-93
- **Border-box gap:** styles.css:547-559
- **Responsive border-box:** styles.css:1383-1406
- **Autocomplete component:** Autocomplete.js:1-310
- **Autocomplete styles:** styles.css:760-850
- **Tab validation:** Autocomplete.js:233-255
- **F1 dropdown:** Autocomplete.js:227-231
- **CRUD recordService:** recordService.js:1-100 (NUEVO)
- **CRUD recordController:** recordController.js:1-80 (NUEVO)
- **CRUD routes:** recordRoutes.js:1-20 (NUEVO)
- **RecordService frontend:** RecordService.js:1-60 (NUEVO)
- **populateForm:** FormRenderer.js (modificar)

### Por Problema:

- **Campos no monospace:** Verificar `font: inherit` en inputs (styles.css:664)
- **Inputs desalineados:** Verificar `height: calc(var(--line-height) * 2)` (styles.css:680)
- **Autofill colores:** styles.css:698-715
- **CRT no funciona:** Verificar `body.dark-mode.crt-mode::after` (styles.css:104)
- **Border-box móvil:** styles.css:1383-1406
- **Autocomplete no carga:** Verificar LookupService, TableCache
- **CRUD no funciona:** Verificar recordRoutes montado en server.js
- **Registro no se actualiza:** Verificar currentMode === 'edit' y currentRecordId

---

**Última actualización:** 2026-02-23
**Versión:** 0.20.0 (DuckDB-WASM Integration)

---

## 📍 Report Engine Module (v0.20.0)

### Estructura
```
js/components/report/
├── ReportEngine.js          # Motor principal v2.0 (~230 líneas)
├── ReportRenderer.js        # Renderizado HTML (~240 líneas)
├── AccumulatorManager.js    # Agregación (~112 líneas)
├── BreakDetector.js         # Control breaks (~66 líneas)
├── ExpressionEvaluator.js   # Safe parser, sin eval (~155 líneas)
├── DataSourceManager.js     # Queries DuckDB/JS dual (~210 líneas)
├── DuckDBAdapter.js         # DuckDB-WASM wrapper (~165 líneas) [NEW]
├── QueryBuilder.js          # YAML → SQL compiler (~175 líneas) [NEW]
├── parsers/
│   └── YamlParser.js        # Parser YAML (~120 líneas)
└── index.js                 # Exports
```

### DuckDBAdapter.js - Wrapper DuckDB-WASM (NEW)

```javascript
// Línea ~12-55: init() - Inicializar DuckDB desde CDN
async init() {
    this.duckdb = await import('https://esm.sh/@duckdb/duckdb-wasm@1.29.0');
    const worker = new Worker(workerUrl);
    this.db = new this.duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule);
    this.conn = await this.db.connect();
}

// Línea ~57-80: loadTable() - Registrar tabla desde JSON
async loadTable(name, jsonData) {
    await this.db.registerFileText(`${name}.json`, JSON.stringify(jsonData));
    await this.conn.insertJSONFromPath(`${name}.json`, { name });
}

// Línea ~82-100: query() - Ejecutar SQL y retornar JS array
async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map(row => row.toJSON());
}
```

### QueryBuilder.js - Compilador YAML → SQL (NEW)

```javascript
// Línea ~15-40: buildQuery() - Generar SQL completo
buildQuery(dataSource, fields) {
    const select = this.buildSelect(dataSource, fields);
    const from = this.buildFrom(dataSource);
    const joins = this.buildJoins(dataSource, fields);
    const where = this.buildWhere(dataSource);
    const orderBy = this.buildOrderBy(dataSource, fields);
    return `${select}\n${from}\n${joins}\n${where}\n${orderBy}`;
}

// Línea ~45-70: buildJoins() - Generar LEFT JOIN desde references
buildJoins(dataSource, fields) {
    return dataSource.joins.map(join => 
        `LEFT JOIN ${joinTable} ${joinAlias} ON t.${joinFromDb} = ${joinAlias}.${joinField}`
    ).join('\n');
}
```

### DataSourceManager.js v2.0 - Backend Dual

```javascript
// Línea ~20-30: initDuckDB() - Inicializar con fallback
async initDuckDB() {
    try {
        this.duckdb = new DuckDBAdapter();
        await this.duckdb.init();
    } catch (error) {
        this.useDuckDB = false;  // Fallback a JS
    }
}

// Línea ~50-80: loadWithDuckDB() - Cargar con SQL nativo
async loadWithDuckDB(dataSource, fields) {
    await this.duckdb.loadTable(tableName, data);
    const sql = this.queryBuilder.buildQuery(dataSource, fields);
    return await this.duckdb.query(sql);
}
```

### ExpressionEvaluator.js - Safe Parser

```javascript
// Línea ~115-155: evaluateCondition() - Sin eval()
evaluateCondition(condition, context) {
    if (!this.isConditionSafe(condition)) {
        return true;  // Bloquea expresiones peligrosas
    }
    // Usa new Function() con sanitización
    const fn = new Function('return (' + expr + ')');
    return fn();
}

// Línea ~157-175: isConditionSafe() - Whitelist caracteres
isConditionSafe(expr) {
    const safePattern = /^[a-zA-Z0-9_\s"':.<>=!&|()]+$/;
    const forbidden = ['eval', 'Function', 'window', 'document'];
    return safePattern.test(expr) && !forbidden.some(w => expr.includes(w));
}
```

### ReportEngine.js v2.0 - Motor Principal

```javascript
// Línea ~15-35: Constructor e inicialización
constructor() {
    this.parser = new YamlParser();
    this.dataSourceManager = new DataSourceManager();
    this.duckdbReady = false;
}

// Línea ~37-50: load() - Inicializar DuckDB
async load(reportPath) {
    this.schema = await this.parser.parse(yamlContent);
    await this.dataSourceManager.initDuckDB();
    this.duckdbReady = this.dataSourceManager.isDuckDBActive();
}

// Línea ~52-60: isDuckDBActive() - Verificar backend
isDuckDBActive() {
    return this.duckdbReady;
}
```

### ReportRenderer.js - Renderizado

```javascript
// Línea ~20-40: determineZoneType() - Clasificar zona
determineZoneType(zone) {
    // Retorna: 'header', 'footer', 'nav', 'separator', 'card', 'detail'
}

// Línea ~45-80: renderHeaderZone() - Header del reporte
// Línea ~85-110: renderNavZone() - Barra de navegación
// Línea ~115-140: renderSeparatorZone() - Separador de categoría
// Línea ~145-180: renderCardZone() - Card de producto
```

### Estilos CSS - Reportes

```css
/* Líneas ~1575-1850 en styles.css */
.report-container { ... }
.report-header { ... }
.report-nav { ... }
.report-separator { ... }
.report-products-grid { ... }
.report-card { ... }
.report-footer { ... }
.report-backend-badge { ... }  /* Badge DuckDB/JS */
```

### Archivos de Demo

| Archivo | Descripción |
|---------|-------------|
| `reports/carta.yaml` | Definición del reporte en YAML |
| `report.html` | Visor público de reportes |
| `utils/init-pizzeria.js` | Datos demo (demo_categorias, demo_productos) |

### Flujo de Ejecución v2.0

```
1. ReportEngine.load('reports/carta.yaml')
   ↓
2. YamlParser.parse() → ReportSchema
   ↓
3. DataSourceManager.initDuckDB()
   ├── Éxito → DuckDB backend
   └── Fallo → JS fallback
   ↓
4. DataSourceManager.loadDataSource()
   ├── DuckDB:
   │   ├── Fetch /api/catalogs
   │   ├── DuckDBAdapter.loadTable()
   │   ├── QueryBuilder.buildQuery() → SQL
   │   └── DuckDBAdapter.query(sql)
   └── JS Fallback:
       ├── Fetch /api/catalogs
       └── resolveJoinsJS() loops O(n²)
   ↓
5. ReportEngine.render()
   ├── renderBeforeReport()
   ├── Iterar registros con control breaks
   └── renderAfterReport()
   ↓
6. HTML + Badge "DuckDB" o "JS"
```

### Performance Comparison

| Métrica | JS Fallback | DuckDB |
|---------|-------------|--------|
| 100 records | ~5ms | ~50ms init + ~1ms |
| 1,000 records | ~50ms | ~50ms init + ~2ms |
| 10,000 records | ~5,000ms (freeze) | ~50ms init + ~10ms |
| JOIN 2 tablas | O(n²) | O(n log n) |
