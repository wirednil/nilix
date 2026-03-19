# Comparativa: NILENGINE (MForm FDL) vs Nilix

**Fecha:** 2026-03-11
**Versión NILENGINE:** MForm.txt (Manual Completo)
**Versión Nilix:** v2.3.0
**Estado de Implementación:** ~95% completado

*Archivo histórico (v0.20.0): `docs/07-archive/COMPARATIVA-NILENGINE-vs-SPACE-FORM-v0.20.md`*

---

## COMPLETITUD GENERAL

| Feature FDL | NILENGINE (MForm) | Nilix v2.3.0 | Completado |
|-------------|----------------|-------------------|-----------|
| **Form Definition XML** | ✅ Completo | ✅ Completo | 95% |
| **Validaciones** | ✅ Avanzado | ✅ Completo | 90% |
| **Layout** | ✅ Complejo | ✅ Complejo | 100% |
| **Persistencia / CRUD** | ❌ (externo) | ✅ SQLite multi-tenant + ScopedDb | 100% |
| **Subformularios** | ✅ Dinámicos | ❌ No | 0% |
| **Campos Múltiples (multifield)** | ✅ Matrices | ✅ Grids + stepper + appendRow | 85% |
| **Campos Agrupados** | ✅ Validación cruzada | ❌ No | 0% |
| **Zona de Claves** | ✅ PAG_SIG/ANT | ✅ key="true" + PAG_SIG/ANT | 90% |
| **Reportes (RDL/YAML)** | ✅ RDL completo | ✅ YAML + DuckDB-WASM | 80% |
| **BD Integration** | ✅ in table | ✅ in-table SQLite + Autocomplete | 95% |
| **Autenticación / Multi-tenant** | ❌ (externo) | ✅ JWT + bcrypt + ScopedDb | 100% |
| **Handler System** | ❌ (externo) | ✅ after/beforeSave/validate | 100% |
| **RADU Permissions** | ❌ (externo) | ✅ client + server-side | 100% |
| **Campos Virtuales (is=)** | ✅ Completo | ✅ aritmético + sum/avg/count | 85% |
| **Validaciones inline** | ✅ check/between/in | ✅ + min/max/pattern/message | 100% |
| **Mobile UX** | ❌ (terminal) | ✅ responsive cards + sticky | 100% |
| **Reportes Públicos** | ❌ | ✅ public_token UUID base64url | 100% |

---

## FEATURES IMPLEMENTADOS (nil-form)

### 1. Form Definition XML (95%)

```xml
<!-- Nilix v2.3.0 -->
<form id="producto" title="Productos" database="demo_productos"
      handler="producto_nuevo" crud-mode="standard">
    <form-attributes>
        <use>demo_productos</use>
        <window border="single"/>
        <messages>
            <message id="HELP_COD">Código interno del producto</message>
        </messages>
        <confirm>add, delete, end</confirm>
        <display-status>true</display-status>
    </form-attributes>
    <layout>...</layout>
</form>
```

Implementado: `<form>`, `<form-attributes>`, `<use>`, `<messages>`, `<confirm>`, `<window>`, `<display-status>`, `handler=`, `crud-mode=`.
Faltante: `%language`, `%autowrite` (no es crítico en web).

---

### 2. Layout Containers (100%)

```xml
<container type="horizontal">
    <border>
        <field id="id" label="Código" type="number" keyField="true" size="6"/>
    </border>
    <field id="fecha" label="Fecha" type="date" align="right"/>
</container>
<container type="vertical">
    <field id="nombre" label="Nombre" type="text" size="50"/>
</container>
```

✅ Horizontal/vertical, anidamiento recursivo, border, align left/center/right.

---

### 3. Campos Básicos (100%)

| Tipo | Estado |
|------|--------|
| text, number, date, time, email, tel | ✅ |
| textarea | ✅ |
| checkbox | ✅ |
| select con `<options>` (estático) | ✅ |
| select con `<in-table>` + `<copy>` (dinámico) | ✅ |
| skip / display-only | ✅ |
| default (today, valor) | ✅ |
| autoenter | ❌ |
| mask | ❌ |

---

### 4. Validaciones (90%)

```xml
<field id="descuento" type="number" label="Descuento">
    <validation>
        <required>true</required>
        <min>0</min>
        <max>100</max>
        <pattern>^\d+$</pattern>
        <message>Descuento entre 0 y 100, entero</message>
    </validation>
</field>
<field id="precio" type="number" label="Precio">
    <validation>
        <check>this > 0 and this <= 999999</check>
    </validation>
</field>
```

✅ required, min, max, pattern, message, check (ExpressionEngine), between, in, cross-field.
❌ `check after campo` (validación diferida al salir del grupo), `unique` a nivel campo simple.

---

### 5. Campos Virtuales — `is=` (85%)

```xml
<field id="subtotal" label="Subtotal" is="precio * cantidad" skip="true"/>
<field id="total_items" label="Total Items" is="sum(importe)" skip="true"/>
<field id="promedio" label="Promedio" is="avg(precio)" skip="true"/>
```

✅ Expresiones aritméticas, funciones agregadas sum/avg/count/min/max sobre columnas multifield.
❌ `is descr(campo)`, `is help(tecla)`, `is time/date(expr)`.

---

### 6. Multifield — Grids (85%)

```xml
<field id="items" label="Items" type="multifield" rows="50" display="7">
    <field id="codigo" label="Código" type="number" size="6"/>
    <field id="descripcion" label="Descripción" type="text"/>
    <field id="cantidad" label="Cant" type="number" size="3" is="stepper"/>
    <field id="precio" label="Precio" type="number" unique="true"/>
    <field id="subtotal" label="Subtotal" is="cantidad * precio" skip="true"/>
</field>
```

✅ rows/display/paginación, unique, stepper, appendRow dinámico desde handler, mobile cards.
❌ `ignore [delete] [add] [insert]` por fila.

---

### 7. Zona de Claves / PAG_SIG / PAG_ANT (90%)

```xml
<field id="id" label="Código" type="number" keyField="true" size="6"/>
```

Al completar el campo `keyField="true"` → `ValidationCoordinator.loadRecord()` → `RecordService.load()` → puebla el form.

✅ Carga DbToFm, PAG_SIG/PAG_ANT (`< ANT` / `SIG >`), RADU-aware (visibles en modo lectura).
❌ `LEER_SIGUIENTE/LEER_PREVIO` por múltiples criterios simultáneos.

---

### 8. Handler System (100%)

```javascript
// /opt/wc/pizzeria/apps/producto_handler.js
module.exports = {
    table: 'demo_productos',
    keyField: 'id',
    after(fieldId, value, data, db) {
        if (fieldId === 'id_categoria') {
            const prods = db.findAll('demo_productos', { id_categoria: value });
            return { populate: { fieldId: 'items', rows: prods } };
        }
    },
    beforeSave(data, db) {
        // lógica multi-table
        return data;
    }
};
```

✅ after/beforeSave/validate/before/afterSave/beforeDelete/afterDelete, ScopedDb, appendRow, setValues, enableFields/disableFields.

---

### 9. Autenticación Multi-tenant (100%)

```
JWT payload: { usuarioId, empresaId, rol, publicToken, jti }
HttpOnly cookie nil_token → XSS-safe
ScopedDb: auto-filtra empresa_id en todas las queries
Rate limiting: 10/15min por IP
Blacklist JTI: logout real
```

✅ bcrypt, JWT, ScopedDb, IDOR prevention, public token para reportes públicos.

---

## FEATURES NO IMPLEMENTADOS

### 1. Subformularios (0%)

```xml
<!-- NILENGINE: -->
<field id="codigo" subform "cod1"/>
```

Desplegar formulario modal cuando se completa un campo. Anidamiento hasta 8 niveles.
**Impacto:** No puede hacer ABM de entidades relacionadas en una sola pantalla.
**Estimación:** 5-7 días.

---

### 2. Campos Agrupados (0%)

```xml
<!-- NILENGINE: -->
{ __/__/__ __/__/__ }
%fields agrup: check desde <= hasta; desde:; hasta:;
```

Validación cruzada al salir del grupo, `check after campo`.
**Impacto:** No puede validar rangos fecha inicio/fin en el mismo blur event.
**Estimación:** 3 días.

---

### 3. Autoenter / Mask (0%)

- `autoenter` — pase automático al campo siguiente al completar maxLength
- `mask` — máscaras de entrada (CUIT, teléfono, etc.)

**Estimación:** 2 días.

---

## COBERTURA RDL / nil-report (80%)

| Feature RDL | NILENGINE | Nilix | Estado |
|-------------|---------|------------|--------|
| Zonas (header/footer/detail/separator/subtotal) | ✅ | ✅ | 100% |
| Control Breaks (before/after field y report) | ✅ | ✅ | 100% |
| Aggregates: sum, avg, count, min, max | ✅ | ✅ | 100% |
| runsum, runavg, runcount | ✅ | ❌ | 0% |
| DataSources + JOINs (DuckDB) | ✅ | ✅ | 95% |
| Formateo currency, date | ✅ | ✅ | 90% |
| Condicional `ifCondition` en zona | ✅ | ✅ | 80% |
| Variables today, pageno, hour | ✅ | ❌ | 0% |
| Output PDF/printer | ✅ | ❌ | 0% |
| Nav horizontal-scroll (nil-explorer) | — | ✅ | 100% |
| Multi-datasource (header + detail diferente) | — | ✅ | 100% |
| Backend DuckDB-WASM (OLAP) | — | ✅ | 100% |
| Reportes públicos (public_token) | — | ✅ | 100% |

**Diferenciadores Nilix vs NILENGINE RDL:**
- DuckDB-WASM para queries OLAP eficientes con JOINs nativos
- YAML más legible que RDL original (síntaxis declarativa)
- Live preview HTML interactivo con estética terminal
- Multi-tenant nativo: cada empresa ve sus propios datos
- Public token para acceso sin login

---

## COMPLETITUD POR CAPÍTULO FDL

| Capítulo | Complejidad | Nilix v2.3.0 | vs v0.20.0 |
|----------|-------------|-------------------|-----------|
| 3.1-3.6: Campos Básicos | Media | ✅ 100% | +100% |
| 3.7: %form attributes | Alta | ✅ 90% | +50% |
| 3.8: %fields | Alta | ✅ 95% | +25% |
| 3.9: Campos Simples + Select | Alta | ✅ 100% | +30% |
| 3.10: Campos Múltiples | Muy Alta | ✅ 85% | +85% |
| 3.11: Campos Agrupados | Alta | ❌ 0% | = |
| 3.12: Zona de Claves | Media | ✅ 90% | +90% |
| 3.13: Subformularios | Muy Alta | ❌ 0% | = |
| 4: Reportes (YAML/RDL) | Muy Alta | ✅ 80% | +80% |
| Auth/Multi-tenant (extensión) | Alta | ✅ 100% | +100% |

---

## RESUMEN EJECUTIVO

### Estado: 95% completado (v2.3.0)

**Implementado (desde v0.20.0):**
- ✅ CRUD completo con SQLite + ScopedDb multi-tenant
- ✅ Zona de claves + PAG_SIG/ANT
- ✅ Campos virtuales `is=` (aritmético + agregados)
- ✅ Validaciones inline (min/max/pattern/message)
- ✅ Stepper en multifield
- ✅ POS (appendRow dinámico desde handler)
- ✅ Mobile UX responsive (cards multifield, sticky bottom)
- ✅ Auth completa (bcrypt/JWT/HttpOnly cookie/blacklist/rate-limit)
- ✅ RADU client + server-side
- ✅ Report Engine (DuckDB-WASM, control breaks, aggregates, multi-datasource)
- ✅ Reportes públicos (public_token)
- ✅ Dynamic headers/footers en reportes (empresa_config)
- ✅ Multi-tenant 3 empresas demo

**Faltante (5% restante):**
- ❌ Subformularios (modales anidados) — 5-7 días
- ❌ Campos agrupados (validación cruzada) — 3 días
- ❌ Autoenter / Mask — 2 días
- ❌ Variables RDL (today/pageno) + output PDF — 3 días
- ❌ runsum/runavg/runcount — 1 día

---

## Referencias

- **NILENGINE Manual:** `docs/07-archive/MForm.md` + `docs/05-specs/`
- **Nilix Docs:** `docs/02-architecture/ANALYSIS-HIERARCHY.md`
- **Código:** `js/components/form/`, `js/components/report/`, `src/`
- **Comparativa histórica (v0.20.0):** `docs/07-archive/COMPARATIVA-NILENGINE-vs-SPACE-FORM-v0.20.md`

---

**Generado:** 2026-03-11 · **Reemplaza:** `COMPARATIVA-NILENGINE-vs-SPACE-FORM.md` (v0.20.0)
