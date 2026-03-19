# 📚 ÍNDICE DE DOCUMENTACIÓN - NILIX

**Última actualización:** 2026-03-11

Este es el **punto de entrada** a toda la documentación del proyecto.

---

## 🎯 ¿QUÉ DOCUMENTO LEER?

### 🆕 Primera Vez en el Proyecto

**Lee primero:** [`README.md`](README.md)

- ✅ Quick start (cómo iniciar servidor)
- ✅ Qué funciona hoy
- ✅ Ejemplos de XML
- ✅ Estilos terminal/brutalist
- ✅ Testing básico

**Tiempo estimado:** 10-15 minutos

---

### 💻 Quiero Implementar un Feature

**Lee primero:** [`MANUAL-DESARROLLO.md`](MANUAL-DESARROLLO.md)

Luego consulta:
- [`CODE-MAP.md`](CODE-MAP.md) - Para encontrar líneas exactas
- [`ROADMAP.md`](ROADMAP.md) - Para plan de implementación paso a paso

**Contenido MANUAL-DESARROLLO.md:**
- ✅ Arquitectura completa del proyecto
- ✅ Mapeo NILIX FDL → Nilix XML
- ✅ Features implementados vs faltantes
- ✅ Guía: Dónde hacer cada tipo de cambio
- ✅ Problemas comunes y soluciones

**Tiempo estimado:** 30-45 minutos

---

### 🔍 Busco una Línea de Código Específica

**Consulta directamente:** [`CODE-MAP.md`](CODE-MAP.md)

**Contenido:**
- 📍 FormRenderer.js - Índice completo con líneas exactas
- 📍 styles.css - Índice de estilos con líneas
- 📍 Validator.js - Métodos de validación
- 📍 ExpressionEngine.js - Evaluación de expresiones
- 🎯 Quick reference para cambios comunes

**Ejemplo de búsqueda:**
- "¿Dónde se renderiza el help tooltip?" → FormRenderer.js:346-388
- "¿Dónde cambiar el color del help icon?" → styles.css:475
- "¿Dónde se detecta multifield → textarea?" → FormRenderer.js:744

**Tiempo estimado:** 2-5 minutos

---

### 🗺️ Quiero Ver el Roadmap

**Lee:** [`ROADMAP.md`](ROADMAP.md)

**Contenido:**
- 🔴 Features críticos (implementar primero)
- 🟡 Features importantes (segunda fase)
- 🟢 Features deseables (tercera fase)
- 📋 Implementación paso a paso de `type="select"`
- 📋 Implementación paso a paso de atributo `is`
- 📋 Implementación paso a paso de backend API
- 📊 Matriz de prioridades (impacto vs complejidad)
- 🎯 Sprints sugeridos

**Tiempo estimado:** 20-30 minutos

---

### 📖 Necesito Entender Multifields

**Lee:** [`docs/04-guides/MULTIFIELD-GUIDE.md`](../04-guides/MULTIFIELD-GUIDE.md)

**Contenido:**
- ✅ Qué es un multifield
- ✅ Fase 1: Multifield → Textarea (1 campo hijo)
- ✅ Fase 2: Multifield → Grid (múltiples campos)
- ✅ Detección automática
- ✅ Ejemplos completos
- ✅ Estilos CSS
- ✅ Comparación de sintaxis

**Tiempo estimado:** 10-15 minutos

---

### 📜 Necesito Ver la Spec Original

**Consulta:** [`docs/07-archive/MForm.md`](../07-archive/MForm.md)

**Secciones clave:**
- Línea 195: La Sección %fields
- Línea 431: Subformularios
- Línea 443: Campos Múltiples
- Línea 453: Atributos de Campos Múltiples
- Línea 295: Atributo `is` (campos virtuales)
- Línea 315: Atributo `in table` (lookups)

**Advertencia:** Documento largo (~1000 líneas). Usar búsqueda (Ctrl+F) para encontrar temas específicos.

---

## 📁 ESTRUCTURA DE LA DOCUMENTACIÓN

```
nilix/
├── docs/
│   ├── 01-getting-started/
│   │   ├── README.md            ← 🆕 INICIO AQUÍ
│   │   └── DOCS-INDEX.md        ← Este archivo (índice)
│   ├── 02-architecture/
│   │   ├── ANALYSIS-HIERARCHY.md
│   │   ├── CONTEXT.md
│   │   └── SECURITY-AUDIT-PLAN.md
│   ├── 03-reference/
│   │   ├── CODE-MAP.md          ← 🗺️ Mapa de líneas de código
│   │   ├── AUTH.md              ← 🔐 Autenticación HttpOnly cookie
│   │   ├── CHANGELOG.md
│   │   └── COMPARATIVA-NILENGINE-vs-NILIX.md
│   ├── 04-guides/
│   │   └── MULTIFIELD-GUIDE.md  ← 📊 Guía de multifields
│   ├── 06-development/
│   │   ├── MANUAL-DESARROLLO.md ← 📘 Manual exhaustivo
│   │   └── ROADMAP.md           ← 🚀 Plan de features faltantes
│   └── 07-archive/
│       └── MForm.md             ← 📜 Spec NILENGINE FDL original
└── forms/                       # Motor: login.xml (parte del repo)
```

---

## 🎯 ESCENARIOS COMUNES

### Escenario 1: "Soy nuevo, quiero entender el proyecto"

1. ✅ Lee [`README.md`](README.md) (10 min)
2. ✅ Inicia servidor: `node server.js`
3. ✅ Abre: `http://localhost:3000` (login: admin/demo1234)
4. ✅ Prueba el POS: selecciona "Punto de Venta" en el menú
5. ✅ Lee [`MANUAL-DESARROLLO.md`](../06-development/MANUAL-DESARROLLO.md) (30 min)

**Tiempo total:** ~45 minutos

---

### Escenario 2: "Quiero implementar campos select"

1. ✅ Lee [`ROADMAP.md`](ROADMAP.md) sección "FEATURE 1: type=select" (5 min)
2. ✅ Consulta [`CODE-MAP.md`](CODE-MAP.md) para ubicar líneas (2 min)
3. ✅ Implementa según pasos en ROADMAP
4. ✅ Actualiza [`MANUAL-DESARROLLO.md`](MANUAL-DESARROLLO.md) sección "Campos Básicos"

**Tiempo total:** ~2-3 horas (implementación + testing + docs)

---

### Escenario 3: "Tengo un bug con tooltips"

1. ✅ Consulta [`MANUAL-DESARROLLO.md`](MANUAL-DESARROLLO.md) sección "DEBUGGING: PROBLEMAS COMUNES"
2. ✅ Lee subsección "Problema: El tooltip no se muestra"
3. ✅ Consulta [`CODE-MAP.md`](CODE-MAP.md) líneas exactas:
   - FormRenderer.js:382 (stopPropagation)
   - styles.css:260 (overflow visible)
   - styles.css:520 (z-index)

**Tiempo total:** ~10-20 minutos

---

### Escenario 4: "¿Cómo cambio el color del help icon?"

**Respuesta rápida:**

[`CODE-MAP.md`](CODE-MAP.md) → Sección "Cambio: Modificar color theme"

**Archivo:** `css/styles.css` línea ~475

```css
.help-icon {
    color: #00aaff; /* Cambiar de #00ff00 a azul */
}
```

**Tiempo total:** 2 minutos

---

### Escenario 5: "¿Estamos listos para producción?"

1. Lee [`PRODUCTION-READINESS-PLAN.md`](../06-development/PRODUCTION-READINESS-PLAN.md) Sección 0 (Auditoría — estado actual)
2. Verifica madurez global estimada y tabla de próximos pasos
3. Ejecuta `node scripts/check.js` para validación automatizada del entorno

**Tiempo total:** ~10 minutos

---

### Escenario 6: "Volvemos a hablar después de semanas"

**Lee primero:** Este archivo (DOCS-INDEX.md) para recordar estructura

**Luego revisa:**
1. [`README.md`](README.md) sección "Estado del Proyecto" (qué está hecho)
2. [`ROADMAP.md`](ROADMAP.md) sección "Métricas de Progreso" (qué falta)
3. [`MANUAL-DESARROLLO.md`](MANUAL-DESARROLLO.md) sección "Features Implementados" (resumen completo)

**Tiempo total:** ~15 minutos

---

## 📊 MATRIZ DE DOCUMENTOS

| Documento | Propósito | Audiencia | Actualización |
|-----------|-----------|-----------|---------------|
| README.md | Inicio rápido | Todos | Cada feature |
| MANUAL-DESARROLLO.md | Referencia completa | Desarrolladores | Cada feature |
| CODE-MAP.md | Navegación de código | Desarrolladores | Cada cambio |
| ROADMAP.md | Plan de features | Desarrolladores | Cada sprint |
| MULTIFIELD-GUIDE.md | Guía específica | Desarrolladores | Cuando cambie multifields |
| PRODUCTION-READINESS-PLAN.md | Plan de madurez + auditoría de producción | Tech lead / DevOps | Al completar fases o auditorías |
| DOCS-INDEX.md | Punto de entrada | Todos | Cuando se agregue doc |
| MForm.md | Spec FDL | Referencia | No (documento original) |

---

## 🔍 BÚSQUEDA RÁPIDA

### Por Keyword

| Busco... | Documento | Sección |
|----------|-----------|---------|
| **Cómo iniciar** | README.md | Quick Start |
| **Multifield detection** | MULTIFIELD-GUIDE.md | Detección Automática |
| **Date field width** | CODE-MAP.md | FormRenderer.js:417 |
| **Help tooltip** | CODE-MAP.md | FormRenderer.js:346-388 |
| **Validaciones** | MANUAL-DESARROLLO.md | Features Implementados → 6. Validaciones |
| **Estilos brutalist** | README.md | Estilo Terminal/Brutalist |
| **Atributo `is`** | ROADMAP.md | FEATURE 2: Atributo is |
| **Backend API** | ROADMAP.md | FEATURE 3: Backend API |
| **Spec FDL** | MForm.md | (buscar con Ctrl+F) |
| **Dónde hacer cambio X** | MANUAL-DESARROLLO.md | GUÍA: DÓNDE HACER CADA TIPO DE CAMBIO |

---

## 📖 ORDEN DE LECTURA RECOMENDADO

### Para Usuarios (Solo usar formularios)

1. README.md (10 min)
   - Quick Start
   - Ejemplos completos

**Total:** 10 minutos

---

### Para Desarrolladores Frontend

1. README.md (10 min)
2. MANUAL-DESARROLLO.md (45 min)
   - Arquitectura
   - Features implementados
   - Guía de modificaciones
3. CODE-MAP.md (15 min)
   - Explorar índices de FormRenderer.js y styles.css
4. ROADMAP.md (20 min)
   - Features faltantes
   - Prioridades

**Total:** ~90 minutos

---

### Para Arquitectos / Code Reviewers

1. MANUAL-DESARROLLO.md (60 min)
   - TODO el documento
2. CODE-MAP.md (30 min)
   - Revisar estructura de cada archivo
3. ROADMAP.md (30 min)
   - Plan técnico de features
4. MForm.md (60 min)
   - Entender spec FDL original

**Total:** ~3 horas

---

## 🔄 MANTENIMIENTO DE DOCS

### Cuándo Actualizar Cada Documento

#### README.md
- ✅ Cada feature nuevo implementado (agregar ejemplo)
- ✅ Cambio en quick start
- ✅ Nueva limitación descubierta

#### MANUAL-DESARROLLO.md
- ✅ Cada feature nuevo (agregar a tabla de implementados)
- ✅ Nueva guía de "Dónde hacer cambio"
- ✅ Bug común descubierto (agregar a Debugging)
- ✅ Cambio de arquitectura

#### CODE-MAP.md
- ✅ Cada cambio en FormRenderer.js (actualizar líneas)
- ✅ Nuevos métodos agregados
- ✅ Cambios significativos en styles.css

#### ROADMAP.md
- ✅ Feature completado (mover a "Implementados" en MANUAL)
- ✅ Nueva prioridad identificada
- ✅ Cambio en estimaciones
- ✅ Cada sprint completado

#### MULTIFIELD-GUIDE.md
- ✅ Cambio en detección de multifields
- ✅ Nuevo tipo de multifield
- ✅ Cambio en renderizado

#### DOCS-INDEX.md (este archivo)
- ✅ Nuevo documento agregado
- ✅ Cambio en estructura de carpetas
- ✅ Nuevo escenario común identificado

---

## 🎓 CONVENCIONES DE DOCUMENTACIÓN

### Formato de Headers

```markdown
# Título Principal (H1) - Solo uno por documento
## Sección Mayor (H2)
### Subsección (H3)
#### Detalle (H4)
```

### Emojis Estándar

| Emoji | Significado |
|-------|-------------|
| ✅ | Implementado / Completo / Sí |
| ❌ | No implementado / Falta / No |
| ⚠️ | Advertencia / Parcial / Cuidado |
| 🔴 | Prioridad CRÍTICA |
| 🟡 | Prioridad IMPORTANTE |
| 🟢 | Prioridad DESEABLE |
| 📍 | Línea de código / Ubicación |
| 🔍 | Búsqueda / Encontrar |
| 📁 | Archivo / Carpeta |
| 🎯 | Objetivo / Meta |
| 🚀 | Roadmap / Próximos pasos |

### Code Blocks

````markdown
```javascript
// Código JavaScript con sintaxis highlighting
const foo = 'bar';
```

```xml
<!-- XML con sintaxis highlighting -->
<field id="campo" type="text"/>
```

```bash
# Comandos bash
node server.js
```
````

---

## 📝 CHANGELOG DE DOCUMENTACIÓN

### 2026-02-01 - Creación inicial

**Documentos creados:**
- ✅ README.md
- ✅ MANUAL-DESARROLLO.md
- ✅ CODE-MAP.md
- ✅ ROADMAP.md
- ✅ DOCS-INDEX.md (este archivo)

**Documentos existentes:**
- ✅ docs/04-guides/MULTIFIELD-GUIDE.md
- ✅ docs/07-archive/MForm.md (spec FDL)

**Total:** 4 documentos nuevos + 2 existentes = 6 documentos

**Palabras totales:** ~25,000 palabras

---

## 🎯 RESUMEN EJECUTIVO

### ¿Qué es Nilix?
Motor de aplicaciones de negocio con estética terminal, con diseño terminal/brutalist.

### Documentación Disponible
- **README.md** - Inicio rápido (10 min)
- **MANUAL-DESARROLLO.md** - Manual completo (45 min)
- **CODE-MAP.md** - Mapa de código (navegación instantánea)
- **ROADMAP.md** - Plan de features (20 min)
- **MULTIFIELD-GUIDE.md** - Guía de multifields (10 min)
- **MForm.md** - Spec FDL (referencia)

### Próximos Pasos
1. Lee README.md
2. Prueba el proyecto
3. Consulta MANUAL-DESARROLLO.md para desarrollo
4. Usa CODE-MAP.md para navegación rápida
5. Sigue ROADMAP.md para implementar features

---

## 🆘 ¿PERDIDO?

### Si no encuentras algo:

1. **Busca en este índice** (Ctrl+F)
2. **Consulta "BÚSQUEDA RÁPIDA"** (arriba)
3. **Revisa "ESCENARIOS COMUNES"** (arriba)
4. **Grep en todos los docs:**
   ```bash
   grep -r "keyword" *.md forms/*.md
   ```

### Si sigue sin encontrarse:

Probablemente necesite documentarse. Agrega a este índice y al documento correspondiente.

---

**Última actualización:** 2026-03-11
**Mantenido por:** Claude Code
**Próxima revisión:** Cuando se complete Sprint 1

---

## 📞 CONTACTO

Para preguntas sobre la documentación o sugerencias de mejora, revisar los siguientes documentos en orden:

1. Este índice (DOCS-INDEX.md)
2. README.md
3. MANUAL-DESARROLLO.md

Si la duda persiste, consultar MForm.md (spec FDL).

---

**¡Bienvenido a Nilix! 🚀**
