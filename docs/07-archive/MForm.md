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
Como se mencionó anteriormente, cada formulario está contenido en un archivo de definición con la extensión ".fm", conocido como archivo fuente FDL. Este archivo será procesado con fgen, para generar un archivo con la extensión ".fmo", y opcionalmente un archivo de cabecera con la extensión ".fmh", como se muestra en el siguiente gráfico:



```
                                            ┌──────────┐
┌─────────┐      ┌────────┐         ┌┄┄┄┄┄> │ arch.fmh │
│ arch.fm ├──────┤  fgen  ├─────────┤       └──────────┘
└─────────┘      └────────┘         │       
                                    │       ┌──────────┐
                                    └┄┄┄┄┄> │ arch.fmo │
                                            └──────────┘

```

Figura 3.2 - Generación de un Formulario
El archivo ".fmo" contiene el formulario compilado, el cual es usado por los utilitarios que permiten emplearlo para distintos fines (testform, execform, doform, etc) o por un programa de aplicación escrito en "C", en el momento de su ejecución. El archivo de cabecera debe incluirse en los programas de aplicación en "C" que utilicen el formulario. Contiene valores de constantes simbólicas que representan los distintos campos, y otras constantes auxiliares necesarias para la compilación.
## El Lenguaje FDL
Un archivo de formulario escrito en FDL se divide en tres secciones:
- La primera parte contiene la imagen de la pantalla.
- La segunda parte (iniciada por la palabra clave %form), contiene información general sobre el formulario. Esta sección es opcional.
- La tercera parte (que se inicia con la palabra clave %fields), tiene como fin definir los nombres de los campos y sus atributos (validaciones, ayudas, etc.). Se explicará seguidamente el formato de cada sección.
### Imagen de la Pantalla
Comienza al principio del archivo, y muestra cómo se verá la pantalla cuando se utilice el formulario. Hay cuatro clases de datos en la imagen:
- Texto común. Se despliega directamente.
- Indicadores de Atributos de Pantalla. Consisten en una secuencia "Esc [ n m", donde "Esc [" simboliza <HOME>, y el valor de n corresponde al atributo:

Atributo | Número (n) 
---------|------------
 NORMAL | 0
 NEGRITA | 1
 STANDOUT | 2
 SUBRAYADO| 4
BLINK | 5
REVERSO | 7

Figura 3.3 - Atributos de Pantalla

El atributo se activa desde el momento en que se inserta en la imagen hasta que otra indicación modifique su vigencia. El editor ie permite manejar estos atributos de manera muy cómoda, digitando ~n a, donde n es el dígito indicado en la segunda columna. Se recomienda no usar el número 6, ya que provoca una alteración en el juego de caracteres.
- Valores de variables de ambiente. El valor de una variable de ambiente puede obtenerse con la indicación \$name, donde name es el nombre de la variable. Por ejemplo: la indicación \$usrname desplegará el contenido de la variable de ambiente usrname al momento de desplegar el formulario, en la posición de pantalla donde ha sido escrito.
- Campos de Pantalla. Son los campos de datos donde el usuario ingresará y/o visualizará información. Pueden ser de tipo fecha (DATE), hora (TIME), numérico (NUM), punto flotante (FLOAT), alfanumérico (CHAR) y booleano (BOOL). Los campos también se conocen con el nombre steps (pasos) porque cuando se utiliza el formulario, el proceso de ingreso de datos recorre cada campo de la pantalla "paso por paso". Cada campo dibujado en la imagen debe ser bautizado con un nombre en la sección %fields. Los campos se enumeran de izquierda a derecha, y de arriba hacia abajo según aparecen en la pantalla y deben nombrarse en ese mismo orden en la sección %fields.

Los campos que el usuario debe completar con datos, están marcados en la pantalla con el carácter de subrayado ( _ ). Se dibujan de la siguiente manera, de acuerdo al tipo de dato que ellos aceptan y/o muestran:
1. ALFANUMERICO. Está formado por una secuencia de uno o más caracteres de subrayado ( _ ):
```
_ _ _ _ _ _ _ _ _ _  //Alfanumérico de 10 caracteres.
```
En este campo, el usuario puede ingresar cualquier carácter imprimible. Es posible dar validaciones adicionales sobre el tipo de caracteres que se admiten mediante las especificaciones de máscara que se describirán más adelante. Debe tenerse en cuenta que conforme a las normas del trazado WYSIWYG los "underscores" aparecerán uno a continuación del otro formando un trazo continuo, y no separados como aquí se ilustran.

2. NUMERICO. Es también una secuencia de subrayados, pero termina con un punto decimal. Opcionalmente puede especificarse la coma (",") como separador de unidades de mil. Luego del punto pueden indicarse posiciones para decimales. Se usa el punto decimal y la coma para los millares, a fin de uniformizar la especificación de pantalla; sin embargo, en el momento de usar el formulario, los números se mostrarán según el país. En el caso del español se usará la coma como separador decimal y el punto para indicar los millares.
```
_ _ _.          // Entero de 3 dígitos. 
_ _ _ _ _._     // 5 dígitos enteros, 1 decimal. 
_ _ _,_ _ _._ _ // 6 dígitos enteros con separador de miles, 2 decimales. 
```
En caso de que el campo tenga posibilidad de ser negativo, se indicará anteponiendo el signo correspondiente, de la siguiente manera: 
```
-_ _ _,_ _ _._ _  // 6 dígitos enteros, 2 decimales, separador de miles y signo.
```
Si se quiere usar dígito verificador en el campo, se agrega un signo numeral después del punto (el campo debe ser entero): 
```
_ _ _ _.# 
```
Al ingresar los datos, sólo se permiten dígitos y el signo menos, si ha sido indicado. 

3. DATE. En este caso las barras definen el formato utilizado para la fecha, que puede ser alguno de los siguientes: 
```
_ _/_ _/_ _      // (dd/mm/aa) 
_ _/_ _/_ _ _ _  // (dd/mm/aaaa) 
```
La cantidad de posiciones después de la segunda barra determina si se especifica el año completo, o solamente los dos últimos dígitos. Las fechas se validan en el momento en el que el usuario las digita, rechazando las que sean erróneas. 

4. TIME. El carácter dos puntos ":" es el que marca este tipo de campo. La hora puede especificarse en dos formatos: 
```
_ _:_ _      // (HH:MM) 
_ _:_ _:_ _  // (HH:MM:SS) 
```
La hora se valida en el momento en que se ingresa,
rechazando los valores sin sentido. 

5. FLOAT. Este tipo de campo se identifica mediante el carácter "e" al final de una secuencia de subrayados. 
Al igual que para los campos numéricos, si se antepone el signo menos, se permitirá el ingreso del mismo durante la carga. Veamos ahora su sintaxis: 

```
_ _ _ _ _ _ e      // 7 dígitos en punto flotante sin signo. 
-_ _ _ _ _ _ _ _ e // 9 dígitos en punto flotante con signo. 
```

En el ingreso de este tipo de datos, sólo se permitirán: 
- dígitos numéricos;
- el signo menos si estubiera especificado, o
- el carácter e para el ingreso en formato exponencial.

Es importante notar que debido a este último formato la longitud mínima de este tipo de campo es siete.

6. BOOL. Este tipo de dato está formado por cero o mas caracteres subrayados seguidos por el carácter "?". 
El formato es el siguiente:
```
_ _ ? Booleano de 3 caracteres.
```
Los valores lícitos para este tipo de dato son: 
verdadero (Si, Yes, etc) o falso (No, etc). 
Solo hará falta ingresar el primer carácter, por ejemplo "Y" o "S" para el valor verdadero, desplegándose automáticamente el resto del campo, "YES" en el primer caso y "SI" en el segundo. La configuración de los valores dependerá de la variable de ambiente LANGUAGE.

Las características y validaciones aplicadas en cuanto al tipo de dato aceptado fueron indicadas al dibujar cada campo. Pueden presentarse casos más complejos donde sean necesarias otras restricciones a los caracteres aceptados. NILIX provee las llamadas "máscaras" que permiten especificar validaciones sobre un campo alfanumérico, restringiendo el tipo de carácter que puede ingresarse en cada posición. Estas posibilidades se obtienen mediante el atributo mask. Para más información se puede consultar la página de la función mask(ST) en la Referencia de Funciones de NILIX.

---

Continuando con el ejemplo introducido en el capítulo anterior (esquema de biblioteca), podríamos definir la imagen del formulario de manejo de datos de la tabla libros, de la siguiente forma:

```
LIBROS Código del Libro: __________. 
Título de la Obra: ____________________________ 
Código del Autor: __________. 
Edición: _____ 
Fecha: _____/_____/_____
```
Existen también posibilidades más avanzadas:
- Campos Múltiples: Permiten formar una matriz con una serie de campos dibujados en una fila.
- Campos Agrupados: Conjunto de campos que se relacionan para efectuar validaciones cruzadas entre sus valores.
- Subformularios: Capacidad de presentar un formulario en forma dinámica. Cuando el usuario completa un campo, se despliega el subformulario, permitiendo cargar datos en él. Cuando se completa a su vez el subformulario, éste desaparece de la pantalla, continuándose en el formulario original.
### Separador de Campos

Es posible usar el carácter NULL (ej., '\0') como separador de Campo, el cual hará que dos campos separados por él en una imagen aparezcan juntos en la pantalla. Esto puede ser útil cuando se quiera desplegar varios campos en pantalla, porque usando el separador NULL se ahorra el espacio entre los campos numéricos, los cuales ya tienen un separador (ej., el punto del final).
## La Sección %form
Esta sección es opcional, y especifica ciertas características generales de un formulario. Está formada por una serie de sentencias finalizadas por punto y coma (";"). Pueden insertarse comentarios de la siguiente forma:
- Precediéndolos por dos barras ("/ /"). El comentario se extiende desde allí hasta el fin de línea.
- Encerrándolos entre los pares de caracteres barra-asterisco ("/*") y asterisco-barra ("*/"). Esta notación es análoga a la empleada en lenguajes de programación como "C" y PL/I:

```
/* Esto es un comentario */
```

En esta sección se admiten las siguientes sentencias:
use Especifica los esquemas de la base de datos que se usarán cuando se relacionen campos de tablas de la Base de Datos con los de pantalla (luego se verá más sobre este tema). Los esquemas se especifican por una lista de nombres separados por comas:

```
// Esquemas a utilizar: 
use biblio,alpha, sueldos;
language 'c' 
```
Esta sentencia indica al compilador (fgen) que se genere el archivo de encabezado (el que lleva extensión .fmh). Este archivo es necesario en el momento de la compilación de los programas CFIX que invoquen a este formulario.
```
ignore 
```
Las operaciones a ser ignoradas van en una lista, separadas por comas. Pueden ser: add, update, ignore, delete, next , prev y end. Por ejemplo:
```
/* Ignorar operaciones de agregado y borrado */ 
ignore delete, add;
```

`confirm`
Las operaciones de formulario que deben confirmarse antes de su ejecución pueden ser: add,
384
- 


update, ignore, delete y end. Su sintaxis es la misma que para el ignore.

```
// Confirmar actualización y fin
confirm update, end;
```

`window`  
Esta sentencia controla los parámetros de la ventana que contendrá al formulario.
messages La próxima subsección explica las cláusulas admitidas. En esta opción se especifican los mensajes de error o ayuda que serán asociados a los campos de la pantalla, y desplegados en el momento en que se digite la tecla de función <AYUDA>, o se produzca un error en tales campos. La lista de mensajes está separada por comas (",") y finaliza con punto y coma (";").

```
messages 
HELP1: "Código numérico del Libro", 
ERROR: "El título ya existe";

```
Al desplegar un mensaje desde un programa en CFIX (Lenguaje "C" + Biblioteca de funciones NILIX) pueden pasarse como argumentos del mismo valores obtenidos durante la ejecución del programa. De esta forma se logrará que los mensajes varíen según las circunstancias. La forma de especificar la posición donde se colocarán los valores pasados al mensaje, es similar a la del printf del "C", por lo tanto las siguientes alternativas son válidas:

```
%d : short (d = Decimal corto) 
%ld : long (ld = Long Decimal) 
%f : double (f = Full capacity = Double length) 
%g : float ("f" ya se usó, por eso emplea "g") 
%s : char (s = string de caracteres) 
%D : date %T : time autoexplicativos 
%B : bool <S3>
```

Por ejemplo el mensaje ERROR podría completarse de la siguiente forma:
```
ERROR:"El título %s ya existe";
```
Cuando se despliegue el mensaje desde el programa se le pasará como parámetro el título del libro que se haya repetido. 
Nótese también que si se desea colocar el signo 'porcentaje' (%) en un mensaje será necesario anteponerle otro signo %, por ejemplo:
```
MENSAJE:"La suma supera el 100%%."
```
con lo que en pantalla aparecerá:
```
La suma supera el 100%.
```


`without control field`
 
Mediante esta sentencia se evita que se incluya en la pantalla el campo de control.

`autowrite`

Esta cláusula permite indicar que se grabe el contenido de la pantalla automáticamente, cuando se pase por el campo de control. Esto tendrá efecto exclusivamente cuando se trate de un alta. Si el registro existiera para realizar una nueva grabación será necesario digitar la tecla de NILIX.

`display status`

Esta cláusula indica mediante una palabra al pie de la pantalla el estado del registro en proceso: alta, baja o modificación.

---

## La Cláusula Window
Como ya se ha mencionado, esta cláusula admite una serie de opciones que se describen a continuación:

`label`

Esta opción permite la definición de una etiqueta que aparecerá en el borde de la ventana que contendrá al formulario. La leyenda se indica con un string a continuación de la palabra clave, como muestra el ejemplo:
```
/* Etiqueta del formulario */ 
window label "Libros de la Biblioteca";
```

`fullscreen`

Esta cláusula dimensiona la ventana que contendrá el formulario a la totalidad de la pantalla (generalmente 80 columnas x 24 filas).

`origen`

Permite especificar las coordenadas del borde superior izquierdo de la ventana. Puede indicarse la fila solamente, o la fila y la columna:
```
window origin (4);
window origin (2, 10);
```

`border`

Define el atributo y los caracteres utilizados para armar el borde de la ventana. Las características del mismo se definen mediante las posibilidades ilustradas en la tabla siguiente:

|Atributo de borde | tipo de caracteres | limites de bordes | Colores de borde
|--|--|--|--|
|  |  |  | red |
|  |  | top | green |
| blink | single | low | blue |
| bold | double | left | yellow |
| reverse | asterisk | right | magenta |
|  |  |  | cyan |
|  |  |  | white |

Figura 3.4 - Características de borde


Cuando no se pone ninguna de estas indicaciones, el borde se hace en los cuatro laterales de la ventana. Los atributos de la ventana pueden combinarse entre sí para obtener distintos tipos de borde. Por ejemplo:

```
window border (double, reverse);
```

Existe un tipo de borde llamado 'standard' que intenta dibujar un recuadro de acuerdo a las posibilidades de la terminal, y que en terminales con carácteres gráficos de línea equivale al ejemplo anterior.

`background`

Determina el color de fondo de la ventana creada para el formulario. Los colores posibles son:

```
red green yellow blue magenta cyan white
```
Estamos ahora en condiciones de agregarle a la pantalla del ejemplo, la sección %form, como se muestra en la ilustración siguiente:


```
LIBROS 
Código del Libro:  __________. 
Título de la Obra: ____________________________ 
Código del Autor:  __________. 
Edición:           _____ 
Fecha:             _____/_____/_____ 
%form 
// Esquema a utilizar use biblio; 
language C; confirm end, update; 
messages 
HELP1: Código del libro; 
ERROR: El título ya existe;
window border standard, 
label Libro de la Biblioteca;
```
## La Sección %fields
Esta parte del archivo FDL es obligatoria. Define los nombres de los campos incluidos en la pantalla, y sus atributos. Los nombres deben estar ordenados de acuerdo con la posición del campo en la pantalla, recordando que se enumeran de izquierda a derecha y de arriba hacia abajo. La sintaxis de esta sección es una lista de nombres de campos seguidos por una lista opcional de atributos:

`nombre_campo [: atributos];`

Debe haber tantas sentencias como campos en la pantalla. La especificación de atributos para un campo es una lista de sentencias separadas por comas. Los atributos permiten definir aspectos tales como relación con campos de bases de datos, mensajes de ayuda y error, validaciones a realizar sobre el valor del campo, etc. La siguiente sintaxis se aplica a ítems encerrados entre los signos de "mayor" y "menor":

**[string]** 

Es cualquier cadena de caracteres encerrada entre comillas dobles.

`"Soy una cadena" "This is a string"`

**[value]**

Es una constante del tipo adecuado según la naturaleza del campo de formulario: 
- Alfanumérico: Se admite como <valor> una cadena de caracteres. 
- Numérico: Admite un número. La cantidad de dígitos y los decimales deben ser compatibles con el dibujo dado al campo en la imagen de la pantalla. 
- Fecha: Una cadena de caracteres que represente una fecha válida. Por ejemplo:

    `fecha: between "01/01/86" and "29/02/88";`

- Hora: Una cadena de caracteres que representa una hora válida, por ejemplo: 

    `hora: between "06:00" and "17:30:45";`

Las constantes especiales today y hour se refieren a la fecha y hora corrientes respectivamente, y se pueden usar como <valor> para campos de tipo fecha y hora respectivamente. También se puede hacer referencia a una variable de ambiente indicándola con $var, la que debe estar definida en el momento de ejecución. 
- Referencia: este tipo especial de campo permite la definición de ciertos campos como "polimórficos". Esto significa que el campo puede aceptar diferentes tipos de datos en forma nativa, por ejemplo:
```
_____ 
____. 
____. _____ _____ 
%form 
%fields 
a; 
b: reference(r1..r4), is cod 
r1: internal char(10), check this != "hola" 
r2: internal num(4); 
r3: internal time; 
r4: internal date; ...
```

donde b es el campo de referencia el que puede cambiar su tipo en tiempo de ejecución a uno de los especificados dentro de la lista de campos de la cláusula de referencia. En este caso los campos son los comprendidos en el rango "r1 .. r4". Todos estos campos deben ser internals y deben aparecer luego del campo de referencia.

b es un campo numérico de cuatro posiciones (en correspondencia a lo que se definió en la imagen del form) e indica el campo, dentro del rango de campos internals, que en algún momento es usado como definición.

Por Ejemplo: si el campo tiene valor 1, esto significa que cuando se ingrese este campo, será del tipo char(10) y también deberá elegir la condición de check específica (puede ser igual al string "hola"); si el campo toma valor 2, se verá como un campo numérico de cuatro posiciones, si su valor es tres se verá como un campo de hora y finalmente si es cuatro, se verá como un campo de fecha.

El campo b tomará el valor necesario manualmente ( por medio de la función FmSetFld), o automáticamente (por medio de la expresión is). El uso más comúnes el de asociarle al campo una expresión is, la que le dará su valor y definirá su tipo dinámicamente.

Se debe tener en cuenta que el campo b tendrá que contener cualquiera de los tipos correspondientes a la lista de campos de la cláusula de referencia, así que el espacio que se le otorga en la imagen del form debe ser aquella del tipo de mayor longitud.

Como podemos ver, cada campo perteneciente al rango puede tener su propio atributo, que será respetado cada vez que el campo tome su forma.

### Restricciones en campos polimórficos
El campo de referencia (en el ejemplo era b) no puede ser asociado a la base de datos. Los campos de referencia tienen las mismas restricciones que los campos de tipo internals.
Finalmente, es bueno repetir que los campos de referencia deben ser siempre de tipo internal, estar juntos en una zona de campo, aparecer luego del campo de referencia y aparecer en forma ascendente dentro de la lista de la cláusula de referencia.
Cuando se usa un valor al definir un atributo de check, se verifica que sea compatible con el   campo de formulario, y en el caso del atributo default, que verifique el atributo de check si es que hay alguno. En el caso de usar una variable de ambiente como valor, no puede hacerse ningún control al momento de compilar el formulario, por lo que el mismo queda pospuesto hasta que el formulario sea utilizado. Como se ha mencionado anteriormente, existen campos de tipo múltiple y agrupado con lo que se tienen básicamente campos:

- Simples. 
- Múltiples.
- Agrupados. 

Los campos simples son aquellos en donde se realiza ingreso de datos, y que contendrán un valor. Los campos múltiples son matrices formadas por columnas, que contienen conjuntos de valores; cada una de ellas corresponde a un campo. Los campos agrupados se utilizan para realizar validaciones cruzadas entre distintos componentes de un formulario. Los campos múltiples y los agrupados están siempre formados por uno o más campos simples.

### Atributos Válidos para Todo Tipo de Campo

`not null`

El campo debe tener un valor.

`descr[iption] MSG`

Define un mensaje que aparecerá en el borde inferior de la pantalla toda vez que el usuario esté sobre el campo. MSG debe ser un mensaje definido en la tabla de mensajes definida con el atributo MESSAGES de la sección %form.

`display only`

Los contenidos del campo no deben ser modificados. El usuario puede posicionarse sobre dicho campo, pero no le está permitido alterar su valor.

`display only + is`

Cuando estas cláusulas están combinadas, cuando el if no retorna valor void, el campo no será skip (permite posicionarse sobre el mismo), pero será read only (no se podrá modificar). Por ejemplo:

```
a: display only, is b==1? c: void;
```
 
`display only when expr`

Esta cláusula hará que el campo sea display only cuando la condición en expr sea verdadera. Por ejemplo:
```
a: display only whenb==1;
```
Nota: esta cláusula funcionara como una abreviación de:
```
a: display only, is b==1 ? this : void;
```

`skip`

Saltea el campo en el proceso de ingreso de datos (salta al próximo campo). Esto también funciona para campos agrupados y múltiples, salteando completamente la estructura de campo.

`skip when cond`

Implementa un skip cuando la condición retorna verdadero. Por ejemplo, para campos simples y agrupados:
```
______. 
{ ______. _____. } 
______. 
%form 
%fields 
a; 
agrup: skip when a > 1; 
b; 
c; 
d: skip when a > 2;
```

En el caso en que a sea 2, el próximo campo al cual saltará el cursor será d.


### Atributos para Campos Simples

`on help {<MSG>|manual}`

Si el usuario digita la tecla <HELP> mientras está posicionado en este campo, muestra el texto asociado a MSG definido en la cláusula messages de la sección %form o devuelve el control al programa en el caso de que se especifique manual. Esto permite al programador incluir rutinas que requieran mayor elaboración que las ofrecidas por NILIX. La opción también permite especificar títulos para las ventanas generadas por las ayudas. Un ejemplo de su aplicación se verá más adelante cuando se presenten las cláusulas que generan ventanas. Cuando no se especifica mensaje de ayuda para un campo y se la solicita, se despliega un mensaje que indica el tipo del campo y la cantidad de posiciones que ocupa.

`on error <MSG>`

Se despliega el texto asociado a MSG, definido en la cláusula messages de la sección %form, como mensaje de error cuando el usuario ingresa un dato inválido en el campo.

`mask <string>`

Realiza una operación de máscara sobre el campo. Ver Capítulo 2-Descripción de Sentencias DDS, en la subsección CREATE TABLE, mask, de este Manual.

`default <valor>`

El valor por omisión para un campo será el valor indicado. Puede usarse una variable de ambiente mediante la indicación:

```
default $VARIABLE
```

`length <valor>`

Un campo tipo "char" o "num" posee dos longitudes asociadas: una real, que es la verdadera longitud del campo y otra de salida, que es una longitud virtual dependiente de la imagen especificada en el form. La longitud real debe ser siempre menor o igual que la de salida. Cuando el campo no está asociado con la base de datos entonces el atributo length permite definir la longitud real. Si ésta última es diferente a la de salida, en el ingreso de estos dos tipos de campos se podrán utilizar la teclas de movimiento de cursor para hacer "scroll", y poder ver el campo completamente.

`autoenter`

Mediante este atributo, se establece que no será necesario digitar para pasar de campo, sino que cuando se complete la cantidad de posiciones del mismo, se efectúa un pase de campo automático.

`<campo_tabla>`

El campo de pantalla hereda los atributos del campo de base de datos especificado. Los atributos en campos de tablas tienen el mismo significado en los formularios. La única diferencia es que no tienen significado en el formulario ni la clave primaria, ni la cadena de descripción. Si los tamaños de los campos no coinciden pueden suceder las siguientes alternativas:
- Si el campo definido en el formulario tiene una longitud mayor que la del campo de la Base de Datos, se toma la longitud del segundo. 
- Si el campo definido en el formulario tiene una longitud menor que la del campo de la Base de Datos y el tipo de dato no es ni "char" ni "num", en el momento de la compilación aparecerá un mensaje de error que dice: 
```
"pant.fm", line nn, (48). La longitud del campo 'campo' es incorrecta. Debe ser mayor o igual que la de la base de datos.
```

En caso que el dato sea de tipo "num" o "char", la longitud definida en la base de datos establecerá la longitud real, mientras que la de salida quedará determinada por la longitud en el form (ver atributo length).
- Si el campo definido en el formulario tiene una longitud menor que la del campo de la Base de Datos y tiene un atributo skip, se toma la longitud del campo del primero.
- Si el campo definido en el formulario tiene una longitud menor que la del campo de la Base de Datos y el último tiene asociado un atributo mask, en el momento de la compilación aparecerá un mensaje de error:

```
"pant.fm", line nn, (10). La máscara "cadena" no coincide con la longitud del campo.
```

La opción de fgen -w permite informar cuándo se han hecho ajustes. 

El esquema al cual pertenece la tabla debe haber sido indicado en la sentencia use. La forma de especificar la asociación entre campo de base de datos y de formulario es la siguiente:

```
esquema.tabla.campo
```
Si es el esquema corriente (es decir el primero de la sentencia use se puede omitir la especificación de esquema:

```
tabla.campo
```

Si además el campo del formulario tiene el mismo nombre que el campo en la tabla, la indicación se reduce a:

```
tabla.
```
El siguiente es un ejemplo: 

```
%form 
use biblio; 
%fields 
codigo: libros.;
```

Se dan más detalles sobre la herencia de atributos de base de datos en la sección 

`[manual] subform(<cadena> [, ...]) `

Asocia uno o más formularios. Se explica en detalle en la sección dedicada a subformularios.

`check`

Los atributos de "check" (verificación) permiten especificar una validación sobre el valor ingresado en el campo, y son los siguientes:
- Operadores relacionales (>, <, >=, <=, !=, ==).
- Operador [not] between.
- `[not]in ... (valores)...`. Se especifica una lista de valores que se admiten en el campo. También puede indicarse la validación contraria (not), es decir que el campo no puede contener ninguno de los datos indicados.
- `check expresion`. Combina las anteriores, pudiendo indicarse condiciones que involucren a otros campos del formulario.
- `[not]in tabla [descendente]`. Esta validación permite controlar que un valor exista en una tabla de base de datos. Con not se excluyen los valores sobrantes en la tabla. Estos atributos se explican más en detalle en la siguiente sección Atributos de Check.

`is ... `

Este atributo permite definir campos virtuales. Su especificación completa se detalla en la sección Atributo IS de este capítulo.

### Atributos de Check 

Estos atributos permiten especificar validaciones sobre el valor de los campos de pantalla.

`relop {<valor> | campo}`

Los valores que no verifican la condición no serán aceptados y se los tratará como errores. La condición se puede expresar con cualquiera de los siguientes operadores relacionales: `> < >= <= == != `

Por ejemplo se puede especificar:

```
codigo: > 10;
```

Es posible también realizar operaciones lógicas entre campos del formulario, siempre y cuando el campo contra el cual se compara esté definido previamente. Por ejemplo:
```
%fields 
..... 
desde ; 
hasta : >= desde;
```

`[not] between <valor> and <valor> `

Igual que en el punto anterior, pero la condición da un rango de validez, incluidos los extremos. valor1 debe ser menor que valor2. Por ejemplo:

```
codigo: between 10 and 100;
```

`[not] in (<valor>[: <cadena>] [, <valor> ...])`

Los valores aceptados deben pertenecer al conjunto indicado. Opcionalmente se puede indicar una descripción asociada a cada valor. Este atributo da al campo la característica de que cuando se pide ayuda sobre el mismo, se despliegue una ventana de tipo menú, mostrando como opciones los valores del conjunto, y su descripción asociada si es que la hay. El siguiente es un ejemplo:


```
tipo: in (1:"Paises", 2:"Idiomas");
```

que aparece en pantalla de la siguiente forma:

```
┏━ Selección de Opción ━━━━━━━━━━━━━━━━┓
┃                                      ┃
┃  1_ Países                           ┃
┃  2_ Languages                        ┃
┃                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Si se desea cambiar la etiqueta por omisión de la ventana ("Opción a Seleccionar") se puede combinar esta cláusula con la on help, de la siguiente forma:
```
..... 
%form 
messages TITULO: "Cód. Descripción"; 
%fields . . . . . tipo: in (1: "Paises", 2: "Idiomas"), 
on help TITULO;
```
En este caso la etiqueta de la ventana pasará a ser la cadena de caracteres contenida en el mensaje "TITULO". Cuando el atributo está prefijado por not, la validación es a la inversa, es decir, el valor se rechaza si pertenece al conjunto.

`check expresión`

Este atributo permite construir condiciones más complejas que involucren el campo actual del formulario (indicado con this) y cualquier otro campo (indicado con su nombre). La expresión se puede armar con cualquiera de los operadores anteriores. Por ejemplo:

```
precio: check (this<=1000 and cantid*this<=100000); 
```

en este ejemplo se especifica que los precios no deben exceder los mil pesos, y el total no debe exceder los cien mil pesos. Notar el campo cantidad debe ser definido previamente.

`[not] in table`

Esta validación permite verificar que el valor ingresado en el campo exista (o no, si se usa not) en una tabla de base de datos.
En caso de solicitar ayuda en un campo de un formulario que tenga asociada esta cláusula, (ya sea explícitamente o bien heredada de la Base de Datos) se desplegará una ventana similar a la de las cláusulas in, vistas en el punto anterior. Esta ventana incluirá todas las alternativas posibles de selección para ese campo, efectuando a su vez la validación luego del ingreso de datos.
Como en el caso anterior, puede especificarse un título a la ventana generada, combinando esta opción con la cláusula on help.
Debido a la gran variedad de alternativas que ofrece esta cláusula, se explica en profundidad en la siguiente sección.
También, los atributos check pueden referirse a un grupo de campos. Por ejemplo:

```
{ ______. ______. } 
%form 
%field 
agrup: check a > b; 
a; 
b;
```

### Atributo in table
Consiste en verificar que el valor que se le da a un campo de un formulario exista en una columna de una tabla de base de datos. La verificación se hace realizando una búsqueda por clave sobre la tabla donde debe existir el valor. En el caso más simple la lectura se realiza por la clave primaria. A la clave que se está buscando se le da el valor El valor que se le da a la clave a buscar es el que tiene el campo que se está validando. Supondremos en primera instancia que el valor del campo se puede usar directamente para realizar una búsqueda.
El resultado de la validación es entonces el resultado de la búsqueda, es decir, si la búsqueda es exitos a la validación verifica.
Cuando un campo tiene un atributo 'in tabla' y se pide ayuda sobre el mismo se desplegará una ventana menú que muestra el contenido de la tabla para permitir la selección de uno de sus valores. En dicha ventana se muestran los valores posibles para el campo, y asociado a cada uno de ellos una descripción, de la misma forma que en la validación 'in' con un conjunto de valores.
La sintaxis para expresar esta validación es:

`[not] in tabla [by indice [(valor,...)][:(campo1,...)]`

donde tabla es aquella donde se hace la búsqueda, y debe pertenecer a alguno de los esquemas indicados en la sentencia use. Los campos: campo1, campo2, ... pertenecen a dicha tabla, y se los denomina "campos de descripción". En el formulario usado como ejemplo, existe el campo autor. Su contenido debe existir en la tabla autores, del esquema biblio, por tanto:

```
autor: in autores:(nombre)
```
Para efectuar la validación se toma el valor dado a 'autor' en el formulario y se lo usa como clave primaria para realizar una búsqueda en autores. Ahora supongamos que el campo sobre el cual hacemos una validación se puede utilizar para hacer una búsqueda por clave, pero que no es la clave primaria, sino otro índice. Entonces se debe indicar el nombre del mismo -supongamos sea titulo- de la siguiente forma:
```
titulo: not in libros by titulo;
```
Ahora bien, es frecuente que el campo sobre el cual se realiza la validación no baste por sí solo para hacer la búsqueda por índice, debido a que se desea usar una clave compuesta por varios campos. Una validación in table usando un índice compuesto debe especificar de qué modo completar la clave. Siempre se usará como último componente de la misma el campo de formulario a validar. Para los demás valores de la clave se puede especificar:
- Un valor constante. La forma de definirlo es la misma que para definir [valor], como se mostró anteriormente al explicar los atributos de check.
- Un valor de otro campo del formulario.
- Una variable de ambiente.
- Un campo de la Base de Datos. 

Por ejemplo, la tabla grales tiene un índice formado por dos campos numéricos. El primero es el tipo de registro y el segundo un código. En el formulario se quiere validar que los campos tipo y código existan en la tabla grales, para lo que se indica:
```
tipo:; codigo: in grales(tipo):descrip;
```
Con esta especificación, cuando se valide el valor del campo código se usará el valor del campo tipo del formulario como primer componente de la clave, completándola con el valor de código. Si la verificación se hiciera con un valor constante, podríamos tener por ejemplo:
```
codigo: in grales(1):descrip;
```
Aquí se usará el valor constante 1 (uno) como primer campo de la clave, y el valor del campo a validar en último lugar. Con una variable de ambiente se procede de manera similar, pero debe ir precedida por un símbolo '$'. Por ejemplo:
```
codigo: in grales($VARAMB):descrip;
```


donde 'VARAMB' es el nombre de una variable ambiental, el cual debe escribirse en mayúsculas o minúsculas según haya sido definida dicha variable (no es indistinto aquí el uso de uno u otro tipo). Finalmente, con un campo de la Base de Datos se especifica:
```
codigo: in grales(tabla.campo):descrip;
```
Donde tabla.campo es la referencia al campo campo de un registro, de la tabla tabla, que fue accedido, previamente, por otro campo del formulario mediante un atributo in table. Resumiendo, véase la diferencia entre las distintas notaciones posibles para una misma designación: empresa Alude al campo así llamado dentro de la tabla a la que pertenece el campo que está siendo validado. $empresa Se refiere a la variable de ambiente denominada 'empresa', que contiene habitualmente el nombre o razón social del cliente que utiliza el sistema. emps.empresa El campo 'empres' ya no pertenece a la tabla sobre la cual se está trabajando, sino a otra llamada 'emps'.

### Los Campos Descripción 

Los campos del registro accedido por el atributo in table, pueden ser copiados automáticamente sobre campos del formulario si se cumplen las siguientes condiciones:

- Los campos del formulario están asociados a la tabla accedida.
- Estos campos están a continuación del campo que tiene el atributo 'in tabla'.
- Los campos tienen el atributo skip, o bien display only. En el siguiente ejemplo:

```
autor: libros., in autores:(nombre); 
desc1: autores.nombre,display only;
```
cuando se cargue el valor del campo autor, y este se encuentre en la tabla autores, se copiará el valor del campo nombre del registro encontrado sobre el campo de formulario desc1.

### Atributo is 
Este atributo permite definir campos virtuales, es decir campos cuyo valor resulta de alguna expresión. Puede implementarse de la siguiente forma:

```
campo : is expr;
```
donde expr puede ser:

```
exp_valor { +, -, *, / } exp_valor | (exp_valor) | 
{ campo | constante | $var_ambiente |
función | today | hour } 
función : sum (campo) 
| avg (campo) 
| max (campo) 
| min (campo) 
| count (campo) 
| descr (campo) 
| help (nombre_tecla) 
| num (expr) 
| date (expr) 
| time (expr)
```
La asignación de un atributo is a un campo, lo convierte a su vez en uno el tipo skip para que el operador no pueda modificar su valor.
Es obvio que esto debe ser así puesto que se le está asignando al sistema la responsabilidad de fijar el contenido del campo. Las funciones sum, avg, max, min y count sólo aceptan como parámetros campos pertenecientes a un múltiple. A su vez, sum acepta solamente campos numéricos (en sentido restringido) y avg no acepta campos alfanuméricos, pero sí por ejemplo del tipo "time" podría utilizarse para determinar la hora promedio de llegada o de salida de un grupo de empleados. El tipo del resultado de cada función se detalla a continuación:
- sum, count y num son siempre numéricas.
- descr y help son alfanuméricas.
- date es de tipo fecha.
- time es de tipo hora.
- avg, max y min son del mismo tipo que su argumento.
Las expresiones combinadas deben estar compuestas por términos que tengan el mismo tipo. De lo contrario se obtendrá un mensaje de error indicando que se están mezclando valores de tipos incompatibles. A continuación se explican las distintas funciones, acompañadas de algunos ejemplos de sus aplicaciones. Supongamos un formulario de carga de asientos, semejante al siguiente:

```
Cuenta Descripcion Debe Haber 
[ ____. _______________ _,___,___.__ _,___,___.__ ] 
.... 
Total Debe Total Haber 
_,___,___.__ _,___,___.__ 
Diferencia _,___,___.__
```

La función descr asocia a un campo con las descripciones de un atributo in de otro campo, por ejemplo:
```
Tipo: __. 
Descripción: ____________
..... 
%fields 
tipo: in (1:"Proveedor", 2:"Cliente"); 
desc0: is descr(tipo); 
.....
```
---
--- <-FIN->


En el campo desc0 de la pantalla se copiará automáticamente la descripción asociada con el valor ingresado en el campo tipo. La función help devuelve la tecla de función asociada con un nombre de función. Su argumento debe ser un nombre de tecla válido. El resultado de la función variará según la terminal. Un ejemplo de su aplicación podría ser:

```
..... 
Presione ___ para generar el listado. 
..... 
%fields 
..... 
ayuda : is help (PROCESAR);
```

y en pantalla podrá aparecer lo siguiente:

```
Presione F5 para generar el listado.
```
Las funciones num, date y time convierten, si es posible, la expresión pasada como parámetro al tipo de la función. Por ejemplo:
```
campo : is date ($fecha);
```
donde la variable de ambiente fecha contiene una cadena de carácteres que puede ser convertida a un valor de tipo date. Las teclas que se pueden utilizar son las que se detallan en la tabla ilustrada en el Apéndice A, del Manual del Usuario.

### Atributo on help in table 
Es posible aprovechar las facilidades de selección de un valor mediante una ventana menú para un campo, pero sin obligar a que se realice la validación. Esto permite que el usuario examine los valores obrantes en la tabla y luego decida adoptar uno de ellos, o bien otro que no se halle incluido en la misma. Esto se logra con la cláusula on help precediendo al atributo in help:
```
autor: on help in autores:nombre;
```
Con esta cláusula la validación no se realiza, pero si el usuario pide ayuda sobre el campo se mostrará la ventana menú con los valores existentes. Sigue vigente la propiedad de copia de los campos de descripción.

# Interfaz con la Base de Datos
La asociación de un campo de formulario con el de una tabla de base de datos tiene una serie de implicancias que se verán a continuación. Debe tenerse en cuenta que el proceso de herencia de los atributos se produce en el momento de procesar la definición del formulario con el utilitario fgen. Por lo tanto un cambio de atributos en la base de datos no implicará que se refleje en los formularios hasta que se reprocesen éstos. Esto puede producir efectos indeseados, como cambiar un valor previo válido en uno no válido; en realidad esto debe ser cuidadosamente tenido en cuenta antes de introducir dicha alteración.

## Atributos Heredados
Los campos especificados en un formulario heredan de la base de datos los siguientes atributos:

`flags` La especificación de not null.

`longitud` La longitud que predomina es la especificada en la base de datos. Si la indicada en el formulario es menor que la del Data Base, entonces se señala que existe un error en la es pecificación, a menos que el campo sea display only o skip, en cuyo caso el valor podrá aparecer truncado en el formu lario. En caso que sea mayor, la longitud se ajustará a la de la base de datos (esto es indicado cuando se compila el for mulario con la opción -w del fgen).

`máscara` Si en la base de datos ha sido definida una máscara para un campo, esta también es heredada al formulario.

`default` Los valores definidos por defecto; es decir, cuando no se explicita un contenido y se asume un valor por el sistema.

`check` Los atributos de check (check expresión, between, opera- dores relacionales, in tabla o in con un conjunto de valores) son heredados por el campo de formulario.

## Compatibilidad
Para poder relacionar un campo de formulario con uno de base de datos, es necesario que sus tipos sean compatibles. Seguidamente se muestran las combinaciones válidas:

En caso de que el campo sea numérico y tenga decimales, se valida que la cantidad de decimales especificados en el formulario sea exactamente igual a la de la base de datos.

Las compatibilidades indicadas con [*] son válidas sólo si el campo tiene una máscara completamente numérica. A continuación se explica esta característica con más detalle.

## Máscaras Numéricas
En caso de tener un campo en un formulario con una máscara definida y que ésta sea toda numérica, se puede tratar a dicho campo como un campo numérico, es decir, que se pueden hacer operaciones tales como obtener su valor desde un programa "C" mediante la función de interface de NILIX FmIFld, aunque esté especificado como una cadena de caracteres.

Sin embargo en el ingreso de datos no se obtendrá justificación a derecha como ocurre en los campos numéricos, sino que se manejará mediante la máscara indicada.

Cuando se compila el formulario con el utilitario fgen, se analizan todos los atributos definidos en el campo para encontrar una definición de máscara, antes de indicar que existe incompatibilidad de tipos entre la definición del formulario y de la base de datos, en caso de que se haya indicado al campo como una cadena de caracteres, y en la base de datos como un numérico.

El siguiente ejemplo muestra un formulario completo con un campo alfanumérico con máscara numérica:

```
INGRESO DE AUTORES 
Código del Autor : ____ | 
Nombre del Autor : ______________________________ 
Nacionalidad : __._______________ 
%form 
use biblio; 
window label "Autores", border standard; 
%fields 
codigo : autores., mask "nn-NN" ; 
nombre : autores. ; 
nacion : autores. ; 
descrip : grales., skip;
```

En este caso se define como una cadena de caracteres al campo codigo, aunque en la base de datos este definido como numérico, debido a que se define la máscara toda numérica "nn-NN", que quiere decir que habrá cuatro dígitos, los primeros dos no obligatorios y los últimos dos si, separados por un guión ("-").

## Superposición de Atributos

Cuando en un campo se repite un atributo, queda como efectivo el último de ellos. Por ejemplo si se indica dos veces el valor default, se usará el último. Un campo de formulario puede poseer atributos definidos en la definición FDL, o bien recibirlos por herencia desde la base de datos. Este es un caso de potencial superposición si en el formulario se define un atributo que ya tenía el campo de base de datos. Predominará siempre la definición en el formulario ya que la asociación con la base de datos va siempre como primer atributo. Un ejemplo de tal situación es:


```
Base de datos: 
fecha date descr "Fecha de edición" 
default today, 
Formulario: 
fecha: libros., default "01/01/84";
```

Se tomará como default el valor definido en el formulario (01/01/84). Para averiguar cuándo se producen superposiciones de atributos, utilizar la opción -w del utilitario fgen.

---------------- FIN

## Subformularios
Como se señaló anteriormente, es posible asociar uno o más subformularios a un campo simple (los campos pertenecientes a un múltiple o a un agrupado pueden tener asociados subformularios). El subformulario se diseña de la misma manera que cualquier formulario. Se despliega una vez que el campo al cual está asociado se completa. En ese momento se crea una ventana, se despliega el subformulario y se realiza la captura de datos. Cuando el proceso termina, la ventana con el subformulario desaparece. Los subformularios resuelven básicamente dos problemas:
1. Permitir el ingreso de un conjunto de datos relacionados con un campo determinado, pero que no hace a la esencia del contenido del formulario principal y por lo tanto no es necesario su despliegue permanente. También es el caso en el cual el formulario es demasiado complejo y requiere una gran cantidad de datos, por lo que no cabe en una única ventana, o bien la información queda muy abigarrada. 
2. Permitir ingresar datos con diferente formato, de acuerdo a los distintos valores que puede asumir un determinado campo. Esta asociación se especifica con el atributo subform. El argumento que acompaña a esta palabra clave contiene el nombre de un subformulario. Por ejemplo:
```
codigo: subform "cod1";
```
En este caso, se invocará al subformulario cod1 cada vez que se altere el campo codigo; o aún sin modificarse, cada vez que se digite la tecla <META> sobre el campo codigo.

Los subformularios pueden estar anidados hasta ocho niveles. Esta restricción se debe a que sólo se pueden tener abiertos esta cantidad de formularios o subformularios simultáneamente. En el caso de que un campo tenga asociados más de un subformulario, la especificación será:
```
codigo: subform ("cod1", "cod2", "cod3");
```
Se invocará a los subformularios cod1, cod2 o cod3, de acuerdo al valor que tome el campo código, que debe obligatoriamente tener un atributo in cuya cantidad de valores admitidos coincida con la cantidad de subformularios. Si algunas de las opciones del atributo in no se corresponde con ningún subformulario, se lo debe especificar con null. Por ejemplo:
codigo: subform ("cod1", null, "cod3");
Supongamos que un campo de un formulario tiene asociado un subformulario y el atributo default. Cuando se está en un alta (FM_NEW) y se pasa por dicho campo, aunque no se cambie el valor del mismo, se desplegará el subformulario. Esto es necesario ya que por tratarse de un alta el subformulario no tiene todavía datos cargados. Si se tratara de una modificación (FM_USED) esto no ocurre. Será necesario modificar el valor del campo para que se despliegue el subformulario o bien digitar la tecla sobre el mismo.
## Campos Múltiples
Un conjunto de campos puede agruparse para formar un campo múltiple. Dicho conjunto se repetirá en una cierta cantidad de filas, formando de este modo una matriz. La primera columna de esta matriz se denomina "campo rector". Las dimensiones de los campos múltiples son: tantas columnas como campos diferentes comprenda y tantas filas como se especifique con el atributo rows.
Hay teclas de función que permiten paginar en un campo múltiple, para consultar la información desplegada de una manera confortable, así como eliminar e insertar filas, etc.
Para definir un campo múltiple se encierran entre corchetes los campos de pantalla que se incluirán en la matriz. Para ejemplificar este caso, nos vamos a alejar un poco del esquema de la biblioteca, de forma tal que se pueda ver claramente el sentido de los campos múltiples. Así por ejemplo:
```
nrocuenta escripción débitos créditos 
[______._ ________ ___,___.__ __,___.__] 
%fields 
grancampo: rows 30, display 5; 
nrocuenta:; 
descrip:; 
debitos:; 
creditos:;
```
En este ejemplo se define con grancampo el nombre del multirenglón, especificando que tendrá treinta filas (rows 30), y que se desplegarán de a cinco por pantalla (display 5). La cantidad de filas totales (rows) debe ser múltiplo de la cantidad de filas que se desplieguen (display).

## Atributos de Campos Múltiples
Se verá primero qué significado tienen los atributos que se aceptan en cualquier tipo de campo en el caso de aplicarlo sobre un campo múltiple.

`not null` Cuando se realiza el ingreso de datos, debe ingresarse por lo menos una fila de la matriz si se especificó este atributo sobre el campo múltiple. De ser especificado sobre el campo rector (primero después de la definición del múltiple, en el ejemplo "nrocuenta"), se ignora. Si aparece sobre cualquier otro campo definido dentro de un múltiple, será obligatorio si se cargó el campo "rector" de la fila correspondiente.

`display only` Todos los campos comprendidos en el múltiple son de despliegue exclusivamente. skip when condición En caso de cumplirse la condición, realiza un skip de todos los campos del múltiple. Los campos que forman el múltiple podrán tener atributos de campos simples, con la excepción del campo rector que no podrá tener asociado el atributo default.

## Atributo Unique
Sobre un campo que forma parte de un múltiple se puede indicar el atributo "unique" con dicha palabra clave. Mediante este atributo se indica que se verifique que el valor ingresado no esté repetido en alguna fila anterior o posterior.
## Atributos Específicos de Campos Múltiples
Los atributos que se indican a continuación se pueden especificar solamente en la definición del campo múltiple, es decir, en el campo virtual que lo nombra.

`display <número>` Es la cantidad de filas, sobre el total de la matriz, que se mostrarán simultáneamente en la pantalla.

`rows <número>` Es obligatoria su presencia ya que define la cantidad de filas totales que tiene la matriz. Debe ser un múltiplo de la cantidad indicada en display.

`ignore [delete] [add] [insert]` La operación indicada no es permitida al usuario sobre la matriz.
- delete se refiere a la posibilidad de borrar una fila completa.
- add se refiere a la posibilidad de agregar nuevas filas a continuación de la última.
- insert es la posibilidad de insertar una fila en una posición cualquiera dentro de la matriz.

## Campos Agrupados

Existen casos en los cuales las validaciones sobre datos en los campos de pantalla se realizan teniendo en cuenta valores de otros campos. Un caso típico es el ingreso de dos fechas, donde la segunda debe ser mayor o igual que la primera. Sobre este campo (el de la segunda fecha) no hay forma de especificar una validación, dejándola entonces a cargo de un programa "CFIX". Este verificará que cada vez que se ingrese una fecha en el segundo campo sea mayor o igual que la primera. Sin embargo, dadas las posibilidades de movimiento del cursor a través de los campos en pantalla, el programa debería tener en cuenta (y eventualmente restringir) determinados movimientos, para poder efectuar fácilmente la verificación. Los campos agrupados simplifican la lógica de este problema. Al igual que los múltiples, los campos agrupados son un conjunto de campos sucesivos de pantalla que generan un campo virtual. Se definen en la pantalla encerrando sus componentes entre llaves:

```
Fecha Desde Fecha Hasta 
=========== =========== 
{ __/__/__ __/__/__ }
```

Al igual que en los campos múltiples, esta definición da origen a un campo virtual que debe ser declarado. Los campos agrupados pueden anidarse y pueden estar dentro de un campo múltiple. En la sección que explica la interfaz con el lenguaje "C" se da un ejemplo del uso de campos agrupados.

## Atributos para Campos Agrupados
Además de los atributos especificados en "Atributos para todo tipo de campo" se pueden colocar expresiones de checks sobre los campos agrupados. Ejemplo:
```
agrup: check a > b;
a:; 
b:;
```

## Atributos para Campos dentro de un Agrupado
En un campo incluido dentro de un agrupado se puede indicar el atributo:

```
check after nombre_campo
```
donde nombre_campo designa a un campo agrupado que contiene a aquél al cual se le está indicando esta validación. Esto tiene como efecto posponer la aplicación de los atributos de check de dicho campo hasta que se salga del campo agrupado "nombre_campo". Supongamos, a título de ejemplo, tener los siguientes campos:
```
agrup; 
tipo :; 
codigo : in grales(tipo);
```
Con estas definiciones, si hemos ingresado el valor 1 en el campo tipo, y se está posicionado luego en el campo codigo, y no existiese ningún registro con valor 1 en tipo, la validación in no se verificará nunca, y no se podrá salir del campo.
En cambio agregando:
codigo : in grales(tipo), check after agrup;
la validación se aplicará cuando se salga del agrupado, es decir que se puede retroceder con el cursor para cambiar el valor del campo tipo sin que se valide el valor en codigo. El check recién se aplicará cuando se salga del agrupado, es decir cuando se oprima `<INGRESAR>` o `<CURS_ABA>` en el campo codigo, o saliendo por cualquier otra dirección. Esto también soluciona el problema que se presentaría si el campo agrupado estuviera dentro de un campo múltiple. Si se modifican los valores de uno de los campos incluidos en el campo agrupado, pero en lugar de recorrer toda la fila del campo múltiple, se desplaza el cursor por las columnas, la validación se realizará de la misma forma, ya que se efectúa al salir del campo agrupado.
## Campos Agrupados dentro de un Campo Múltiple
Es posible definir campos agrupados dentro de un campo múltiple. Esto permite hacer validaciones cruzadas en cada fila del multirrenglón y extender la unicidad de las filas a más de un campo. Por ejemplo, si consideramos el siguiente formulario de carga de comprobantes:
```
..... 
Tipo Comp. Nro. Comp. Fecha Importe 
[ __. _,___,___. __/__/__ _,___,___.__] 
..... 
%fields 
..... 
multip : rows 100, display 5; /* Campo virtual múltiple */ 
tipcmp : comps.; 
nrocmp : comps.; 
feccmp : comps.; 
impcmp : comps.;
```
En este caso sería conveniente validar que no se repitan los comprobantes en las columnas. Con nuestros conocimientos hasta este momento, esta tarea no la podríamos realizar automáticamente. Podríamos utilizar el atributo unique pero sólo en una de las columnas lo que no produciría el efecto deseado. Recurriendo a los campos agrupados deberíamos hacer lo siguiente:
```
..... 
Tipo Comp. Nro. Comp. Fecha Importe 
[{ __. _,___,___.} __/__/__ _,___,___.__] 
..... 
%fields 
..... 
multip : rows 100, display 5; /* Campo virtual múltiple */ 
agrup : unique;               /* Campo virtual agrupado */ 
tipcmp : comps.; 
nrocmp : comps.; 
feccmp : comps.; 
impcmp : comps.;
```

Esto nos asegura que no se repitan los comprobantes en las líneas del multirrenglón. Se declara como unique al agrupamiento de los campos tipcmp y nrocmp que es muy distinto a declarar independientemente unique a cada uno de los campos.

## Formularios con Zona de Clave
Cuando se vieron las operaciones que se realizaban con los formularios, se estableció que una de ellas era la de traer un formulario existente.

Debe existir algún modo de individualizar los datos que se buscan. 

Para ello es posible definir en la imagen de un formulario una primera parte (compuesta por un número cualquiera de campos), llamada "Error! Bookmark not defined.zona de claves".

Cuando un formulario tiene zona de claves, se lo puede imaginar dividido en dos secciones. La primera se comporta como un formulario clave de entrada, de modo que una vez completado el último campo se realizará la operación denominada LEER.

En el formulario electrónico se busca que el usuario complete inicialmente el formulario clave. Luego se utiliza la información ingresada para buscar el formulario completo en la base de datos. De no encontrarse, la sección de datos aparece en blanco para ser completada y archivada.

Hay otras dos operaciones muy similares a LEER, llamadas LEER_SIGUIENTE y LEER_PREVIO. Especifican respectivamente el formulario con la clave siguiente, o la anterior, al que se tiene en pantalla.

Operación | Tecla de Función 
|---|---| 
Zona de Datos| `<AGREGAR>`<br> `<ACTUALIZAR>` <br> `<REMOVER>` <br> `<IGNORAR>` <br> |
`<PROCESAR>` <br> `<PROCESAR>` <br> `<REMOVER>` <br> `<IGNORAR>` <br>| ZONA DE CLAVES O CAMPO CONTROL|
LEER SIG <br> LEER PREV | `<PAG SIG>` <br> `<PAG PREV>` |
Zona de claves |  LEER |
Completar zona de claves | Cualquier posición |
FIN | `<FIN>`

Figura 3.7 - Validez de las Operaciones de Formularios

La tabla está dividida según las zonas del formulario, indicando el significado de cada tecla de función activada sobre dicha zona. En el caso de la zona de claves, el solo hecho de completar sus campos provoca la operación LEER.
Una vez dentro de la zona de datos, no es posible retornar a la zona de claves hasta tanto no se realice una operación.
Luego de ordenar las operaciones ACTUALIZAR, AGREGAR, REMOVER o IGNORAR, el formulario de datos se blanqueará, y el cursor pasará al primer campo clave.
El formulario de la figura 3.8., se utiliza con el esquema biblio (el mismo que se utiliza como ejemplo en el capítulo de Bases de Datos), donde la tabla autores se indexa por la columna codigo. En otras palabras, es fácil encontrar un formulario por el valor del campo codigo. Entonces se modificará el formulario, agregando la zona delimitadora de clave, indicando tal efecto mediante una barra vertical de Unix), como se muestra a continuación:
```
FORMULARIO DE LIBROS 
-------------------
Código de Libro   : _,___. | 
Título del Libro  :______________________________ 
Autor             : ____.______________________________ 
Número de Edición : __. 
Fecha de Edición  : __/__/__ 
%form 
use biblio; 
window label "Libros", border standard; 
%fields 
codigo : libros.; 
titulo : libros.; 
autor : libros., in au<hy> tores : nombre; 
nombre : autores., skip; 
edicion: libros.; 
fecha : libros.,<= today;
```
Figura 3.8 - Figura 3.9. - Formulario de Libros

En el campo autor se ha agregado la cláusula "in", indicando en este caso que el código del autor que se ingrese se validará contra lo grabado en la tabla autores, no permitiendo otro valor distinto a los que figuren en esa tabla.

En el diseño del formulario aparece el campo nombre. Es un campo de despliegue (lo especifica la sentencia skip). Además, está relacionado con el campo nombre de la tabla autores, por lo que se desplegará el valor del campo sobre el formulario, cuando se ingrese el código del autor. El campo fecha tiene un atributo que indica que se lo debe completar con una fecha menor o igual que la del sistema.

## Utilitarios
Existen diversas maneras de utilizar un formulario, una vez procesado con fgen. En líneas generales, se puede decir que hay dos formas:
- Mediante un utilitario de NILIX.
- Escribiendo un programa en "C", usando rutinas para manejo de formularios (FM), provistas por la biblioteca de NILIX. En esta sección se describirán los utilitarios de NILIX que se relacionan con los formularios. En la sección siguiente se describirá en líneas generales la interfaz de programación con el lenguaje "C".

## TESTFORM
Este utilitario permite la prueba de un diseño de formulario, es decir, se obtiene un prototipo del comportamiento de la pantalla, de acuerdo a lo especificado en la definición. No interactúa con la base de datos en el momento de la lectura o la grabación, es decir que no permite consultar datos existentes, ni como es lógico, actualizar las bases de datos asociadas al formulario. Sin embargo, se aplican todas las validaciones indicadas en la definición del formulario, aún aquellas que impliquen consultar una tabla de la base de datos (el atributo in tabla). La forma de utilizarlo a través de la línea de comandos (o shell) es:

```
$ testform nombre_formulario
```

## GENFM
El utilitario genfm toma una tabla de un esquema existente, y genera una especificación de formularios en FDL (Form Definition Language) para realizar operaciones sobre dicha tabla. La forma de utilizarlo es:

```
genfm esquema.tabla
```

Se obtendrá como resultado un archivo llamado "tabla.fm" con una definición de un formulario para operar sobre dicha tabla. El nombre del archivo resultante se puede cambiar mediante la opción "-o nombre" para indicar en qué archivo se dejará la salida.
La zona de claves del formulario se construirá en base a la clave primaria de la tabla. Es posible indicar cualquier otro índice de la misma mediante la opción "-i indice". Por ejemplo:
```
genfm -i indice esquema.tabla
```

## DOFORM

doform permite utilizar un formulario para consultar y modificar información de la base de datos. Para poder trabajar correctamente, el formulario que se utilizará debe cumplir ciertas condiciones: 1. Debe poseer una zona de claves. Esta zona de claves debe contener campos que coincidan con algún índice unívoco de la tabla, o bien caiga dentro de alguno de los casos de multirrenglón que se detalla más adelante. 2. Si tiene campos múltiples deben cumplir con alguno de los casos que se especifican más adelante. 3. Todos los campos de la zona de datos del formulario deben estar asociados con campos de base de datos, de la tabla que se usó en la zona de claves, o de tablas que estén relacionadas mediante atributos "in table". Si así no se hiciere, la información cargada sobre los campos no asociados se perderá. Cuando hay campos no asociados con la base de datos, el utilitario pone un mensaje de advertencia. 4. El formulario sólo debe involucrar campos de a lo sumo dos tablas. Así mismo, cualquier número de tablas puede ser usado para procedimientos de validación. La manera de utilizar doform es la siguiente:

```
$ doform nombre_formulario
```

Doform maneja la estrategia de bloqueo de registros de la siguiente manera: Al leer el registro lo bloquea hasta que se indique una operación, cumplida la cual el registro será liberado. Existe una opción en la línea de comandos: -l. Si está presente, se bloqueará toda la tabla al iniciar el proceso y se la liberará recién al terminar el mismo. Si no puede bloquearse debido a que otro proceso tiene algún registro ya bloqueado, doform abortará con un mensaje de error.

### Modo de lectura de los registros 

Si el formulario permite modificar o borrar registros existentes doform realizará la lectura en modo TEST y LOCK (ver GetRecord (DB), Referencia del Programador). Un formulario de consulta es aquel que ignora las operaciones delete (borrado) y update (modificación), en estos formularios doform hará la lectura sin bloquear.

Formularios con campos Multirrenglón
El utilitario doform permite manejar formularios que tengan campos multirrenglón, siempre y cuando caigan dentro de alguno de los siguientes casos:
1. Cuando los campos (columnas) del multirrenglón están relacionados con un vector de la base de datos. En este caso todas las columnas (excepto aquellas que sean SKIP o DISPLAY ONLY) deben ser vectores y de igual dimensión.
```
...... 
Vec1 Desc(campo skip) 
Vec2 [ ___. ____________________ _____ ]
```

2. Cuando la clave de la pantalla no coincide completamente con un índice de la tabla y los primeros campos del multirrenglón completan la clave. Este es el caso de la Edición de Form de n registros por vez.
```
ABM DE ASIENTOS 
fecha : __/__/__ 
tipo  : __. 
nro   : _,___.| 
nreng descrip Cuenta Importe 
[ ___. ____________________ __. _,___,___.__ ]
```

y el archivo tiene una clave de la forma:
```
... (fecha, tipo, nro, nreng);
```

3. Edición usando dos tablas con una relación de 1 a n, es decir que para un registro de la tabla principal hay n de la tabla asociada. En este caso se debe usar la opción -j para indicar qué campos son comunes a ambas tablas.
```
nrosub : ___. | 
nombre : ______________________________ 
Tipos de Comprobante tcom descrip 
[ __. ____________________]
```
donde las tablas son:

```
table SUBCTA { 
    nrosub num(3), 
    nombre char(30) 
}; 

table TCOMP { 
    nro2 num(3) in SUBCTA:nombre, 
    tcom num(2), 
    descrip char(20) 
} primary key(nro2, tcom);
```

En este caso la llamada al doform debe ser de la forma:

```
doform -jnro2=nrosub pantalla
```
Los campos que utilizará el utilitario doform para acceder a la segunda tabla, deben formar la clave primaria de la misma. Casos no contemplados: 1.No se permiten llamadas a subform dentro de campos múltiples. 2.En un subform los múltiples deben corresponderse con vectores. 3.No soporta la actualización por Edición de Formularios de más de 2 tablas.

## GENCF
Este utilitario permite generar automáticamente un programa en CFIX a partir de un formulario compilado, es decir que utilizará el archivo con extensión "fmo", obtenido con el utilitario fgen. Desde la línea de comandos se invoca mediante:
```
gencf formulario
```
Como resultado del utilitario se obtendrá un programa llamado formulario.c. Es posible dar un nombre distinto al programa objeto resultante mediante la opción "-o nombre". Se pueden generar dos tipos de programas dependiendo del tipo de formulario que se vaya a utilizar:
- Se genera cuando el formulario no tiene zona de claves.
- Se produce cuando el formulario tiene una zona de claves. 

Listadores: Estos programas consisten solamente en la toma de datos del fomulario, y la captura de un comando (tecla de función) dada por el usuario. Si ésta es distinta de `<PROCESO>` simplemente terminará. En caso contrario se ejecutará el código que se agregue en el lugar del programa generado indicado como proceso central. ABM: Cuando el formulario posee zona de claves se intenta generar un programa de altas bajas y modificaciones. Es factible generarlos para formularios que trabajan con una o dos tablas, contemplando multirenglones y subformularios. En el programa generado se incluirán rutinas de chequeo pre-campo y post-campo sólo si se pide explícitamente a través de las opciones:
- Incluye rutina after field.
- Incluye rutina before field. 

Por ejemplo:
```
gencf -b formulario
```

Formularios con Multirenglones
El utilitario gencf contempla los mismos casos de multirrenglón que el doform.

## EXECFORM
Este comando permite utilizar un formulario para pedir al usuario en una forma amigable parámetros que se utilizarán para invocar otro proceso. Los valores que se ingresen en los campos, serán pasados como parámetros al invocar el proceso. Por ejemplo:

```bash
$ execform prog # donde prog es un formulario
```
definido de la siguiente manera:

```
Parametro 1 : ______. 
Parametro 2 : _____________
```

Cuando se digite la tecla de función será invocado un programa llamado prog.sh con los valores cargados en los campos del formulario como parámetros. Por ejemplo si el usuario ingresó 1000 en el primer campo, y dejó en blanco el segundo se ejecutará:

```bash
prog.sh "1000" ""
```
Como se mostró, execform asume que el programa a ejecutar tiene el mismo nombre que el formulario, pero con extensión ".sh". Es posible indicar cualquier otro nombre de programa, poniéndolo a continuación del nombre del formulario. Por ejemplo:

```bash
$ execform prog prog1.exe
```

Existe otro parámetro importante para este utilitario que es el modo en que se ejecutará el programa. Si no se especifica otra cosa, se asume que es un programa a ejecutar a través del shell, pero existen otros modos que se indican como opciones en la línea de comandos, que son los siguientes:
- -r vuelve al formulario después de ejecutar el programa.
- -w El programa se ejecutará como un proceso usuario del Window Manager. Es el valor tomado en caso de omisión.
- -p [FILAS] [xCOLS] El programa será ejecutado a través del shell, pero capturando su salida en una ventana. Las dimensiones de la misma pueden definirse optativamente a continuación de la letra p, donde FILAS y COLS indican la cantidad de filas y columnas de dicha ventana. Por defecto se asumirá el espacio disponible en pantalla en cada caso.
- -d Este modo se denomina debugging ya que no se invoca al programa, sino que se muestran los argumentos que se le pasarían al mismo en la parte inferior de la pantalla cuando el usuario digita la tecla .
- -s Se ejecuta el programa como si fuese uno del sistema operativo.

# Interfaz C
Compilando Programas
NILIX provee la facilidad de escribir programas en lenguaje "C" que utilicen todas las posibilidades de manejo de formularios vistas anteriormente. Para este fin se dispone de una poderosa biblioteca de funciones para usar en los programas. Los programas en C pueden ser generados en forma automática mediante el utilitario gencf a partir de una definición de formulario. La manera de compilar un programa escrito en "C" con NILIX es:
```
$ cfix form1.c
```
Este comando imprimirá en la pantalla el siguiente mensaje: 
```
$ cc -Iinclude form1.c -o form1 -lidea
```
donde include es el directorio donde se encuentran los archivos de encabezamiento de NILIX. Este directorio es localizado por medio de la variable de ambiente NILIX. Con esta instrucción se compilará un programa llamado form1.c y se lo dejará como archivo ejecutable con el nombre form1. Si se trabaja con sistemas que tienen gran cantidaad de funciones, es imprescindible utilizar algún programa que pueda, ante la definición de dependencias entre programas objetos y fuentes, realizar automáticamente las tareas de compilación y linkedición. make, de UNIX, es una herramienta que cumple con ese cometido, y por lo tanto se recomienda su uso. La manera de referenciarse a los diversos campos de formulario en un programa en "C" es a través del uso de constantes simbólicas o constantes manifiestas. Para poder generar estas constantes (que se expresan mediante sentencias #define del preprocesador de "C") se debe incluir en la sección %form de la definición del formulario, la siguiente sentencia:
```
language C;
```
Otra forma de obtener estas constantes, es desde la línea de comandos, ejecutando: 
```
$ fgen -h form1.fm
```
En este caso, la opción -h indica que además de generar el "formulario compilado", se genere un archivo de encabezados con todas las definiciones comentadas anteriormente. El archivo se genera con extensión .fmh; por lo tanto en el ejemplo anterior se creará el archivo form1.fmh. El mismo debe incluirse en el programa fuente como:

```
#include <NILIX.h> 
#include "form1.fmh"
```

## La Función DoForm
La función DoForm es el núcleo de toda aplicación que se implemente en lenguaje "C" utilizando formularios. Permite el ingreso de datos sobre los campos definidos en un formulario realizando validaciones, las cuales pueden estar especificadas:
De acuerdo al tipo de campo. Por ejemplo, en un campo de tipo fecha, sólo se permitirá ingresar datos que representen fechas válidas, es decir que no se aceptará el 29 de febrero de un año no bisiesto.
De acuerdo a lo indicado en el formulario. Por ejemplo, si un campo se definió como not null, no se podrá pasar ese campo si no se le ingresa un dato.
Mediante programación, a través de funciones pre y post campo.
DoForm se mueve a través de todos los campos de un formulario hasta que el usuario digite una tecla de función determinada, en cuyo caso retorna un valor que representa el estado del formulario. Las operaciones y los valores retornados son:

Operación |Valor Retornado 
|--|--|
ADD | FM_ADD |
UPDATE | FM_UPDATE
REMOVE | FM_DELETE
IGNORE | FM_IGNORE
END | FM_EXIT

Figura 3.9 - La función DoForm

Cuando el formulario tiene "zona de claves" se agregan otros estados adicionales. Estos estados son: 
- FM_READ: Se devuelve cuando se ha ingresado el último campo de la zona de claves o campo control. 
- FM_READ_NEXT: En caso que se haya digitado la tecla página siguiente en la zona de claves o campo control. 
- FM_READ_PREV: En caso que se haya digitado la tecla página previa en la zona de claves o campo control.

## Condiciones Pre-Campo y Post-Campo
Anteriormente se mencionó que se realizan validaciones mediante funciones pre y post campo (se las denominará before y after field respectivamente). DoForm llama a estas funciones antes (before) y después (after) de realizar la entrada de datos.

Desde un punto de vista técnico, la manera de indicar a qué función se debe invocar es pasando como argumentos de la misma un puntero a la función que se quiera ejecutar, o NULLFP (NULL File Pointer) cuando no se desea realizar dicha validación. 

El utilitario gencf incluye rutinas after y before field si se le indican las opciones -a y -b respectivamente. El proceso completo de ingreso y validación de campos es entonces el siguiente:


```
                ( de campo anterior )
                          │
                          ▼
                  ┌───────────────┐
                  │  beforefield  │───────────────┐
                  └───────┬───────┘               │
                          │                       │
                          ▼               FM_SKIP │
                  ┌───────────────┐               │
        ┌────────▶│ Entrada Datos │◀───────┐      │
        │         └───────┬───────┘        │      │
        │                 │ Teclas de      │      │
        │                 ▼ Función        │      │
        │         ┌───────────────┐        │      │
        │         │    fmOnKey    │        │      │
        │         └────┬─────┬────┘        │      │
        │    DEL/HELP  │     │ Otra Tecla  │      │
        │    ┌─────────┘     └────────┐    │      │
        │    ▼                        ▼    │      │
        │ ┌──────────┐        ┌──────────────┐    │
        │ │ Teclas   │        │ Validaciones │────┘ on error /
        │ │ DEL/HELP │        └───────┬──────┘      DEL / F1
        │ └────┬─────┘                │
        │      │                      │ FM_OK
        │      └──────────────────────┤
        │       FM_ERROR / FM_REDO    │
        │                             ▼
        │                     ┌──────────────┐
        │                     │  afterfield  │
        │                     └───────┬──────┘
        │         FM_ERROR            │
        │         FM_REDO             ▼
        └──────────────────────┬──────────────┐
                               │ Validaciones │
                               │  si cambio   │
                               └───────┬──────┘
                                       │
                                       ▼ FM_OK
                              ( siguiente campo )
                              
```

Figura 3.10 - Validaciones Pre- y Post- campo.

Un ejemplo muy simple de uso de before field sería el que se muestra a continuación. Lo que se desea hacer es saltear el campo DESCRIP pues es un campo de despliegue solamente. En rigor no es necesario realizar esta operación en un programa CFIX pues se podría indicar directamente como atributo del campo de formulario: se muestra tan sólo a modo de ejemplo.


```
private fm_status before(form fm, fmfield campo, it fila) 
{ } 
...
{
    switch (campo) { 
    ... 
    case DESCRIP:
        return FM_SKIP; 
        break; 
    } 
    return FM_OK; 
}
```

En este caso el before del campo DESCRIP, indica que se debe ejecutar un "skip".
Se debe tener en cuenta que las teclas de función: <REMOVER>, <IGNORAR> y <FIN> no pasan por el after; es decir, que las validaciones que sean necesarias realizar para estas teclas de función deberán ser hechas en el cuerpo principal del programa, pudiendo eventualmente informar situaciones de error con la rutina FmSetError.

### has [after|before] when expr
Estas cláusulas (las que deberán ser especificadas en la sección %field del formulario) definirán si un campo dado tiene o no tiene la condición after o before dependiendo del valor de verdad de la expresión expr. Por ejemplo:

```
a: has after when a != null;
```

ejecutará el after del campo a cuando a sea diferente de NULL.


## Condiciones Pre- y Post- Campo en campos múltiples y agrupados
Los campos múltiples y los agrupados también pueden utilizar las funciones before y after field. Si el "nombre de campo" referenciado es un campo agrupado (obtenido del .fmh correspondiente), se realizará una validación antes de entrar o de después de salir de él, según corresponda. Esto es de suma utilidad en los casos en los cuales se necesita una validación cruzada entre varios campos (habitualmente dos, como sería el caso de valores "desde" y "hasta", incluyendo campos tipo fecha, en los que debe verificarse que una de ellas sea anterior o posterior a otra.

A continuación se presenta un ejemplo de formulario para la carga de un rango de códigos de autor, con el objeto de listar los libros asociados a ellos.

```
LISTADO DE LIBROS POR CODIGO DE AUTOR
Autor Desde : { ____. ______________________________ 
Autor Hasta :   ____. ______________________________ } 
%form 
use biblio; 
window label "Listado de "Libros", border standard; 
messages MAYOR:"El código desde debe ser menor que el hasta"; 
%fields 
AGRUP: desde : libros.autor; 
desc0 : autores.nombre, skip; 
hasta : libros.autor; 
desc1 : autores.nombre, skip;
``` 
Figura 3.11 - Figura 3.12 - Formulario de listado de libros

El código CFIX para verificar que desde sea menor que hasta es:

```
private fm_status after(form fm, fmfield nro_campo)
{ 
    switch (nro_campo) { 
        case AGRUP: 
        if (FmIFld(fm, DESDE) > FmIFld(fm, HASTA)) 
            return FmErrMsg(fm, M_MAYOR); break; 
        } 
    return FM_OK; 
}
```

En este caso, AGRUP es el nombre simbólico del campo agrupado definido en el formulario, que permite verificar que el campo HASTA sea mayor que el DESDE. Los valores ingresados en estos campos se obtienen mediante la función FmIFld de la biblioteca. Si no se cumple la condición, se mostrará en pantalla el mensaje MAYOR mediante la función de biblioteca FmErrMsg, definido en la opción messages de la zona %form.
Los campos múltiples también pueden ser objeto de validaciones, de manera similar a la explicada para los agrupados.

## Suformularios Manuales
Ya se ha indicado la posibilidad de asociar, a un campo de un formulario, subformularios automáticos o manuales. La sección Subformularios de este capítulo explica el caso de los primeros. Para asociar subformularios manuales se debe indicar el atributo manual subform según la sintaxis:
```
campo: manual subform ("formulario");
```
La diferencia entre un subformulario automático y uno manual es que éste último debe ser desplegado por el programa en el momento apropiado. Los subformularios se activan mediante una función de la biblioteca de interfaz (ver DoSubform(FM), en Referencia del Programador). El programa CFIX debe incluir los archivos de encabezado que correspondan.
## La Biblioteca de Formularios
Para una descripción completa de la biblioteca de formularios, consultar la parte II de este manual, capítulo Interfaz con Formularios (FM).

## Capacidades Máximas
| | |
|--|--|
| Número de Formularios abiertos simultáneamente | 8 |
Número de Esquemas abiertos simultáneamente | 4
Campos en un Formulario |9999
Caracteres en un campo alfanumérico | 65535
Dígitos en un campo numérico | 15
Dígitos significativos en un campo numérico | 15
Rango de valores en un campo fecha | 16/04/1894 to 16/09/2073
Rango de valores en un campo hora | 00:00:00 to 23:59:58
Dimensión de un vector |65535
Valores en un campo in |65535
Nombres de Campo | unlimited
Cantidad de Mensajes | 64 
Cantidad de caracteres de un identificador | 16 
Campos clave en un "in table" | 32


a El último horario para un día es 23:59:58, esto se debe a que NILIX tiene una precisión de 2 segundos para los datos del tipo Time.

---
Capítulo 17
Reportes
En este capítulo se describen las capacidades de los reportes de IDEA-FIX, el lenguaje utilizado para su definición (RDL) y los utilitarios que permiten manejarlos.
Introducción
Los informes impresos (listados) son denominados en NILIX "reportes", terminología tomada de la palabra inglesa reports. NILIX permite diseñar reportes en forma muy simple, a fin de poder indicar aspectos tales como:
- Características de los campos;
- Relación con Bases de Datos;
- Funciones como sumatorias y promedios;
- Cortes de control, y otros. Los reportes pueden diseñarse con cualquier editor, pero es altamente recomendable el uso de uno de los provistos por NILIX, ya que poseen ciertas características que facilitan mucho esta tarea; siendo algunas de ellas imprescindibles, como por ejemplo la posibilidad de escribir en español (vocales acentuadas, eñes, etc.) y carácteres gráficos. Para definir un reporte se utiliza el RDL, o Report Definition Language (Lenguaje de Definición de Reportes). El RDL permite dibujar la imagen del listado tal como se desea su impresión, en un modo llamado WYSIWYG (What You See Is What You Get: lo que ves es lo que obtienes), es decir que al ejecutar el programa, el listado se genera con el formato que se le ha diseñado. Cuando el archivo de definición del reporte está completo, se lo compila con rgen, el utilitario de NILIX para generación de reportes.

Capítulo 17 - Reportes
Generando Reportes
La especificación del reporte está contenida en un archivo con extensión ".rp", conocido como archivo fuente RDL. Este se procesa con el utilitario rgen de NILIX, para generar un archivo con extensión ".rpo".
Figura 4.1 - Generación de Reportes
La figura anterior muestra este proceso de generación, incluyendo en forma optativa crear otro con extensión ".rph", este archivo contiene el reporte compilado. Este archivo es utilizado tanto por el utilitario doreport como por un programa de aplicación escrito en "C", en el momento de su ejecución. El archivo de cabecera ".rph" debe incluirse en los programas de aplicación en "C" que utilicen el reporte. Contiene valores de constantes simbólicas que representan los distintos campos, y otras constantes auxiliares necesarias para la compilación.
El Lenguaje RDL
Un archivo de especificación RDL se divide en tres secciones.
- La primera contiene la imagen del listado. En esta sección se dibuja el reporte, como se desea que éste aparezca en la salida. La imagen se compone de campos del listado que se llenan con la información provista por el usuario, y cadenas de carácteres constantes. Esta sección comienza al principio del archivo, y en ella se describen las distintas zonas que componen el listado.
- La segunda sección se inicia con la palabra clave %report. Se compone de sentencias que terminan en punto y coma, dando información acerca de los requerimientos generales del listado, tales como longitud del papel, esquemas de base de datos a utilizar, márgenes, destino del reporte, etc.
- La tercera sección comienza con la palabra clave %fields y define los nombres de los campos del listado y sus atributos.
422
- 

Capítulo 17 - Reportes
Imagen del Reporte
La imagen del reporte se divide en zonas del reporte que son líneas de detalle. Una zona del listado tiene un nombre, y está formada por uno o más campos, o inclusive por ninguno. En el diseño es posible imponer condiciones para definir cuándo debe imprimirse una zona. La definición de una zona se inicia con un "%" seguida por su nombre, los nombres de los campos de la zona, y opcionalmente por la condición para imprimirla. La figura muestra el esqueleto de una especificación de reporte.
Figura 4.2 - Estructura de un Reporte
La salida del reporte se compone de páginas, cada una de las cuales se divide en zonas, tal como se las dibuja en el archivo de definición (.rp). Sobre el dibujo de la zona se especifican los campos que serán reemplazados por información. La zona tiene un nombre, y se indican uno o más parámetros que son los valores a reemplazar en los campos de la zona. Opcionalmente se puede especificar una condición que controla cuándo se imprimirá la zona. La sintaxis completa para definir una zona es:
%zoneX(expr [: expid], ...) ... donde: nombre es el nombre de la zona. expr es una expresión completa que puede contener llamados a función y campos combinados en expresiones aritméticas.
Definiendo Expresiones
Las expresiones definen los valores que se imprimirán en los campos correspondientes de la

- 423

Capítulo 17 - Reportes
zona. También, una expresión puede ser identificada con un nombre, para ser referenciada directamente por su nombre luego en el reporte. Por ejemplo:
%zoneA (n1, n2, (n1+n2)*200 : b) %zoneB ((runsum(b)+n1+n2)/800)
El id de la expresión (b, en este caso), también puede ser usado para tener dos entradas distintas en la sección %fields, por ejemplo:
%zoneA(a : c1, a : c2) ________ _________ %fields c1: atributos para c1; c2: atributos para c2;
Los valores que conforman una expresión puede ser un campo de un reporte, un función, una variable, una constante, o cualquier combinación de ellos. A continuación se presenta una explicación detallada de cada valor: Funciones: sum(param): Se imprimirá la suma de los valores que haya tomado param. avg(param): Se imprimirá el promedio de los valores que haya tomado param. count(param): Se imprimirá la cantidad de los valores que haya tomado param. min(param): Se imprimirá el mínimo de los valores que haya tomado param. max(param): Se imprimirá el máximo de los valores que haya tomado param. runsum(param): Se imprimirá la suma de los valores que haya tomado el parámetro indicado, a lo largo de todo el reporte. runavg(param): Se imprimirá el promedio de los valores que haya tomado el parámetro indicado, a lo largo de todo el reporte. runcount(param): Se imprimirá la cantidad de valores que haya tomado el parámetro indicado, a lo largo de todo el reporte. runmin(param): Se imprimirá el mínimo de los valores que haya tomado el parámetro indicado, a lo largo de todo el reporte. runmax(param): Se imprimirá el máximo de los valores que haya tomado el parámetro indicado, a lo largo de todo el reporte. Las funciones runsum, runavg, runcount, runmin y runmax , se aplican cuando se desea evaluar los valores que obtuvo un determinado parámetro hasta el momento en que se la invoca.
424
- 

Capítulo 17 - Reportes
Variables:
- today~: Contiene la fecha corriente.
- hour: Contiene la hora corriente.
- pageno: Contiene el número de página.
- lineno: Contiene el número de línea.
- module: Contiene el nombre del módulo.
Constantes:
- Puede ser cualquier constante numérica: 1, 2, . . ., 50, . . .738, . . .
Para una mayor comprensión, tomaremos un nuevo ejemplo, que intenta abarcar la mayor cantidad de variantes posibles. Para ello utilizaremos las siguientes tablas de un esquema llamado personal:
table emp descr "Legajos del personal" { empno num(4) not null primary key, nombre char(30)not null, cargo num(1) in cargos:descrip, jefe num(4) in emp:nombre, fingr date <=today, sueldo num(12,2), depto num(2) in depto:nombre }; table depto descr "Departamentos" { depno num(2) not null primary key, nombre char(20) not null }; table cargos descr "Cargos de la Empresa" { cargo num(2) not null primary key, descrip char(20) not null };
Como ejemplo de utilización de funciones, remitimos al lector a la figura siguiente, en la cual se define un reporte utilizando las tablas del esquema que acabamos de definir. Pero antes, a los fines de un mejor aprovechamiento del espacio, dejamos ilustrada una consulta por iql, consistente en el "query":
use personal; select ~depto, nombre, sueldo, fingr from ~emp, depto where emp.depto = depto.depno output to report ~personal;
Aquí se han representado en bastardilla los nombres y operandos variables que debe ingresar el programador.

- 425

Capítulo 17 - Reportes
%tit(pageno, today) before page Página : __. Fecha: __/__/__ Listado de Empleados ==================== Depto. Empleado Sueldo Fecha Ingreso ======================================================== %linea(depto, nombre, sueldo, fingr) __. __________________________ ___________. __/__/__ %suma(sum(sueldo)) after depto Cálculos por departamento: ------------------------Suma de sueldos por departamento : ___________. %prom(avg(sueldo)) after depto Promedio de sueldo por departamento : ___________. %mini( min(sueldo) ) after depto Mnimo sueldo del departamento : ___________. %maxi(max(sueldo)) after depto Máximo sueldo del departamento : ___________. %totsuma( sum(sueldo) ) after report Cálculos Totales: ------------------Suma de los sueldos de la empresa : ___________. %totprom( avg(sueldo) ) after report Promedio de sueldo de la empresa : ___________. %totmini( min(sueldo) ) after report Sueldo mínimo de la empresa : ___________. %totmaxi( max(sueldo) ) after report Sueldo máximo de la empresa : ___________. %report use personal; %fields depto: ; nombre: ; sueldo: ; fingr: ;
Figura 4.3 - Reporte con Funciones
Página: 1 Fecha : 03/08/89 Listado de Empleados ==================== Depto. Empleado Sueldo Fecha Ingreso ======================================================== 1 Juan Gatica 950 14/01/82 1 Hugo Riveros 1400 23/04/80 Cálculos por departamento: ------------------------Suma de sueldos por departamento : 2350 Promedio de sueldo por departamento : 1175 Mínimo sueldo del departamento : 950 Máximo sueldo del departamento : 1400 2 Charlie Parker 2600 23/06/87 2 Albert Colby 1150 07/08/92 Cálculos por departamento: ------------------------Suma de sueldos por departamento : 3750 Promedio de sueldo por departamento : 1875 Mínimo sueldo del departamento : 1150 Máximo sueldo del departamento : 2600 3 John Holmes 1000 27/08/84 Página: 2 Fecha : 03/08/89 Cálculos Totales: -------------------
426
- 

Capítulo 17 - Reportes
Suma de los sueldos de la empresa : 7100 Promedio de sueldo de la empresa : 1420 Sueldo mínimo de la empresa : 950 Sueldo máximo de la empresa : 2600
Figura 4.4 - Listado cn Funciones
Nótese que se han usado expresiones simples (aquellas que sólo una referencia), para ver su uso a continuación se presentan algunos ejemplos.
%zoneX ((runsum(b)+n1+n2)/8000)
Aquí, b, n1 y n2 pueden ser campos pertenecientes a la misma zona o a zonas previamente definidas. Nótese que la definición de campos es un caso particular de esta sintaxis.
%zoneX(n) %zoneY(a, b, a+b, sum(n), avg(n)*100)
En este caso, n es una expresión que retorna el valor de un campo n, a es una expresión que retorna el valor del campo a, y lo mismo pasa con b. La expresión a+b retorna el valor de a y de b, la expresión sum(n) retorna la sumatoria del campo n y la expresión avg(n)*100 retorna el promedio del campo n por 100. La expresión a+b permite realizar operaciones "horizontales" (esto es poner en una columna la suma de otras dos) dentro de reportes.
Opciones de Impresión
Las zonas de los reportes pueden ser impresas según condiciones que se indican junto con la definición de las mismas.
Cortes de Control
{before, after} {report, page, campo, ( [report] [,page] [,campo] [,...] )}
Estas opciones controlan aspectos de la impresión de una zona. Las condiciones before (antes) y after (después) implementan cortes de control, que pueden ser efectuados según:
- report: El comienzo o fin del reporte. Esta opción puede usarse en conjunción con la page, según se verá más adelante.
- page: El comienzo o fin de la página. Es de señalar que la opción before page no imprime la zona en la primera página, en tanto que after page no lo hace en la última.
- campo: La impresión se realiza antes o después de que cambie el valor del campo mencionado.
- condiciones: La zona se imprime cuando se cumpla un subconjunto de las condiciones de corte. Es decir que si el conjunto de condiciones está formado por las opciones page, report y

- 427

Capítulo 17 - Reportes
campo, la zona se imprimirá cuando se cumpla cualquiera de las condiciones individuales o cuando se cumplan dos o más simultáneamente. El conjunto de opciones puede estar formado por varios campos, en cuyo caso la zona se imprimirá antes o después (before o after) del cambio de valores de uno o más de ellos.
Un ejemplo de la aplicación de la combinación de opciones de corte de control, sería el caso en que el programador necesitara imprimir una zona al comienzo de todas las páginas, la primera inclusive, y otra al final de todas ellas, incluyendo la última. Si colocara simplemente las opciones before report y after page no conseguiría esto, ya que en el primer caso no se imprimiría la zona en la primera página y en el otro no se imprimiría en la última. Combinando estas opciones con before page y after report de la manera apropiada, es posible obtener el resultado deseado. Por ejemplo:
%zonaM( param [,...] ) before (page, report) %zonaN( param [,...] ) after (page, report)
Por otro lado, u grupo de especificaciones como:
%zoneB1( param1 ) before page %zoneB2( param1, param2 ) before report %zoneB1( param3 ) after page %zoneB2( param3, param4 ) after report
Los siguientes son algunos ejemplos de aplicación de las opciones de corte de control:
%titulo( today, hour, pageno ) before page Fecha : __/__/__ Hora : __:__:__ Página : ___. %total ( sum(sueldo) ) after (depto, seccion, report) TOTAL : _,___,___.__
En el primer caso la zona se imprimirá antes de cada página, salvo la primera, y los campos indicados tomarán los valores de las variables pasadas como parámetros. La segunda zona del ejemplo se imprimirá cuando alguno de los parámetros depto y/o seccion cambien de valor o bien termine el reporte. Si se diera el caso de que se cumplan dos o tres de las condiciones simultáneamente la zona sólo se imprimirá una vez.
Impresión Condicionada - if
if <param> <condicion> <param>
Esta opción permite controlar una determinada zona, de forma tal que si se cumple <condicion>, se imprime la zona de impresión asociada.
%linea() if campo1 = campo2
es un caso simple. Usando expresiones sería de este tipo:
%zoneY(a, b) if a + 10 > b + sum(n)
428
- 

Capítulo 17 - Reportes
de esta forma la opción if se torna más potente.
Agrupación
group with zona
La opción group permite agrupar zonas para que sean impresas en la misma página. Por ejemplo si una zona de totales desea ser impresa junto con otra de subtotales, para que dado el caso no quede la zona de totales impresa en una hoja separada, debería especificarse:
%subtot(sum(sueldo)) after (depto, seccion, report) Total : _,___,___.__ %total(sum(sueldo), max(sueldo), min(sueldo), avg(sueldo)) after report, group with subtot Totales : _,___,___.__ Sueldo Máximo : _,___,___.__ Sueldo Mínimo : _,___,___.__ Sueldo Promedio : _,___,___.__
Avance de página
eject {before, after}
La opción eject provoca un salto de página antes (eject before) o después (eject after) de imprimirse la zona. Si no se especifica el momento, se obtendrá el mismo efecto que un eject after. Esto equivale a decir que ÔafterÕ es el valor por defecto.
Zonas no Impresas
no print
En ocasiones no se desea que una determinada zona sea impresa. Ello ocurre cuando se quiere imprimir el nombre del mes de una fecha pasada como parámetro: es necesario ubicar la fecha en alguna zona para que quede definido el tipo de dicho parámetro. En tal caso la fecha puede estar definida en una zona no imprimible, de forma tal de no entorpecer el diseño del reporte. Veamos un ejemplo:
%fecaux(fecha) no print __/__/__ %titulo( day(fecha), monthname(fecha), year(fecha) ) before report __. de _________ de _,___. .....
Impresión en una posición fija
at line NN
La opción at line NN permite imprimir una zona siempre en la misma posición de la hoja.

- 429

Capítulo 17 - Reportes
piepag(param1, ... ) at line 53
En este ejemplo la zona de "pie de página" piepag siempre se imprimirá a partir del renglón 53 de cada página del reporte. Es importante resaltar que el usuario es responsable de verificar que las zonas previas no sobrepasarán el número de línea especificado: dado que el sistema no interrumpirá la impresión de una zona que involucre varias líneas, en este caso el pie de página aparecerá en una línea inferior (la primera disponible luego de que la zona previa este completada). Las expresiones pueden ser usadas incluyendo esta opción, como en
%zoneZ(c, d) at line $PLINE + 1
Así mismo, las expresiones usadas en esta cláusula no podrán contener referencias a expresiones definidas en una zona.
Definición de Campos
Los campos de los listados se definen siempre dentro de las zonas, y se los especifica igual que en los formularios. La única diferencia es que a los campos se les da un nombre dentro de la especificación de la zona, y en la sección %fields, se especifican las características de los mismos. La expresión "\$varname" se reemplaza por el valor de la variable de ambiente varname. El texto que aparecerá en la salida es el contenido de dicha variable de ambiente cuando se imprime el reporte.
La Sección %report
Esta sección puede contener las siguientes sentencias: use esquema [, esquema]; especifica el o los esquemas de la Base de Datos a utilizar. Por su parte las especificaciones
flength = <valor>; // Largo de página topmarg = <valor>; // Margen superior botmarg = <valor>; // Margen inferior leftmarg = <valor>; // Margen izquierdo [no] formfeed;
indican los valores para la longitud del formulario de papel (flength) y para los márgenes superior, inferior e izquierdo de la página (topmarg, botmarg y leftmarg respectivamente). La longitud de la línea se supone de 80 caracteres. Si se indica la opción formfeed, se cumplirán los saltos de página al imprimir el reporte; en caso contrario el listado saldrá en forma continua. <valor> puede ser un número, o un valor que se toma del ambiente con una indicación $varname. En este caso, el valor es aquel contenido en la variable de ambiente cuando se
430
- 

Capítulo 17 - Reportes
imprime el listado. Los valores por defecto son:
flength: 66
width: 80
leftmarg: 0
topmarg: 2
botmarg: 2
output to { archivo | printer | pipe comando | terminal | stdout }
Esta sentencia permite la especificación del destino de la salida, que puede ser un archivo, la impresora, otro comando, la terminal o la salida normal (standard output).
archivo Esta opción permite enviar los resultados del reporte a un archivo
printer Esta opción envía la salida del reporte al destino especificado en la variable de ambiente printer (Consultar Manual del Usuario, Apéndice A). En el sistema operativo MSDOS, la variable de ambiente PRINTER podría estar definida de la siguiente forma:
PRINTER = P:pm -o PRN
pipe command Si se usa esta alternativa, los resultados del reporte son enviados al proceso indicado por el comando cmnd, sirviendo de input para la ejecución del mismo.
terminal La salida por terminal genera una ventana con los resultados del reporte, permitiendo paginar vertical y lateralmente. La ventana generada tendrá tantas columnas como la línea más ancha del reporte. La cantidad de columnas máxima de la ventana creada nunca excederá el ancho de la terminal en uso, por lo tanto el usuario tendrá la posibilidad de paginar lateralmente. El largo de ventana también se calcula automáticamente, en base a la longitud de página definida en el reporte y la cantidad de filas disponibles en la terminal. En tal caso, el usuario podrá paginar verticalmente.
stdout Esta opción envía los resultados del reporte a la salida estándar, tal como ésta esté definida.
En caso de no especificarse esta cláusula se considera como salida la opción output to printer (default value).
input from <fuente>; <fuente>: <cadena> | <variable_de_ambiente> [...] | pipe <cadena> | <variable_de_ambiente>

- 431

Capítulo 17 - Reportes
| terminal
Esta sentencia se utiliza cuando el reporte es utilizado por doreport, permitiendo definir de dónde se leerá la entrada.
La primer opción de <fuente>, es utilizada para indicar la entrada mediante un archivo de datos. Por ejemplo, si en el archivo datos, se tiene almacenada la información que debe ser entrada al utilitario doreport, se puede especificar como:
input from "datos"; input from $datos;
haciendo primero referencia a un string de caracteres, y luego a una variable de ambiente; ésta debe existir al momento de ejecución.
En cambio:
%report use personal; input from pipe "iql -b -c select depto, nombre, sueldo, fingr from emp, depto where emp.depto = depto.depno output delimited;"
se usa para indicar, mediante la especificación input from pipe(<dg>), que la entrada será la salida de un comando, mientras que input from terminal utiliza la entrada estándar. Cuando no está presente, doreport la emplea por defecto, siendo necesario indicar en el comando la opción ``-d'', o cuál es la forma en que vienen separados los campos y los registros que entran al utilitario doreport (<dg>). Finalmente, con la sentencia
language "C";
se informa que el reporte será usado desde la interfaz de programación, de modo que cuando sea procesado con el utilitario rgen se genere siempre el archivo de encabezamiento (archivo.rph), sin necesidad de indicarlo explícitamente.
La Sección %fields
Esta sección es semejante a la de un archivo de formulario. Pueden especificarse atributos para cada nombre de los campos de una zona. El orden en que los campos se nombran en esta sección, es aquel en el cual espera encontrarlos doreport.
La sintaxis de esta sección es una lista de los nombres de los campos seguidos por una lista opcional de atributos:
campo: opciones;
La especificación de opciones está formada por una lista de sentencias separadas por comas, que pueden ser:
432
- 

Capítulo 17 - Reportes
<campo_tabla> Los atributos inherentes al campo en la especificación en la tabla de campos de la base de datos a la que se hace referencia. Es factible especificar atributos adicionales o derivados de otros ya existentes. mask <cadena> Realiza una operación de máscara como el atributo mask definido en el Capítulo II, (Descripción de Sentencias DDS - CREATE TABLE). Como ser:
%zoneX(a) _____ %fields a: mask ($MASK != null ? $MASK : "NNNN");
Nótese que esta expresión no puede contener referencias a expresiones definidas en una zona. null zeros Aplicable solamente sobre campos numéricos. Si el campo tiene valor "0", se dejará en blanco (" ") en lugar de imprimirlo. Se explican a continuación las distintas sintaxis posibles, aplicables en cada caso a los anteriores ítems. <campo_tabla> La forma de especificarlo puede ser:
esquema.tabla.campo
Esta es una especificación completa y definida. Se refiere a un campo de una tabla de un esquema. Las restantes definiciones implican un cierto grado de ambigüedad.
tabla.campo
La tabla debe pertenecer a uno de los esquemas activos, establecidos en la sentencia use. Se utiliza la primera de ellas que concuerde con el nombre tabla.
tabla.
Valen las consideraciones efectuadas para el caso anterior con respecto a tabla. El campo usado es aquel con el mismo nombre que el del campo de la pantalla. <cadena> Una cadena es cualquier conjunto de caracteres encerrado entre comillas dobles (character string).
"Hola, mundo!"
<valor> Un valor puede ser cualquiera de los tipos válidos para las columnas de las tablas, que son: numeric, character string, date, time, float o bool. Las variables especiales today y hour corresponden a la fecha y hora corriente. Cualquiera sea la cantidad de campos que se empleen con el utilitario doreport, el orden en que se especifican debe coincidir con el orden en que fueron colocados para su impresión.
Funciones y Variables

- 433

Capítulo 17 - Reportes

Cabe hacer las siguientes consideraciones con respecto al tipo de función (formato) que corresponde a cada una de las funciones permitidas en un reporte.
- Las funciones son creadas dinámicamente, cada vez que aparece una función en la definición de un reporte, se crea un nuevo campo virtual. Esto permite que la misma función sea impresa con diferentes formatos.
- Las funciones pueden ser usadas en expresiones (if a < sum(h)). En este caso se le asigna un tipo interno (el cual está señalado con una "x" en la Tabla 6), pues el tipo interno permanece indefinido. Cuando hay más de una "x", se eligen el tipo que haga válida la expresión.
- El tipo de una función está definido de dos formas:
1.Por el tipo seleccionado en la imagen del reporte.
2.Por el uso del mismo dentro de una expresión.

FUNCION NUMERICNOO-NUMERICO

SHORT

DATE

TIME

CHAR

SUM

x

AVG

x

x

x

COUNT

x

MIN

x

x

x

MAX

x

x

x

DAY-MONTH-YEAR x

DAYNAME

x MONTHNAME

x

TODAY

x

HOUR

x

Figura 4.5 - Funciones y Tipos Internos

LONG x x x x x x

DOUBLE x x x x x x

Las variables tienen un tipo fijo asignado, y no puede ser modificado. La única opción posible es agregar short o long al valor numérico, como se puede observar en la siguiente tabla:

VARIABLE NUMERICNOO-NUMERICO

Char

Double

Date

Time

pageno

lineno

today

x

hour

x

flength

botmarg

topmarg

Short x x
x x x

Long x x
x x x

434
- 

Capítulo 17 - Reportes

leftmarg width

x

x

x

x

Figura 4.6 - Variables y Tipos Internos

Para completar esta descripción, veamos un diagrama de compatibilidad entre las funciones y los tipos de argumentos que aceptan.

FUNCION NUMERICNOO-NUMERICO

Char

Double

Date

Time

SUM

x

AVG

x

x

x

COUNT

x

x

x

x

MIN

x

x

x

MAX

x

x

x

DAY

x

MONTH

x

YEAR

x

DAYNAME

x

MONTHNAME

x

Figura 4.7 - Funciones y Tipos de Argumentos Válidos

Short x x x x x

Long x x x x x

Definición del tipo de un campo: 1. Si se lo va a imprimir y no está definido aún, se le asigna el tipo de diseño de impresión (si es compatible en caso de ser una función). 2. Si ya tiene un tipo definido, pueden darse los siguientes casos:
- Son iguales: no existen problemas. Es el caso de una función con un solo lugar donde imprimir.
- Son distintos (ocurre cuando un campo debe imprimirse en distintos lugares):
- Válido sólo en los casos numéricos.
- Si hay decimales deben coincidir., entre la definición original (pe., la Base de Datos) y el diseño de impresión. Expresiones:
- Si ambos campos están definidos, se verifica la compatibilidad.
- Si está definido uno solo, se define al otro de ese mismo tipo.


- 435

Capítulo 17 - Reportes

- Si ambos campos se hallan indefinidos, se produce ERROR.
Interfaz entre la Base de Datos y los Reportes
En la siguiente tabla se especifica la compatibilidad entre tipos de campo de la base de datos y del reporte:

BASE de DATOS
Date
x

REPORTE

Char

Numeric

Float

CHAR

x

NUMERIC

xa

x

TIME

DATE

FLOAT

x

BOOL

x

Figura 4.8 - Correspondencia de Tipos: BD/Reporte

Time x

Debe tenerse en cuenta que:
- La longitud del campo en el reporte puede ser cualquiera.
- En caso de que se halla indicado la opción "-w" al efectuar la compilación del reporte con el utilitario rgen, se avisa si los decimales no coinciden.
Listado Ejemplo
Como ejemplo, se construirá un listado del esquema personal que se utilizó en este capítulo. El listado debe dar para cada departamento una lista de sus miembros, imprimiendo el nombre del empleado y la fecha de ingreso. Se desea también, al final del listado, la cantidad total del "staff" de la empresa. La figura muestra un listado que tiene esas especificaciones, y está almacenado en un archivo llamado emplo.rp.
%reptitulo() before report LISTADO DEL PERSONAL ==================== %pgtitulo(pageno) before page Listado del Personal Page: ____. ===========================================

a Sólo si la máscara es completamente numérica.
436
- 

Capítulo 17 - Reportes
%dep(dnum,ddes) before dnum Departamento: __. _________________________ NUMERO NOMBRE INGRESO %person(pnum,pnombre,pfingr) _____ _______________________ __/__/__ %tot(count(pnum)) after report =========================================== Total Staff : _____. Empleados. %report %fields dnum; ddes; pnum; pnombre; pfingr;
Figura 4.9 - Listado Simple
El listado se compila con el utilitario rgen:
$ rgen emplo.rp
Una vez que el listado fue compilado, se lo puede correr con doreport. Pero se le debe preparar una entrada en ASCII. Es fácil de lograr con la sentencia SELECT del iql. Para eso se prepara un archivo llamado list.sql con los comandos que siguen:
use personal; select depno, depto.nombre, empno, emp.nombre, fingr from emp, depto where emp.depto = depto.depno order by depno output delimited;
Se puede ver que la sentencia SELECT lista todos los empleados ordenados por número de departamento. De esta forma, cuando cambia el valor de depno se satisface la condición before dnum, y se imprime el encabezamiento. La estructura del registro tiene los campos en el orden que los espera el listado, en el orden especificado en la sección fields.
El listado se obtiene con los siguientes comandos:
$ iql list.sql | doreport emplo
En primer lugar se invoca al utilitario iql, pasándole como parámetro un archivo que contiene sentencias DMS (Data Manipulation Statements). Mediante el símbolo "|" (pipe) se indica que la salida que se obtenga del comando se tome como entrada del proceso que le sigue. En nuestro caso, los resultados arrojados al ejecutarse las sentencias incluidas en el archivo "list.sql" serán tomados por el utilitario doreport como parámetros del reporte. En el sistema operativo MS-DOS esta es la forma de simular las opciones input from pipe y output to pipe, de las especificaciones generales del reporte.
La salida impresa se muestra en el siguiente gráfico:

- 437

Capítulo 17 - Reportes
LISTADO DEL PERSONAL ==================== Listado del Personal al 03/01/88 Pag: 1 >============================================= Departamento: 1 Desarrollo NUMERO NOMBRE INGRESO 1 Juan Gatica 01/03/88 4 Hugo Riveros 01/04/86 Departamento: 2 Software de Base NUMERO NOMBRE INGRESO 2 Charlie Parker 03/12/60 5 Albert Colby 03/11/70 Listado del Personal al 03/01/88 Pag: 2 ============================================== Departamento: 3 Documentación NUMERO NOMBRE INGRESO 9 John Holmes 25/02/75 3 Sam Pepper 25/02/75 7 Peter Pan 30/10/66 Departamento: 4 Administración NUMERO NOMBRE INGRESO 6 Piccolino Capri 11/09/87 =========================================== Total del Personal: 8 Empleados
Figura 4.10 - Listado de Salida
Otra opción, es incluir en la sentencia de iql, a qué report se debe direccionar la salida:
use personal; select depno, departamento.nombre, empno, emp.nombre, fingr from emp, depto where emp.depto = depto.depno order by depno output to report "emplo";
Nótese que el nombre del reporte no necesita llevar la extensión ".rp", dado que será asumida por el sistema. Con este cambio, el listado será producido por el comando:
$ iql list.sql
Usando Reportes
Existen distintas formas de utilizar un reporte, una vez que ha sido procesado con el utilitario rgen:
- Mediante el utilitario "doreport" de NILIX.
- Desde un programa de aplicación en lenguaje "C", mediante rutinas de manejo de reportes, provistas por la biblioteca de NILIX.
- Direccionando la salida de una sentencia SELECT de IQL.
Se verá a continuación cuales son los métodos existentes.
438
- 

Capítulo 17 - Reportes
DOREPORT
Doreport es un utilitario que lee una secuencia de registros de datos por su entrada estándar. Esos datos son los que alimentan la definición del reporte que se le pasa como parámetro. Se indica de donde tomará la entrada de datos especificándolo en la sección "%report" de la definición del reporte (ver Lenguaje RDL). Este utilitario trabaja como un filtro, lee su entrada, la formatea, y escribe el resultado en la salida. La entrada debe ser en ASCII, admitiendo distintos formatos de delimitación de campos, en forma similar a los utilitarios imp y exp (ver Capítulo 2 - Usando Bases de Datos /Utilitario export-import). Esto permite generar reportes en forma sumamente rápida y sencilla a través de la combinación de estos utilitarios como muestra la figura:
Figura 4.11 - Generación de Reportes
Para poder trabajar en forma correcta con este utilitario debe asegurarse que el orden de los campos en el lote de datos de entrada es el que se ha definido en el reporte. La forma de utilizar doreport es la siguiente:
a) $ doreport -Fc -Rc reporte Mediante estas opciones se indica que: Rc: Define a c como el carácter separador de registros. Por defecto es el carácter "newline" (\n). Fc: Define a c como el carácter separador de campos. Por defecto es la coma (,).
b) $ doreport -d reporte -d Mediante esta opción se indica que se toman los delimitadores de campos y registros como los estándares, es decir que se espera como separador de campos a las "," y al de los registros al "\n".
c) $ doreport reporte param1 param2 ... Los parámetros que se pasan al utilitario serán tomados como valores que saldrán impresos en el reporte en el lugar donde se lo haya referenciado en el archivo de especificación del reporte con \$1, \$2, etc..

- 439

Capítulo 17 - Reportes
d) $ doreport -nNN reporte
Emite NN copias del reporte.
Interfaz C
Las distintas aplicaciones con reportes pueden ser desarrolladas mediante la aplicación del utilitario "doreport" y con las instrucciones del ``iql'', al cual se ha hecho referencia en este mismo capítulo.
En caso de que algún requerimiento no pueda ser satisfecho con las herramientas antes mencionadas, puede recurrirse a la Interfaz de Programación (ver Capítulo 1, de Referencia del Programador). Esta permite el desarrollo de reportes de distinto nivel de complejidad, para cualquier aplicación. La Biblioteca de NILIX posee un subconjunto de funciones para manejo de reportes, entre las cuales se destaca la función DoReport. Esta función junto con las funciones DbToRp, RpSetFld y otras, permiten el desarrollo de las aplicaciones antes mencionadas.
La función DoReport, es la que produce la salida de una zona que se haya definido en el archivo de especificación del reporte. En caso de que dicha zona contenga campos, debe haberse dado valores a los mismos mediante la función RpSetFld o alguna de sus variantes. Ellas tienen por función específica la asignación de contenidos a los distintos campos definidos en el reporte, existiendo una variante de "Set field" para cada tipo de formato (float, date, time, char, etc.).
DbToRp (Data base to Report) copia valores de una tabla de la base de datos a los campos del reporte que se le indiquen.
Para tener más información de estas funciones remitirse a al parte II de este manual.
En un programa en lenguaje "C" desarrollado para trabajar con un reporte, también puede ser utilizada la función DoForm en caso de que se esté utilizando una pantalla para referenciar la información que se desea esté contenida en el reporte. Por ejemplo, asociar una pantalla a un reporte para que ciertos datos de la pantalla se impriman en el reporte. Se puede obtener más información sobre ésto en la sección Generador de Formularios.
Por ejemplo, si se quiere obtener un listado, de los empleados con el siguiente formato:
%tit(pageno, today) before page Página: __. Fecha : __/__/__ Listado de Empleados ====================== Depto. Empleado Sueldo F. Ingreso ======================================================== %linea(rdepto, nombre, sueldo, fingr) __. ____________________________ _______,__. __/__/__ %report use personal; %fields rdepto: emp.depto;
440
- 

Capítulo 17 - Reportes

nombre: emp.; sueldo: emp.; fingr : emp.;

Figura 4.12 - Especificación de Reporte

Se puede obtener mediante el acceso a los datos pertinentes con las sentencias del iql o el doreport, utilizando a éste último como formateador.
/***************************************************** * DENOMINACION:Listado de Empleados * *PANTALLAS:No se usan * *REPORTES:rep.rp * ******************************************************/ #include <NILIX.h> #include "rep.rph" #include "personal.sch" wcmd (rep, 1.1 08/08/89) { report rp; rp = OpenReport("rep", RP_EABORT); while(GetRecord(EMP,NEXT_KEY, IO_NOT_LOCK)!=ERROR){ DbToRp(rp, RDEPTO, FINGR); DoReport (rp, LINEA); } }
Figura 4.13 - Programa en "C"para manejo de Reportes

Este no es un caso de gran complejidad, pero su objeto es mostrar un ejemplo de programa desarrollado en "C", empleando algunas de las funciones de la biblioteca de interface de NILIX para obtener el listado.
Como se ve, en el programa se deben incluir los archivos cabecera resultantes de compilar el reporte rep.rp con la opción "-h" del rgen, habiendo creado el archivo cabecera del esquema.
Mediante este programa se abre un reporte, y por cada registro de datos obtenido se realiza la transferencia de dichos datos desde el buffer de la base de datos al área del reporte; luego, mediante la función DoReport, se provoca la salida al destino indicado mediante la variable de ambiente printer, que puede ser un device o un archivo. Remitimos al lector al capítulo de Funciones para comprender el funcionamiento de cada una de las que se han utilizado en esta porción de código. El listado tendría el siguiente aspecto:
Página: 1 Fecha : 23/08/92 Listado de Empleados ====================== Depto. Empleado Sueldo F. Ingreso ===================================================== 1 Juan Gatica 1900,00 01/03/88 1 Hugo Riveros 1090,00 01/04/86 2 Charlie Parker 900,00 12/10/60 2 Albert Colby 1550,00 11/03/70 3 John Holmes 1000,00 25/02/75


- 441

Capítulo 17 - Reportes
Página: 2 Fecha : 23/08/92 Listado de Empleados ====================== Depto. Empleado Sueldo F. Ingreso ===================================================== 3 Sam Pepper 1350,00 25/02/75 3 Peter Pan 1200,00 30/10/66 3 Piccolino Capri 1200,00 09/11/87
Figura 4.14 - Ejemplo de Impresión de Reporte

Capacidades Máximas
Número de Reportes abiertos simultaneamente Número de Esquemas abiertos simultaneamente
Carácteres en un campo alfanumérico Dígitos en un campo numérico
Dígitos significativos en un campo numérico Rango de valores en un campo fecha Rango de valores en un campo hora Nombres de Esquema Nombres de Tabla Nombres de Campo Campos por Reporte Zonas por Reporte

8 4 65535
15 15 16/04/1894 to 16/09/2073 00:00:00 to 23:59:58a 10 10 Unlimited 128 128

a El último horario para un día es 23:59:58, esto se debe a que NILIX tiene una precisión de 2 segundos para los datos del tipo Time.
442
- 

----
<?xml version="1.0" encoding="UTF-8"?>
<form-definition>
    <form title="Carga y Consulta de Clientes" database="demo">
        <form-attributes>
            <use>demo</use>
            <window border="single"/>
            <language>C</language>
            <messages>
                <message id="NRO">Ingrese el número de ficha de cliente que desea consultar.</message>
                <message id="NOM">Nombre del cliente, hasta 30 caracteres.</message>
                <message id="DIR">Calle y número del domicilio</message>
                <message id="FEC">La fecha de alta debe estar comprendida dentro de los últimos 90 días</message>
            </messages>
            <display-status>true</display-status>
            <confirm>add, delete, end</confirm>
        </form-attributes>

        <layout>
            <container type="vertical">
                <!-- Número de Cliente -->
                <field id="clieno" label="Número de Cliente" type="numeric" size="5">
                    <attributes>
                        <help>in clientes:(nombre, direc)</help>
                    </attributes>
                    <validation>
                        <table-validation reference="clientes.clieno"/>
                    </validation>
                </field>

                <!-- Nombre -->
                <field id="nombre" label="Nombre" type="text" size="30">
                    <attributes>
                        <help>NOM</help>
                    </attributes>
                    <validation>
                        <table-validation reference="clientes.nombre"/>
                    </validation>
                </field>

                <!-- Dirección -->
                <field id="direc" label="Dirección" type="text" size="30">
                    <attributes>
                        <help>DIR</help>
                    </attributes>
                    <validation>
                        <table-validation reference="clientes.direc"/>
                    </validation>
                </field>

                <!-- Provincia y Descripción de Provincia - Horizontal -->
                <container type="horizontal">
                    <field id="prov" label="Provincia" type="text" size="2">
                        <validation>
                            <table-validation reference="clientes.prov"/>
                        </validation>
                    </field>
                    <field id="desc0" label="" type="text" size="20">
                        <attributes>
                            <skip>true</skip>
                        </attributes>
                        <validation>
                            <table-validation reference="provin.nombre"/>
                        </validation>
                    </field>
                </container>

                <!-- Localidad y Descripción de Localidad - Horizontal -->
                <container type="horizontal">
                    <field id="loc" label="Localidad" type="text" size="2">
                        <validation>
                            <table-validation reference="clientes.loc"/>
                        </validation>
                    </field>
                    <field id="desc1" label="" type="text" size="20">
                        <attributes>
                            <skip>true</skip>
                        </attributes>
                        <validation>
                            <table-validation reference="local.nombre"/>
                        </validation>
                    </field>
                </container>

                <!-- Código Postal -->
                <field id="cp" label="Código postal" type="numeric" size="4">
                    <validation>
                        <table-validation reference="clientes.cp"/>
                    </validation>
                </field>

                <!-- Fecha de alta -->
                <field id="fealta" label="Fecha de alta" type="date" format="dd/MM/yyyy">
                    <attributes>
                        <default>today</default>
                    </attributes>
                    <validation>
                        <check><![CDATA[fealta >= today - 90]]></check>
                        <table-validation reference="clientes.fealta"/>
                    </validation>
                </field>

                <!-- I.V.A. -->
                <field id="iva" label="I.V.A." type="numeric" size="5">
                    <validation>
                        <table-validation reference="clientes.iva"/>
                    </validation>
                </field>

                <!-- Límite de Compra -->
                <field id="limite" label="Límite de Compra" type="numeric" size="8">
                    <validation>
                        <table-validation reference="clientes.limite"/>
                    </validation>
                </field>
            </container>
        </layout>
    </form>
</form-definition>
