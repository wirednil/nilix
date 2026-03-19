console.log("🌐 api/client.js: Cargando...");

import logger from '../utils/clientLogger.js';

// ─── Auth helpers ────────────────────────────────────────────────────────────

/**
 * fetch() wrapper that relies on the HttpOnly cookie sent automatically.
 * If the server returns 401, redirects to login.
 */
async function authFetch(url, options = {}) {
    let res;
    try {
        res = await fetch(url, options);
    } catch (err) {
        logger.error('authFetch', `Red: ${options.method ?? 'GET'} ${url}`, err);
        throw err;
    }

    if (res.status === 401) {
        logger.warn('authFetch', `401 → redirect login (${url})`);
        window.location.href = '/login.html';
        throw new Error('Sesión expirada');
    }

    return res;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function getMenu() {
    console.log("🌐 GET Menu: Solicitando a /api/menu...");
    try {
        const response = await authFetch('/api/menu');
        if (!response.ok) throw new Error("Error de red al cargar el menú");
        const data = await response.json();
        console.log("✅ GET Menu: Datos recibidos.");
        return data;
    } catch (error) {
        console.error("❌ GET Menu Error:", error);
        return null;
    }
}

async function getFile(absolutePath) {
    console.log(`🌐 GET File: Solicitando ${absolutePath}...`);
    try {
        const response = await authFetch(`/api/files/content?path=${encodeURIComponent(absolutePath)}`);
        if (!response.ok) throw new Error(`Error cargando ${absolutePath}`);
        const data = await response.text();
        console.log(`✅ GET File: ${absolutePath} cargado.`);
        return data;
    } catch (error) {
        console.error(`❌ GET File Error (${absolutePath}):`, error);
        return null;
    }
}

// Legacy
async function getTree() {
    console.log("🌐 GET Tree: Solicitando a /api/files...");
    try {
        const response = await authFetch('/api/files');
        if (!response.ok) throw new Error("Error de red al cargar el árbol");
        const data = await response.json();
        console.log("✅ GET Tree: Datos recibidos.");
        return data;
    } catch (error) {
        console.error("❌ GET Tree Error:", error);
        return null;
    }
}

/**
 * Cierra la sesión: revoca el token en el servidor (cookie se envía automáticamente).
 */
async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { }
    window.location.href = '/login.html';
}

export { authFetch, getMenu, getFile, getTree, logout };
