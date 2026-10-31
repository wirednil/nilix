# Pendientes estéticos — reportes y tablas

**Estado:** anotados para más adelante (2026-10-31). Detalles mínimos que
salieron de las rondas de validación con Chrome sobre thym-pos; ninguno
afecta datos ni el uso.

## Criterio para tablas y planillas (decisión del usuario, 2026-10-31)

- Una planilla con más columnas o valores más anchos **se va a ver cortada,
  y está bien**: se resuelve con desplazamiento, **no agregando ancho**.
- El área de trabajo queda con su tope (900px en `#active-content`, 800px
  el `.report-container`). No se saca.
- Lo que importa es que se **intuya** el desplazamiento: sombra en el borde
  donde la tabla sigue, manito para arrastrar (de costado la tabla, vertical
  la página), primera columna fija. Ver `js/utils/dragScroll.js`.
- **En los prompts de validación con Chrome:** no pedir que "entre
  completa" a un ancho dado ni reportar como FALLA que una columna quede
  afuera o que haga falta desplazarse. Evaluar si se nota que sigue, si el
  arrastre y la sombra funcionan, y si se lee bien al desplazar. Pedirle a
  Chrome que no proponga sacar el tope de ancho.

## Pendientes

| # | Detalle | Idea |
|---|---|---|
| 1 | La sombra izquierda cae encima de la columna N° fija y la oscurece | Que empiece después de la primera columna (variable CSS con su ancho) |
| 2 | La sombra se nota poco en filas grises y nada sobre el encabezado oscuro | Un poco más fuerte, no más ancha |
| 3 | Al imprimir sin "gráficos de fondo" (default de Chrome) el encabezado oscuro puede salir blanco sobre blanco — sobre todo el comprobante | `print-color-adjust: exact` en el `thead`, o borde/negrita como respaldo en `@media print` |
| 4 | Modo oscuro: las filas alternadas casi no se distinguen (negro vs `#121212`) | Más contraste solo en oscuro |
| 5 | "Cargando" se corre unos px a medida que crecen los puntos | Que los puntos ocupen siempre su lugar (ancho fijo, revelar con `clip-path`) |
| 6 | Al desplazar, el texto queda pegado a la N° fija ("25ransferencia") | Descartado por ahora (usuario); si vuelve: borde/espacio a la derecha de la columna fija |
| 7 | Seleccionar un pedazo de texto en una tabla arrastrable no se puede (arrastrar siempre desplaza) | Descartado por sobreingeniería (usuario); triple click selecciona la celda |
| 8 | Título del Tablero mensual sin el mes | Una línea en `tablero_mensual.yaml` con `format: month` (como Ventas del mes) — a decidir |
| 9 | Fila TOTAL de Ventas del mes no va en negrita | A decidir |
| 10 | "Ventas del mes": columnas sugeridas — canal de la clienta (fácil), productos vendidos (toca el motor: agregar líneas por venta), subtotales por cómo pagó | A decidir |
