console.log("📂 FileExplorer.js: Cargando imports...");

import { createElement } from '../utils/domUtils.js';
import { RADU } from '../utils/RADU.js';

console.log("✅ FileExplorer.js: Imports listos.");

class FileExplorer {
    constructor(container, onItemSelected) {
        console.log("📂 FileExplorer: Instancia creada.");
        this.container = container;
        this.onItemSelected = onItemSelected;
    }

    render(menuItems) {
        console.log("📂 Render: Dibujando menú...");
        this.container.innerHTML = '';
        const rootUl = createElement('ul', 'tree root');

        menuItems.forEach(item => {
            this.renderItem(item, rootUl);
        });

        this.container.appendChild(rootUl);
    }

    renderItem(item, parentElement) {
        if (item.type === 'separator') {
            const li = document.createElement('li');
            if (item.label) {
                const sep = createElement('div', 'tree-separator tree-separator--labeled', item.label);
                li.appendChild(sep);
            } else {
                const sep = createElement('div', 'tree-separator');
                li.appendChild(sep);
            }
            parentElement.appendChild(li);
            return;
        }

        if (item.type === 'menu') {
            this.renderMenuFolder(item, parentElement);
            return;
        }

        // form or report — leaf node
        const li = document.createElement('li');
        const div = createElement('div', 'tree-node');
        div.dataset.target = item.target;
        div.dataset.type = item.type;

        const icon = createElement('span', 'tree-icon', '[ ]');
        div.appendChild(icon);

        const label = createElement('span', '', item.label);
        div.appendChild(label);

        const radu = new RADU(item.permissions);
        if (!radu.canWrite()) {
            const badge = createElement('span', 'tree-badge', ' [R]');
            div.appendChild(badge);
        }

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
            div.classList.add('active');
            if (this.onItemSelected) this.onItemSelected(item);
        });

        li.appendChild(div);
        parentElement.appendChild(li);
    }

    renderMenuFolder(item, parentElement) {
        const li = document.createElement('li');
        const div = createElement('div', 'tree-node');
        div.dataset.type = 'menu';

        const icon = createElement('span', 'tree-icon', '[-]');
        div.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = `/${item.label}`;
        label.style.fontWeight = 'bold';
        div.appendChild(label);

        li.appendChild(div);

        const ul = createElement('ul', 'tree');
        (item.children || []).forEach(child => {
            this.renderItem(child, ul);
        });
        li.appendChild(ul);

        let expanded = true;
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            expanded = !expanded;
            icon.textContent = expanded ? '[-]' : '[+]';
            ul.style.display = expanded ? 'block' : 'none';
        });

        parentElement.appendChild(li);
    }

    // Legacy: kept for compatibility with old tree-of-files format
    renderNode(node, parentElement, currentPath) {
        const li = document.createElement('li');
        const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

        const div = createElement('div', 'tree-node');
        div.dataset.path = nodePath;
        div.dataset.type = node.type;

        const icon = createElement('span', 'tree-icon', node.type === 'folder' ? (node.expanded ? '[-]' : '[+]') : '[ ]');
        div.appendChild(icon);

        const name = document.createElement('span');
        if (node.type === 'folder') {
            name.textContent = `/${node.name}`;
            name.style.fontWeight = 'bold';
        } else {
            name.textContent = node.name;
        }
        div.appendChild(name);

        li.appendChild(div);

        div.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
            div.classList.add('active');

            if (node.type === 'folder') {
                node.expanded = !node.expanded;
                icon.textContent = node.expanded ? '[-]' : '[+]';
                const ul = li.querySelector('ul');
                if (ul) ul.style.display = node.expanded ? 'block' : 'none';
            } else {
                if (this.onItemSelected) this.onItemSelected(node, nodePath);
            }
        });

        if (node.children && node.children.length > 0) {
            const ul = createElement('ul', 'tree');
            if (!node.expanded) ul.style.display = 'none';

            node.children.forEach(child => {
                this.renderNode(child, ul, nodePath);
            });
            li.appendChild(ul);
        }

        parentElement.appendChild(li);
    }
}

export default FileExplorer;
