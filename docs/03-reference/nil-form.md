# NIL-FORM
## Introducción
   
Uno de los aspectos más importantes en un programa de aplicación es la interfaz con el usuario. nil-form provee una forma para diseñar fácilmente las pantallas de formularios de     
manera amigable para el operador, proporcionando:         

- Definición de características de los campos;
- Criterios de consistencia para aplicar a los datos cargados;
- Mensajes de error y ayuda, y
- Completo control sobre el layout de la pantalla, incluyendo contenedores, bordes y ventanas.

Los programas de aplicación interactivos son formularios electrónicos desplegados en pantalla. Un formulario es la imagen de un documento, sobre la cual pueden realizarse las mismas
acciones que las que se realizarían sobre un trozo de papel, como ser:

1. Archivar datos en la base de datos.
2. Leer un registro, y luego modificarlo (o actualizarlo).
3. Remover un registro de la base de datos.

Para archivar un formulario, como en 1), existen dos operaciones asociadas: AGREGAR (cuando el registro es nuevo) o ACTUALIZAR (cuando se ha modificado un registro existente
previamente cargado, como en 2).

Para desechar un registro (caso 3.), se realiza una operación llamada BORRAR.

Para ignorar lo que se ha escrito en un formulario y dejarlo en el estado anterior a la modificación, se realiza una operación denominada IGNORAR.

Todas las operaciones definidas anteriormente se ejecutan mediante los botones de acción del formulario.

La siguiente tabla describe la correspondencia entre las operaciones y los controles de nil-form:


| Operación  |Botón nil-form 
|------------|----------------|
| AGREGAR    | [ GUARDAR ] (registro nuevo)
| ACTUALIZAR | [ GUARDAR ] (registro existente) 
| BORRAR     | [ BORRAR ]
| IGNORAR    | [ IGNORAR ]
| FIN        | [ FIN ]



 Figura 3.1 — Operaciones de Formularios

Un formulario puede tener restringidas ciertas operaciones, o bien pedir una confirmación antes de ejecutarla, mediante el atributo <confirm> y el sistema de permisos RADU.

La interfaz de cada programa con el usuario se establece a través de formularios. Se considera cada formulario como una ventana dentro del workspace de Nilix.

Los formularios se escriben en XML con cualquier editor de texto. Para definir un formulario se utiliza el XML nil-form — lenguaje declarativo derivado del FDL original, adaptado
para la web. El XML describe la estructura de la pantalla tal como se la desea: al cargar el formulario, nil-form la renderiza fielmente en el navegador. No requiere compilación
previa; el XML se interpreta en tiempo de ejecución.

```xml
<form id="producto" title="Productos" database="demo_productos" handler="producto_handler">
    <form-attributes>
        <use>demo_productos</use>
        <window border="single"/>
        <confirm>add, delete</confirm>
    </form-attributes>
    <layout>
        <container type="horizontal">
            <field id="id"     label="Código" type="number" keyField="true" size="6"/>
            <field id="nombre" label="Nombre" type="text"   size="50"/>
        </container>
    </layout>
</form>
```

---

## Generando el Formulario

En nil-form, cada formulario está contenido en un archivo XML con extensión `.xml`. No existe etapa de compilación: nil-form interpreta el archivo directamente en tiempo de ejecución al cargar el formulario en el navegador.

```
┌──────────┐      ┌──────────────┐      ┌─────────────┐
│ form.xml ├──────┤  nil-runtime ├──────┤  navegador  │
└──────────┘      └──────────────┘      └─────────────┘
```

*Figura 3.2 — Carga de un Formulario en nil-form*

El archivo `.xml` es el único artefacto necesario. nil-form lo parsea, construye el árbol de campos y renderiza la pantalla con estética neobrutalista terminal. No se generan archivos intermedios ni cabeceras.

---

## El Lenguaje XML nil-form

Un archivo de formulario en nil-form se divide en dos secciones:

- La primera (elemento `<form-attributes>`), contiene información general sobre el formulario: tabla de datos, borde de ventana, mensajes de ayuda, operaciones que requieren confirmación.
- La segunda (elemento `<layout>`), define los campos y su disposición en pantalla.

```xml
<form id="cliente" title="Clientes" database="clientes" handler="cliente_handler">
    <form-attributes>
        <use>clientes</use>
        <window border="single"/>
        <messages>
            <message id="HELP_COD">Código interno del cliente</message>
        </messages>
        <confirm>add, delete</confirm>
    </form-attributes>
    <layout>
        <!-- campos aquí -->
    </layout>
</form>
```

### Layout de Pantalla

La imagen de la pantalla se define mediante contenedores y campos dentro de `<layout>`. Los contenedores pueden ser horizontales o verticales y anidarse recursivamente.

```xml
<layout>
    <container type="horizontal">
        <border>
            <field id="codigo" label="Código" type="number" keyField="true" size="6"/>
        </border>
        <field id="fecha" label="Fecha" type="date" align="right"/>
    </container>
    <container type="vertical">
        <field id="nombre" label="Nombre" type="text" size="50"/>
    </container>
</layout>
```

Los campos se procesan en el orden en que aparecen en el XML, de arriba hacia abajo y de izquierda a derecha dentro de cada contenedor.

### Tipos de Campo

Los tipos de dato disponibles en nil-form se declaran con el atributo `type` del elemento `<field>`:

| Tipo NILENGINE | `type=` nil-form | Notas |
|---|---|---|
| CHAR / alfanumérico | `"text"` | Acepta cualquier carácter imprimible |
| NUM / numérico | `"number"` | Entero o decimal según `size` y `<validation>` |
| DATE | `"date"` | Validado automáticamente; formato local |
| TIME | `"time"` | Formato HH:MM |
| BOOL | `"checkbox"` | Valor `true` / `false` |
| EMAIL | `"email"` | Validación de formato email |
| TEL | `"tel"` | Teléfono |

El tamaño del campo se controla con `size`:

```xml
<field id="codigo"   type="number" size="6"/>
<field id="nombre"   type="text"   size="50"/>
<field id="precio"   type="number" size="10"/>
<field id="vigente"  type="checkbox"/>
<field id="vencimto" type="date"/>
<field id="hora_ing" type="time"/>
```

Para campos con decimales, se usa `<validation>` con `<min>` y `<max>`, o la expresión `is=` para campos calculados:

```xml
<field id="precio"   type="number" label="Precio"   size="10"/>
<field id="cantidad" type="number" label="Cant"     size="3" is="stepper"/>
<field id="subtotal" type="number" label="Subtotal" is="precio * cantidad" skip="true"/>
```

---

## 🚧 Pendiente en nil-form

- **FLOAT** (punto flotante con notación exponencial) → tipo numérico estándar; sin soporte de notación `e`. No implementado.
- **Dígito verificador** (`_.#`) → validación especial de dígito verificador. No implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición (CUIT, CBU, teléfono). No implementado.
- **Variables de ambiente en imagen** (`$usrname`) → valores dinámicos embebidos en el layout. No implementado como atributo de pantalla; disponible via handler o `is=`.

---

Continuando con el ejemplo de biblioteca, el formulario de manejo de datos de la tabla `libros` en nil-form se define así:

```xml
<form id="libros" title="Libros" database="libros" handler="none">
    <form-attributes>
        <use>libros</use>
        <window border="single"/>
    </form-attributes>
    <layout>
        <container type="horizontal">
            <border>
                <field id="codigo" label="Código del Libro" type="number" keyField="true" size="10"/>
            </border>
        </container>
        <container type="vertical">
            <field id="titulo"    label="Título de la Obra"  type="text"   size="30"/>
            <field id="cod_autor" label="Código del Autor"   type="number" size="10"/>
            <field id="edicion"   label="Edición"            type="number" size="5"/>
            <field id="fecha"     label="Fecha"              type="date"/>
        </container>
    </layout>
</form>
```

Existen también posibilidades más avanzadas:

- **Campos Múltiples** (`type="multifield"`): Permiten formar una grilla con una serie de campos en filas. Soportan stepper, appendRow dinámico desde handler, paginación y mobile cards.
- **Campos Agrupados**: Conjunto de campos que se relacionan para efectuar validaciones cruzadas entre sus valores. *(Ver 🚧 Pendiente)*
- **Subformularios**: Capacidad de presentar un formulario en forma dinámica al completar un campo. *(Ver 🚧 Pendiente)*

### Separador de Campos

No aplica en nil-form. La separación y alineación entre campos se controla mediante contenedores `<container type="horizontal|vertical">` y el atributo `align`.

---

## La Sección `<form-attributes>`

Esta sección es opcional y especifica características generales del formulario. Equivale a la antigua sección `%form` del lenguaje FDL original. Se admiten los siguientes elementos:

**`<use>`** — Especifica la tabla principal de la base de datos a usar:

```xml
<use>libros</use>
```

**`<ignore>`** — Operaciones deshabilitadas para el formulario. En nil-form se gestiona mediante permisos RADU en el menú (`permissions="R"`, `"RA"`, `"RADU"`, etc.):

```xml
<!-- NILENGINE: ignore delete, add; -->
<!-- nil-form: se configura en menu.xml con permissions="RU" -->
```

**`<confirm>`** — Operaciones que piden confirmación antes de ejecutarse. Valores posibles: `add`, `update`, `delete`, `end`:

```xml
<confirm>update, end</confirm>
```

**`<window>`** — Controla el borde de la ventana del formulario:

```xml
<window border="single"/>   <!-- opciones: single | double | none -->
```

**`<messages>`** — Define mensajes de error o ayuda asociados a campos. Se muestran al hacer foco en un campo o al producirse un error de validación:

```xml
<messages>
    <message id="HELP_COD">Código numérico del libro</message>
    <message id="ERROR_TITULO">El título ya existe en la base de datos</message>
</messages>
```

Los mensajes se referencian desde `<field>` mediante el atributo `help`:

```xml
<field id="codigo" label="Código" type="number" help="HELP_COD"/>
```

**`<display-status>`** — Muestra al pie del formulario el estado del registro en proceso (alta, modificación, lectura):

```xml
<display-status>true</display-status>
```

---

## 🚧 Pendiente en nil-form

- **FLOAT** (punto flotante con notación exponencial) → tipo numérico estándar; sin soporte de notación `e`. No implementado.
- **Dígito verificador** (`_.#`) → validación especial de dígito verificador. No implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición (CUIT, CBU, teléfono). No implementado.
- **Variables de ambiente en imagen** (`$usrname`) → valores dinámicos embebidos en el layout. No implementado como atributo de pantalla; disponible via handler o `is=`.
- **Campos Agrupados** → validación cruzada al salir del grupo (`check after campo`). No implementado.
- **Subformularios** → formulario modal al completar un campo, hasta 8 niveles anidados. No implementado.
- **`autowrite`** → grabación automática al pasar por el campo de control. No implementado.
- **Especificadores de formato en mensajes** (`%d`, `%s`, `%D`, etc.) → mensajes son cadenas estáticas; valores dinámicos disponibles via handler.

---

## La Cláusula `<window>`

Como ya se ha mencionado, esta cláusula admite una serie de opciones que se describen a continuación:

**`label`**

Etiqueta que aparece en el borde de la ventana del formulario. En nil-form se define mediante el atributo `title` del elemento `<form>`, o con el atributo `label` dentro de `<window>`:

```xml
<form id="libros" title="Libros de la Biblioteca" ...>
```

**`fullscreen`**

No aplica en nil-form. El formulario siempre ocupa el área de trabajo del workspace, adaptándose al viewport del navegador.

**`origin`**

No aplica en nil-form. El posicionamiento se controla mediante el layout de contenedores XML y las reglas CSS del motor.

**`border`**

Define el tipo de borde del formulario. nil-form soporta los siguientes valores:

| Valor | Descripción |
|-------|-------------|
| `single` | Borde simple (por defecto) |
| `double` | Borde doble |
| `none` | Sin borde |

```xml
<window border="single"/>
<window border="double"/>
```

El tipo `standard` del FDL original equivale a `single` en nil-form. Los atributos de color y efecto de borde (blink, bold, reverse, colores) son propios del tema neobrutalista del motor y no se configuran por formulario.

**`background`**

El color de fondo es gestionado globalmente por el tema CSS de nil-form (phosphor green / terminal). No se configura por formulario.

---

Ejemplo completo de `<form-attributes>` con todas las cláusulas activas:

```xml
<form id="libros" title="Libros de la Biblioteca" database="libros" handler="none">
    <form-attributes>
        <use>libros</use>
        <confirm>end, update</confirm>
        <messages>
            <message id="HELP1">Código del libro</message>
            <message id="ERROR">El título ya existe</message>
        </messages>
        <window border="single"/>
        <display-status>true</display-status>
    </form-attributes>
    <layout>
        <container type="vertical">
            <field id="codigo"    label="Código del Libro"  type="number" keyField="true" size="10" help="HELP1"/>
            <field id="titulo"    label="Título de la Obra" type="text"   size="30"/>
            <field id="cod_autor" label="Código del Autor"  type="number" size="10"/>
            <field id="edicion"   label="Edición"           type="number" size="5"/>
            <field id="fecha"     label="Fecha"             type="date"/>
        </container>
    </layout>
</form>
```

---

## La Sección `<layout>` — Definición de Campos

Esta sección es obligatoria. Define los campos del formulario, su tipo, disposición en pantalla y atributos de validación. Los campos emergen desde nil — cada `<field>` es una estructura que el motor materializa en pantalla.

Los campos se declaran dentro de contenedores en `<layout>`:

```xml
<layout>
    <container type="vertical">
        <field id="codigo"  label="Código"  type="number" keyField="true" size="10"/>
        <field id="titulo"  label="Título"  type="text"   size="30"/>
        <field id="edicion" label="Edición" type="number" size="5"/>
        <field id="fecha"   label="Fecha"   type="date"/>
    </container>
</layout>
```

Existen tres categorías de campo:

- **Simples**: contienen un único valor. Son el tipo base.
- **Múltiples** (`type="multifield"`): matrices de filas con columnas; soportan stepper, appendRow dinámico desde handler, paginación y mobile cards.
- **Agrupados**: para validaciones cruzadas entre campos. *(Ver 🚧 Pendiente)*

---

### Tipos de Valor en Atributos

**`[string]`** — Cadena de caracteres entre comillas dobles:

```xml
default="Pendiente"
```

**`[valor]`** — Constante del tipo adecuado al campo:

- Alfanumérico: cadena de caracteres.
- Numérico: número entero o decimal.
- Fecha: cadena en formato `dd/mm/aaaa`. La constante especial `today` refiere a la fecha actual.
- Hora: cadena en formato `HH:MM` o `HH:MM:SS`. La constante `hour` refiere a la hora actual.

```xml
<field id="vencimiento" type="date" default="today">
    <validation><min>01/01/2020</min><max>31/12/2099</max></validation>
</field>

<field id="apertura" type="time">
    <validation><min>06:00</min><max>22:00</max></validation>
</field>
```

---

### Atributos Válidos para Todo Tipo de Campo

**`not null` → `<required>true</required>`**

El campo debe tener un valor:

```xml
<field id="nombre" type="text" size="50">
    <validation><required>true</required></validation>
</field>
```

**`descr MSG` → `help="MSG_ID"`**

Muestra un mensaje en la barra inferior de la pantalla mientras el usuario está sobre el campo. El mensaje debe estar definido en `<messages>`:

```xml
<field id="codigo" type="number" help="HELP_COD"/>
```

**`display only` → `display-only="true"`**

El campo es visible pero no editable. El usuario puede posicionarse sobre él pero no modificar su valor:

```xml
<field id="descripcion" type="text" display-only="true"/>
```

Cuando se combina con `is=`, el campo muestra el resultado de la expresión y es de solo lectura:

```xml
<field id="subtotal" is="precio * cantidad" display-only="true"/>
```

**`skip` → `skip="true"`**

El campo se omite en el recorrido de ingreso de datos. También aplica a multifields, salteando la estructura completa:

```xml
<field id="interno" type="number" skip="true"/>
```

---

### Atributos para Campos Simples

**`on help MSG` → `help="MSG_ID"`**

Al hacer foco en el campo se muestra el mensaje definido en `<messages>`:

```xml
<field id="cod_libro" type="number" help="HELP1"/>
```

**`on error MSG` → `<message>` dentro de `<validation>`**

Mensaje de error personalizado cuando el dato ingresado no pasa la validación:

```xml
<field id="titulo" type="text" size="30">
    <validation>
        <required>true</required>
        <message>El título no puede estar vacío</message>
    </validation>
</field>
```

**`default <valor>` → `default="valor"`**

Valor por defecto al inicializar el formulario:

```xml
<field id="estado"  type="text"   default="Activo"/>
<field id="fecha"   type="date"   default="today"/>
<field id="cant"    type="number" default="1"/>
```

**`length / size` → `size="n"`**

Longitud visible del campo en caracteres:

```xml
<field id="codigo" type="number" size="6"/>
<field id="nombre" type="text"   size="50"/>
```

**`tabla.campo` → `<in-table>`**

Asocia el campo a una tabla de base de datos para validación y autocompletado. La tabla debe pertenecer al esquema declarado en `<use>`:

```xml
<!-- autor hereda validación de la tabla autores -->
<field id="autor" label="Autor" type="number">
    <in-table table="autores" key="id" display="nombre"/>
</field>

<!-- desc_autor se copia automáticamente del registro encontrado -->
<field id="desc_autor" label="Nombre" type="text" display-only="true" skip="true">
    <copy from="autores" field="nombre"/>
</field>
```

---

### Atributos de Check — Validaciones

**Operadores relacionales → `<check>` o `<min>` / `<max>`**

```xml
<field id="codigo" type="number">
    <validation><min>10</min></validation>
</field>

<field id="hasta" type="number">
    <validation><check>this >= desde</check></validation>
</field>
```

**`between valor1 and valor2` → `<min>` + `<max>`**

```xml
<field id="codigo" type="number">
    <validation><min>10</min><max>100</max></validation>
</field>
```

**`in (valor: descripción, ...)` → `<options>`**

Lista de valores estáticos aceptados. Al solicitar ayuda se despliega una lista de selección con estética neobrutalista terminal:

```xml
<field id="tipo" label="Tipo" type="select">
    <options>
        <option value="1">Países</option>
        <option value="2">Idiomas</option>
    </options>
</field>
```

**`check expresión` → `<check>`**

Condiciones compuestas que involucran el campo actual (`this`) y otros campos del formulario:

```xml
<field id="precio" type="number" label="Precio">
    <validation>
        <check>this &lt;= 1000 and cantidad * this &lt;= 100000</check>
        <message>Precio fuera de rango permitido</message>
    </validation>
</field>
```

**`in table` → `<in-table>`**

Verifica que el valor ingresado exista en una tabla de la base de datos. Al solicitar ayuda se despliega una ventana con los valores disponibles:

```xml
<field id="autor" label="Autor" type="number">
    <in-table table="autores" key="id" display="nombre"/>
</field>
```

---

### Los Campos Descripción — `<copy>`

Los campos de la tabla accedida por `<in-table>` pueden copiarse automáticamente sobre campos del formulario cuando se cumplen las condiciones:

- El campo destino tiene `display-only="true"` o `skip="true"`.
- Está a continuación del campo con `<in-table>`.

```xml
<field id="autor"      label="Autor"  type="number">
    <in-table table="autores" key="id" display="nombre"/>
</field>
<field id="desc_autor" label="Nombre" type="text" display-only="true" skip="true">
    <copy from="autores" field="nombre"/>
</field>
```

---

### Atributo `is=` — Campos Virtuales

Permite definir campos cuyo valor resulta de una expresión. El campo se convierte automáticamente en `skip` (el operador no puede modificarlo):

```xml
<field id="campo" is="expresion" skip="true"/>
```

Expresiones soportadas:

| Expresión | Resultado | Estado |
|-----------|-----------|--------|
| `precio * cantidad` | Numérico (aritmética) | ✅ |
| `sum(importe)` | Numérico (suma columna multifield) | ✅ |
| `avg(precio)` | Numérico (promedio columna) | ✅ |
| `max(precio)` | Tipo del argumento | ✅ |
| `min(precio)` | Tipo del argumento | ✅ |
| `count(campo)` | Numérico | ✅ |
| `stepper` | Control `[▼ n ▲]` en multifield | ✅ |
| `descr(campo)` | Descripción de un `in` | ❌ Pendiente |
| `help(tecla)` | Valor de una tecla de función | ❌ Pendiente |
| `num(expr)` | Conversión a numérico | ❌ Pendiente |
| `date(expr)` | Conversión a fecha | ❌ Pendiente |
| `time(expr)` | Conversión a hora | ❌ Pendiente |

Ejemplo con agregados sobre un multifield:

```xml
<field id="items" label="Ítems" type="multifield" rows="50" display="7">
    <field id="descripcion" label="Descripción" type="text"/>
    <field id="cantidad"    label="Cant"        type="number" size="3" is="stepper"/>
    <field id="precio"      label="Precio"      type="number" size="10"/>
    <field id="subtotal"    label="Subtotal"    is="cantidad * precio" skip="true"/>
</field>
<field id="total" label="Total" is="sum(subtotal)" skip="true"/>
```

---

## 🚧 Pendiente en nil-form

- **FLOAT** (notación exponencial `e`) → no implementado.
- **Dígito verificador** (`_.#`) → no implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición. No implementado.
- **Variables de ambiente** (`$VAR`) en atributos → disponible via handler o `is=`.
- **Campos de referencia / polimórficos** (`reference(r1..r4)`) → no implementado.
- **`display only when expr`** / **`skip when cond`** → condicionales en tiempo de ejecución. No implementado.
- **`autoenter`** → paso automático al completar el campo. No implementado.
- **`in table` con índice compuesto** (`by indice (val,...)`) → `<in-table>` soporta clave simple; índices compuestos no implementados.
- **Campos Agrupados** → validaciones cruzadas al salir del grupo. No implementado.
- **Subformularios** → modal al completar un campo, hasta 8 niveles. No implementado.
- **`is descr(campo)`** / **`is help(tecla)`** / **`is num/date/time(expr)`** → funciones de conversión y descripción. No implementados.
- **`autowrite`** → grabación automática al pasar por el campo de control. No implementado.
- **Especificadores de formato en mensajes** (`%d`, `%s`, etc.) → mensajes son cadenas estáticas.

---

En el campo `desc0` se copia automáticamente la descripción asociada al valor ingresado en `tipo`, usando `<copy>` sobre el campo con `<in-table>`.

Las funciones `is help()`, `is num()`, `is date()` e `is time()` del FDL original no están implementadas en nil-form v2.3.0. Ver 🚧 Pendiente.

### Atributo `on help in table`

Es posible mostrar la ventana de selección de una tabla al campo sin forzar la validación. Esto permite al usuario examinar los valores disponibles y adoptar uno o bien ingresar uno distinto. En nil-form, el comportamiento de `<in-table>` siempre valida. La variante "ayuda sin validación" aún no está implementada; consultar 🚧 Pendiente.

---

# Interfaz con la Base de Datos

En nil-form, los campos del formulario **no heredan atributos del esquema de base de datos**. Todos los atributos — validaciones, defaults, máscaras — se definen explícitamente en el XML del formulario. La base de datos se accede a través de **ScopedDb** (que inyecta automáticamente `empresa_id` en todas las queries) y mediante `<in-table>` para lookups y validación de existencia.

No existe equivalente a la compilación con `fgen`: nil-form parsea el XML en tiempo de ejecución. Los cambios en la estructura de la base de datos no requieren recompilar formularios; pero sí puede ser necesario actualizar el XML si cambian tipos o restricciones.

## Atributos Heredados

En nil-form, los atributos se definen directamente en el XML. Los equivalentes a los atributos heredados del FDL original son:

| Atributo FDL | Equivalente nil-form |
|---|---|
| `not null` | `<required>true</required>` en `<validation>` |
| `longitud` | `size="n"` en `<field>` |
| `default` | `default="valor"` en `<field>` |
| `check expresión` | `<check>...</check>` en `<validation>` |
| `between` | `<min>` + `<max>` en `<validation>` |
| `in tabla` | `<in-table table="..." key="..." display="..."/>` |
| `máscara` | ❌ No implementado (ver 🚧 Pendiente) |

La asociación de un campo con una tabla se declara con `<in-table>`:

```xml
<field id="codigo" label="Código" type="number" keyField="true">
    <in-table table="autores" key="id" display="nombre"/>
</field>
```

## Compatibilidad de Tipos

nil-form no realiza verificación de compatibilidad de tipos entre el campo XML y la columna en la base de datos en tiempo de definición. La validación de tipo ocurre en tiempo de ejecución: si un valor no puede almacenarse en la columna correspondiente, el handler o el `recordService` devuelven un error que nil-form muestra en pantalla.

Recomendación: declarar `type=` en el XML consistente con el tipo de la columna en SQLite (`"number"` para columnas numéricas, `"text"` para `TEXT`, `"date"` para fechas en formato ISO).

## Máscaras Numéricas

No implementadas en nil-form v2.3.0. Ver 🚧 Pendiente.

## Superposición de Atributos

En nil-form, el XML del formulario es la única fuente de verdad para los atributos de campo. No existe herencia desde la base de datos, por lo que no hay superposición entre definición de formulario y definición de esquema.

Si en el XML se define el mismo atributo más de una vez (por ejemplo en `<validation>` anidado), prevalece el último valor parseado. Se recomienda definir cada atributo una sola vez por campo.

Ejemplo de precedencia explícita en XML nil-form:

```xml
<!-- El handler puede sobreescribir el default en tiempo de ejecución -->
<field id="fecha" label="Fecha de edición" type="date" default="today">
    <validation><min>01/01/1984</min></validation>
</field>
```

Si el handler devuelve un valor para el campo en `after()` o `beforeSave()`, ese valor prevalece sobre el `default`.

---

## 🚧 Pendiente en nil-form

- **FLOAT** (notación exponencial `e`) → no implementado.
- **Dígito verificador** (`_.#`) → no implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición. No implementado.
- **Variables de ambiente** (`$VAR`) en atributos → disponible via handler o `is=`.
- **Campos de referencia / polimórficos** (`reference(r1..r4)`) → no implementado.
- **`display only when expr`** / **`skip when cond`** → condicionales en tiempo de ejecución. No implementado.
- **`autoenter`** → paso automático al completar el campo. No implementado.
- **`in table` con índice compuesto** (`by indice`) → `<in-table>` soporta clave simple únicamente.
- **`on help in table` sin validación** → `<in-table>` siempre valida; variante solo-ayuda no implementada.
- **Campos Agrupados** → validaciones cruzadas al salir del grupo. No implementado.
- **Subformularios** → modal al completar un campo, hasta 8 niveles. No implementado.
- **`is descr(campo)`** / **`is help(tecla)`** / **`is num/date/time(expr)`** → funciones de conversión y descripción. No implementados.
- **`autowrite`** → grabación automática al pasar por el campo de control. No implementado.
- **Especificadores de formato en mensajes** (`%d`, `%s`, etc.) → mensajes son cadenas estáticas.
- **Herencia de atributos desde esquema DB** → en nil-form todos los atributos se definen en XML.

---

## Subformularios

Los subformularios permiten desplegar un formulario secundario en forma dinámica al completar un campo, permitiendo cargar datos en él y luego retornar al formulario original. Pueden anidarse hasta ocho niveles.

> ❌ **No implementado en nil-form v2.3.0.** Ver 🚧 Pendiente.

---

## Campos Múltiples

Un conjunto de campos puede agruparse para formar un campo múltiple (`type="multifield"`). Dicho conjunto se repetirá en una cantidad de filas formando una grilla. La primera columna es el "campo rector".

En nil-form, un campo múltiple se define con el elemento `<field type="multifield">` que contiene como hijos los campos de cada columna:

```xml
<field id="grancampo" label="Movimientos" type="multifield" rows="30" display="5">
    <field id="nrocuenta" label="Nro. Cuenta" type="number"/>
    <field id="descrip"   label="Descripción" type="text"/>
    <field id="debitos"   label="Débitos"     type="number"/>
    <field id="creditos"  label="Créditos"    type="number"/>
</field>
```

`rows="30"` define el total de filas de la matriz. `display="5"` define cuántas filas se muestran simultáneamente en pantalla. La paginación se navega con los botones `[ ← Anterior ]` / `[ Siguiente → ]` y el indicador `1-5 de 30`.

En móvil (≤650px), cada fila se renderiza como una card apilada con labels en columna izquierda — neobrutalismo terminal responsive.

Rows dinámicos pueden agregarse desde un handler con `appendRow`:

```javascript
after(fieldId, value, data, db) {
    if (fieldId === 'cod_producto') {
        const prod = db.find('productos', { id: value });
        return { appendRow: { field: 'grancampo', row: { descrip: prod.nombre, precio: prod.precio } } };
    }
}
```

## Atributos de Campos Múltiples

**`not null`** → `<required>true</required>` sobre el campo `type="multifield"`: debe ingresarse al menos una fila.

**`display only`** → `display-only="true"` sobre el campo `type="multifield"`: todos los campos hijos son de solo lectura.

**`skip when condición`** → no implementado en nil-form v2.3.0.

Los campos que forman el múltiple pueden tener los mismos atributos que los campos simples, salvo el campo rector (el primero) que no puede tener `default`.

## Atributo `unique`

Sobre un campo hijo de un multifield se puede indicar `unique="true"`. nil-form verifica que el valor ingresado no esté repetido en ninguna otra fila:

```xml
<field id="items" type="multifield" rows="50" display="7">
    <field id="codigo" label="Código" type="number" unique="true"/>
    <field id="descrip" label="Descripción" type="text"/>
    <field id="precio"  label="Precio"      type="number"/>
</field>
```

## Atributos Específicos de Campos Múltiples

**`display <n>`** → `display="n"`: cantidad de filas visibles simultáneamente.

**`rows <n>`** → `rows="n"`: cantidad total de filas de la grilla.

**`ignore [delete] [add] [insert]`** → no implementado en nil-form v2.3.0. Los botones `[ + ]` (agregar fila) y `[ ✕ ]` (borrar fila) son controlados por RADU: si el usuario no tiene `canWrite()`, los botones se ocultan. Control granular por operación dentro del multifield es pendiente. Ver 🚧.

---

## Campos Agrupados

Los campos agrupados son un conjunto de campos sucesivos que generan un campo virtual para realizar validaciones cruzadas entre sus componentes (por ejemplo: fecha-desde debe ser menor que fecha-hasta).

> ❌ **No implementado en nil-form v2.3.0.** Las validaciones cruzadas entre campos deben implementarse en el handler (`beforeSave`) o en `<validation><check>this >= desde</check></validation>` sobre el campo individual. Ver 🚧 Pendiente.

## Atributos para Campos Agrupados

> ❌ **No implementado.** Ver 🚧 Pendiente.

## Atributos para Campos dentro de un Agrupado

> ❌ **No implementado** (`check after nombre_campo`). Ver 🚧 Pendiente.

## Campos Agrupados dentro de un Campo Múltiple

> ❌ **No implementado.** Ver 🚧 Pendiente.

---

## Formularios con Zona de Clave

La zona de clave es la primera parte del formulario, compuesta por uno o más campos que identifican el registro a buscar. Al completar el último campo clave, nil-form ejecuta automáticamente la operación **LEER**: busca el registro en la base de datos y lo despliega en la zona de datos.

En nil-form, la zona de clave se define con el atributo `keyField="true"` sobre el campo identificador:

```xml
<field id="codigo" label="Código de Libro" type="number" keyField="true" size="6"/>
```

Al completar `codigo` (blur), `ValidationCoordinator` ejecuta `RecordService.load()` y puebla el formulario. Si no existe el registro, la zona de datos queda en blanco para alta.

| Operación | Control nil-form | Zona |
|-----------|-----------------|------|
| AGREGAR / ACTUALIZAR | **`[ GUARDAR ]`** | Zona de datos |
| BORRAR | **`[ BORRAR ]`** | Zona de datos |
| IGNORAR | **`[ IGNORAR ]`** | Zona de datos |
| LEER | automático al completar `keyField` | Zona de claves |
| LEER SIGUIENTE | **`[ SIG > ]`** | Zona de datos |
| LEER PREVIO | **`[ < ANT ]`** | Zona de datos |
| FIN | **`[ FIN ]`** | Cualquiera |

*Figura 3.7 — Operaciones de Formulario en nil-form*

Los botones `[ < ANT ]` / `[ SIG > ]` navegan al registro anterior/siguiente en la misma tabla, teniendo en cuenta el `empresa_id` del operador activo (ScopedDb multi-tenant). Son visibles incluso en modo solo-lectura (RADU sin `canWrite`).

Ejemplo completo — Formulario de Libros con zona de clave:

```xml
<form id="libros" title="Libros" database="libros" handler="none">
    <form-attributes>
        <use>libros</use>
        <window border="single"/>
        <confirm>delete, end</confirm>
    </form-attributes>
    <layout>
        <container type="horizontal">
            <border>
                <field id="codigo"  label="Código"    type="number" keyField="true" size="6"/>
            </border>
        </container>
        <container type="vertical">
            <field id="titulo"   label="Título"    type="text"   size="30"/>
            <field id="autor"    label="Autor"     type="number" size="6">
                <in-table table="autores" key="id" display="nombre"/>
            </field>
            <field id="nombre"   label="Nombre"    type="text" display-only="true" skip="true">
                <copy from="autores" field="nombre"/>
            </field>
            <field id="edicion"  label="Edición"   type="number" size="3"/>
            <field id="fecha"    label="Fecha"      type="date">
                <validation><max>today</max></validation>
            </field>
        </container>
    </layout>
</form>
```

---

## Utilitarios

En nil-form no existe etapa de compilación ni utilitarios CLI independientes. Las funciones equivalentes son nativas al motor.

### TESTFORM

En el FDL original, `testform` ejecuta el prototipo de un formulario sin base de datos. En nil-form, simplemente abrir el formulario en el navegador provee el mismo comportamiento:

```
http://localhost:3000/?form=nombre_formulario
```

Las validaciones se aplican en tiempo de ejecución. Para probar sin handler, usar `handler="none"` en el XML.

### GENFM

`genfm` generaba un archivo FDL a partir de una tabla de base de datos. En nil-form, un formulario de CRUD puro sin lógica custom se obtiene con `handler="none"`:

```xml
<form id="autores" title="Autores" database="autores" handler="none">
    ...
</form>
```

nil-form gestiona automáticamente las operaciones GUARDAR / BORRAR / IGNORAR sobre la tabla especificada.

### DOFORM

`doform` ejecutaba un formulario completo con acceso a base de datos. En nil-form, este es el comportamiento por defecto al servir el formulario con `node server.js`. Todas las operaciones CRUD, validaciones `<in-table>` y paginación PAG_SIG/PAG_ANT están integradas en el motor.

### GENCF

Generaba código C para integrar formularios en programas CFIX. **No aplica en nil-form.** La lógica de negocio se implementa en handlers JavaScript:

```javascript
// apps/libros_handler.js
module.exports = {
    table: 'libros',
    keyField: 'codigo',
    beforeSave(data, db) { return data; },
    afterSave(data, db) { /* post-procesamiento */ }
};
```

### EXECFORM

Permitía usar un formulario como captura de parámetros para lanzar un proceso externo. **No aplica en nil-form.** La acción posterior al `[ GUARDAR ]` se implementa en `afterSave` del handler o mediante rutas Express personalizadas en `src/routes/`.

---

## 🚧 Pendiente en nil-form

- **FLOAT** (notación exponencial `e`) → no implementado.
- **Dígito verificador** (`_.#`) → no implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición. No implementado.
- **Variables de ambiente** (`$VAR`) en atributos → disponible via handler o `is=`.
- **Campos de referencia / polimórficos** (`reference(r1..r4)`) → no implementado.
- **`display only when expr`** / **`skip when cond`** → condicionales en tiempo de ejecución. No implementado.
- **`autoenter`** → paso automático al completar el campo. No implementado.
- **`in table` con índice compuesto** (`by indice`) → `<in-table>` soporta clave simple únicamente.
- **`on help in table` sin validación** → `<in-table>` siempre valida; variante solo-ayuda no implementada.
- **Campos Agrupados** → validaciones cruzadas al salir del grupo (`check after campo`). No implementado.
- **Subformularios** → formulario modal al completar un campo, hasta 8 niveles. No implementado.
- **`ignore [delete] [add] [insert]`** en multifield → control granular de operaciones por fila. No implementado.
- **`skip when condición`** en multifield → no implementado.
- **`is descr(campo)`** / **`is help(tecla)`** / **`is num/date/time(expr)`** → no implementados.
- **`autowrite`** → grabación automática al pasar por el campo de control. No implementado.
- **Especificadores de formato en mensajes** (`%d`, `%s`, etc.) → mensajes son cadenas estáticas.
- **Herencia de atributos desde esquema DB** → en nil-form todos los atributos se definen en XML.

---

# Interfaz con Handlers

En lugar de la interfaz C del FDL original, nil-form expone una **interfaz de handlers JavaScript** para implementar lógica de negocio pre- y post-campo, validaciones programáticas y operaciones con la base de datos.

Los handlers se ubican en `$NIL_APP_DIR/apps/` y se referencian desde el formulario con el atributo `handler=`:

```xml
<form id="libros" title="Libros" database="libros" handler="libros_handler">
```

```javascript
// /opt/wc/pizzeria/apps/libros_handler.js
module.exports = {
    table: 'libros',
    keyField: 'codigo',

    before(fieldId, data, db) { },          // pre-campo
    after(fieldId, value, data, db) { },    // post-campo (blur)
    beforeSave(data, db) { return data; },  // pre-GUARDAR
    afterSave(data, db) { },               // post-GUARDAR
    beforeDelete(data, db) { },            // pre-BORRAR
    afterDelete(data, db) { }             // post-BORRAR
};
```

`db` es una instancia de **ScopedDb** — inyecta automáticamente `empresa_id` en todas las queries del tenant activo.

---

## La Función DoForm → nil-form Runtime

En el FDL original, `DoForm` era el núcleo que recorría los campos y retornaba el estado de la operación. En nil-form, este rol lo cumple el motor formado por `ValidationCoordinator` + `SubmitManager` + `HandlerBridge`.

Los estados equivalentes son:

| FDL original | nil-form | Descripción |
|---|---|---|
| `FM_ADD` | `[ GUARDAR ]` (nuevo) | `POST /api/records/:table` |
| `FM_UPDATE` | `[ GUARDAR ]` (existente) | `PUT /api/records/:table/:id` |
| `FM_DELETE` | `[ BORRAR ]` | `DELETE /api/records/:table/:id` |
| `FM_IGNORE` | `[ IGNORAR ]` | reset client-side |
| `FM_EXIT` | `[ FIN ]` | cierra el formulario |
| `FM_READ` | completar `keyField` | `GET /api/records/:table/:id` |
| `FM_READ_NEXT` | `[ SIG > ]` | `GET /api/records/:table/navigate?dir=next` |
| `FM_READ_PREV` | `[ < ANT ]` | `GET /api/records/:table/navigate?dir=prev` |

*Figura 3.9 — Estados de operación en nil-form*

---

## Condiciones Pre-Campo y Post-Campo

Las funciones `before` y `after` del handler son el equivalente directo a las funciones before/after field del FDL original.

```
         ( foco entra al campo )
                   │
                   ▼
          ┌─────────────────┐
          │  before(field)  │──── FM_SKIP → handler retorna { skip: true }
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Entrada datos  │◀──── usuario escribe
          └────────┬────────┘
                   │ blur
                   ▼
          ┌─────────────────┐
          │  after(field)   │──── puede retornar:
          └────────┬────────┘     { populate }, { appendRow },
                   │              { setValues }, { error }
                   ▼
          ┌─────────────────┐
          │  Validaciones   │──── <validation> del XML
          └────────┬────────┘
                   │ FM_OK
                   ▼
          ( siguiente campo )
```

*Figura 3.10 — Flujo de validación en nil-form*

Ejemplo — saltear un campo de descripción (campo display-only) y poblar valores desde `after`:

```javascript
after(fieldId, value, data, db) {
    if (fieldId === 'cod_autor') {
        const autor = db.find('autores', { id: value });
        if (!autor) return { error: 'Autor no encontrado' };
        return { setValues: { nombre_autor: autor.nombre } };
    }
}
```

Las operaciones `[ BORRAR ]`, `[ IGNORAR ]` y `[ FIN ]` no pasan por `after`. Las validaciones necesarias para estas operaciones deben implementarse en `beforeDelete` o `beforeSave`.

### `has [after|before] when expr`

> ❌ **No implementado en nil-form v2.3.0.** La ejecución condicional de before/after se controla programáticamente dentro del propio handler con un `if`.

---

## Condiciones Pre- y Post- Campo en Campos Múltiples y Agrupados

Los handlers `before` y `after` reciben el `fieldId` del campo afectado. Para campos dentro de un multifield, nil-form pasa el identificador de la columna. Las validaciones cruzadas entre columnas de una misma fila se implementan en `beforeSave`:

```javascript
beforeSave(data, db) {
    const items = data.items || [];
    for (const fila of items) {
        if (fila.tipo === fila.codigo) {
            throw new Error('Tipo y código no pueden coincidir en una misma fila');
        }
    }
    return data;
}
```

Para validaciones cruzadas entre campos simples (equivalente a campos agrupados), también se usa `beforeSave`:

```javascript
beforeSave(data, db) {
    if (data.fecha_desde > data.fecha_hasta) {
        throw new Error('La fecha desde debe ser menor que la fecha hasta');
    }
    return data;
}
```

---

## Subformularios Manuales

> ❌ **No implementado en nil-form v2.3.0.** Ver 🚧 Pendiente.

---

## La Biblioteca de Handlers

La interfaz completa del handler — incluyendo todas las funciones disponibles en `db` (ScopedDb) y los valores de retorno de `after` — se documenta en `docs/02-architecture/ANALYSIS-HIERARCHY.md` y en el código fuente de `src/services/handlerService.js`.

---

## Capacidades Máximas

| Capacidad | nil-form v2.3.0 |
|-----------|-----------------|
| Formularios abiertos simultáneamente | Sin límite técnico (por tab/workspace) |
| Campos en un formulario | Sin límite técnico |
| Caracteres en un campo `text` | Sin límite técnico (JavaScript string) |
| Dígitos significativos en un campo `number` | 15 (precisión IEEE 754) |
| Rango de valores en un campo `date` | 01/01/1970 — 31/12/9999 (Date JS) |
| Rango de valores en un campo `time` | 00:00 — 23:59 |
| Filas en un multifield (`rows`) | Sin límite técnico |
| Opciones en un `<options>` estático | Sin límite técnico |
| Mensajes en `<messages>` | Sin límite técnico |
| Tenants (empresas) simultáneos | Sin límite técnico (ScopedDb) |
| Formularios abiertos por sesión | Sin límite técnico |

---

## 🚧 Pendiente en nil-form

- **FLOAT** (notación exponencial `e`) → no implementado.
- **Dígito verificador** (`_.#`) → no implementado.
- **Máscaras** (`mask`) → restricción de caracteres por posición. No implementado.
- **Variables de ambiente** (`$VAR`) en atributos → disponible via handler o `is=`.
- **Campos de referencia / polimórficos** (`reference(r1..r4)`) → no implementado.
- **`display only when expr`** / **`skip when cond`** → condicionales en tiempo de ejecución. No implementado.
- **`autoenter`** → paso automático al completar el campo. No implementado.
- **`in table` con índice compuesto** (`by indice`) → `<in-table>` soporta clave simple únicamente.
- **`on help in table` sin validación** → variante solo-ayuda sin validación. No implementado.
- **Campos Agrupados** → como estructura XML declarativa con `check after campo`. No implementado.
- **Subformularios** (automáticos y manuales) → formulario modal al completar un campo. No implementado.
- **`ignore [delete] [add] [insert]`** en multifield → control granular por operación. No implementado.
- **`skip when condición`** en multifield → no implementado.
- **`has [after|before] when expr`** → ejecución condicional declarativa de hooks. No implementado.
- **`is descr(campo)`** / **`is help(tecla)`** / **`is num/date/time(expr)`** → no implementados.
- **`autowrite`** → grabación automática al pasar por el campo de control. No implementado.
- **Herencia de atributos desde esquema DB** → en nil-form todos los atributos se definen en XML.

<!-- Sección adaptada para nil-form.md | Nilix v2.3.0 -->
