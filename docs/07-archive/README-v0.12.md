# NILIX

**Renderizador de formularios web basado en XML**

Diseño terminal/brutalist • JavaScript vanilla • Sin dependencias

---

## ⚠️ IMPORTANTE: SQLite en Memoria

> **Este proyecto usa sql.js (SQLite compilado a JavaScript) en memoria.**
> 
> - ✅ **Adecuado para:** Desarrollo, demos, prototipos, testing
> - ❌ **NO adecuado para:** Producción con múltiples usuarios concurrentes
> 
> Los datos persisten en `data/catalogs.db` mediante exportación manual.
> Para producción, considerar migrar a PostgreSQL o MySQL.

---

## 🚀 QUICK START

### 1. Iniciar Servidor Local

```bash
# Desde la raíz del proyecto
cd /media/cibo/KINGSTON/side-proj/other/space-form

# Con Python 3
python3 -m http.server 3000

# O con Python 2
python -m SimpleHTTPServer 3000

# O con Node.js (si tienes http-server instalado)
npx http-server -p 3000
```

### 2. Abrir en el Navegador

```
http://localhost:3000
```

Por defecto carga `forms/simple-form.xml`.

### 3. Probar Otros Formularios

```
http://localhost:3000/?form=test-multifield
http://localhost:3000/?form=simple-form
```

---

## 📋 ¿QUÉ PUEDES HACER HOY?

### ✅ Campos Básicos

```xml
<field id="nombre" label="Nombre Completo" type="text" size="50"/>
<field id="edad" label="Edad" type="number" size="3"/>
<field id="nacimiento" label="Fecha de Nacimiento" type="date"/>
<field id="email" label="Correo" type="email" size="50"/>
<field id="mensaje" label="Mensaje" type="textarea" rows="5"/>
```

**Resultado:**
- Input con estilo terminal (monospace, bordes rectos)
- Labels en UPPERCASE arriba del campo
- Validaciones HTML5 automáticas

---

### ✅ Validaciones

```xml
<field id="precio" label="Precio" type="number">
    <validation>
        <required>true</required>
        <check>&gt; 0</check>
        <between min="1" max="99999"/>
    </validation>
</field>
```

**Validaciones disponibles:**
- `<required>true</required>` - Campo obligatorio
- `<check>expr</check>` - Expresión custom (ej: `&gt; 10`, `this &lt; 100`)
- `<between min="X" max="Y"/>` - Rango numérico

---

### ✅ Help Tooltips

```xml
<messages>
    <message id="HELP_NOMBRE">Ingrese nombre completo sin abreviaturas</message>
</messages>

<field id="nombre" label="Nombre" type="text">
    <attributes>
        <help>HELP_NOMBRE</help>
    </attributes>
</field>
```

**Resultado:**
- Icono `[?]` en verde phosphor antes del label
- Click en `[?]` → tooltip estilo terminal
- ESC o click fuera → cierra tooltip

---

### ✅ Multifields → Textarea (1 campo hijo)

```xml
<field id="mensaje" type="multifield" rows="500" display="10">
    <field id="texto" type="text"/>
</field>
```

**Resultado:**
- Se renderiza como `<textarea>` normal
- 10 líneas visibles (display)
- Máximo 40,000 caracteres (500 × 80)

**Cuándo usar:**
- Contenido de emails
- Logs del sistema
- Mensajes largos
- Cualquier texto multi-línea

---

### ✅ Multifields → Grid/Tabla (múltiples campos)

```xml
<field id="items" label="Items del Pedido" type="multifield" rows="50" display="7">
    <field id="codigo" label="Código" type="number"/>
    <field id="descripcion" label="Descripción" type="text"/>
    <field id="cantidad" label="Cantidad" type="number"/>
    <field id="precio" label="Precio" type="number"/>
</field>
```

**Resultado:**
- Tabla HTML con 4 columnas
- 7 filas visibles a la vez
- Botones "← Anterior" / "Siguiente →"
- Indicador "1-7 de 50"

**Cuándo usar:**
- Tablas de datos
- Listas de registros
- Grids editables
- Datos tabulares

---

### ✅ Containers (Layout)

#### Vertical (default):
```xml
<container type="vertical">
    <field id="nombre" label="Nombre" type="text"/>
    <field id="apellido" label="Apellido" type="text"/>
</container>
```

Labels arriba de inputs, campos apilados verticalmente.

#### Horizontal:
```xml
<container type="horizontal">
    <field id="dia" label="Día" type="number" size="2"/>
    <field id="mes" label="Mes" type="number" size="2"/>
    <field id="anio" label="Año" type="number" size="4"/>
</container>
```

Campos en fila, labels arriba de cada input.

---

### ✅ Border (Recuadros)

```xml
<container type="horizontal">
    <!-- Recuadro alrededor del campo -->
    <border>
        <field id="orderno" label="Número de Factura" type="text" size="5"/>
    </border>

    <!-- Campo sin recuadro, alineado a la derecha -->
    <field id="fecha" label="Fecha" type="date" align="right"/>
</container>
```

**Resultado:**
```
+--------------------+
| Número Factura: __ |      Fecha: __/__/__
+--------------------+
```

**Cuándo usar:**
- Zona de claves (key fields)
- Agrupar visualmente campos relacionados
- Destacar campos importantes
- Recrear layouts con recuadros

**Border dentro de border:**
```xml
<border>
    <field id="cliente" label="Cliente" type="text" size="6"/>
    <field id="nombre" label="Nombre" type="text" size="50"/>
</border>
```

**Resultado:**
```
+-------------------------+
| Cliente: ______         |
| Nombre : ______________ |
+-------------------------+
```

---

### ✅ Alineación de Campos (align)

```xml
<container type="horizontal">
    <field id="izquierda" label="Izquierda" type="text"/>
    <field id="centro" label="Centro" type="text" align="center"/>
    <field id="derecha" label="Derecha" type="text" align="right"/>
</container>
```

**Atributos soportados:**
- `align="left"` (default) - Campo a la izquierda
- `align="center"` - Campo centrado
- `align="right"` - Campo a la derecha

**Cuándo usar:**
- Campos de fecha/hora en esquina superior derecha
- Totales alineados a la derecha
- Layouts complejos que requieren distribución espacial

---

## 📁 ESTRUCTURA DE UN FORMULARIO XML

### Estructura Mínima

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="mi-form" title="Título del Formulario">
    <layout>
        <field id="campo1" label="Campo 1" type="text"/>
    </layout>
</form>
```

### Estructura Completa

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form-definition>
    <form id="contacto" title="Formulario de Contacto" database="contacts">

        <!-- ATRIBUTOS DEL FORM -->
        <form-attributes>
            <use>contacts</use>
            <window border="single"/>
            <messages>
                <message id="HELP_NOMBRE">Ingrese su nombre completo</message>
                <message id="HELP_EMAIL">Email válido (usuario@dominio.com)</message>
            </messages>
            <display-status>true</display-status>
            <confirm>add, end</confirm>
        </form-attributes>

        <!-- LAYOUT DEL FORM -->
        <layout>
            <!-- Campo simple -->
            <field id="nombre" label="Nombre Completo" type="text" size="50">
                <attributes>
                    <help>HELP_NOMBRE</help>
                </attributes>
                <validation>
                    <required>true</required>
                </validation>
            </field>

            <!-- Campo con validaciones -->
            <field id="edad" label="Edad" type="number" size="3">
                <validation>
                    <required>true</required>
                    <between min="18" max="99"/>
                </validation>
            </field>

            <!-- Container horizontal -->
            <container type="horizontal">
                <field id="telefono_area" label="Área" type="tel" size="4"/>
                <field id="telefono_numero" label="Número" type="tel" size="10"/>
            </container>

            <!-- Textarea -->
            <field id="comentarios" label="Comentarios" type="textarea" rows="5"/>

            <!-- Multifield (grid) -->
            <field id="contactos" label="Contactos Previos" type="multifield" rows="20" display="5">
                <field id="fecha" label="Fecha" type="date"/>
                <field id="tipo" label="Tipo" type="text"/>
                <field id="notas" label="Notas" type="text"/>
            </field>
        </layout>
    </form>
</form-definition>
```

---

## 🎨 ESTILO TERMINAL/BRUTALIST

### Características

- ✅ **Border radius: 0** - Sin esquinas redondeadas
- ✅ **Bordes gruesos** - 2-3px sólidos
- ✅ **Fuente monospace** - JetBrains Mono, Courier New
- ✅ **Labels UPPERCASE** - Con letter-spacing
- ✅ **Verde phosphor** - #00ff00 para help icons
- ✅ **Sin sombras** - Estilo plano
- ✅ **Alto contraste** - Fondo oscuro (#1a1a1a)

### Paleta de Colores

```css
Fondo:       #1a1a1a  (Negro terminal)
Texto:       #e0e0e0  (Gris claro)
Bordes:      #333     (Gris oscuro)
Help icon:   #00ff00  (Verde phosphor)
Error:       #ff4444  (Rojo)
```

### Modificar Estilo

Editar `css/styles.css` líneas 10-20:

```css
:root {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --help-icon-color: #00ff00; /* ← Cambiar a #00aaff para azul */
}
```

---

## 📂 ARCHIVOS CLAVE

### Código Principal (v0.10.0)

| Archivo | Descripción | Líneas |
|---------|-------------|--------|
| `js/main.js` | Inicialización + sidebar toggle | ~90 |
| `js/components/FormRenderer.js` | ⭐ Orquestador principal | ~340 |
| `js/components/fieldRenderer/` | ⭐ Módulo de renderizado de campos | ~400 |
| `js/components/xmlParser/` | ⭐ Parsing XML | ~80 |
| `js/components/uiComponents/` | ⭐ Componentes UI | ~70 |
| `css/styles.css` | Estilos terminal/brutalist | ~1,100 |
| `js/utils/Validator.js` | Validaciones de campos | ~120 |
| `js/utils/ExpressionEngine.js` | Evaluación de expresiones | ~340 |

### Estructura de Componentes

```
js/components/
├── FormRenderer.js          # Orquestador (refactorizado)
├── fieldRenderer/           # Módulo de campos
│   ├── index.js            # Exports
│   ├── Label.js           # Labels, tooltips
│   ├── InputField.js      # Inputs, textareas
│   ├── Checkbox.js        # Checkboxes
│   └── Multifield.js      # Grids, textareas grandes
├── xmlParser/              # Parsing XML
│   ├── index.js
│   └── XmlParser.js
└── uiComponents/           # Componentes UI
    ├── index.js
    └── UiComponents.js
```

### Formularios de Ejemplo

| Archivo | Propósito |
|---------|-----------|
| `forms/simple-form.xml` | Ejemplo básico de todos los campos |
| `forms/apps/test-multifield.xml` | Testing de multifields (textarea y grid) |
| `forms/apps/imail.xml` | Caso real (emails) |

### Documentación

| Archivo | Propósito |
|---------|-----------|
| `README.md` | ⭐ Este archivo (inicio rápido) |
| `MANUAL-DESARROLLO.md` | ⭐ Manual exhaustivo de desarrollo |
| `CODE-MAP.md` | ⭐ Mapa de líneas de código |
| `forms/MULTIFIELD-GUIDE.md` | Guía de multifields |
| `agent/MForm.txt` | Spec original NILIX FDL |

---

## 🧪 TESTING

### Probar Formulario Simple

```bash
# Iniciar servidor
python3 -m http.server 3000

# Abrir navegador
http://localhost:3000/?form=simple-form
```

**Qué probar:**
1. ✅ Campos se renderizan correctamente
2. ✅ Labels están en UPPERCASE
3. ✅ Help tooltips funcionan al hacer click en `[?]`
4. ✅ Validaciones se ejecutan al blur
5. ✅ Estilos brutalist aplicados

### Probar Multifields

```bash
http://localhost:3000/?form=test-multifield
```

**Qué probar:**
1. ✅ Multifield con 1 campo → textarea
2. ✅ Multifield con N campos → grid/tabla
3. ✅ Navegación con botones funciona
4. ✅ Indicador "1-7 de 50" se actualiza
5. ✅ Headers de tabla visibles

### Debugging

```javascript
// Abrir consola del navegador (F12)
// Ver errores en pestaña Console

// Verificar que FormRenderer se inicializó
console.log(window.formRenderer);

// Ver datos del formulario
console.log(window.formRenderer.formData);

// Forzar reload sin cache
// Ctrl + Shift + R (Linux/Windows)
// Cmd + Shift + R (Mac)
```

---

## 🔧 MODIFICACIONES COMUNES

### Cambiar Color del Help Icon

**Archivo:** `css/styles.css` línea ~475

```css
.help-icon {
    color: #00aaff; /* Cambiar de #00ff00 a azul */
}
```

### Cambiar Width de Campos Date

**Archivo:** `js/components/FormRenderer.js` línea ~455

```javascript
if (type === 'date') {
    inputEl.style.width = '20ch'; // Cambiar de 17ch a 20ch
}
```

### Cambiar Default Rows de Textarea

**Archivo:** `js/components/FormRenderer.js` línea ~420

```javascript
inputEl.rows = rows || 5; // Cambiar de 3 a 5
```

### Agregar Nuevo Tipo de Campo

**Archivo:** `js/components/FormRenderer.js` línea ~400

```javascript
if (type === 'color') {
    inputEl = createElement('input');
    inputEl.type = 'color';
    inputEl.style.width = '60px';
    inputEl.style.height = '40px';
}
```

**XML:**
```xml
<field id="color_favorito" label="Color" type="color"/>
```

---

## 📖 EJEMPLOS COMPLETOS

### Ejemplo 1: Formulario de Contacto

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="contacto" title="Contacto">
    <messages>
        <message id="HELP_EMAIL">Email válido (ej: juan@mail.com)</message>
        <message id="HELP_TELEFONO">Teléfono con código de área</message>
    </messages>

    <layout>
        <field id="nombre" label="Nombre Completo" type="text" size="50">
            <validation>
                <required>true</required>
            </validation>
        </field>

        <field id="email" label="Email" type="email" size="50">
            <attributes>
                <help>HELP_EMAIL</help>
            </attributes>
            <validation>
                <required>true</required>
            </validation>
        </field>

        <field id="telefono" label="Teléfono" type="tel" size="20">
            <attributes>
                <help>HELP_TELEFONO</help>
            </attributes>
        </field>

        <field id="mensaje" label="Mensaje" type="textarea" rows="5">
            <validation>
                <required>true</required>
            </validation>
        </field>

        <field id="newsletter" label="Suscribirse al newsletter" type="checkbox" default="false"/>
    </layout>
</form>
```

---

### Ejemplo 2: Formulario con Multifield (Pedido)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<form id="pedido" title="Nuevo Pedido">
    <layout>
        <field id="cliente" label="Cliente" type="text" size="50">
            <validation>
                <required>true</required>
            </validation>
        </field>

        <field id="fecha" label="Fecha del Pedido" type="date">
            <attributes>
                <default>today</default>
            </attributes>
        </field>

        <!-- Grid de items -->
        <field id="items" label="Items del Pedido" type="multifield" rows="50" display="10">
            <field id="codigo" label="Código" type="number"/>
            <field id="descripcion" label="Descripción" type="text"/>
            <field id="cantidad" label="Cantidad" type="number"/>
            <field id="precio_unit" label="Precio Unit." type="number"/>
        </field>

        <!-- Textarea para observaciones -->
        <field id="observaciones" type="multifield" rows="100" display="5">
            <field id="obs_texto" type="text"/>
        </field>
    </layout>
</form>
```

---

## ⚠️ LIMITACIONES ACTUALES

### ❌ No Implementado (ver roadmap en MANUAL-DESARROLLO.md)

- `type="select"` con opciones dropdown
- Atributo `is` (campos virtuales calculados)
- Validación `in (valores)` con menú
- Validación `in tabla` (lookups en BD)
- Subformularios (popup forms)
- Zona de claves (CRUD operations)
- Máscaras de entrada (`mask`)
- Backend real (actualmente LocalStorage)

### ⚠️ Funcionalidad Parcial

- **Multifield grids:** Navegación estática (no carga datos dinámicamente)
- **Validaciones:** Solo expresiones simples (no cross-field)
- **Persistencia:** LocalStorage temporal (no BD)

---

## 🐛 PROBLEMAS COMUNES Y SOLUCIONES

### Problema: "El formulario no se muestra"

**Causa:** Error en XML (mal formado)

**Solución:**
1. Abrir consola (F12)
2. Ver errores en Console
3. Verificar que el XML esté bien formado:
   - Todas las tags tienen cierre
   - Atributos entre comillas
   - Encoding UTF-8 declarado

**Verificar:**
```bash
# Validar XML con xmllint (si está instalado)
xmllint --noout forms/tu-form.xml
```

---

### Problema: "Los tooltips no aparecen"

**Causas posibles:**
1. `overflow: hidden` en contenedor padre
2. `z-index` muy bajo
3. Event bubbling cierra tooltip inmediatamente

**Solución:**
Ver `css/styles.css` líneas 260 y 520:
```css
.input-group {
    overflow: visible; /* ← No 'hidden' */
}

.help-tooltip {
    z-index: 9999; /* ← Máxima prioridad */
}
```

---

### Problema: "Las validaciones no funcionan"

**Debugging:**
```javascript
// En consola del navegador
const input = document.querySelector('#nombre');
console.log('Validation XML:', input._validationXml); // Debe tener contenido
console.log('Validator:', window.formRenderer.validator);
```

**Verificar sintaxis XML:**
```xml
<!-- ✅ Correcto (escapa < y >) -->
<check>&gt; 10</check>

<!-- ❌ Incorrecto -->
<check>> 10</check>
```

---

### Problema: "El servidor no inicia"

**Solución:**

```bash
# Verificar que estás en el directorio correcto
pwd
# Debe mostrar: /media/cibo/KINGSTON/side-proj/other/space-form

# Verificar puerto no esté ocupado
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Usar otro puerto
python3 -m http.server 8080
```

---

## 🚀 PRÓXIMOS PASOS

### Para Desarrolladores

1. **Leer documentación:**
   - `MANUAL-DESARROLLO.md` - Manual exhaustivo
   - `CODE-MAP.md` - Mapa de código con líneas exactas
   - `forms/MULTIFIELD-GUIDE.md` - Guía de multifields

2. **Explorar código:**
   - `FormRenderer.js` - Núcleo del renderizador
   - `styles.css` - Estilos brutalist

3. **Implementar feature nuevo:**
   - Ver "CHECKLIST: IMPLEMENTAR UN FEATURE NUEVO" en MANUAL-DESARROLLO.md

### Para Usuarios

1. **Crear formulario:**
   - Copiar `forms/simple-form.xml`
   - Modificar campos según necesidad
   - Probar: `http://localhost:3000/?form=tu-form`

2. **Personalizar estilos:**
   - Editar `css/styles.css` líneas 10-20 (variables)
   - Ver "GUÍA: DÓNDE HACER CADA TIPO DE CAMBIO" en MANUAL-DESARROLLO.md

---

## 📚 RECURSOS

### Especificaciones FDL

`agent/MForm.txt` - Especificación completa de FDL

**Secciones clave:**
- Línea 195: La Sección %fields
- Línea 431: Subformularios
- Línea 443: Campos Múltiples
- Línea 453: Atributos de Campos Múltiples

### Ejemplos Real

`forms/apps/imail.xml` - Formulario de emails (caso real)

---

## 🤝 CONTRIBUIR

### Workflow Recomendado

```bash
# Crear branch para feature
git checkout -b feature/select-field

# Hacer commits descriptivos
git commit -m "feat: Add select field rendering"
git commit -m "style: Add brutalist styles for select"
git commit -m "docs: Update manual with select field"

# Merge a main
git checkout main
git merge feature/select-field
```

### Documentar Cambios

Al implementar un feature nuevo:

1. ✅ Actualizar `MANUAL-DESARROLLO.md`
2. ✅ Actualizar `CODE-MAP.md` con líneas exactas
3. ✅ Agregar ejemplo en `README.md` (este archivo)
4. ✅ Crear formulario de prueba en `forms/apps/`

---

## 📞 SOPORTE

### Debugging Checklist

Antes de reportar un bug:

1. ✅ Consola del navegador (F12) sin errores
2. ✅ XML bien formado (validar con xmllint)
3. ✅ Hard reload (Ctrl+Shift+R)
4. ✅ Probar con `simple-form.xml` (formulario mínimo)
5. ✅ Verificar que archivos CSS/JS se cargaron (Network tab)

---

## 📊 ESTADO DEL PROYECTO

**Versión:** 0.12.0 (type="select")
**Última actualización:** 2026-02-16

### Novedades v0.12.0

- ✅ **`type="select"`**: Campos dropdown con opciones, estilo brutalist

### Novedades v0.11.0

- ✅ **Header global**: Título "NILIX" + toggle tema siempre visible

### Novedades v0.10.0

- ✅ **Sidebar responsive colapsable**: Botón hamburguesa brutalista, toggle desktop/móvil

### Novedades v0.9.0 (Refactorizado)

- ✅ **Arquitectura modular**: Separación en fieldRenderer, xmlParser, uiComponents
- ✅ **FormReducer.js reducido**: De ~1,260 a ~340 líneas
- ✅ **Código más mantenible**: Cada módulo tiene responsabilidad única
- ✅ **Preparado para escalar**: Interfaces claras para extensión futura

### Cobertura de NILIX FDL

| Feature | Estado | Archivo |
|---------|--------|---------|
| Campos básicos (text, number, date) | ✅ 100% | FormRenderer.js |
| Campos select (dropdown) | ✅ 100% | InputField.js |
| Validaciones básicas (required, check) | ✅ 95% | Validator.js |
| Help tooltips | ✅ 100% | FormRenderer.js + styles.css |
| Multifields → textarea | ✅ 100% | Multifield.js |
| Multifields → grid | ✅ 80% | Multifield.js |
| Containers (layout) | ✅ 100% | FormRenderer.js |
| Atributo `is` (virtuales) | ⚠️ 40% | ExpressionEngine.js |
| `in (valores)` dropdown | ❌ 0% | - |
| `in tabla` lookups | ❌ 0% | - |
| Subformularios | ❌ 0% | - |
| Zona de claves | ❌ 0% | - |

**Cobertura total: ~65%**

---

## 🎯 RESUMEN

### ¿Qué es Nilix?

Un **renderizador de formularios web** que toma definiciones XML (definidas en XML) y las convierte en formularios HTML con estilo **terminal/brutalist**.

### ¿Qué funciona hoy?

- ✅ Campos: text, number, date, time, email, tel, textarea
- ✅ Validaciones: required, check, between
- ✅ Multifields: auto-detección de textarea vs grid
- ✅ Help tooltips estilo terminal con `[?]` icon
- ✅ Containers (horizontal/vertical)
- ✅ Estilos brutalist completos

### ¿Qué falta?

- ❌ Campos select con opciones
- ❌ Atributo `is` completo (campos virtuales)
- ❌ Lookups en base de datos
- ❌ Backend real (actualmente LocalStorage)
- ❌ Subformularios

### ¿Cómo empezar?

```bash
python3 -m http.server 3000
# Abrir http://localhost:3000
```

---

**Hecho con ❤️ basado en XML**
**Estilo: Terminal/Brutalist • Sin frameworks • JavaScript vanilla**
