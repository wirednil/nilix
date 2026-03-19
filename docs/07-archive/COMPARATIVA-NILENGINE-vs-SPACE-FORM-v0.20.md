# Comparativa: NILENGINE (MForm) vs Space Form

**Fecha:** 2026-02-23
**Versión NILENGINE:** MForm.txt (Manual Completo)
**Versión Space Form:** v0.20.0
**Estado de Implementación:** 70% completado

---

## 📊 COMPLETITUD GENERAL

| Feature | NILENGINE (MForm) | Space Form | Completado |
|---------|----------------|------------|-----------|
| **Form Definition** | ✅ Completo | ✅ Básico | 80% |
| **Validaciones** | ✅ Avanzado | ⚠️ Moderado | 70% |
| **Layout** | ✅ Complejo | ✅ Simple | 90% |
| **Persistencia** | ❌ No | ✅ LocalStorage + SQLite | 100% |
| **Subformularios** | ✅ Dinámicos | ❌ No | 0% |
| **Campos Múltiples** | ✅ Matrices | ⚠️ Básico | 30% |
| **Campos Agrupados** | ✅ Validación cruzada | ❌ No | 0% |
| **Reportes** | ✅ RDL Completo | ⚠️ Web Engine + DuckDB | 45-50% |
| **BD/DB Integration** | ✅ in table | ✅ SQLite + DuckDB | 90% |

---

## ✅ FEATURES IMPLEMENTADOS (70%)

### 1. **Form Definition XML** (90%)

**NILENGINE:**
```
%form use biblio; window label "Libros";
messages HELP1: "Código"; ERROR: "Ya existe";
```

**Space Form:**
```xml
<form title="Carga Clientes">
    <form-attributes>
        <use>demo</use>
        <messages>
            <message id="NRO">Número de ficha</message>
        </messages>
    </form-attributes>
</form>
```

**Características implementadas:**
- ✅ Structure base `<form>`
- ✅ `<form-attributes>` con `<use>`, `<messages>`
- ✅ `<field>` con `<label>`, `<type>`, `<size>`
- ⚠️ Faltan `%form use`, `%window`, `%confirm`, `%ignore`

---

### 2. **Layout Containers** (100%)

**NILENGINE:**
```xml
CONTAINER horizontal
    FIELD provincia
    FIELD descripcion
END
```

**Space Form:**
```xml
<container type="horizontal">
    <field id="prov" label="Provincia" type="text" size="2"/>
    <field id="desc0" type="text" size="20">
        <attributes><skip>true</skip></attributes>
    </field>
</container>
```

**Características implementadas:**
- ✅ Horizontal/vertical containers
- ✅ Recursividad (nested containers)
- ✅ Soporte anidado hasta 8 niveles (mismo límite que NILENGINE)
- ✅ Campos con `skip` (readonly)

---

### 3. **Campo Skip (readonly)** (100%)

**NILENGINE:**
```xml
<field id="nombre" display only/>
<field id="desc" skip/>
```

**Space Form:**
```xml
<field id="desc0" type="text" size="20">
    <attributes><skip>true</skip></attributes>
</field>
```

**Características implementadas:**
- ✅ `<skip>` para campos de solo lectura
- ✅ `<display-only>` también soportado

---

### 4. **Validaciones Básicas** (60%)

**NILENGINE:**
```xml
<field id="nombre" not null/>
<field id="email" type="email"/>
```

**Space Form:**
```xml
<field id="email" type="email">
    <validation required="true"/>
</field>
```

**Características implementadas:**
- ✅ `required`
- ✅ `type="email"`, `type="date"`, `type="tel"`
- ⚠️ Faltan `not null` (usado con `required` pero diferente)

---

### 5. **Validaciones Avanzadas** (75%)

**NILENGINE:**
```xml
<field id="edad" check>edad >= 18</field>
<field id="precio" check>precio between 10 and 1000</field>
<field id="codigo" check>codigo in (1, 2, 3)</field>
```

**Space Form:**
```xml
<field id="edad" type="number">
    <validation>
        <check>edad >= 18</check>
    </validation>
</field>
<field id="precio" type="number">
    <validation>
        <check>precio between 10 and 1000</check>
    </validation>
</field>
```

**Características implementadas:**
- ✅ Operadores relacionales: `>`, `<`, `>=`, `<=`, `==`, `!=`
- ✅ `between`
- ✅ `in`
- ✅ Operadores lógicos: `and`, `or`
- ✅ Fechas con `today`
- ✅ Validaciones cruzadas (acceso a otros campos)
- ⚠️ Faltan `in table` real (solo lookup simulado)

---

### 6. **Persistence** (100%)

**NILENGINE:**
- Operaciones ADD/UPDATE/REMOVE/IGNORE (en programas CFIX)

**Space Form:**
```javascript
// Guardar
PersistenceService.save('form-id', formData);

// Obtener todas
PersistenceService.getAll('form-id');

// Exportar
PersistenceService.exportCSV('form-id');
PersistenceService.exportJSON('form-id');

// Estadísticas
PersistenceService.getStats('form-id');
```

**Características implementadas:**
- ✅ LocalStorage como backend
- ✅ Metadata automática (ID único, timestamp)
- ✅ Save/Get/Delete/Count
- ✅ Export CSV y JSON
- ✅ Submissions UI para visualizar datos guardados

---

## ❌ FEATURES FALTANTES (50% crítico)

### 1. **Subformularios** (0%)

**NILENGINE:**
```xml
<field id="codigo" type="text">
    <subform "cod1"/>
    <subform "cod2"/>
</field>
```

**Space Form:**
```xml
<!-- ❌ No existe subform -->
```

**Documentación NILENGINE:**
- Despliega formulario dinámicamente
- Puede anidarse hasta 8 niveles
- Se activa cuando se completa el campo (o con tecla META)
- Se usa para:
  - Cargar conjuntos de datos relacionados
  - Formularios muy complejos (no caben en una ventana)
  - Ingresar datos con diferente formato según valor

**Impacto crítico:**
- ❌ No puede hacer ABM de entidades relacionadas (ej: Clientes con Direcciones múltiples)
- ❌ No puede tener formularios condicionales (ej: si tipo=1 mostrar form A, si tipo=2 mostrar form B)

**Tiempo estimado:** 3-5 días

---

### 2. **Campos Múltiples** (0%)

**NILENGINE:**
```xml
<nrocuenta descrip debitos creditos rows 30 display 5/>
%fields grancampo: rows 30, display 5;
nrocuenta:;
descrip:;
debitos:;
creditos:;
```

**Space Form:**
```xml
<!-- ❌ No existe campo múltiple -->
```

**Documentación NILENGINE:**
- Campos en matrices (filas x columnas)
- Campo rector (primera columna) identifica la fila
- `rows` = total filas
- `display` = filas por pantalla (paginación)
- `unique` = verificar unicidad en toda la matriz

**Impacto crítico:**
- ❌ No puede cargar listas (ej: Items en orden de compra)
- ❌ Sin paginación visual

**Tiempo estimado:** 3-4 días

---

### 3. **Campos Agrupados** (0%)

**NILENGINE:**
```xml
{ __/__/__ __/__/__ }
%fields agrup: check a > b; a; b;
```

**Space Form:**
```xml
<!-- ❌ No existe campo agrupado -->
```

**Documentación NILENGINE:**
- Agrupa campos sucesivos en un campo virtual
- Permite validaciones cruzadas
- Soporta `check after campo` para posponer validación hasta salir del grupo

**Ejemplo:**
```xml
{ __/__/__ __/__/__ }
%fields agrup: check desde <= hasta; desde:; hasta:;
```

**Impacto crítico:**
- ❌ No puede validar que fecha "fin" >= fecha "inicio"
- ❌ No puede validar rangos de campos

**Tiempo estimado:** 2-3 días

---

### 4. **Zona de Claves** (0%)

**NILENGINE:**
```
FORMULARIO DE LIBROS -------------------Código: _,___. | Título: ______________________
<!-- Zona de Claves -->
<!-- Zona de Datos -->
```

**Space Form:**
```xml
<!-- ❌ No existe zona de claves -->
```

**Documentación NILENGINE:**
- Formularios con 2 zonas separadas
- Zona de Claves: Para buscar registros existentes
- Zona de Datos: Para AGREGAR/ACTUALIZAR/REMOVER
- Operaciones:
  - `LEER`: Al completar zona de claves
  - `LEER_SIGUIENTE/LEER_PREVIO`: Paginación de búsqueda
  - `PROCESAR`: AGREGAR/ACTUALIZAR/REMOVER (en zona de datos)

**Ejemplo:**
```xml
%form use biblio;
%fields codigo: libros.; titulo: libros.; autor: libros., in autores:nombre;
```

**Impacto crítico:**
- ❌ No puede buscar registros por ID
- ❌ No puede actualizar datos existentes
- ❌ No puede hacer búsquedas paginadas (LEER_SIGUIENTE/LEER_PREVIO)

**Tiempo estimado:** 3 días

---

### 5. **BD Integration** (30%)

**NILENGINE:**
```xml
<field id="autor" in autores:(nombre)/>
<field id="desc1" autores.nombre, display only/>
<field id="codigo" in grales(tipo):descrip/>
```

**Space Form:**
```xml
<!-- ❌ No conecta a base de datos real -->
```

**Documentación NILENGINE:**
- `in table` busca en tabla de base de datos
- `in table (by indice):campo1,campo2` para claves compuestas
- Copia automática de campos de descripción si están asociados
- Valida contra base de datos real
- Soporte para claves primarias e índices

**Impacto crítico:**
- ⚠️ No integra con base de datos real
- ⚠️ Solo tiene XML de prueba con validaciones simuladas

**Tiempo estimado:** 5-7 días

---

### 6. **Reportes** (45-50%)

**NILENGINE:**
```xml
%tit(pageno, today) before page LISTADO DEL PERSONAL
%linea(depto, nombre, sueldo) __. _____________________
%suma(sum(sueldo)) after depto Suma: ____
%totsuma(sum(sueldo)) after report Total: ____
%report use personal;
%fields depto:; nombre:; sueldo:;
```

**Space Form (v0.20.0):**
```yaml
zones:
  - name: header
    condition: { when: before, on: report }
    template: ["LISTADO DEL PERSONAL"]
  
  - name: linea
    expressions: [{ name: depto }, { name: nombre }, { name: sueldo }]
    template: ["{depto} {nombre} {sueldo}"]
  
  - name: suma
    condition: { when: after, on: [depto] }
    expressions: [{ aggregate: sum, argument: sueldo }]
    template: ["Suma: {sum_sueldo}"]
```

**Documentación NILENGINE:**
- RDL (Report Definition Language)
- Soporte para:
  - Zonas (`%zonas`) → ✅ Implementado
  - Funciones: `sum`, `avg`, `runsum`, `runavg`, `count`, `min`, `max` → ⚠️ Parcial (sum, avg, count, min, max)
  - Cortes: `before page`, `after report`, `before/after campo` → ✅ Implementado
  - `group with zona` → ❌ No implementado
  - `piepag` → ❌ No implementado
  - Output a archivo, printer, terminal, stdout → ❌ Solo HTML display

**Cobertura RDL por Feature:**

| Feature RDL | NILENGINE | Space Form | Estado |
|-------------|---------|------------|--------|
| Zonas | ✅ | ✅ | 70% |
| Control Breaks | ✅ | ✅ | 80% |
| Funciones agregación | ✅ | ⚠️ | 60% |
| Variables (today, hour, pageno) | ✅ | ❌ | 0% |
| DataSources/Queries | ✅ | ✅ | 90% |
| Output PDF/Printer | ✅ | ❌ | 0% |
| Formateo (currency, date) | ✅ | ⚠️ | 50% |
| Condicionales if | ✅ | ⚠️ | 40% |
| Funciones fecha | ✅ | ❌ | 0% |

**Diferenciadores Space Form:**
- DuckDB-WASM para queries OLAP eficientes
- YAML definitions más legibles que RDL original
- Safe expression parser (sin eval)
- Live preview HTML interactivo

**Impacto:**
- ✅ Puede generar listados con control breaks
- ✅ Puede hacer sumatorias, promedios, totales
- ⚠️ Falta output a PDF/CSV
- ⚠️ Falta variables de sistema (today, hour)

**Tiempo estimado para 70%:** 10 días

### 7. **Atmosphere Variables** (0%)

**NILENGINE:**
```xml
<field id="nombre" default $USRNAME/>
<field id="fecha" default today/>
<field id="usuario" reference(r1..r4)>
    r1: internal char(10), check this != "hola"
    r2: internal num(4);
    r3: internal time;
    r4: internal date;
</field>
```

**Space Form:**
```xml
<!-- ❌ No soporta variables de ambiente -->
<!-- ❌ No soporta campos reference/polimórficos -->
```

**Documentación NILENGINE:**
- `$VARIABLE` - Referencia a variable de ambiente
- `today` - Fecha actual
- `hour` - Hora actual
- Campos `reference` - Tipo polimórfico que cambia según valor

**Tiempo estimado:** 1-2 días

---

### 8. **Autoenter** (0%)

**NILENGINE:**
```xml
<field id="codigo" autoenter/>
```

**Space Form:**
```xml
<!-- ❌ No existe autoenter -->
```

**Documentación NILENGINE:**
- Pase automático al próximo campo cuando se completa el campo
- Mejora UX en formularios largos

**Tiempo estimado:** 1 día

---

### 9. **Unique Attribute** (0%)

**NILENGINE:**
```xml
<field id="nrodoc" unique/>
```

**Space Form:**
```xml
<!-- ❌ No existe unique -->
```

**Documentación NILENGINE:**
- Verifica que valor no esté repetido en fila anterior/posterior
- Útil en campos múltiples

**Tiempo estimado:** 1 día

---

### 10. **Atmosphere Variables** (0%)

**NILENGINE:**
- Variables: `today`, `hour`, `pageno`, `lineno`, `module`
- Usadas en reportes con `%zonas`

**Space Form:**
```xml
<!-- ❌ No soporta variables de ambiente en campos o reportes -->
```

**Tiempo estimado:** 1 día

---

## 📈 COMPLETITUD POR CAPÍTULO

| Capítulo NILENGINE | Complejidad | Space Form | Delta |
|------------------|-------------|------------|-------|
| **3. Formularios** | Alta | ⚠️ 50% | -50% |
| **3.1-3.6:** Campos Básicos | Media | ✅ 100% | +100% |
| **3.7:** %form attributes | Alta | ⚠️ 40% | -60% |
| **3.8:** %fields | Alta | ✅ 70% | -30% |
| **3.9:** Campos Simples | Alta | ✅ 100% | +100% |
| **3.10:** Campos Múltiples | Muy Alta | ❌ 0% | -100% |
| **3.11:** Campos Agrupados | Alta | ❌ 0% | -100% |
| **3.12:** Zona de Claves | Media | ❌ 0% | -100% |
| **3.13:** Subformularios | Muy Alta | ❌ 0% | -100% |
| **4. Reportes** | Muy Alta | ❌ 0% | -100% |

---

## 🎯 COMPARATIVA DETALLADA POR FEATURE

### A. DEFINICIÓN DE FORMULARIOS

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| `%form use esquema` | ✅ | ⚠️ `<use>` string | 80% |
| `%language C` | ✅ | ❌ No | 0% |
| `%ignore operaciones` | ✅ | ❌ No | 0% |
| `%confirm operaciones` | ✅ | ❌ No | 0% |
| `%window border/label` | ✅ | ⚠️ CSS only | 60% |
| `%messages HELP/ERROR` | ✅ | ⚠️ `<message id="">` | 70% |
| `%autowrite` | ✅ | ❌ No | 0% |
| `%display status` | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
%form use biblio, personal;
%window border standard, label "Libros de la Biblioteca";
%messages HELP1: "Código numérico del Libro";
ERROR: "El título ya existe";
%confirm add, update, end;
%display status;

<!-- Space Form: -->
<form title="Carga Clientes" database="demo">
    <form-attributes>
        <use>demo</use>
        <messages>
            <message id="NRO">Número de ficha</message>
        </messages>
    </form-attributes>
    <confirm>add, delete, end</confirm>
</form>
```

---

### B. ATRIBUTOS DE CAMPOS

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| `not null` | ✅ | ⚠️ `required` | 80% |
| `display only` | ✅ | ✅ `<display-only>` | 100% |
| `skip` | ✅ | ✅ `<skip>` | 100% |
| `skip when cond` | ✅ | ❌ No | 0% |
| `on help {MSG \| manual}` | ✅ | ⚠️ `<help>` | 70% |
| `on error <MSG>` | ✅ | ⚠️ Custom | 60% |
| `mask <string>` | ✅ | ❌ No | 0% |
| `default <valor>` | ✅ | ⚠️ `<default>` | 80% |
| `length<valor>` | ✅ | ❌ No | 0% |
| `autoenter` | ✅ | ❌ No | 0% |
| `<campo_tabla>` (BD inheritance) | ✅ | ❌ No | 0% |
| `in table` | ✅ | ⚠️ Simulado | 30% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
<field id="codigo" not null/>
<field id="email" type="email" not null/>
<field id="nombre" display only/>
<field id="fecha" default today/>
<field id="clave" mask "NNNN"/>
<field id="dni" length 8, not null/>
<field id="autor" libros., in autores:(nombre)/>
<field id="desc" autores.nombre, display only/>

<!-- Space Form: -->
<field id="email" type="email">
    <validation required="true"/>
</field>
<field id="fecha" type="date">
    <default>today</default>
</field>
<field id="desc0" type="text">
    <attributes><skip>true</skip></attributes>
</field>
```

---

### C. VALIDACIONES

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| Operadores `>` `<` `>=` `<=` `==` `!=` | ✅ | ✅ | 100% |
| `between <val1> and <val2>` | ✅ | ✅ | 100% |
| `in (<val1>[: <desc1>], ...)` | ✅ | ✅ | 100% |
| `check expresión` | ✅ | ✅ | 100% |
| `check after campo` | ✅ | ❌ No | 0% |
| `in table` | ✅ | ⚠️ Simulado | 30% |
| `[not] in table` | ✅ | ⚠️ Simulado | 30% |
| `unique` | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
<field id="edad" relop>edad >= 18</field>
<field id="precio" relop>precio between 10 and 1000</field>
<field id="categoria" in (1:"Paises", 2:"Idiomas")/>
<field id="codigo" check>this != "admin"</field>
<field id="desde" check>desde <= hasta</field>
<field id="tipo" unique/>

<!-- Space Form: -->
<field id="edad" type="number">
    <validation>
        <check>edad >= 18</check>
    </validation>
</field>
<field id="precio" type="number">
    <validation>
        <check>precio between 10 and 1000</check>
    </validation>
</field>
<field id="categoria" type="number">
    <validation>
        <check>categoria in (1, 2, 3)</check>
    </validation>
</field>
```

---

### D. EXPRESIONES (IS)

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| `is expr` | ✅ | ❌ No | 0% |
| `is date(expr)`, `is time(expr)` | ✅ | ❌ No | 0% |
| Funciones `sum, avg, max, min, count` | ✅ | ❌ No | 0% |
| `is descr(campo)` | ✅ | ❌ No | 0% |
| `is help(nombre_tecla)` | ✅ | ❌ No | 0% |
| `is num(expr)` | ✅ | ❌ No | 0% |
| Operadores aritméticos en IS | ✅ | ❌ No | 0% |
| Operadores lógicos en IS | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
<field id="desc" is descr(tipo)/>
<field id="ayuda" is help(PROCESAR)/>
<field id="monto" is num(total * impuesto)/>

<!-- Space Form: -->
<!-- ❌ No existe cláusula is -->
```

---

### E. CAMPOS MULTIPLES

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| Definición con `{ }` | ✅ | ❌ No | 0% |
| `rows <n>` | ✅ | ❌ No | 0% |
| `display <n>` | ✅ | ❌ No | 0% |
| `unique` | ✅ | ❌ No | 0% |
| `ignore [delete] [add] [insert]` | ✅ | ❌ No | 0% |
| Validación por fila | ✅ | ❌ No | 0% |
| Campos opcionales en multiples | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
<nrocuenta descrip debitos creditos rows 30 display 5/>
%fields grancampo: rows 30, display 5;
nrocuenta:;
descrip:;
debitos:;
creditos:;

<!-- Space Form: -->
<!-- ❌ No existe campo múltiple -->
```

---

### F. CAMPOS AGRUPADOS

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| Definición con `{ }` | ✅ | ❌ No | 0% |
| `check a > b` en agrupado | ✅ | ❌ No | 0% |
| `check after campo` | ✅ | ❌ No | 0% |
| Agrupados dentro de multiples | ✅ | ❌ No | 0% |
| Validación cruzada | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
{ __/__/__ __/__/__ }
%fields agrup: check a > b; a; b;

{ __/__/__ __/__/__ }
%fields agrup: unique;
tipcmp : comps.;
nrocmp : comps.;

<!-- Space Form: -->
<!-- ❌ No existe campo agrupado -->
```

---

### G. SUBFORMULARIOS

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| `subform "nombre"` | ✅ | ❌ No | 0% |
| `subform ("cod1", "cod2")` | ✅ | ❌ No | 0% |
| Anidamiento hasta 8 niveles | ✅ | ❌ No | 0% |
| Activación por completion | ✅ | ❌ No | 0% |
| Activación con tecla META | ✅ | ❌ No | 0% |
| `manual subform` | ✅ | ❌ No | 0% |
| Multiple subforms por campo | ✅ | ❌ No | 0% |
| `in` con cantidad de subforms | ✅ | ❌ No | 0% |
| `null` para subform no usado | ✅ | ❌ No | 0% |
| Auto-show en alta (FM_NEW) | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
<field id="codigo" subform "cod1"/>
<field id="codigo" subform ("cod1", "cod2", "cod3")/>
<field id="codigo" subform ("cod1", null, "cod3")/>
<field id="codigo" in (1,2,3), subform ("cod1", null, "cod3")/>

<!-- Space Form: -->
<!-- ❌ No existe subform -->
```

---

### H. ZONA DE CLAVES

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| Zona de Claves | ✅ | ❌ No | 0% |
| Zona de Datos | ✅ | ❌ No | 0% |
| Separación con barra `|` | ✅ | ❌ No | 0% |
| Operación LEER | ✅ | ❌ No | 0% |
| LEER_SIGUIENTE | ✅ | ❌ No | 0% |
| LEER_PREVIO | ✅ | ❌ No | 0% |
| Operaciones en zonas | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
FORMULARIO DE LIBROS -------------------Código: _,___.
<!-- Zona de Claves -->
Título: ____________________
Autor: ____._______________
<!-- Zona de Datos -->
%form use biblio;
%fields codigo: libros.; titulo: libros.; autor: libros., in autores:nombre;

<!-- Space Form: -->
<!-- ❌ No existe zona de claves -->
```

---

### I. REPORTES (RDL)

| Feature | NILENGINE | Space Form | Completado |
|---------|---------|------------|-----------|
| `%report use esquema` | ✅ | ❌ No | 0% |
| `%fields` | ✅ | ❌ No | 0% |
| `%zonas` | ✅ | ❌ No | 0% |
| Funciones `sum, avg, max, min, count` | ✅ | ❌ No | 0% |
| Funciones `runsum, runavg, runcount` | ✅ | ❌ No | 0% |
| Cortes `before page`, `after report` | ✅ | ❌ No | 0% |
| Cortes `before/after campo` | ✅ | ❌ No | 0% |
| `group with zona` | ✅ | ❌ No | 0% |
| `piepag` | ✅ | ❌ No | 0% |
| `if condicion` | ✅ | ❌ No | 0% |
| Output a archivo/printer | ✅ | ❌ No | 0% |
| Input de datos | ✅ | ❌ No | 0% |
| Variables `today`, `hour`, `pageno` | ✅ | ❌ No | 0% |

**Ejemplos:**
```xml
<!-- NILENGINE: -->
%tit(pageno, today) before page Página: __. Fecha: __/__/__
%linea(depto, nombre, sueldo) __. _____________________
%suma(sum(sueldo)) after depto Suma: ____
%totsuma(sum(sueldo)) after report Total: ____
%report use personal;
%fields depto:; nombre:; sueldo:;

<!-- Space Form: -->
<!-- ❌ No existe report definition -->
```

---

## 🚀 RECOMENDACIONES PARA COMPLETAR

### Prioridad 1 (Urgente - 3 semanas)

#### 1. Subformularios (3-5 días)
**Razón:** Fundamental para ABM de entidades relacionadas
**Features:**
- Lógica de abrir/cerrar modales
- Pasar datos al formulario padre
- Soporte anidado (máx 8 niveles)
- Activación por completion o tecla META

**Ejemplo:**
```javascript
// Space Form
class SubformService {
    static open(formId, parentFieldId, data) {
        // Crear modal con formulario
        // Cargar datos en campos
        // Evento al cerrar: guardar datos y actualizar campo padre
    }
    static close(subformId) {
        // Cerrar modal y devolver datos
    }
}
```

---

#### 2. Campos Agrupados (2-3 días)
**Razón:** Validación cruzada es básica en cualquier sistema
**Features:**
- Detectar grupos `{ }` en XML
- Validar al salir del grupo (blur)
- Soporte `check after campo`

**Ejemplo:**
```javascript
// Space Form
class GroupValidator {
    static validateGroup(groupElement, formEl) {
        const fields = groupElement.querySelectorAll('.field-block-group');
        const context = {};
        fields.forEach(f => {
            context[f.id] = document.getElementById(f.id).value;
        });
        const checkExpr = groupElement.dataset.check;
        return ExpressionEngine.evaluate(checkExpr, context);
    }
}
```

---

#### 3. BD Integration Real (5-7 días)
**Razón:** Para producción debe conectar a base de datos
**Features:**
- Cliente SQL (PostgreSQL/MySQL)
- `in table` real con búsqueda
- Herencia de atributos de DB
- Campos de descripción copiados automáticamente

**Ejemplo:**
```javascript
// Space Form
class DatabaseService {
    static async findByField(tableName, fieldName, value) {
        const result = await db.query(
            `SELECT * FROM ${tableName} WHERE ${fieldName} = ?`,
            [value]
        );
        return result;
    }
    static async copyDescription(tableName, fieldId, value) {
        const row = await this.findByField(tableName, 'id', value);
        if (row && row.nombre) {
            return row.nombre;
        }
        return null;
    }
}
```

**Tiempo total:** 10-15 días

---

### Prioridad 2 (Importante - 2 semanas)

#### 4. Reportes (5-7 días)
**Razón:** Necesario para generar listados y reportes de salida
**Features:**
- Parser RDL básico
- Generación de HTML tables con zonas
- Funciones `sum`, `avg`, `runsum`, `runavg`, `count`, `min`, `max`
- Cortes `before page`, `after report`
- Export a PDF/Excel

**Ejemplo:**
```javascript
// Space Form
class ReportGenerator {
    static generateFromRDL(rdlString, data) {
        // Parsear RDL
        const zones = rdlString.match(/%zonas/g);
        const fields = rdlString.match(/%fields/g);
        const sumFunctions = rdlString.match(/sum\((\w+)\)/g);

        // Generar HTML
        let html = '<table>';
        zones.forEach(zone => {
            html += '<tr>';
            fields.forEach(field => {
                const value = data[field];
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';

        // Calcular funciones de suma
        if (sumFunctions.length > 0) {
            const total = data.reduce((acc, val) => acc + val, 0);
            html += `<tr><td>Total: ${total}</td></tr>`;
        }

        return html;
    }
}
```

---

#### 5. Zona de Claves (3 días)
**Razón:** Búsqueda y actualización de registros existentes
**Features:**
- Dividir formulario en zonas
- Operaciones LEER/LEER_SIGUIENTE/LEER_PREVIO
- Integrar con BD (lookup por ID)

**Ejemplo:**
```javascript
// Space Form
class KeyZoneService {
    static async loadByKeyZone(formId, keyData) {
        // Buscar registro por campos clave
        const record = await DatabaseService.find(formId, keyData);
        if (record) {
            // Cargar datos en zona de datos
            Object.entries(record.data).forEach(([fieldId, value]) => {
                const el = document.getElementById(fieldId);
                if (el) el.value = value;
            });
            return { status: 'LOADED', id: record.id };
        } else {
            return { status: 'NEW', id: null };
        }
    }
}
```

**Tiempo total:** 8-10 días

---

### Prioridad 3 (Nice-to-have - 1 semana)

#### 6. Campos Múltiples (3-4 días)
**Razón:** No es crítico pero mejora funcionalidad
**Features:**
- Matrices con `rows`, `display`, `unique`
- Paginación visual
- Validación por fila

**Ejemplo:**
```javascript
// Space Form
class MultipleFieldsService {
    static renderMultiple(fieldsXml, container) {
        const rows = fieldsXml.rows;
        const display = fieldsXml.display || rows;

        let html = '<table>';
        for (let i = 0; i < rows; i++) {
            html += '<tr>';
            fieldsXml.fields.forEach(field => {
                html += `<td>
                    <input type="text" id="${field.id}_row_${i}">
                </td>`;
            });
            html += '</tr>';
        }
        html += '</table>';

        // Paginación visual
        let currentPage = 1;
        const totalPages = Math.ceil(rows / display);
        // ... lógica de paginación
    }
}
```

---

#### 7. Atmosphere Variables (1-2 días)
**Razón:** Mejora UX con datos dinámicos
**Features:**
- `$USRNAME`, `$VARIABLE`
- `today`, `hour`
- Campos `reference` (polimórficos)

**Ejemplo:**
```javascript
// Space Form
class AtmosphereService {
    static getVariable(varName) {
        const variables = {
            USRNAME: 'Usuario Demo',
            TODAY: new Date().toISOString().split('T')[0],
            HOUR: new Date().toISOString().split('T')[1].split('.')[0]
        };
        return variables[varName] || null;
    }
    static renderReferenceField(fieldXml, container) {
        const types = fieldXml.types; // r1..r4
        const currentType = fieldXml.value || types[0];

        let fieldHtml = '';
        types.forEach((type, index) => {
            const value = type === currentType ? fieldXml.value : '';
            fieldHtml += `
                <input type="${this.getType(type)}"
                       id="${fieldXml.id}_type_${index}"
                       value="${value}">
            `;
        });

        // Detectar cambio de tipo
        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const newType = input.id.split('_').pop();
                this.updateType(fieldXml.id, newType);
            });
        });
    }
}
```

---

#### 8. Autoenter (1 día)
**Razón:** UX improvement
**Features:**
- Pase automático al completar campo

**Ejemplo:**
```javascript
// Space Form
class AutoenterService {
    static enableForField(fieldElement) {
        const input = fieldElement.querySelector('input');
        if (!input) return;

        const maxLength = input.maxLength;
        input.addEventListener('input', (e) => {
            if (e.target.value.length === maxLength) {
                const nextField = this.findNextField(fieldElement);
                if (nextField) nextField.querySelector('input')?.focus();
            }
        });
    }
}
```

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual: **70% completado (v0.20.0)**

**Implementado:**
- ✅ Form definition XML básico
- ✅ Layout con containers (horizontal/vertical)
- ✅ Campo skip (readonly)
- ✅ Validaciones básicas (required, types)
- ✅ Validaciones avanzadas (check, between, in)
- ✅ Engine de expresiones completo
- ✅ Persistence con LocalStorage + SQLite
- ✅ Export CSV/JSON
- ✅ CRUD completo (v0.16.0)
- ✅ Handler system multi-table (v0.18.0)
- ✅ Web Report Engine con DuckDB-WASM (v0.20.0)
- ✅ Control breaks before/after field
- ✅ SQL nativo en browser con JOINs eficientes

**Faltante (30% crítico):**
- ❌ Subformularios (dinámicos, anidados)
- ⚠️ Campos múltiples (básico, falta CRUD filas)
- ❌ Campos agrupados (validación cruzada)
- ❌ Zona de claves (búsquedas por ID)
- ⚠️ Reportes: falta variables sistema, output PDF

---

## 🎯 ROADMAP PARA PRODUCCIÓN

### Fase 1: Funcionalidad Core ✅ COMPLETO (v0.16.0)
1. ✅ CRUD completo
2. ✅ Handler system
3. ✅ SQLite integration

**Resultado:** 75% completado, listo para uso en ambientes controlados

---

### Fase 2: Complejidad Enterprise (2 semanas)
4. **Reportes** (5-7 días) - ⭐ Prioridad Media
5. **Zona de Claves** (3 días) - ⭐ Prioridad Media

**Resultado:** 85% completado, ready para producción

---

### Fase 3: UX Enhancements (1 semana)
6. **Campos Múltiples** (3-4 días) - ⭐ Prioridad Baja
7. **Atmosphere Variables** (1-2 días) - ⭐ Prioridad Baja
8. **Autoenter** (1 día) - ⭐ Prioridad Baja

**Resultado:** 95% completado, muy profesional

---

## 💡 NOTAS FINALES

### Fortalezas de Space Form:
1. **Arquitectura modular** - Código organizado en servicios, componentes, utilities
2. **Validaciones avanzadas** - ExpressionEngine completo (75% de validaciones NILENGINE)
3. **Persistence** - LocalStorage + export, 100% completado
4. **UX profesional** - Feedback inmediato, animaciones, tema dark/light
5. **Documentación** - MForm-progress.md y PASOS-CRITICOS muy detallados

### Debilidades críticas:
1. **Sin subformularios** - No puede hacer ABM de relaciones
2. **Sin BD real** - Solo simulado, no productivo
3. **Sin reportes** - No puede generar listados
4. **Sin zona de claves** - No puede buscar/actualizar existentes
5. **Sin campos agrupados** - No puede validar rangos de campos

---

## 📚 Referencias

- **NILENGINE Manual:** `agent/MForm.txt` (Manual Completo, 1200+ líneas)
- **Space Form Docs:** `MForm-progress.md`, `PASOS-CRITICOS-COMPLETADOS.md`
- **Código:** `js/`, `css/`, `forms/`

---

**Generado:** 2026-02-01
**Última actualización:** Tras revisión completa de MForm.txt
