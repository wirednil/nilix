# 📝 Guía para Escribir Formularios XML

---

## 🔌 Atributo `handler` en `<form>`

El atributo `handler` conecta el formulario con un archivo JS que implementa la lógica de negocio de la app.

### Resolución de handlers (orden de búsqueda)

```
$NIL_APP_DIR/apps/<handler>.handler.js   ← primero (handler de la app)
$NIL_APP_DIR/apps/<handler>.js           ← alternativo
nilix/handlers/<handler>.handler.js ← fallback (handlers genéricos del motor)
nilix/handlers/<handler>.js         ← fallback alternativo
```

`$NIL_APP_DIR` se deriva automáticamente del directorio donde vive `NIL_MENU_FILE`.

### Casos

```xml
<!-- Handler propio de la app — vive en $NIL_APP_DIR/apps/ -->
<form title="Producto Nuevo" database="demo_productos" handler="producto_nuevo">

<!-- Sin handler: CRUD genérico del motor, sin lógica de negocio custom -->
<form title="Categorías" database="demo_categorias" handler="none">

<!-- Sin atributo handler: equivalente a handler="none" -->
<form title="Categorías" database="demo_categorias">
```

### Convención `handler="none"`

Cuando un formulario es CRUD puro (sin `after`, `beforeSave`, `validate` custom), declarar explícitamente `handler="none"`. Esto deja claro que **no es un olvido** sino una decisión intencional.

El motor ignora el string `"none"` — si `loadHandler("none")` retorna `null`, el sistema usa RecordService directamente.

### Estructura de un handler

```javascript
// $PIZZERIA/apps/producto_nuevo.handler.js
module.exports = {
    table: 'demo_productos',
    keyField: 'id',

    // Llamado cuando cambia un campo (en tiempo real)
    after(fieldId, value, data, db) {
        // retorna: { setValues, enableFields, disableFields, populate } | null
    },

    // Validaciones antes de guardar
    validate(data) {
        // retorna: { valid: boolean, errors: [] }
    },

    // Transformación de datos antes de INSERT/UPDATE
    beforeSave(data, db) {
        // retorna: datos transformados
    },

    // Hook post-guardado
    afterSave(data, isInsert) {}
};
```

---

## ⚠️ Importante: Escapar Operadores en `<check>`

### Problema

XML interpreta `<` y `>` como inicio/fin de etiquetas, lo que causa errores de parsing cuando usas expresiones con estos operadores.

❌ **INCORRECTO:**
```xml
<validation>
    <check>edad >= 18</check>
    <check>precio <= 1000</check>
    <check>cantidad > 0</check>
</validation>
```

**Error:**
```
XML Parsing Error: not well-formed
```

---

### ✅ Solución: Usar CDATA

Envuelve la expresión en `<![CDATA[ ... ]]>`:

```xml
<validation>
    <check><![CDATA[edad >= 18]]></check>
    <check><![CDATA[precio <= 1000]]></check>
    <check><![CDATA[cantidad > 0]]></check>
</validation>
```

---

## 📋 Reglas Rápidas

### 1. **Siempre usa CDATA con operadores**

Operadores que requieren CDATA:
- `<`, `>`, `<=`, `>=`
- Cualquier expresión con estos símbolos

```xml
✅ <check><![CDATA[edad >= 18]]></check>
✅ <check><![CDATA[precio * cantidad <= 10000]]></check>
✅ <check><![CDATA[fecha >= today - 90]]></check>
```

---

### 2. **CDATA no es necesario para estos casos:**

```xml
<!-- Operadores que NO requieren CDATA -->
✅ <check>edad == 18</check>
✅ <check>nombre != "admin"</check>
✅ <check>categoria in (1, 2, 3)</check>
✅ <check>edad between 18 and 65</check>
```

Pero por consistencia, **recomendamos usar CDATA siempre** en `<check>`:

```xml
<check><![CDATA[categoria in (1, 2, 3)]]></check>
```

---

## 📚 Ejemplos Completos

### Ejemplo 1: Validación Simple

```xml
<field id="edad" label="Edad" type="number">
    <validation>
        <required>true</required>
        <check><![CDATA[edad >= 18]]></check>
    </validation>
</field>
```

---

### Ejemplo 2: Validación Cruzada

```xml
<field id="precio" label="Precio" type="number"/>

<field id="cantidad" label="Cantidad" type="number">
    <validation>
        <check><![CDATA[precio * cantidad <= 10000]]></check>
    </validation>
</field>
```

---

### Ejemplo 3: Fecha

```xml
<field id="fecha_compra" label="Fecha" type="date">
    <attributes>
        <default>today</default>
    </attributes>
    <validation>
        <check><![CDATA[fecha_compra >= today - 365]]></check>
    </validation>
</field>
```

---

### Ejemplo 4: Operadores Lógicos

```xml
<field id="saldo" label="Saldo" type="number">
    <validation>
        <check><![CDATA[edad >= 18 and saldo > 0]]></check>
    </validation>
</field>
```

---

### Ejemplo 5: Between e In

```xml
<!-- Between -->
<field id="edad_jubilacion" label="Edad" type="number">
    <validation>
        <check><![CDATA[edad_jubilacion between 18 and 65]]></check>
    </validation>
</field>

<!-- In -->
<field id="categoria" label="Categoría" type="number">
    <validation>
        <check><![CDATA[categoria in (1, 2, 3)]]></check>
    </validation>
</field>
```

---

## 🔍 Referencia de Operadores Soportados

| Operador | Descripción | Ejemplo CDATA |
|----------|-------------|---------------|
| `>` | Mayor que | `<![CDATA[edad > 18]]>` |
| `<` | Menor que | `<![CDATA[edad < 65]]>` |
| `>=` | Mayor o igual | `<![CDATA[edad >= 18]]>` |
| `<=` | Menor o igual | `<![CDATA[precio <= 1000]]>` |
| `==` | Igual | `<![CDATA[tipo == 1]]>` |
| `!=` | Diferente | `<![CDATA[nombre != "admin"]]>` |
| `between` | Rango | `<![CDATA[edad between 18 and 65]]>` |
| `in` | Lista valores | `<![CDATA[categoria in (1,2,3)]]>` |
| `and` | Y lógico | `<![CDATA[edad >= 18 and saldo > 0]]>` |
| `or` | O lógico | `<![CDATA[tipo == 1 or tipo == 2]]>` |
| `+`, `-`, `*`, `/` | Aritmética | `<![CDATA[precio * cantidad <= 10000]]>` |

---

## 🚨 Errores Comunes

### Error 1: Olvidar CDATA

```xml
❌ <check>edad >= 18</check>
✅ <check><![CDATA[edad >= 18]]></check>
```

### Error 2: CDATA mal cerrado

```xml
❌ <check><![CDATA[edad >= 18]></check>
✅ <check><![CDATA[edad >= 18]]></check>
      ^                       ^^
      Apertura             Cierre
```

### Error 3: Espacios innecesarios

```xml
⚠️  <check> <![CDATA[edad >= 18]]> </check>
✅ <check><![CDATA[edad >= 18]]></check>
```

Funciona, pero la forma limpia es sin espacios.

---

## 🧪 Probar tus Expresiones

Usa el formulario de prueba incluido:
```
forms/apps/test-check-expressions.xml
```

Este archivo tiene 10 tests diferentes que cubren todos los operadores soportados.

---

## 📖 Ver Más

- `MForm-progress.md` - Estado de implementación
- `PASOS-CRITICOS-COMPLETADOS.md` - Documentación completa
- `docs/07-archive/MForm.txt` - Especificación FDL

---

**Última actualización:** 2026-01-30
