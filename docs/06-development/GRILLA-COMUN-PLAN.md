# Plan — Grilla común para el layout de forms

**Estado:** propuesto, no implementado (2026-10-29). Se deja para cuando un
form o una app nueva lo justifique: hoy no hay un error de la usuaria que
esto arregle, es orden visual y menos ajuste a mano por form.

## Por qué

Rondas de validación con Chrome sobre thym-pos (2026-10-27/29). Los
problemas de ancho se fueron arreglando de a uno, con parches:

| Problema | Arreglo actual |
|---|---|
| Etiquetas pegadas en filas horizontales | gap 1.5rem en CSS (el 0.5rem inline del JS le ganaba) |
| A ~1000px campos fuera de la tarjeta | `flex-wrap: wrap` — el que baja queda suelto, sin alinear a nada |
| Campo vertical estirado a todo el ancho ignorando `size` | se respeta `size`; el texto libre va sin `size` en el XML |
| Anchos desparejos uno debajo del otro | quitar `size` a mano, form por form |
| Campo que crece hasta su etiqueta (`expand-to-label`) | abierto, cosmético |
| Bordes derechos que no coinciden entre filas | abierto, cosmético |

Causa común: cada campo mide `size × 1.2ch` (mínimo 8ch) o lo que mida su
etiqueta, y conviven `flex-grow` con anchos fijos. No hay columnas
compartidas, así que los bordes caen donde caen.

## Referencia analizada: The Monospace Web

https://owickstrom.github.io/the-monospace-web/ — no resuelve el responsivo,
lo esquiva (tope de 80ch, sin wrap, nunca apila). Se toma:

- Una unidad por eje: `ch` horizontal, `--line-height` vertical, `px` solo
  bordes, compensados con `calc()`; anchos redondeados con
  `round(down, 100%, 1ch)`.
- El ancho lo pone la celda, no el contenido: el input ocupa el 100% de su
  celda y la etiqueta larga parte en dos líneas.
- Tablas: columnas mínimas (`width: 0%`) y una sola que crece
  (`width: 100%`); texto que se parte, nunca "…".

No se toma: el tope de 80ch, el `.grid` flex sin wrap que cuenta hijos con
`:has()` (máx. 9, filas con distinta N no alinean), el foco solo con borde.

## Propuesta

```css
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6ch, 1fr));
  gap: var(--line-height) 2ch;
  align-items: end;
}
.form-grid > .field { grid-column: span var(--span); }
```

- Todo el form (filas horizontales y campos sueltos) en una sola grilla:
  todas las filas comparten columnas → bordes alineados.
- `--span` lo calcula el motor desde el `size` del XML (ej. `size="12"` →
  ~15ch → 2 columnas). Sin `size` → fila entera. Los XML no cambian.
- `<container type="horizontal">` = los campos empiezan fila nueva; ya no
  hace falta flex.
- Angosto: `auto-fill` da menos columnas; el que no entra baja alineado a la
  columna 1. Bajo ~480px se mantiene el apilado actual.
- Sale `expand-to-label`: la etiqueta parte en dos líneas; los inputs quedan
  alineados por la base.
- Grilla del multifield y tablas de reportes: encabezados en dos líneas,
  una columna que crece, números al mínimo y a la derecha; scroll
  horizontal solo como respaldo.

## Pasos (cada uno con tests primero)

1. Tests de alineación: bordes que coinciden entre filas a 1200/1000/800/375px
   en fixtures de `dev/form/` y en los forms de thym-pos.
2. Grilla común en `LayoutProcessor` / `InputField` + CSS; fuera
   `expand-to-label`.
3. Multifield y `ReportRenderer`.
4. Revalidar todos los forms (Chrome) — toca el layout de todo.

**Archivos:** `js/components/form/LayoutProcessor.js`,
`js/components/fieldRenderer/InputField.js`, `Multifield.js`,
`js/components/report/ReportRenderer.js`, `css/styles.css`.
