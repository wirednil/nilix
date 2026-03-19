/**
 * @file PersistenceService.js
 * @description Servicio de persistencia de formularios en LocalStorage
 * @module PersistenceService
 * @version 1.0.0
 */

console.log("💾 PersistenceService.js: Cargando...");

/**
 * @class PersistenceService
 * @classdesc Maneja el guardado y recuperación de submissions de formularios
 */
class PersistenceService {
    /**
     * Guarda una submission de formulario en LocalStorage
     * @param {string} formId - ID del formulario (ej: "test-validation")
     * @param {Object} data - Datos del formulario (key-value pairs)
     * @returns {Object} Submission guardada con metadata
     */
    static save(formId, data) {
        try {
            const key = this.getStorageKey(formId);
            const existing = this.getAll(formId);

            const submission = {
                id: this.generateId(),
                formId: formId,
                data: data,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toLocaleString('es-ES')
            };

            existing.push(submission);
            localStorage.setItem(key, JSON.stringify(existing));

            console.log(`✅ Submission guardada:`, submission);
            return submission;

        } catch (error) {
            console.error('❌ Error guardando submission:', error);
            throw new Error('No se pudo guardar el formulario');
        }
    }

    /**
     * Obtiene todas las submissions de un formulario
     * @param {string} formId - ID del formulario
     * @returns {Array} Array de submissions
     */
    static getAll(formId) {
        try {
            const key = this.getStorageKey(formId);
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error leyendo submissions:', error);
            return [];
        }
    }

    /**
     * Obtiene una submission específica por ID
     * @param {string} formId - ID del formulario
     * @param {string} submissionId - ID de la submission
     * @returns {Object|null} Submission encontrada o null
     */
    static getById(formId, submissionId) {
        const all = this.getAll(formId);
        return all.find(s => s.id === submissionId) || null;
    }

    /**
     * Elimina una submission específica
     * @param {string} formId - ID del formulario
     * @param {string} submissionId - ID de la submission
     * @returns {boolean} True si se eliminó correctamente
     */
    static delete(formId, submissionId) {
        try {
            const key = this.getStorageKey(formId);
            const all = this.getAll(formId);
            const filtered = all.filter(s => s.id !== submissionId);

            localStorage.setItem(key, JSON.stringify(filtered));
            console.log(`✅ Submission ${submissionId} eliminada`);
            return true;

        } catch (error) {
            console.error('❌ Error eliminando submission:', error);
            return false;
        }
    }

    /**
     * Elimina todas las submissions de un formulario
     * @param {string} formId - ID del formulario
     * @returns {boolean} True si se eliminó correctamente
     */
    static deleteAll(formId) {
        try {
            const key = this.getStorageKey(formId);
            localStorage.removeItem(key);
            console.log(`✅ Todas las submissions de ${formId} eliminadas`);
            return true;

        } catch (error) {
            console.error('❌ Error eliminando submissions:', error);
            return false;
        }
    }

    /**
     * Cuenta el número de submissions de un formulario
     * @param {string} formId - ID del formulario
     * @returns {number} Número de submissions
     */
    static count(formId) {
        return this.getAll(formId).length;
    }

    /**
     * Exporta las submissions a formato CSV
     * @param {string} formId - ID del formulario
     * @param {string} filename - Nombre del archivo (opcional)
     */
    static exportCSV(formId, filename = null) {
        try {
            const submissions = this.getAll(formId);

            if (submissions.length === 0) {
                alert('No hay datos para exportar');
                return;
            }

            // Obtener todas las claves únicas de los datos
            const allKeys = new Set();
            submissions.forEach(s => {
                Object.keys(s.data).forEach(key => allKeys.add(key));
            });

            // Headers: metadata + campos del formulario
            const headers = ['ID', 'Fecha', ...Array.from(allKeys)];
            const csvRows = [headers.join(',')];

            // Datos
            submissions.forEach(submission => {
                const row = [
                    `"${submission.id}"`,
                    `"${submission.createdAt}"`,
                    ...Array.from(allKeys).map(key => {
                        const value = submission.data[key] || '';
                        // Escapar comillas y wrap en comillas si contiene comas
                        return `"${String(value).replace(/"/g, '""')}"`;
                    })
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

            this.downloadFile(blob, filename || `${formId}-${Date.now()}.csv`);
            console.log(`✅ CSV exportado: ${submissions.length} registros`);

        } catch (error) {
            console.error('❌ Error exportando CSV:', error);
            alert('Error al exportar CSV');
        }
    }

    /**
     * Exporta las submissions a formato JSON
     * @param {string} formId - ID del formulario
     * @param {string} filename - Nombre del archivo (opcional)
     */
    static exportJSON(formId, filename = null) {
        try {
            const submissions = this.getAll(formId);

            if (submissions.length === 0) {
                alert('No hay datos para exportar');
                return;
            }

            const jsonContent = JSON.stringify(submissions, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });

            this.downloadFile(blob, filename || `${formId}-${Date.now()}.json`);
            console.log(`✅ JSON exportado: ${submissions.length} registros`);

        } catch (error) {
            console.error('❌ Error exportando JSON:', error);
            alert('Error al exportar JSON');
        }
    }

    /**
     * Obtiene estadísticas de un formulario
     * @param {string} formId - ID del formulario
     * @returns {Object} Estadísticas
     */
    static getStats(formId) {
        const submissions = this.getAll(formId);

        if (submissions.length === 0) {
            return {
                total: 0,
                firstSubmission: null,
                lastSubmission: null
            };
        }

        return {
            total: submissions.length,
            firstSubmission: submissions[0].createdAt,
            lastSubmission: submissions[submissions.length - 1].createdAt,
            storageSize: this.getStorageSize(formId)
        };
    }

    /**
     * Obtiene el tamaño ocupado en LocalStorage
     * @param {string} formId - ID del formulario
     * @returns {string} Tamaño en formato legible
     */
    static getStorageSize(formId) {
        const key = this.getStorageKey(formId);
        const data = localStorage.getItem(key);
        if (!data) return '0 KB';

        const bytes = new Blob([data]).size;
        if (bytes < 1024) return `${bytes} bytes`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // ============================================
    // MÉTODOS PRIVADOS/AUXILIARES
    // ============================================

    /**
     * Genera una clave única para LocalStorage
     * @private
     */
    static getStorageKey(formId) {
        return `nilix-submissions-${formId}`;
    }

    /**
     * Genera un ID único para una submission
     * @private
     */
    static generateId() {
        return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Descarga un blob como archivo
     * @private
     */
    static downloadFile(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
}

export default PersistenceService;
