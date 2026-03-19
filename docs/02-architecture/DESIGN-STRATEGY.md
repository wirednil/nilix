# ESTRATEGIA DE DISEÑO Y MODULARIZACIÓN

## NILIX v0.18.1

---

## 1. ANÁLISIS DEL ESTADO ACTUAL

### 1.1 Problemas de Arquitectura Identificados

| Problema | Gravedad | Archivo(s) | Impacto |
|----------|----------|------------|---------|
| **God Object: FormRenderer** | 🔴 Alta | `js/components/FormRenderer.js` (871 líneas) | Difícil mantener, testing imposible |
| **Handlers sin interfaz definida** | 🟡 Media | `handlers/*.handler.js` | Sin validación, difícil extender |
| **Nombres confusos servicios** | 🟡 Media | `RecordService.js` (frontend) vs `recordService.js` (backend) | Confusión para devs |
| **Lógica de validación mezclada** | 🟡 Media | `FormRenderer.js` + `validator.js` | Acoplamiento fuerte |
| **Duplicación LookupService/TableCache** | 🟢 Baja | `js/services/LookupService.js`, `TableCache.js` | Funcionalidad solapada |

### 1.2 Métricas de Código

```
Archivo                    Líneas   Responsabilidades
────────────────────────────────────────────────────────────────
FormRenderer.js            871      ~8 (render, validate, events, DOM, etc.)
Autocomplete.js           375      ~4 (UI, search, cache, keyboard)
ExpressionEngine.js       338      ~3 (parse, evaluate, functions)
recordController.js       330      ~5 (CRUD, handlers, responses)
```

---

## 2. PROPUESTA DE MODULARIZACIÓN

### 2.1 Refactorización de FormRenderer

**Estrategia:** Extraer responsabilidades en módulos separados

```
js/components/FormRenderer/
├── index.js              # Re-exports, configuración global
├── FormRenderer.js       # Clase principal (reduce ~400 líneas)
├── core/
│   ├── Renderer.js      # Lógica de renderizado puro
│   ├── LayoutProcessor.js # Procesamiento de layout XML
│   └── FieldFactory.js  # Factory para crear campos
├── validation/
│   ├── FormValidator.js # Orchestrator de validación
│   └── rules/           # Reglas de validación
├── events/
│   ├── SubmitHandler.js # Manejo de submit
│   └── KeyboardHandler.js # Navegación con teclas
└── handlers/
    └── HandlerBridge.js # Comunicación con handlers server
```

**Beneficios esperados:**
- Reducir FormRenderer.js de 871 → ~300 líneas
- Testing unitario posible por módulo
- Responsabilidades claras y bien definidas

### 2.2 Sistema de Handlers Mejorado

**Actualmente:**
```javascript
// handlers/producto_nuevo.handler.js
module.exports = {
    table: 'demo_productos',
    keyField: 'id',
    invalidateTables: ['...'],
    after(fieldId, value, data, db) { /* ... */ },
    beforeSave(data, db) { /* ... */ }
}
```

**Propuesta - Handler Framework:**
```javascript
// handlers/base/Handler.js (clase base)
class BaseHandler {
    constructor(config) {
        this.table = config.table;
        this.keyField = config.keyField;
        this.invalidateTables = config.invalidateTables || [];
    }
    
    // Hooks lifecycle
    onInit(context) { }      // Se ejecuta al cargar
    onFieldChange(fieldId, value, context) { }  // after()
    onBeforeSave(data, context) { }  // beforeSave()
    onAfterSave(result, context) { }
    onError(error, context) { }
}

// validators/ - Validaciones centralizadas
// middlewares/ - Logging, auth, transform
// hooks/ - before/after específicos
```

### 2.3 Consolidación de Servicios

**Propuesta de consolidación:**

| Actual | Propuesta | Razón |
|--------|-----------|-------|
| `LookupService.js` + `TableCache.js` | `CatalogService.js` | Unificar acceso a catálogos |
| `RecordService.js` (frontend) | `FormDataService.js` | Nombre más descriptivo |
| `recordService.js` (backend) | `DataAccessObject.js` | Separar lógica de acceso |

---

## 3. ESTRATEGIA DE IMPLEMENTACIÓN

### 3.1 Fases de Refactorización

**Fase 1: Extracción de FormRenderer** (Prioridad Alta)
1. Crear estructura de carpetas `js/components/FormRenderer/core/`
2. Mover `LayoutProcessor.js` → nuevo directorio
3. Crear `FieldFactory.js`
4. Actualizar imports en `index.js`

**Fase 2: Sistema de Handlers** (Prioridad Media)
1. Crear `handlers/base/Handler.js`
2. Definir interfaz/clase base
3. Migrar handlers existentes gradualmente
4. Agregar validación de estructura

**Fase 3: Consistencia de Nombres** (Prioridad Baja)
1. Renombrar servicios con prefijos claros
2. Actualizar imports
3. Documentar convención

### 3.2 Reglas de Diseño

1. **SRP (Single Responsibility):** Cada módulo tiene una única razón para cambiar
2. **OCP (Open/Closed):** Abierto para extensión, cerrado para modificación
3. **DIP (Dependency Inversion):** Depender de abstracciones, no de concreciones
4. **Cohesión alta, acoplamiento bajo:** Módulos relacionados juntos, dependencias explícitas

---

## 4. PUNTOS DE EXTENSIÓN

### 4.1 Sistema de Plugins (Futuro)

```javascript
// Plugin API propuesta
const plugin = {
    name: 'mi-plugin',
    version: '1.0.0',
    
    // Hooks disponibles
    hooks: {
        'form:render:before': (formConfig) => {},
        'field:render': (fieldConfig, fieldElement) => {},
        'validate:field': (value, rules) => {},
        'submit:before': (formData) => {}
    },
    
    // Servicios que provee
    services: {
        myService: class MyService { /* ... */ }
    }
};

// Registro
PluginManager.register(plugin);
```

### 4.2 Extensiones Recomendadas para v0.19+

| Extensión | Tipo | Prioridad |
|-----------|------|-----------|
| Zona de Claves | Feature | Alta |
| Campos Virtuales | Feature | Media |
| Sistema de Plugins | Arquitectura | Baja |

---

## 5. RECOMENDACIONES INMEDIATAS

### 5.1 Acciones de Bajo Riesgo/Alto Impacto

1. **Documentar la estructura actual** - Crear JSDoc en FormRenderer
2. **Extraer expresiones regex** - Mover a constants.js
3. **Agregar TypeScript gradualmente** - Empezar por tipos interfaces
4. **Crear tests unitarios** - Empezar por servicios pequeños

### 5.2 NO Hacer (Anti-patterns)

- ❌ No reescribir todo desde cero
- ❌ No agregar framework (React/Vue) - mantener vanilla
- ❌ No sobre-ingeniería - mantener simple lo que funciona
- ❌ No romper backward compatibility - mantener API estable

---

## 6. CRITERIOS DE ÉXITO

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Líneas en FormRenderer.js | 871 | < 400 |
| Test coverage | 0% | > 30% |
| Handlers con clase base | 0% | 100% |
| Documentación de APIs | Parcial | Completa |

---

**Fecha:** 2026-02-22
**Tipo:** Estrategia de Arquitectura
**Estado:** Propuesta - requiere validación
