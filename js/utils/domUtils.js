console.log("🧩 domUtils.js: Cargando...");

/**
 * Crea un elemento HTML con atributos e hijos de forma concisa.
 * @param {string} tag 
 * @param {string} classes 
 * @param {string} text 
 * @param {HTMLElement[]} children 
 * @returns {HTMLElement}
 */
function createElement(tag, classes = '', text = '', children = []) {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (text) el.textContent = text;
    children.forEach(child => el.appendChild(child));
    return el;
}

export { createElement };

console.log("✅ domUtils.js: Exportado correctamente.");