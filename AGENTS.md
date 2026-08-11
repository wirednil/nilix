# Antes de generar cualquier XML/YAML/handler para nilix

Si sos un agente/LLM ayudando a alguien a armar una app sobre nilix: **leé este
archivo entero antes de escribir una sola línea de XML, YAML o JS de handler.**
No es opcional ni redundante con el README — existe porque, verificado en la
práctica, un agente que solo lee el README y generaliza desde Django / Angular
/ HTML / Jinja / Formik produce sintaxis que **no funciona en nilix**, en los
mismos puntos, de forma repetible. La tabla de la sección 3 es una lista real
de errores que ya se cometieron, no una lista hipotética.

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
| Un reporte YAML | [`docs/03-reference/NIL-REPORT.md`](docs/03-reference/NIL-REPORT.md) |
| Un handler JS | `nil-form.md`, sección "Interfaz con Handlers" |

Estos archivos tienen ejemplos completos y reales, no fragmentos. Si vas a
citar una sintaxis específica (un atributo, una estructura de zona, un tag),
**el ejemplo tiene que salir de estos archivos, no de memoria de otro
framework.**

## 3. Falsos amigos — nilix NO sigue estas convenciones

Estos son errores confirmados, no hipotéticos: un agente externo los cometió
todos, en el mismo intento, trabajando solo con el README.

| Lo que parece obvio (y es de otro framework) | Lo que realmente hace nilix | Fuente |
|---|---|---|
| `<item type="form" target=.../>` en el menú (HTML/Android/CMS) | `<option label=... type="form" target=... permissions="RADU"/>` — el parser solo acepta el nodeName `option`, `<item>` se ignora en silencio y el menú queda vacío | `src/services/menuService.js:30`, `docs/05-specs/MENUS-SPEC.md` |
| `options="a,b,c"` como atributo plano (HTML `<select>`) | `<options><option value="1">Texto</option></options>` — elemento hijo, siempre | `nil-form.md` (sección "IN — tabla de opciones") |
| `required="true"` como atributo plano (HTML5) | `<validation><required>true</required></validation>` — anidado | `nil-form.md` |
| `depends="campo=valor"` para mostrar/ocultar un campo (Django/Angular/Formik) | **No existe. No implementado**, documentado explícitamente 4 veces como `display only when expr` / `skip when cond` → No implementado | `nil-form.md` — sección "🚧 Pendiente en nil-form" |
| Handler en `src/handlers/` (convención genérica de "código fuente") | `$NIL_APP_DIR/apps/<nombre>.handler.js` — nunca dentro de `src/`, que es el motor, no la app | `nil-form.md` — sección "Interfaz con Handlers" |
| `exports.beforeSave = function(data) {...}` (estilo suelto) | `module.exports = { table, keyField, before, after, beforeSave(data, db), afterSave, beforeDelete, afterDelete }` — un solo objeto, `db` siempre como segundo parámetro | `nil-form.md` |
| `{{ campo }}` en templates de reporte (Jinja/Handlebars/Mustache) | `{campo}` — una sola llave | `NIL-REPORT.md` §7.3 |
| Zona de reporte con `id`/`type`/`content` | Zona con `name`/`layout`/`template`/`condition` — claves distintas, estructura distinta | `NIL-REPORT.md` §5 |
| Filtro de reporte tipo array: `tabla[tabla.campo='x'].otro` | `filter: "campo = valor"` a nivel de `dataSource`, sin `IN`/`LIKE`/compuestos; agregación vía `expressions: [{aggregate, argument}]`, no como propiedad de columna | `NIL-REPORT.md` §4.1, §8 |
| Un flag de config para desactivar multi-tenant | No existe. Una tabla es single-tenant si simplemente **no tiene columna `empresa_id`** — es una propiedad del schema, no un switch | `src/services/schemaService.js` (`hasColumn`) |

## 4. Si no podés verificar algo contra un archivo real, decilo

Si vas a proponer una sintaxis y no tenés un ejemplo real de este repo que la
respalde, decí explícitamente "esto no lo pude verificar contra la
documentación, es una inferencia" en vez de presentarlo con la misma
confianza que algo confirmado. Es la diferencia entre un plan que un humano
puede confiar y uno que hay que auditar entero antes de usar.
