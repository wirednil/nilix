console.log("🎨 themeService.js: Cargando...");

const THEME_KEY = 'theme';

function init() {
    console.log("🎨 Init: Verificando localStorage...");
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateButtonIcon();
}

function toggle() {
    console.log("🎨 Toggle: Cambiando tema...");
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    updateButtonIcon();
}

function isDark() {
    return document.body.classList.contains('dark-mode');
}

function updateButtonIcon() {
    const btn = document.getElementById('theme-btn');
    if (btn) {
        btn.textContent = isDark() ? '☀️' : '🌙';
    }
}

export { init, toggle, isDark };