// --- CONFIGURACIÓN ---
const CONFIG = {
    ROOT_PATH: '/opt/user/home/progs/', // Ruta visual (solo estética)
    API_URL: '/api/files', // ENDPOINT DEL BACKEND (Ya no es JSON estático)
    FORMS_DIR: './forms/' // Ruta real usada por el frontend para cargar los XMLs
};

// --- LÓGICA DE TEMA ---
function initTheme() {
    const body = document.body;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') body.classList.add('dark-mode');
}

function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('theme-btn');
    if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}

// --- CARGA DINÁMICA DESDE EL SERVIDOR ---
async function loadFileSystem() {
    try {
        // Ya no leemos un archivo JSON, consultamos la API de Node.js
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) throw new Error("Error conectando con el servidor de archivos");
        return await response.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function loadXML(filename) {
    try {
        // Nota: Esto sigue siendo fetch, pero servido por Express
        const response = await fetch(`${CONFIG.FORMS_DIR}${filename}`);
        if (!response.ok) throw new Error(`Error cargando ${filename}`);
        return await response.text();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// --- RENDERIZADO DEL ÁRBOL (IGUAL QUE ANTES) ---
function renderTree(node, parentElement, currentPath = "") {
    const li = document.createElement('li');
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
    
    const div = document.createElement('div');
    div.className = 'tree-node';
    div.dataset.path = nodePath;
    div.dataset.type = node.type;
    
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.type === 'folder' ? (node.expanded ? '[-]' : '[+]') : '[ ]';
    div.appendChild(icon);
    
    const name = document.createElement('span');
    
    // Si es carpeta, agregamos la barra al principio. Si es archivo, nada.
    if (node.type === 'folder') {
        name.textContent = `/${node.name}`;
    } else {
        name.textContent = node.name;
    }
    
    // Estilo adicional para las carpetas (opcional, para diferenciar más)
    if (node.type === 'folder') {
        name.style.fontWeight = 'bold'; // Opcional: Negrita para carpetas
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
            openFile(node, nodePath);
        }
    });

    if (node.children && node.children.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'tree';
        if (!node.expanded) ul.style.display = 'none';
        
        node.children.forEach(child => {
            renderTree(child, ul, nodePath);
        });
        li.appendChild(ul);
    }

    parentElement.appendChild(li);
}

// --- ABRIR ARCHIVO ---
async function openFile(fileNode, fullPath) {
    const workspace = document.getElementById('active-content');
    workspace.innerHTML = '';

    // Ruta visual
    const pathDisplay = document.createElement('div');
    pathDisplay.className = 'path-display';
    pathDisplay.textContent = `> ${CONFIG.ROOT_PATH}${fullPath}`;
    workspace.appendChild(pathDisplay);

    // Detectar si es XML
    if (fileNode.name.endsWith('.xml')) {
        const xmlContent = await loadXML(fileNode.name);
        
        if (xmlContent) {
            renderContactForm(workspace, xmlContent);
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'terminal-window';
            errorDiv.innerHTML = `<pre>ERROR: No se pudo cargar ${fileNode.name}.</pre>`;
            workspace.appendChild(errorDiv);
        }
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'terminal-window';
        placeholder.innerHTML = `<pre>ERROR: No viewer installed for extension ".${fileNode.name.split('.').pop()}".</pre>`;
        workspace.appendChild(placeholder);
    }
}

// --- RENDERIZADOR DEL FORMULARIO (IGUAL QUE ANTES) ---
function renderContactForm(container, xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const formNode = xmlDoc.querySelector('form');
    const title = formNode.getAttribute('title');
    const messagesNode = xmlDoc.querySelector('messages');
    const confirmStr = formNode.querySelector('confirm').textContent;

    const messages = {};
    if (messagesNode) {
        messagesNode.querySelectorAll('message').forEach(m => {
            messages[m.getAttribute('id')] = m.textContent;
        });
    }

    const actionMap = {
        'add': 'ENVIAR',
        'end': 'TERMINAR',
        'reset': 'LIMPIAR'
    };

    const windowDiv = document.createElement('div');
    windowDiv.className = 'terminal-window';

    const header = document.createElement('div');
    header.className = 'window-header';
    const isDark = document.body.classList.contains('dark-mode');
    
    header.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <span class="window-title">${title}</span>
            <span class="db-info">DB: ${formNode.getAttribute('database')}</span>
        </div>
        <button id="theme-btn" class="theme-toggle" onclick="toggleTheme()" title="Cambiar tema">
            ${isDark ? '☀️' : '🌙'}
        </button>
    `;
    
    windowDiv.appendChild(header);

    const formEl = document.createElement('form');
    formEl.className = 'form-vertical';

    const fields = xmlDoc.querySelectorAll('field');

    fields.forEach(fieldXml => {
        const id = fieldXml.getAttribute('id');
        const labelTxt = fieldXml.getAttribute('label');
        const type = fieldXml.getAttribute('type');
        const isRequired = fieldXml.querySelector('validation > required')?.textContent === 'true';

        const rowDiv = document.createElement('div');
        
        if (type === 'checkbox') {
            rowDiv.className = 'field-row checkbox-row';
            const labelEl = document.createElement('label');
            labelEl.textContent = ''; 
            labelEl.style.visibility = 'hidden';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'checkbox-wrapper';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.name = id;
            if(fieldXml.getAttribute('default') === 'true') input.checked = true;

            const span = document.createElement('span');
            span.className = 'checkbox-label-text';
            span.textContent = labelTxt;

            wrapper.appendChild(input);
            wrapper.appendChild(span);
            
            rowDiv.appendChild(labelEl);
            rowDiv.appendChild(wrapper);

        } else {
            rowDiv.className = 'field-row';
            
            const labelEl = document.createElement('label');
            labelEl.setAttribute('for', id);
            labelEl.textContent = labelTxt + (isRequired ? ' *' : ':');

            const groupDiv = document.createElement('div');
            groupDiv.className = 'input-group';

            let inputEl;

            if (id === 'message') {
                inputEl = document.createElement('textarea');
            } else {
                inputEl = document.createElement('input');
                inputEl.type = type;
                if (type === 'date') inputEl.title = "Seleccione una fecha en el calendario";
            }

            inputEl.id = id;
            inputEl.name = id;
            if (isRequired) inputEl.required = true;

            const defaultVal = fieldXml.querySelector('attributes default')?.textContent;
            if (defaultVal === 'today' && type === 'date') {
                inputEl.value = new Date().toISOString().split('T')[0];
            }

            groupDiv.appendChild(inputEl);

            const helpId = fieldXml.querySelector('attributes help')?.textContent;
            if (helpId && messages[helpId]) {
                const helpSpan = document.createElement('span');
                helpSpan.className = 'help-msg';
                helpSpan.textContent = messages[helpId];
                groupDiv.appendChild(helpSpan);
            }

            rowDiv.appendChild(labelEl);
            rowDiv.appendChild(groupDiv);
        }

        formEl.appendChild(rowDiv);
    });

    const nav = document.createElement('nav');
    nav.className = 'actions-nav';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = actionMap['reset'];
    resetBtn.onclick = () => formEl.reset();
    nav.appendChild(resetBtn);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = actionMap['add'];
    nav.appendChild(submitBtn);

    formEl.appendChild(nav);
    windowDiv.appendChild(formEl);
    container.appendChild(windowDiv);

    formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "¡ENVIADO!";
        submitBtn.style.backgroundColor = "#4CAF50";
        submitBtn.style.borderColor = "#4CAF50";
        
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.style.backgroundColor = ""; 
            submitBtn.style.borderColor = "";
            formEl.reset();
        }, 2000);
    });
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    
    // 1. Pedir al servidor Node.js que escanee la carpeta './forms'
    // ESTO DEVUELVE UN ARRAY: [{name: "form.xml", ...}, {name: "otro.xml", ...}]
    const fileSystemList = await loadFileSystem();
    
    if (fileSystemList && Array.isArray(fileSystemList)) {
        // 2. Renderizar árbol iterando sobre el array
        const treeContainer = document.getElementById('file-tree');
        const rootUl = document.createElement('ul');
        rootUl.className = 'tree root';
        
        // --- CORRECCIÓN AQUÍ ---
        // Iteramos cada nodo y lo renderizamos individualmente.
        // Pasamos "" (cadena vacía) como currentPath porque estos son archivos raíz dentro de forms/
        fileSystemList.forEach(node => {
            renderTree(node, rootUl, ""); 
        });
        
        treeContainer.appendChild(rootUl);
    } else {
        // Si está vacío o hay error
        document.getElementById('file-tree').innerHTML = 
            "<div style='padding:10px; color:#666;'>Carpeta vacía o error de conexión.</div>";
    }

    document.getElementById('base-path-input').value = CONFIG.ROOT_PATH;
});