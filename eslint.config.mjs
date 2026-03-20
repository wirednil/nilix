import js from '@eslint/js';

// Node.js globals (backend + scripts)
const nodeGlobals = {
    require:         'readonly',
    module:          'writable',
    exports:         'writable',
    __dirname:       'readonly',
    __filename:      'readonly',
    process:         'readonly',
    console:         'readonly',
    setTimeout:      'readonly',
    clearTimeout:    'readonly',
    setInterval:     'readonly',
    clearInterval:   'readonly',
    Buffer:          'readonly',
    fetch:           'readonly',
    URL:             'readonly',
    URLSearchParams: 'readonly',
    crypto:          'readonly',
};

// Browser globals (frontend js/)
const browserGlobals = {
    ...nodeGlobals,
    window:                'readonly',
    document:              'readonly',
    navigator:             'readonly',
    localStorage:          'readonly',
    sessionStorage:        'readonly',
    location:              'readonly',
    history:               'readonly',
    Event:                 'readonly',
    CustomEvent:           'readonly',
    DOMParser:             'readonly',
    MutationObserver:      'readonly',
    HTMLElement:           'readonly',
    AbortController:       'readonly',
    FormData:              'readonly',
    Blob:                  'readonly',
    Worker:                'readonly',
    WebAssembly:           'readonly',
    alert:                 'readonly',
    confirm:               'readonly',
    requestAnimationFrame: 'readonly',
};

export default [
    js.configs.recommended,

    // ─── Backend: src/, scripts/, utils/, server.js ───────────────────────────
    {
        files: ['src/**/*.js', 'scripts/**/*.js', 'utils/**/*.js', 'server.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: nodeGlobals,
        },
        rules: {
            'no-undef':      'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern:       '^_',
                varsIgnorePattern:       '^_',
                caughtErrorsIgnorePattern: '^_',
                caughtErrors:            'none',   // catch vars handled by caughtErrorsIgnorePattern
            }],
            'no-console':    'off',
        }
    },

    // ─── Frontend: js/ — ES Modules + browser globals ────────────────────────
    // no-undef es error (variables undefined son bugs reales).
    // El resto son warnings — pre-existentes, no bloquean CI.
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: browserGlobals,
        },
        rules: {
            'no-undef':              'error',
            'no-unused-vars':        ['warn', {
                argsIgnorePattern:         '^_',
                varsIgnorePattern:         '^_',
                caughtErrors:              'none',
            }],
            'no-useless-assignment': 'warn',
            'no-case-declarations':  'warn',
            'no-prototype-builtins': 'warn',
            'preserve-caught-error': 'off',
            'no-empty':              ['warn', { allowEmptyCatch: true }],
            'no-console':            'off',
        }
    },

    // ─── Tests: Node built-in test runner ────────────────────────────────────
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...nodeGlobals,
                before:     'readonly',
                after:      'readonly',
                beforeEach: 'readonly',
                afterEach:  'readonly',
            },
        },
        rules: {
            'no-undef':      'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern:         '^_',
                varsIgnorePattern:         '^_',
                caughtErrors:              'none',
            }],
            'no-console':    'off',
            'no-empty':      ['error', { allowEmptyCatch: true }],
        }
    },

    // ─── Ignorados ────────────────────────────────────────────────────────────
    {
        ignores: ['node_modules/**', 'dev/**', 'data/**']
    }
];
