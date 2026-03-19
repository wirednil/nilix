console.log("🚀 MAIN.JS: Iniciando carga de módulos...");

import { getMenu } from './api/client.js';
import { init as initTheme, toggle as toggleTheme, isDark } from './services/themeService.js';
import FileExplorer from './components/FileExplorer.js';
import Workspace from './components/Workspace.js';
import logger from './utils/clientLogger.js';

console.log("✅ MAIN.JS: Todos los imports resueltos correctamente.");

// ── Capturar errores JS no manejados → log en servidor ──────────────────────
window.onerror = (msg, src, line, col, err) => {
    logger.error('window', `Uncaught: ${msg} (${src}:${line}:${col})`, err);
};
window.onunhandledrejection = (ev) => {
    logger.error('window', `UnhandledRejection: ${ev.reason}`);
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("📜 DOM Ready: Documento HTML cargado.");

    // 0. Auth guard — redirect to login if no valid session
    let session = null;
    try {
        const checkRes = await fetch('/api/auth/check');
        if (!checkRes.ok) { window.location.href = '/login.html'; return; }
        session = await checkRes.json();
        if (!session.ok) { window.location.href = '/login.html'; return; }
    } catch { window.location.href = '/login.html'; return; }
    localStorage.removeItem('nil_token'); // limpieza de migración

    // 0. Theme Toggle Global
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.textContent = isDark() ? '☀️' : '🌙';
        themeBtn.addEventListener('click', () => {
            toggleTheme();
            themeBtn.textContent = isDark() ? '☀️' : '🌙';
            updateCrtToggle();
        });
    }

    // 0.1 CRT Effects Toggle
    const crtToggle = document.getElementById('crt-toggle');
    const CRT_KEY = 'nilix-crt-mode';
    
    function updateCrtToggle() {
        if (!crtToggle) return;
        const crtEnabled = localStorage.getItem(CRT_KEY) === 'true';
        if (isDark() && crtEnabled) {
            document.body.classList.add('crt-mode');
            crtToggle.style.display = 'inline-block';
        } else if (isDark()) {
            document.body.classList.remove('crt-mode');
            crtToggle.style.display = 'inline-block';
        } else {
            document.body.classList.remove('crt-mode');
            crtToggle.style.display = 'none';
        }
    }
    
    if (crtToggle) {
        updateCrtToggle();
        crtToggle.addEventListener('click', () => {
            const crtEnabled = localStorage.getItem(CRT_KEY) === 'true';
            const newState = !crtEnabled;
            localStorage.setItem(CRT_KEY, newState);
            document.body.classList.toggle('crt-mode', newState);
        });
    }

    // 1. Sidebar Toggle (Brutalist)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const MOBILE_BREAKPOINT = 650;
    let wasMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            
            if (isMobile) {
                sidebar.classList.toggle('open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
            
            sidebarToggle.classList.toggle('active');
        });
        
        window.addEventListener('resize', () => {
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            
            if (wasMobile !== isMobile) {
                sidebar.classList.remove('open', 'collapsed');
                sidebarToggle.classList.remove('active');
                wasMobile = isMobile;
            }
        });
    }

    // 2. Inicializar Tema
    try {
        initTheme();
        console.log("✅ Tema inicializado.");
    } catch (e) {
        console.error("❌ Error iniciando tema:", e);
    }

    // 2. Referencias al DOM
    const treeContainer = document.getElementById('file-tree');
    const workspaceContainer = document.getElementById('active-content');
    const pathInput = document.getElementById('base-path-input');

    if(!treeContainer || !workspaceContainer) {
        console.error("❌ CRÍTICO: No se encontraron los contenedores en el HTML (file-tree o active-content).");
        return;
    }

    // 3. Instanciar Componentes
    try {
        const workspace = new Workspace(workspaceContainer, session?.publicToken ?? null);
        console.log("✅ Workspace instanciado.");

        const fileExplorer = new FileExplorer(treeContainer, (item) => {
            console.log("🖱️ Click en item:", item.label, item.type);
            workspace.loadItem(item);

            // Cerrar sidebar en móvil al seleccionar un item
            if (window.innerWidth <= MOBILE_BREAKPOINT) {
                sidebar.classList.remove('open');
                sidebarToggle.classList.remove('active');
            }
        });
        console.log("✅ FileExplorer instanciado.");

        // 4. Cargar Menú
        console.log("📡 Solicitando menú al servidor...");
        const menu = await getMenu();

        if (menu) {
            console.log("✅ Menú recibido:", menu);
            fileExplorer.render(menu);
            logger.info('main', `Menú cargado (${Array.isArray(menu) ? menu.length : '?'} items)`);
        } else {
            logger.error('main', 'getMenu devolvió null — menú no disponible');
            treeContainer.innerHTML = "Error cargando menú.";
        }

        // 5. Configuración Visual
        pathInput.value = Workspace.ROOT_PATH;

    } catch (e) {
        logger.error('main', 'Error durante inicialización', e);
    }
});