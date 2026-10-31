/**
 * @file dragScroll.js
 * @description Tablas de reportes más anchas que su caja (ej. "Ventas del mes"
 *              de thym-pos): además de la barra de scroll —que con muchas
 *              filas queda abajo de todo— se desplazan arrastrándolas con el
 *              mouse. Solo cuando hay algo para desplazar: ahí la caja lleva
 *              .is-scrollable (cursor "grab", css/styles.css). Tacto y
 *              touchpad ya desplazan solos; esto es para el mouse.
 */

/** @param {HTMLElement} box - El contenedor con overflow-x: auto */
export function enableDragScroll(box) {
    const update = () => box.classList.toggle('is-scrollable', box.scrollWidth > box.clientWidth + 1);
    new ResizeObserver(update).observe(box);

    let start = null;
    box.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || !box.classList.contains('is-scrollable')) return;
        start = { x: e.clientX, left: box.scrollLeft, id: e.pointerId, moved: false };
    });
    box.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x;
        if (!start.moved && Math.abs(dx) < 4) return; // un click no es un arrastre
        if (!start.moved) {
            start.moved = true;
            box.setPointerCapture(e.pointerId);
            box.classList.add('is-dragging');
        }
        box.scrollLeft = start.left - dx;
    });
    const end = () => {
        if (!start) return;
        start = null;
        box.classList.remove('is-dragging');
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
}

export default enableDragScroll;
