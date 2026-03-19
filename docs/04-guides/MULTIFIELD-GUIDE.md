# 📊 Guía: Multifields en Nilix

## ⚙️ ¿Qué es un Multifield?

Un **multifield** es un campo que permite almacenar múltiples filas de datos. En el sistema original, se usaba para:

1. **Textarea virtual** - Contenido de emails, logs, mensajes largos
2. **Tablas/Grids** - Listas de registros con múltiples columnas

Nilix detecta **automáticamente** qué tipo de multifield es según la cantidad de campos hijos.

---

## 🎯 Fase 1: Multifield → Textarea

### ¿Cuándo se convierte en textarea?

Cuando el multifield tiene **1 solo campo hijo**:

```xml
<field id="RENG" type="multifield" rows="500" display="10">
    <field id="texto" type="text"/>
</field>
```

### Atributos:

| Atributo | Descripción | Ejemplo |
|----------|-------------|---------|
| `rows` | Máximo de líneas permitidas | `rows="500"` |
| `display` | Altura visible del textarea (líneas) | `display="10"` |

### Conversión Automática:

```
Multifield original:
├── RENG : rows 500, display 10
└── texto : display only

→ Nilix Textarea:
   ├── rows="10"
   ├── maxlength="40000" (500 × 80)
   └── readonly si display-only="true"
```

### Ejemplo Completo:

```xml
<field id="message_body" label="Mensaje" type="multifield" rows="500" display="10">
    <help>Contenido del mensaje de email</help>
    <field id="texto" display-only="true"/>
</field>
```

**Resultado:**
- Un `<textarea>` con 10 líneas visibles
- Máximo 40,000 caracteres (500 líneas × 80 char/línea)
- Readonly si el campo hijo tiene `display-only="true"`

---

## 📊 Fase 2: Multifield → Grid/Tabla

### ¿Cuándo se convierte en tabla?

Cuando el multifield tiene **múltiples campos hijos**:

```xml
<field id="RENGS" type="multifield" rows="50" display="7">
    <field id="nume" label="No" type="number" display-only="true"/>
    <field id="rte" label="Remitente" type="text" skip="true"/>
    <field id="fec" label="Fecha" type="date" skip="true"/>
</field>
```

### Atributos:

| Atributo | Descripción | Ejemplo |
|----------|-------------|---------|
| `rows` | Máximo de filas en la tabla | `rows="50"` |
| `display` | Filas visibles sin scroll | `display="7"` |

### Conversión Automática:

```
Multifield original:
├── RENGS : rows 210, display 7
├── nume : display only
├── rte  : skip
└── fec  : skip

→ Nilix Grid:
   ├── Tabla con 3 columnas
   ├── 7 filas visibles
   ├── Botones ← Anterior / Siguiente →
   └── "1-7 de 210"
```

### Estructura de la Tabla:

```html
<table class="multifield-table">
    <thead>
        <tr>
            <th>No</th>
            <th>Remitente</th>
            <th>Fecha</th>
        </tr>
    </thead>
    <tbody>
        <tr data-row-index="0">
            <td><input type="number" readonly></td>
            <td><input type="text" readonly></td>
            <td><input type="date" readonly></td>
        </tr>
        <!-- ... 6 filas más -->
    </tbody>
</table>
```

### Navegación:

- **Botones**: `← Anterior` / `Siguiente →`
- **Indicador**: `1-7 de 50`
- **Auto-deshabilitado**: Primer página desactiva "Anterior", última página desactiva "Siguiente"

---

## 🔍 Detección Automática

Nilix usa esta lógica:

```javascript
function detectMultifieldType(multifieldXml) {
    const childFields = multifieldXml.querySelectorAll(':scope > field');

    if (childFields.length === 1) {
        return 'textarea'; // ← Fase 1
    } else if (childFields.length > 1) {
        return 'grid';     // ← Fase 2
    } else {
        return 'invalid';
    }
}
```

---

## 📋 Ejemplos Completos

### Ejemplo 1: Email Body (Textarea)

```xml
<field id="email_content" label="Contenido del Email" type="multifield" rows="1000" display="15">
    <help>Escriba el contenido del email aquí</help>
    <field id="body" type="text"/>
</field>
```

**Resultado:**
- Textarea de 15 líneas visibles
- Máximo 80,000 caracteres
- Estilo terminal (monospace)

---

### Ejemplo 2: Tabla de Logs (Grid)

```xml
<field id="system_logs" label="Logs del Sistema" type="multifield" rows="200" display="10">
    <help>Últimos logs del sistema</help>
    <field id="timestamp" label="Timestamp" type="text" display-only="true"/>
    <field id="level" label="Level" type="text" display-only="true"/>
    <field id="message" label="Mensaje" type="text" display-only="true"/>
</field>
```

**Resultado:**
- Tabla con 3 columnas (Timestamp, Level, Mensaje)
- 10 filas visibles a la vez
- Todos los campos readonly
- Navegación con botones

---

### Ejemplo 3: imail (Caso Real)

```xml
<!-- Contenido del mensaje -->
<field id="RENG" type="multifield" rows="500" display="10">
    <field id="texto" display-only="true"/>
</field>

<!-- Tabla de mensajes recibidos -->
<field id="RENGS" label="Mensajes" type="multifield" rows="210" display="7">
    <field id="nume" label="No" type="number" display-only="true"/>
    <field id="rte" label="De" type="text" skip="true"/>
    <field id="dia" label="Día" type="text" skip="true"/>
    <field id="fec" label="Fecha" type="date" skip="true"/>
    <field id="hor" label="Hora" type="text" skip="true"/>
</field>
```

---

## 🎨 Estilos CSS

### Textarea (Fase 1):

- Monospace (`--label-font`)
- Bordes rectos (brutalismo)
- Scroll vertical automático
- Resize permitido

### Grid (Fase 2):

- Tabla con bordes sólidos
- Encabezados oscuros con texto claro
- Hover en filas
- Inputs compactos en celdas
- Controles de navegación integrados

### Grid en móvil — Cards (v1.9.0, ≤650px):

La tabla se convierte en cards apiladas. Requiere `data-label` en cada `<td>` (generado por JS).

```
+----------------------------------+
| PRODUCTO   | Margherita           |
| PRECIO     | 12.50                |
| CANT       |▼|   001   |▲|        |
| SUBTOTAL   | 12.50                |
|                                ✕ |
+----------------------------------+
```

**Cómo funciona:**
- `_getColumns()` extrae `label: th.textContent.trim()` de cada `<th>`
- `_buildRow()` asigna `td.dataset.label = col.label` a cada celda
- Filas filler: `row.dataset.empty = 'true'` → ocultas con `display: none`
- Celda acción: `actionTd.dataset.label = ''` → `::before` no muestra nada
- CSS: `td::before { content: attr(data-label); flex: 0 0 33% }` — labels en columna alineada
- Inputs: `flex: 1` — ocupan los 2/3 restantes

**Stepper en card — truco CSS crítico:**
`button { width: 100% }` del breakpoint móvil convierte los botones ▼/▲ en
`flex-basis: 100%` dentro del wrapper flex, aplastando el input numérico.
Fix: `.stepper-btn { width: auto }` en el selector específico del contexto card.

---

## ⚠️ Limitaciones Actuales

### Fase 1 (Textarea):
- ✅ Renderizado completo
- ✅ Readonly/editable según `display-only`
- ✅ Validaciones
- ⚠️ No guarda datos (falta backend)

### Fase 2 (Grid):
- ✅ Renderizado completo
- ✅ Navegación básica (paginación)
- ⚠️ Navegación no carga datos dinámicamente
- ⚠️ No guarda datos (falta backend)
- ⚠️ No soporta agregar/borrar filas

---

## 🚀 Testing

Archivo de prueba: `forms/apps/test-multifield.xml`

```bash
# Abrir en el navegador
open http://localhost:3000/?form=test-multifield
```

**Qué probar:**
1. Textarea se renderiza correctamente
2. Tabla se renderiza con encabezados
3. Botones de navegación funcionan
4. Campos readonly no son editables
5. Estilos terminal/brutalista aplicados

---

## 📊 Comparación de sintaxis

| Feature | FDL original | NILIX |
|---------|---------|------------|
| **Textarea virtual** | Array de strings | `<textarea>` nativo |
| **Navegación líneas** | PgUp/PgDn manual | Scroll automático |
| **Grid/Tabla** | Array 2D | `<table>` HTML |
| **Paginación** | Manual con C++ | Botones JS |
| **Edición celdas** | Por fila | Por celda |
| **Límite filas** | 500 líneas | Sin límite técnico |

---

**Última actualización:** 2026-02-01
