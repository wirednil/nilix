# Propuesta — API de datos para handlers (ScopedDb v2)

**Fecha:** 2026-07-24
**Estado:** Propuesta de diseño, no implementada. Ningún código de producción fue tocado para escribir este documento.
**Origen:** continuación de la auditoría de `auth.db` (self-escalation a `rol='wizard'`, SQLi vía `keyField`, `isGlobalWizard`) hacia el lado de `app.db` y la capa de extensión de handlers.

---

## Por qué existe esto

`ScopedDb` (`src/services/scopedDb.ts`) expone `find()`, `findAll()`, `insert()` con auto-inyección de `empresa_id`. **No tiene `update()` ni `remove()`.** La consecuencia no es hipotética — está confirmada en un handler real:

```js
// apps/precios_handler.js:35-38
db.prepare('DELETE FROM demo_productos WHERE id = ?')
// apps/precios_handler.js:53-56
db.prepare('UPDATE demo_productos SET precio_actual = ? WHERE id = ?')
```

Ninguna de las dos tiene `empresa_id` en el `WHERE`. `demo_productos` es una tabla multi-tenant real, compartida hoy por 3 tenants:

```
PRAGMA table_info(demo_productos) → tiene columna empresa_id
SELECT empresa_id, COUNT(*) FROM demo_productos GROUP BY empresa_id
  → [[1,49],[2,34],[3,39]]   (pizzería, parrilla, heladería)
```

Cualquier usuario autenticado en un tenant puede borrar o repricear productos de otro tenant mandando ese `id` en el body de un POST a `precios.xml`. `db.prepare()` (`scopedDb.ts:68-70`) es un passthrough directo a `rawDb.prepare()` — cero scoping, por diseño (es el escape hatch documentado). Ver la corrección en `HANDLER-AUDIT.md` — esto ya había sido auditado por SQL injection (correctamente, sin riesgo) pero nunca por scope de tenant.

**La API nueva tiene que hacer que este error sea imposible, no improbable.**

---

## Fase A — Qué necesita el XML

### Tipos de campo y su operación de datos

| tipo XML | dónde se resuelve | operación de datos |
|---|---|---|
| `text`/`textarea`/`date`/`number`/`checkbox` | render puro (`InputField.js`, `Checkbox.js`) | ninguna |
| `select` estático | render puro | ninguna — opciones embebidas en el XML |
| `select` + `<in-table>` → `dynamic-select` (`LayoutProcessor.js:209-245`) | `Autocomplete.js` | **lookup de catálogo**, con `filter-by` opcional y `<copy from= to=>` |
| `multifield` (`Multifield.js`) | render propio | leer N filas relacionadas + N filas borradas (`${id}_deleted`, auto-generado por el framework, `Multifield.js:524-528`) + sincronizar |
| `is="expr"` | 100% cliente (`ExpressionEngine`) | ninguna — nunca toca el backend |
| `<subform>` | navegación client-side | ninguna de `db` — orquestación de UI |

**Hallazgo clave:** el lookup de `in-table`/autocomplete **no pasa por ningún handler** — va directo a `/api/v1/catalogs/:table` o `/api/v1/records/:table` (`LookupService.js:4-5,19-67`). Los catálogos ya están resueltos por un subsistema separado. Lo que le queda a un handler es exactamente lo que este documento cubre: leer/escribir registros relacionados que el motor genérico no sabe manejar.

### Ciclo de vida de hooks (confirmado línea por línea contra `recordController.js`)

```
assertOperationAllowed(table, 'canAdd'/'canUpdate'/'canDelete')  → RADU, solo sobre la tabla de la ruta
validateWithHandler(handler, data)          → handler.validate(data)          SIN db
  ↓ si inválido: 400, corta
createScopedDb(...)
transformWithHandler(handler, data, db)     → handler.beforeSave(data, db)    CON db
saveDatabase()                               → flush a disco — ANTES del insert primario
  ↓ si transformedData === null: afterSaveWithHandler(handler, data, false) SIN db, return (bypass CRUD)
recordService.insert/upsert/update(...)     → acá se genera el PK
afterSaveWithHandler(handler, result.data, isInsert)  → handler.afterSave(data, isInsert)   SIN db
```

`deleteRecord`: `beforeDeleteWithHandler(handler, id)` sin `db` → `recordService.remove()` → `afterDeleteWithHandler(handler, id)` sin `db`.

**Hallazgo central:** `afterSave` es el único hook que corre después de que la fila primaria tiene su PK generado (`recordController.js:135-137,227-229,305-307`), pero **no recibe `db`** (`handlerService.js:93-99`). El hook con el timing correcto existe; le falta el parámetro que lo haría útil. Por eso `ordenes_handler.js` inserta en `caja` en `beforeSave` (antes de que exista `id_orden`) en vez de en `afterSave` (cuando sí existiría).

Inconsistencias menores encontradas de paso: en `createRecord`, cuando un handler bypassa el CRUD (`transformedData === null`), `afterSaveWithHandler(handler, data, false)` pasa `isInsert=false` incluso en un alta (`recordController.js:129`), y la respuesta dice `{updated:true}` en vez de `{created:true}` (línea 130). Ningún handler actual depende de esto, pero rompería a uno que sí lo hiciera.

### Huecos que justifican que existan handlers

1. Insertar/actualizar/borrar en una tabla distinta de la que el form declara.
2. Leer el estado anterior de un registro antes de decidir qué hacer.
3. Sincronizar filas de un multifield contra otra tabla (altas + bajas + ediciones en un guardado).
4. Find-or-create por una clave no-PK.
5. Reglas de habilitación de campos dependientes de otro campo (`after`).

---

## Inventario completo — 5 handlers, 2 apps, ambos directorios agotados

`.env` → `NIL_APP_DIR=electro-pos/apps/` (2 handlers). Fallback core `nilix/handlers/` no existe. A pedido, se extendió a `pizzeria/apps/` (3 handlers) porque la muestra de electro-pos sola no mostraba ninguna necesidad de `update()`/`remove()`.

| handler | hook | operación | cómo la hace | tenant-safe |
|---|---|---|---|---|
| `equipos_handler.js` | after/beforeSave | UI + shaping de data, sin persistir | no toca `db` | N/A (`equipos` sin `empresa_id`) |
| `ordenes_handler.js` | after/validate | UI + validación | no toca `db` | N/A |
| `ordenes_handler.js` | beforeSave (lectura) | leer estado anterior | `db.find('ordenes', {id_orden})` ×2 | N/A (`ordenes` sin `empresa_id`) |
| `ordenes_handler.js` | beforeSave (escritura) | insert en `caja` | `db.insert('caja', {...})` ×2 | N/A |
| `venta_handler.js` | after | filtro dropdown + poblar carrito | `db.findAll`/`db.find` | Sí — auto-scopeado |
| `venta_handler.js` | beforeSave | insert cabecera + N líneas, bypassa CRUD | `db.insert('ventas'/'detalle_ventas')` | Sí, pero **sin garantía transaccional** |
| `precios_handler.js` | after | poblar grilla | `db.findAll` | Sí |
| `precios_handler.js` | beforeSave DELETE | borrar productos del multifield | `db.prepare(DELETE...)` | 🔴 **NO — el hallazgo central** |
| `precios_handler.js` | beforeSave UPDATE | actualizar precio | `db.prepare(UPDATE...)` | 🔴 **NO — mismo problema** |
| `producto_nuevo.handler.js` | after/beforeSave | find-or-create categoría | `db.find`/`db.insert` | Sí |

**14 operaciones de `db` en total: 8 `find`/`findAll`, 6 `insert`, 2 `prepare()` crudo (ambas en `precios_handler.js`, ambas UPDATE/DELETE por PK, ambas sin scope). Cero JOINs. Cero agregación SQL. Cero uso de `fs`/`child_process`/red en ningún handler.**

### Respuestas a las preguntas del inventario

1. **Mutaciones UPDATE/DELETE simples por PK:** 2, ambas en `precios_handler.js`, ambas forzadas a `prepare()` porque no hay otra forma.
2. **Lo que `update()`/`remove()` básico NO cubre:** nada de lo observado necesita SQL más complejo. Pero hay un problema de **atomicidad**, no de expresividad, en 2 lugares reales: `caja.id_orden=NULL` en altas nuevas (`ordenes_handler.js`, el ID no existe todavía en `beforeSave`) y el loop de `detalle_ventas` sin rollback si falla a mitad de camino (`venta_handler.js:80-88`).
3. **Lectura/escritura fuera de tenant:** sí, confirmado, `precios_handler.js`, dos veces. El resto son tenant-safe por construcción (`find`/`findAll`/`insert` auto-inyectan), no por disciplina del programador.
4. **`fs`/`child_process`/red:** ninguno en los 5 handlers.
5. **Confianza en `data` sin validar:** `equipos_handler.js:41` (`{...data}` sin allowlist, bajo riesgo en esa tabla); `precios_handler.js:32` (`JSON.parse` sin validar forma ni tope de longitud, además de sin scope de tenant); `venta_handler.js:60` (`precio_unitario` tomado directo del body del cliente, nunca revalidado contra `demo_productos.precio_actual` — el ejemplo `data.precio` real, no hipotético).
6. **Lógica duplicada:** el patrón "leer filas de un multifield desde claves planas `prefijo_campo_N` con regex" aparece dos veces (`venta_handler.js:53-63`, `precios_handler.js:44-46`) — candidato real a método de la API.
7. **Rango por índice vs SQL crudo:** de las 14 operaciones, 0 JOINs, 0 agregación SQL. Las 2 que hoy usan `prepare()` son UPDATE/DELETE por PK lisos, forzados a crudo únicamente porque la API no tiene esos verbos.

---

## Propuesta de superficie

```ts
interface HandlerDb {
  cursor<T>(table: string, index?: string): Cursor<T>;
  get<T>(table: string, key: unknown): T | null;   // = cursor(table).from(key).to(key).fetch()[0] ?? null

  insert(table: string, data: Record<string, unknown>): number;              // falla si ya existe la PK (si se pasa una)
  put(table: string, key: unknown, data: Record<string, unknown>): number;   // upsert por PK
  del(table: string, key: unknown): boolean;

  canAdd(table: string): boolean;
  canUpdate(table: string): boolean;
  canDelete(table: string): boolean;

  transaction<T>(fn: (db: HandlerDb) => T): T;   // fn debe ser síncrona (ver Feasibility)

  sql(statement: string, arity: number): SqlCursor;  // reemplazo de exec()/prepare()
}

interface Cursor<T> {
  from(value: unknown | unknown[]): Cursor<T>;
  to(value: unknown | unknown[]): Cursor<T>;
  where(conditions: Record<string, unknown>): Cursor<T>;  // igualdad adicional, mismo scan
  fetch(limit?: number): T[];
  fetchPrev(limit?: number): T[];
  count(): number;
}
```

`empresa_id` nunca es parámetro — se inyecta con el mismo mecanismo que `find`/`insert` ya usan (`schemaService.hasColumn`, `scopedDb.ts:12-14`), extendido a los verbos nuevos sin cambiar la filosofía.

**Test de "¿hay más de una forma de hacer lo mismo?" aplicado:** `find`/`findAll` de hoy se colapsan en `get`/`cursor().where()` — no quedan como API paralela. `db` nunca expone `Statement` de sql.js (`.bind/.step/.free` desaparecen del lado del handler).

### Transacciones — ownership: unirse, no transferir

sql.js es un blob en memoria sin locks reales — no hay ningún recurso con dueño que transferir entre llamadas. `db.transaction(fn)` se une a la transacción existente si ya hay una abierta; el commit real ocurre una sola vez, al cierre del bloque más externo.

### Destino de `exec()`/`prepare()`: reemplazar, no gatear

Se eliminan. `db.sql(statement, arity)` los reemplaza: aridad declarada por adelantado, rechazo si no coincide con los `?` del statement. `empresa_id` no se auto-inyecta acá — SQL crudo es responsabilidad de quien lo escribe, y eso queda documentado en el error si aplica.

---

## Feasibility — qué es construible ya, con qué stack

Chequeado contra el stack real (sql.js WASM in-memory, single-process, Node/Express), no solo justificado por el inventario. Dato verificado antes de esta sección: `PRAGMA index_list` sobre las 8 tablas reales de ambas apps → **cero índices secundarios declarados en ningún schema**, solo el implícito de la PK.

### Factible ya, barato — reutiliza infraestructura existente

`get`, `del`, `put` (mismo patrón que `authRecordService.upsert()`, ya escrito y probado del lado de `auth.db`), `insert` con "falla si existe", **`canAdd`/`canUpdate`/`canDelete`** (la lógica ya existe completa — `assertOperationAllowed`, RADU, `menuService.tablePermissions` — es exponerla, no escribirla), `afterSave(data, isInsert, db)` (una línea + pasar el `db` que `recordController.js` ya construye), `sql(statement, arity)` (reescritura de una función existente + contar `?`).

### Factible, pero con una decisión de diseño antes de escribir código

**`transaction(fn)`** — sql.js es una sola conexión compartida sin aislamiento entre requests concurrentes de Express. Un `BEGIN`/`COMMIT` real funciona bien si `fn` es **síncrona** — que es el caso de los 2 bugs reales encontrados (ningún `await` en el tramo que escribe). Si un handler futuro necesita `await` dentro de una transacción (ej. `bcrypt.hash`, ya usado del lado de `auth.db`), hay una ventana real de interleaving con otra request. **Recomendación: `transaction(fn)` solo acepta `fn` síncrona por ahora.**

**Framework envolviendo `beforeSave`→insert primario en transacción por defecto** — factible, pero cambia comportamiento de todas las tablas/handlers existentes a la vez; correr contra el suite completo antes de asumir que no rompe nada.

### Factible de construir, pero sin target real hoy

**Cursor por índice nombrado más allá de la PK** — con cero índices secundarios en ningún schema real, hoy siempre operaría en modo "por PK". Lo que hace falta ahora es más chico: `cursor(table)` rangea por PK, `.where()` filtra el resto con table scan (rápido al volumen actual — pizzeria tiene ~120 productos en total). Construir soporte de índice arbitrario sería infraestructura para un caso que no existe en ningún schema todavía.

### No recomendable dado el stack, aunque sea "factible" en sentido literal

Locking pesimista (sql.js no tiene otro escritor con quien competir), `SetRelation` global (reabriría la clase de bug que esta auditoría cerró en `auth.db`), campos tipados/`SetCursorFlds` (JS ya da esto gratis).

---

## Orden sugerido para una futura Fase D

1. `get`/`del`/`put`/`insert`/`canAdd`/`canUpdate`/`canDelete` — bajo riesgo, alto cierre. `canAdd/canUpdate/canDelete` cierra el bypass de RADU sobre tablas secundarias encontrado en la validación de Fase B.
2. `afterSave(data, isInsert, db)` — un cambio, cierra `caja.id_orden=NULL`.
3. `transaction(fn)` síncrona — cierra el loop de `detalle_ventas`.
4. `sql()` reemplazando `exec`/`prepare` — cierra el escape hatch.
5. Cursor simple (PK + `.where()`) — generaliza `find`/`findAll` sin inventar soporte de índice que ningún schema usa todavía.

**No implementado. No hay commit ni cambio de código asociado a este documento.**
