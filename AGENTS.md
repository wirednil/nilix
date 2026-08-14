# Antes de generar cualquier XML/YAML/handler para nilix

Si sos un agente/LLM ayudando a alguien a armar una app sobre nilix: **leé este
archivo entero antes de escribir una sola línea de XML, YAML o JS de handler.**

**El trigger es "el proyecto está nombrado", no "estoy por escribir código".**
Si el pedido viene formulado como un problema de negocio/diseño (formularios,
métricas, flujo de trabajo) y en algún momento va a necesitar volcarse a
formularios/reportes/handlers de nilix, leé esto **antes** de entrar en modo
diseño — no después, cuando ya armaste una arquitectura y solo falta
"adaptarla". Confirmado en la práctica: un agente que resolvió el problema de
negocio primero y leyó esto recién en un segundo intento ya había propuesto,
en el primer intento, una funcionalidad que no existe.

No es opcional ni redundante con el README — existe porque, verificado en la
práctica sobre 5 intentos independientes de distintos modelos con el mismo
pedido, un agente que solo lee el README y generaliza desde Django / Angular
/ HTML / Jinja / Formik / SurveyJS produce sintaxis que **no funciona en
nilix**, en los mismos puntos, de forma repetible. La tabla de la sección 3
es una lista real de errores que ya se cometieron, no una lista hipotética.

**Si no tenés capacidad real de leer este repo (sin fetch de URLs, sin
browsing, sin acceso a archivos), decilo así de directo — "no puedo verificar
esto contra el repo real" — en vez de inventar un motivo plausible ("el repo
es privado", "no está indexado") para justificar la falta de acceso. De los
5 intentos verificados, 2 no tenían acceso real y ninguno de los dos lo dijo
por su cuenta — los dos inventaron una excusa incorrecta en su lugar, y
generaron arquitectura fabricada con la misma confianza que si hubieran
leído el código real.**

## 1. Generá con las herramientas, no a mano

nilix tiene generadores que garantizan sintaxis correcta por construcción.
Usarlos evita la mayoría de los errores de este documento sin necesidad de
memorizar sintaxis:

```bash
. ./vars                          # exporta NILSRC + funciones scaffold/nil-start/nil-setup
scaffold mi-proyecto --dest=..    # crea el skeleton completo: form/, apps/, reports/, .env, menu.xml
cd ../mi-proyecto_v000/mi-proyecto
node setup.js                     # JWT secret + auth.db + app DB
node start.js                     # arranca el servidor
```

Para un handler, no lo escribas a mano — generalo desde el form real:

```bash
node utils/gencf.js form/mi_form.xml -o apps/mi_form.handler.js -a -b
```

`gencf.js` lee los campos reales del XML y genera el `module.exports` con la
firma correcta. Esto elimina por construcción los dos errores de handler más
comunes: ubicarlo en el directorio equivocado, y omitir el parámetro `db`.

## 2. Documentación de referencia — leer antes, no "si hace falta"

| Vas a escribir | Leé primero |
|---|---|
| Un `<form>` XML (campos, validación, condicionales) | [`docs/03-reference/nil-form.md`](docs/03-reference/nil-form.md) |
| Un `menu.xml` | [`docs/05-specs/MENUS-SPEC.md`](docs/05-specs/MENUS-SPEC.md) |
| Un reporte YAML | [`docs/03-reference/NIL-REPORT.md`](docs/03-reference/NIL-REPORT.md) — **si el reporte combina más de una tabla o necesita agrupar por más de un campo, leé también §10 antes de diseñar las zonas** |
| Un handler JS | `nil-form.md`, sección "Interfaz con Handlers" |

Estos archivos tienen ejemplos completos y reales, no fragmentos. Si vas a
citar una sintaxis específica (un atributo, una estructura de zona, un tag),
**el ejemplo tiene que salir de estos archivos, no de memoria de otro
framework.**

## 3. Falsos amigos — nilix NO sigue estas convenciones

Estos son errores confirmados, no hipotéticos: salieron de auditar 5 intentos
independientes (de distintos modelos, mismo pedido, mismo repo) contra el
código real. Cada fila es al menos un caso real, con la fuente que lo
desmiente.

| Lo que parece obvio (y es de otro framework) | Lo que realmente hace nilix | Fuente |
|---|---|---|
| Cualquier forma de mostrar/ocultar un campo según el valor de otro — `depends="campo=valor"` (Django/Angular), `"condition": {"field":...}` (JSON Schema Form), `render_if: "$campo == valor"` (SurveyJS), `display="false"` + `<required>true when x is 'y'</required>` (North Mini Code) | **No existe. No implementado.** Es el error más repetido de todos los verificados contra este proyecto: **4 de 7 intentos independientes lo inventaron, cada uno con un nombre distinto, sin coordinación entre ellos** — incluso uno que recibió la instrucción explícita "implementá esto sobre nilix" y aun así se fue a otro stack (Google Sheets/Forms) y coló esta misma sintaxis inventada en los fragmentos que sí presentó como nilix. Documentado explícitamente 4 veces en `nil-form.md` como `display only when expr` / `skip when cond` → No implementado | `nil-form.md` — sección "🚧 Pendiente en nil-form" |
| `<item type="form" target=.../>` en el menú (HTML/Android/CMS) | `<option label=... type="form" target=... permissions="RADU"/>` — el parser solo acepta el nodeName `option`, `<item>` se ignora en silencio y el menú queda vacío | `src/services/menuService.js:30`, `docs/05-specs/MENUS-SPEC.md` |
| `options="a,b,c"` como atributo plano (HTML `<select>`) | `<options><option value="1">Texto</option></options>` — elemento hijo, siempre | `nil-form.md` (sección "IN — tabla de opciones") |
| `required="true"` como atributo plano (HTML5) | `<validation><required>true</required></validation>` — anidado | `nil-form.md` |
| `type="api"` o similar para reportes en `menu.xml` | `type="report"` — `MENUS-SPEC.md` en su forma original proponía `type="api"`, quedó desactualizado respecto al parser real; ver la corrección al inicio de ese archivo | `src/services/menuService.js`, `sys/nil-sys.xml:21,24` |
| `kind: document` en un reporte con totales agregados (Contribución, Ganancia, etc.) | Necesita `kind: ledger` — cualquier zona con rol `total` (`condition: {when: after, on: report}` + `aggregate`) solo es válida bajo `kind: ledger` | `NIL-REPORT.md` §5.4 |
| Handler en `src/handlers/` (convención genérica de "código fuente") | `$NIL_APP_DIR/apps/<nombre>.handler.js` — nunca dentro de `src/`, que es el motor, no la app | `nil-form.md` — sección "Interfaz con Handlers" |
| nilix es una app de terminal (TUI) o tiene backend en C | Es una aplicación **web** — Express/Node.js sobre HTTP, renderizada en el navegador. La "estética terminal" es CSS (monospace, verde fósforo), no un programa de terminal real. Cero código C en el runtime | `server.js` (`express()`, `http.createServer`), ausencia total de `.c`/`.h` fuera de material de referencia histórico |
| nilix usa PostgreSQL | Usa SQLite vía `sql.js` — cero dependencia de Postgres en todo el proyecto | `src/services/database.js:1` (`require('sql.js')`) |
| `exports.beforeSave = function(data) {...}` (estilo suelto) | `module.exports = { table, keyField, before, after, beforeSave(data, db), afterSave, beforeDelete, afterDelete }` — un solo objeto, `db` siempre como segundo parámetro | `nil-form.md` |
| `{{ campo }}` en templates de reporte (Jinja/Handlebars/Mustache) | `{campo}` — una sola llave | `NIL-REPORT.md` §7.3 |
| Zona de reporte con `id`/`type`/`content` | Zona con `name`/`layout`/`template`/`condition` — claves distintas, estructura distinta | `NIL-REPORT.md` §5 |
| Filtro de reporte tipo array: `tabla[tabla.campo='x'].otro` | `filter: "campo = valor"` a nivel de `dataSource`, sin `IN`/`LIKE`/compuestos; agregación vía `expressions: [{aggregate, argument}]`, no como propiedad de columna | `NIL-REPORT.md` §4.1, §8 |
| Un flag de config para desactivar multi-tenant | No existe. Una tabla es single-tenant si simplemente **no tiene columna `empresa_id`** — es una propiedad del schema, no un switch | `src/services/schemaService.js` (`hasColumn`) |
| `help="ID"` / `default="valor"` como atributos de `<field>` (y así aparecen en `dev/form/*.xml` y en buena parte de `nil-form.md`) | El renderer vivo (`LayoutProcessor.js`) solo lee `<help>ID</help>` y `<default>valor</default>` como **elementos hijos**. Los atributos se ignoran en silencio — no hay error, simplemente el help-text nunca aparece y el campo arranca vacío. Esta es la trampa más peligrosa de las dos: los ejemplos "reales" del propio repo enseñan la sintaxis rota | `LayoutProcessor.js` (`querySelector('attributes help')`/`querySelector('help')`, ídem `default`); confirmado que `js/app.js` (el único que sí lee esos atributos) está deshabilitado — `<script src="js/app.js">` comentado en `index.html:61` |
| Asumir que `<check>`/`<min>`/`<max>`/`<pattern>` bloquean el guardado si el dato es inválido (como `required` en HTML5) | **Solo `<required>true</required>` bloquea.** Es el único que se traduce a un atributo HTML real (`InputField.js:47`); el resto corre al perder el foco del campo y solo muestra un mensaje — nunca llama `setCustomValidity()`, nunca impide el submit. Y `<check>` específicamente solo evalúa bien con un único operador relacional entre dos campos numéricos: compuesto con `and`/`or` siempre da `false`; comparando dos campos `type="date"` siempre da `true` (`evaluateArithmetic()` hace `parseFloat()` sobre todo, y lo no-numérico cae a `0`). Para cualquier validación que deba impedir guardar: handler (`validate()`/`beforeSave()`) | `js/components/fieldRenderer/InputField.js:47`, `js/utils/ExpressionEngine.js` (orden de detección en `evaluate()`); `docs/03-reference/nil-form.md`, sección "Qué bloquea el guardado y qué no" |

## 4. Si no podés verificar algo contra un archivo real, decilo — y si es crítico, parate

Si vas a proponer una sintaxis y no tenés un ejemplo real de este repo que la
respalde, decí explícitamente "esto no lo pude verificar contra la
documentación, es una inferencia" en vez de presentarlo con la misma
confianza que algo confirmado. Es la diferencia entre un plan que un humano
puede confiar y uno que hay que auditar entero antes de usar.

Etiquetar la incertidumbre no alcanza si la parte incierta es el núcleo de lo
que se pidió (ej. el campo crítico de un formulario, la zona de totales de un
reporte). En ese caso: **frená antes de entregar el archivo final** y pedí
confirmación o el archivo real que falta, en vez de entregar algo completo
pero con una pieza central inventada. Etiquetar + entregar igual solo mueve
el problema al lector; parar antes de la parte crítica lo evita.

## 5. Leer la doc y los ejemplos reales no alcanza — pueden estar mal ellos mismos

La sección 2 dice "leé la doc antes de escribir". Es necesario pero no
suficiente: **`help="ID"` y `default="today"` como atributos** (la fila de la
sección 3 sobre esto) no las inventó ningún modelo por generalizar de otro
framework — las copió textual de `dev/form/clientes.xml`, `ordenes.xml`,
`nil-form.md` §"Atributos Válidos". Un agente que hizo exactamente lo que
este archivo pide (leer ejemplos reales del repo, citar la fuente) produjo
XML que no funciona, porque la fuente misma estaba desactualizada contra el
renderer vivo (`dev/form/*.xml` apuntaba a un renderer legacy, `js/app.js`,
que está deshabilitado desde `index.html`).

La única salida que no depende de que alguien ya haya encontrado y corregido
el error específico: **antes de dar por buena una sintaxis de campo
(atributo vs. elemento hijo, qué tags leen qué), confirmá con grep que el
renderer vivo la lee** — `LayoutProcessor.js`, `validator.js`,
`ExpressionEngine.js`, `ValidationCoordinator.js` para formularios;
`YamlParser.js`/`ReportRenderer.js` para reportes — y, si es viable, abrí el
form en el navegador antes de entregarlo. Esto no reemplaza la sección 2:
la doc y los ejemplos siguen siendo el punto de partida correcto y aciertan
en la mayoría de los casos (estructura de `<layout>`, `<validation>`,
`<in-table>`, etc.) — pero cuando la pieza es crítica (una condición de
validación, un default que si falla deja el form invalidable), la
verificación contra el código fuente vivo no es opcional.
