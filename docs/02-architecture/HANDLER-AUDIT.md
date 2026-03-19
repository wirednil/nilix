# Auditoría de Handlers — Inventario de Seguridad

**Fecha:** 2026-03-18
**Auditor:** T0.3 del Plan de Producción
**Alcance:** todos los handlers activos del motor y de la app de demo

---

## Metodología

Para cada handler se revisa:

1. **API DB usada** — `ScopedDb` (seguro, parametrizado internamente) vs `db.prepare()`/`db.exec()` (escape hatch, requiere revisión manual)
2. **Interpolación de datos de usuario** — ¿algún valor de `data` llega a SQL sin casting o sanitización?
3. **Manejo de errores** — ¿puede un input malformado causar un crash no manejado?

**Veredictos posibles:**

| Veredicto | Significado |
|-----------|-------------|
| `SAFE` | Sin riesgo de SQLi. Sin crash path por input malformado. |
| `SAFE-MINOR` | Sin riesgo de SQLi, pero con una observación de robustez menor. |
| `NEEDS-REVIEW` | Usa escape hatches o lógica compleja que requiere revisión más profunda. |
| `UNSAFE` | SQLi posible o crash garantizado por input externo. Requiere fix inmediato. |

---

## Inventario

### 1. `src/handlers/auth/nil-users.js`

| Campo | Detalle |
|-------|---------|
| **Ubicación** | `space-form/src/handlers/auth/nil-users.js` |
| **Propósito** | Handler del formulario de gestión de usuarios internos |
| **API DB usada** | Ninguna — módulo vacío (`module.exports = {}`) |
| **Veredicto** | ✅ SAFE |

**Notas:** Sin lógica. El CRUD estándar del motor maneja todo. No hay superficie de ataque.

---

### 2. `apps/precios_handler.js`

| Campo | Detalle |
|-------|---------|
| **Ubicación** | `$NIL_APP_DIR/apps/precios_handler.js` |
| **Propósito** | Gestión de precios en bulk via multifield. Permite eliminar y actualizar precios de productos en una sola operación. |
| **API DB usada** | `db.findAll()` (ScopedDb) + `db.prepare()` (escape hatch) |
| **Veredicto** | ⚠️ SAFE-MINOR |

**Análisis detallado:**

```js
// after() — ScopedDb, sin riesgo
db.findAll('demo_productos', { id_categoria: value, activo: 1 });
```
`value` llega sin casting pero ScopedDb usa bind parameters internamente. Sin riesgo.

```js
// beforeSave() — db.prepare() con DELETE
const stmt = db.prepare('DELETE FROM demo_productos WHERE id = ?');
stmt.bind([parseInt(row.id)]);   // ← parseInt: casting explícito
```
Query parametrizada. `parseInt()` garantiza que nunca llega un string a la query. **Sin riesgo de SQLi.**

```js
// beforeSave() — db.prepare() con UPDATE
const stmt = db.prepare('UPDATE demo_productos SET precio_actual = ? WHERE id = ?');
stmt.bind([parseFloat(precio), parseInt(id)]);   // ← parseFloat + parseInt
```
Mismo patrón. **Sin riesgo de SQLi.**

**Observación menor (no SQLi):**
```js
const deletedRows = JSON.parse(data.productos_deleted || '[]');  // ← sin try/catch
```
Si `productos_deleted` llega como JSON malformado (ej: `"[{broken"`), `JSON.parse` lanza una excepción no capturada que propaga al handler del error global del motor → respuesta 500. No es un vector de SQLi ni RCE, pero sí un crash evitable.

**Fix recomendado:**
```js
let deletedRows = [];
try {
    deletedRows = JSON.parse(data.productos_deleted || '[]');
} catch {
    deletedRows = [];
}
```

---

### 3. `apps/producto_nuevo.handler.js`

| Campo | Detalle |
|-------|---------|
| **Ubicación** | `$NIL_APP_DIR/apps/producto_nuevo.handler.js` |
| **Propósito** | Crear producto con posibilidad de crear una nueva categoría en la misma operación |
| **API DB usada** | Solo ScopedDb: `db.find()`, `db.insert()` |
| **Veredicto** | ✅ SAFE |

**Análisis detallado:**

```js
// after() — find con parseInt
db.find('demo_categorias', { id: parseInt(value) });
```

```js
// beforeSave() — find + insert via ScopedDb
db.find('demo_categorias', { nombre: nombreCategoria });   // ← string, pero ScopedDb parametriza
db.insert('demo_categorias', { nombre: nombreCategoria, activo: 1 });
```
`nombreCategoria` proviene de `data.nombre_categoria?.trim()`. No hay concatenación de SQL. ScopedDb usa bind parameters. **Sin riesgo.**

Los valores numéricos en el `return` de `beforeSave` usan `parseFloat()` e `parseInt()` antes de ser procesados por el CRUD estándar.

---

### 4. `apps/venta_handler.js`

| Campo | Detalle |
|-------|---------|
| **Ubicación** | `$NIL_APP_DIR/apps/venta_handler.js` |
| **Propósito** | Punto de Venta: registra cabecera de venta + líneas de detalle en una transacción |
| **API DB usada** | Solo ScopedDb: `db.findAll()`, `db.find()`, `db.insert()` |
| **Veredicto** | ✅ SAFE |

**Análisis detallado:**

```js
// after() — findAll + find con parseInt
db.findAll('demo_productos', { id_categoria: parseInt(value), activo: 1 });
db.find('demo_productos', { id: parseInt(value) });
```

```js
// beforeSave() — todos los valores numéricos son casteados antes de insert
db.insert('ventas', {
    total,                              // reduce() de parseFloat() de los ítems
    forma_pago:  data.forma_pago  || 'efectivo',   // string, ScopedDb parametriza
    tipo_pedido: data.tipo_pedido || 'local',
    numero_mesa: data.numero_mesa || null,
    nota:        data.nota        || null,
    fecha:       new Date().toISOString()           // generado internamente
});
```
`nombre_producto` en `detalle_ventas` proviene de `data[...]` sin casting, pero ScopedDb lo trata como string parametrizado. **Sin riesgo.**

---

## Resumen

| Handler | Veredicto | Usa `db.prepare()` | Fix requerido |
|---------|-----------|-------------------|---------------|
| `nil-users.js` | ✅ SAFE | No | — |
| `precios_handler.js` | ⚠️ SAFE-MINOR | **Sí** (2 queries) | `JSON.parse` sin try/catch |
| `producto_nuevo.handler.js` | ✅ SAFE | No | — |
| `venta_handler.js` | ✅ SAFE | No | — |

**Resultado: 0 handlers UNSAFE. 0 handlers NEEDS-REVIEW.**

El único uso de `db.prepare()` (escape hatch) está correctamente parametrizado con `?` y los valores están casteados a tipos numéricos antes del bind. No hay interpolación de strings en SQL.

---

## Reglas para handlers futuros

Para mantener este nivel de seguridad, cualquier handler nuevo debe seguir estas reglas:

1. **Preferir siempre la API de ScopedDb** (`find`, `findAll`, `insert`) sobre `prepare`/`exec`.
2. **Si se usa `db.prepare()`**, la query debe usar siempre `?` como placeholder. **Nunca** concatenar `data.*` en el string SQL.
3. **Castear siempre los tipos numéricos** antes de `bind()`: `parseInt()`, `parseFloat()`.
4. **Envolver `JSON.parse()` en try/catch** cuando parsea data de usuario.
5. **No usar `db.exec()`** con contenido derivado de datos del formulario.

---

## Auditoría de handlers de clientes

Si el sistema está desplegado con handlers propios del cliente (distintos a los de la app de demo), aplicar esta misma metodología sobre cada archivo en `$NIL_APP_DIR/apps/*.js`.

Lista de verificación rápida por handler:

- [ ] ¿Usa `db.exec()` con strings que incluyen `data.*`? → **UNSAFE**
- [ ] ¿Usa `db.prepare()` con concatenación de strings? → **UNSAFE**
- [ ] ¿Usa `db.prepare()` con `?` y casting numérico? → SAFE
- [ ] ¿Usa solo `find`/`findAll`/`insert`? → SAFE
- [ ] ¿Tiene `JSON.parse()` sin try/catch sobre datos de usuario? → SAFE-MINOR
