# ANÁLISIS DE PROYECTO: NILIX

## RESUMEN EJECUTIVO

Nilix es un renderizador de formularios web basado en XML, implementado con JavaScript vanilla y Node.js/Express. El proyecto cuenta con una arquitectura modular bien organizada y documentación precisa. Se identificaron patrones de "falso dinamismo" y discrepancias entre docs e implementación.

**Hallazgos principales:**
- El sistema de **handlers** es extensible con nombre de archivo coincidente
- La **invalidación de caché** ahora es dinámica mediante `result.invalidateTables`
- Los **datos de demostración** se cargan dinámicamente mediante `exp.js` (importa archivos TSV a SQLite)
- El **schema service** es verdaderamente dinámico (usa sqlite_master)
- La cobertura FDL real es ~60%
- La Zona de Claves NO está implementada completamente (solo detección parcial)

---

## CORRECCIONES AL ANÁLISIS ANTERIOR

| Punto | Análisis Anterior | Realidad Actual |
|-------|-------------------|-----------------|
| Cobertura | ~90% (incorrecto) | **~60%** (ya estaba correcto) |
| invalidateTables | Estático/hardcodeado | **✅ Dinámico** (implementado) |
| Zona de Claves | Parcialmente implementada | **❌ No implementada** (solo detección) |

---

## DISCREPANCIAS DOC VS CÓDIGO

### ANALYSIS-HIERARCHY.md vs Realidad

**Documentado:** 
- Línea 20: Cobertura: ~60%
- Líneas 391-400: v0.17.0 Zona de Claves (Próximo) - estado ⏳

**Real:**
- La cobertura de ~60% es correcta
- Zona de Claves está planificada pero NO implementada (solo existe `findKeyField()` para detección, no funcionalidad completa)

**Severidad:** Baja - La documentación está actualizada

---

### MANUAL-DESARROLLO.md vs Código

**Documentado:**
- Sección "Features Implementados" indica que `in tabla` (lookups) está implementado

**Real:**
- [`src/services/catalogService.js:4-21`](src/services/catalogService.js:4) usa consultas SQL reales contra SQLite
- [`src/services/schemaService.js:9-18`](src/services/schemaService.js:9) verifica tablas dinámicamente con `sqlite_master`
- El sistema **SÍ funciona** correctamente

**Severidad:** Ninguna - Documentación correcta

---

## HALLAZGOS DE DINAMISMO REAL (IMPLEMENTADO)

### 1. Cache Invalidation - ✅ DINÁMICO (v0.18.0)

**Descripción:**  
El sistema de caché ahora es verdaderamente dinámico, usando `result.invalidateTables` del handler.

**Evidencia:**
- [`js/components/FormRenderer.js:767-774`](js/components/FormRenderer.js:767):
```javascript
const invalidateTables = result.invalidateTables || [];
invalidateTables.forEach(table => {
    LookupService.invalidateCache(table);
});
```

- [`src/controllers/recordController.js:168-173`](src/controllers/recordController.js:168):
```javascript
const invalidateTables = handler?.invalidateTables || [];
if (result.updated) {
    res.json({ data: result.data || result, updated: true, invalidateTables });
}
```

**Impacto Positivo:**
- Los handlers definen qué tablas invalidar dinámicamente
- No hay tablas hardcodeadas en FormRenderer
- Sistema extensible sin modificar código core

---

### 2. Sistema de Datos (exp.js) - ✅ DINÁMICO

**Descripción:**  
El sistema usa `exp.js` para cargar datos desde archivos TSV dinámicamente.

**Evidencia:**
- [`utils/exp.js`](utils/exp.js): Sistema de importación de archivos TSV a SQLite
  - Carga datos desde archivos `.dat` o `.tsv`
  - Es el equivalente dinámico a la carga de datos
  - Permite agregar nuevos catálogos sin modificar código

- [`forms/demo/demo_clientes.dat`](forms/demo/demo_clientes.dat): Archivo de datos de demostración

**Impacto Positivo:**
- El sistema ES dinámico mediante `exp.js`
- Los archivos `.dat`/`.tsv` pueden modificarse sin cambiar código

---

### 3. Schema Service - ✅ DINÁMICO

**Descripción:**  
Detección automática de tablas usando metadatos de SQLite.

**Evidencia:**
- [`src/services/schemaService.js:9-18`](src/services/schemaService.js:9):
```javascript
function tableExists(tableName) {
    const db = getDatabase();
    const stmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    );
}
```

**Impacto Positivo:**
- Las tablas se detectan automáticamente
- No hay lista whitelist hardcodeada

---

## HALLAZGOS DE FALSO DINAMISMO

### 1. Sistema de Handlers - Severidad: Media

**Descripción:**  
Los handlers requieren nombres de archivo coincidentes con las tablas.

**Evidencia:**
- [`src/services/handlerService.js:13-27`](src/services/handlerService.js:13):
```javascript
const possibleNames = [
    `${tableName}.handler.js`,
    `${tableName}.js`,
    `demo_${tableName}.handler.js`
];
```

**Impacto:**
- No se pueden agregar nuevos handlers sin crear archivos con nombres específicos

**Recomendación:**
- Documentar la convención de nombres claramente
- Considerar registro central de handlers si se necesita más flexibilidad

---

### 2. Configuración de Base de Datos - Severidad: Media

**Descripción:**  
La base de datos usa SQLite en memoria (sql.js) - solución de desarrollo, no producción.

**Evidencia:**
- [`src/services/database.js:1-8`](src/services/database.js:1): Usa `sql.js` (SQLite en JavaScript)

**Impacto:**
- No es una base de datos real
- Limitado para uso en producción con múltiples usuarios

**Recomendación:**
1. Documentar que es solución de desarrollo
2. Proporcionar path para migrar a PostgreSQL/MySQL

---

## MÉTRICAS FINALES

| Métrica | Valor |
|---------|-------|
| % Componentes dinámicos implementados | 50% (3 de 6) |
| % Falso dinamismo residual | 17% (1 de 6 - handlers) |
| Documentación desactualizada | 0% |
| Riesgo general | **Bajo** |

---

## TABLA: DINAMISMO REAL vs FALSO

| Componente | Tipo | Notas |
|------------|------|-------|
| Cache invalidation (invalidateTables) | ✅ Dinámico | result.invalidateTables del handler |
| Carga de datos (exp.js) | ✅ Dinámico | Importa TSV a SQLite |
| Schema detection | ✅ Dinámico | sqlite_master |
| Carga de handlers | ⚠️ Parcial | Por nombre de archivo |
| Persistencia | ⚠️ Parcial | SQLite archivo local |

---

## ARCHIVOS DUPLICADOS ELIMINADOS

Se eliminaron 8 archivos .md duplicados de la raíz del proyecto:
- CHANGELOG.md → agent/03-reference/CHANGELOG.md
- CODE-MAP.md → agent/03-reference/CODE-MAP.md
- DEBUG-HORIZONTAL.md → agent/05-archive/DEBUG-HORIZONTAL.md
- DOCS-INDEX.md → agent/01-getting-started/DOCS-INDEX.md
- MANUAL-DESARROLLO.md → agent/02-development/MANUAL-DESARROLLO.md
- MForm-progress.md → agent/05-archive/MForm-progress.md
- PASOS-CRITICOS-COMPLETADOS.md → agent/05-archive/PASOS-CRITICOS-COMPLETADOS.md
- ROADMAP.md → agent/02-development/ROADMAP.md

## ESTRATEGIA DE MODULARIZACIÓN

Ver [`agent/DESIGN-STRATEGY.md`](DESIGN-STRATEGY.md) para plan a futuro de refactorización.

**Nueva estructura agent/:**
```
agent/
├── ANALYSIS-HIERARCHY.md     # Archivo raíz de análisis global
├── ANALYSIS-PROJECT.md       # Este análisis
├── MForm.txt
├── 01-getting-started/
├── 02-development/
├── 03-reference/
├── 04-guides/
├── 05-archive/
├── sessions/
└── specs/
```

---

**Fecha de análisis:** 2026-02-21  
**Analista:** Claude Code (Deep Analyzer Mode)  
**Versión analizada:** Nilix v0.18.0
