import { getNilMenu } from './api/client.js';
import { init as initTheme, toggle as toggleTheme, isDark } from './services/themeService.js';
import FileExplorer from './components/FileExplorer.js';
import Workspace from './components/Workspace.js';

const SYSTEM_ROLES = ['wizard', 'admin', 'auditor'];

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Auth guard
    let session = null;
    try {
        const res = await fetch('/api/auth/check');
        if (!res.ok) { window.location.href = '/nil-login'; return; }
        session = await res.json();
        if (!session?.ok) { window.location.href = '/nil-login'; return; }
    } catch { window.location.href = '/nil-login'; return; }

    // Operadores no tienen acceso a nil-sys
    if (!SYSTEM_ROLES.includes(session.rol)) {
        window.location.href = '/';
        return;
    }

    // 2. Tema
    initTheme();
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.textContent = isDark() ? '☀️' : '🌙';
        themeBtn.addEventListener('click', () => {
            toggleTheme();
            themeBtn.textContent = isDark() ? '☀️' : '🌙';
        });
    }

    // 3. Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 650;
            if (isMobile) sidebar.classList.toggle('open');
            else          sidebar.classList.toggle('collapsed');
            sidebarToggle.classList.toggle('active');
        });
    }

    // 4. Mostrar usuario en footer del sidebar
    const userEl = document.getElementById('nil-sys-user');
    if (userEl) userEl.textContent = `${session.usuario} [${session.rol}]`;

    // 5. Instanciar workspace + explorador
    const treeContainer      = document.getElementById('file-tree');
    const workspaceContainer = document.getElementById('active-content');

    const workspace    = new Workspace(workspaceContainer, session?.publicToken ?? null);
    const fileExplorer = new FileExplorer(treeContainer, item => {
        workspace.loadItem(item);
        if (window.innerWidth <= 650) {
            sidebar.classList.remove('open');
            sidebarToggle.classList.remove('active');
        }
    });

    // 6. Cargar menú de sistema (filtrado por permisos en el servidor)
    const items = await getNilMenu();
    if (items?.length) {
        fileExplorer.render(items);
    } else {
        treeContainer.textContent = 'Sin ítems de menú disponibles.';
    }
});
