# 🐛 Debug: Contenedores Horizontales

## Problema Reportado

El usuario ve en `clie2.xml`:
```
Provincia: :
 __  __
Localidad: :
 __  __
```

Debería verse:
```
Provincia: __       ____________________
Localidad: __       ____________________
```

---

## HTML Generado (del Inspector)

```html
<div class="field-block-horizontal">
  <label for="prov">Provincia:</label>
  <div class="input-group">
    <input type="text" id="prov" name="prov" style="width: 8ch;">
  </div>
</div>
<div class="field-block-horizontal">
  <label for="desc0" style="visibility: hidden;">&nbsp;</label>
  <div class="input-group">
    <input type="text" id="desc0" name="desc0" style="width: 24ch;" readonly="">
  </div>
</div>
```

---

## CSS Aplicado

```css
.horizontal-container {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;  /* Alinear por la base */
  flex-wrap: nowrap;
}

.field-block-horizontal {
  display: flex;
  flex-direction: column;  /* Label arriba, input abajo */
  flex-shrink: 0;
}

.field-block-horizontal .input-group {
  width: auto !important;  /* NO expandirse */
}
```

---

## Estructura Esperada

```
┌─ horizontal-container ────────────────────────┐
│                                               │
│  ┌─ field-block ─┐    ┌─ field-block ────┐  │
│  │ Provincia:    │    │ (label oculto)   │  │
│  │ [__]          │    │ [______________] │  │
│  └───────────────┘    └──────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

Con `align-items: flex-end`, los inputs deberían alinearse en la base.

---

## Diagnóstico

### 1. Verificar que los divs están DENTRO de `.horizontal-container`

Inspeccionar el DOM y verificar:
```html
<container type="horizontal"> <!-- Del XML -->
   ↓
<div class="horizontal-container"> <!-- Renderizado -->
  <div class="field-block-horizontal">...</div> <!-- campo 1 -->
  <div class="field-block-horizontal">...</div> <!-- campo 2 -->
</div>
```

### 2. Verificar CSS computed

En inspector, seleccionar `.horizontal-container` y verificar:
- ✅ `display: flex`
- ✅ `flex-direction: row` (default)
- ✅ `align-items: flex-end`

### 3. Verificar ancho de `.field-block-horizontal`

Cada uno debería tener:
- width: auto (no forzado a 100%)
- flex-grow: 0 (porque los inputs tienen style width)
- flex-shrink: 0

---

## Posibles Causas

### Causa 1: Los divs NO están dentro de `.horizontal-container`

**Síntoma:** Se ven apilados verticalmente

**Verificar:** Ver el árbol DOM completo

**Solución:** Verificar que `renderContainer()` está creando el wrapper correctamente

---

### Causa 2: CSS heredado forzando width: 100%

**Síntoma:** Cada field-block ocupa todo el ancho del contenedor

**Verificar:** Computed styles de `.field-block-horizontal`

**Solución:** Ya agregamos `width: auto !important` en `.field-block-horizontal .input-group`

---

### Causa 3: El ":" extra viene del label invisible

**Síntoma:** Visualmente se ve `: :` en lugar de un solo `:`

**Verificar:** El label con `visibility: hidden` tiene contenido `&nbsp;`, no `:`

**Solución:** Ya corregido en `createLabel()` - usa `\u00A0` cuando no hay labelTxt

---

## Solución Aplicada

### Cambios en FormRenderer.js

1. **createLabel()** - Labels vacíos usan `\u00A0` + visibility hidden
2. **extractFieldConfig()** - Soporte para `<help>` directo (sin `<attributes>`)
3. **extractFieldConfig()** - Soporte para `<default>` directo

### Cambios en styles.css

1. **`.horizontal-container`** - `align-items: flex-end`
2. **`.field-block-horizontal .input-group`** - `width: auto !important`
3. **Labels mínimo height** - `min-height: 1.2rem` para alineación

---

## Test Manual

1. Abrir `forms/apps/clie2.xml`
2. Inspeccionar el DOM:
   - Buscar `<div class="horizontal-container">`
   - Verificar que tiene 2 hijos `.field-block-horizontal`
3. Verificar visualmente:
   - ¿Los dos inputs están en la misma línea?
   - ¿Se ve solo un ":" (de "Provincia:")?
4. Medir anchos con inspector:
   - .horizontal-container width?
   - .field-block-horizontal (1) width?
   - .field-block-horizontal (2) width?

---

## Si Sigue Sin Funcionar

### Opción A: Revisar parent container

El problema puede ser que `.horizontal-container` está dentro de otro contenedor que lo forza a comportamiento vertical.

### Opción B: Simplificar layout

Cambiar a un approach más simple:
```css
.horizontal-container {
  display: flex;
  gap: 1rem;
}

.horizontal-container .field-block-horizontal {
  display: inline-flex;
  flex-direction: column;
  width: auto;
}
```

### Opción C: Usar grid en lugar de flex

```css
.horizontal-container {
  display: grid;
  grid-template-columns: auto auto;
  gap: 1.5rem;
}
```

---

**Última actualización:** 2026-01-30
