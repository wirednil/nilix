/**
 * @file dragScroll.js
 * @description Tablas de reportes (ej. "Ventas del mes" de thym-pos): con más
 *              columnas o valores más anchos van a ser más anchas que la
 *              pantalla, y eso está bien — no se agranda nada, se ayuda a ver
 *              que se desplazan:
 *              - una sombra en el borde donde la tabla sigue (izquierda o
 *                derecha), que se va al llegar al final;
 *              - la manito: arrastrar con el mouse desplaza la tabla de
 *                costado y la página para arriba/abajo. Solo si hay algo que
 *                desplazar (.is-scrollable, css/styles.css). Tacto y touchpad
 *                ya desplazan solos; esto es para el mouse.
 */

/** Contenedor que desplaza la página verticalmente (el workspace), si hay. */
function verticalScroller(el) {
    for (let n = el.parentElement; n; n = n.parentElement) {
        const { overflowY } = window.getComputedStyle(n);
        if (/(auto|scroll)/.test(overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
    }
    const doc = document.scrollingElement;
    return doc && doc.scrollHeight > doc.clientHeight + 1 ? doc : null;
}

/**
 * @param {HTMLElement} box - El contenedor con overflow-x: auto
 * @returns {HTMLElement} El marco (.report-scroll-frame) que lo envuelve, para
 *          insertar en lugar de `box` — lleva las sombras de los bordes.
 */
export function enableDragScroll(box) {
    const frame = document.createElement('div');
    frame.className = 'report-scroll-frame';
    frame.appendChild(box);

    const update = () => {
        const max = box.scrollWidth - box.clientWidth;
        frame.classList.toggle('more-left', box.scrollLeft > 1);
        frame.classList.toggle('more-right', box.scrollLeft < max - 1);
        box.classList.toggle('is-scrollable', max > 1 || !!verticalScroller(box));
    };
    new ResizeObserver(update).observe(box);
    box.addEventListener('scroll', update, { passive: true });
    box.addEventListener('pointerenter', update);

    let start = null;
    box.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        update();
        if (!box.classList.contains('is-scrollable')) return;
        const page = verticalScroller(box);
        start = { x: e.clientX, y: e.clientY, left: box.scrollLeft, page, top: page?.scrollTop ?? 0, id: e.pointerId, moved: false };
    });
    box.addEventListener('pointermove', (e) => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 4) return; // un click no es un arrastre
        if (!start.moved) {
            start.moved = true;
            box.setPointerCapture(e.pointerId);
            box.classList.add('is-dragging');
        }
        box.scrollLeft = start.left - dx;
        if (start.page) start.page.scrollTop = start.top - dy;
    });
    const end = () => {
        if (!start) return;
        start = null;
        box.classList.remove('is-dragging');
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    return frame;
}

export default enableDragScroll;
