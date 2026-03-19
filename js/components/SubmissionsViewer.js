/**
 * @file SubmissionsViewer.js
 * @description Componente para visualizar y exportar submissions guardadas
 * @module SubmissionsViewer
 * @version 1.0.0
 */

console.log("📊 SubmissionsViewer.js: Cargando...");

import { createElement } from '../utils/domUtils.js';
import PersistenceService from '../services/PersistenceService.js';

/**
 * @class SubmissionsViewer
 * @classdesc Muestra las submissions de un formulario y permite exportarlas
 */
class SubmissionsViewer {
    /**
     * @constructor
     * @param {HTMLElement} container - Contenedor donde se renderizará
     * @param {string} formId - ID del formulario
     */
    constructor(container, formId) {
        this.container = container;
        this.formId = formId;
    }

    /**
     * Renderiza el visor de submissions
     */
    render() {
        const submissions = PersistenceService.getAll(this.formId);
        const stats = PersistenceService.getStats(this.formId);

        this.container.innerHTML = '';

        // Header con estadísticas
        const header = this.createHeader(stats);
        this.container.appendChild(header);

        // Botones de acción
        const actions = this.createActionButtons();
        this.container.appendChild(actions);

        // Lista de submissions
        if (submissions.length === 0) {
            this.container.appendChild(this.createEmptyState());
        } else {
            const list = this.createSubmissionsList(submissions);
            this.container.appendChild(list);
        }
    }

    /**
     * Crea el header con estadísticas
     * @private
     */
    createHeader(stats) {
        const header = createElement('div', 'submissions-header');

        header.innerHTML = `
            <h3>📊 Submissions Guardadas</h3>
            <div class="stats">
                <span>Total: <strong>${stats.total}</strong></span>
                ${stats.total > 0 ? `
                    <span>Primera: ${stats.firstSubmission}</span>
                    <span>Última: ${stats.lastSubmission}</span>
                    <span>Espacio: ${stats.storageSize}</span>
                ` : ''}
            </div>
        `;

        return header;
    }

    /**
     * Crea los botones de acción
     * @private
     */
    createActionButtons() {
        const actions = createElement('div', 'submissions-actions');

        const exportCSVBtn = createElement('button', 'btn-export', 'Exportar CSV');
        exportCSVBtn.onclick = () => this.exportCSV();

        const exportJSONBtn = createElement('button', 'btn-export', 'Exportar JSON');
        exportJSONBtn.onclick = () => this.exportJSON();

        const deleteAllBtn = createElement('button', 'btn-delete-all', 'Eliminar Todas');
        deleteAllBtn.onclick = () => this.deleteAll();

        const refreshBtn = createElement('button', 'btn-refresh', 'Refrescar');
        refreshBtn.onclick = () => this.render();

        actions.appendChild(exportCSVBtn);
        actions.appendChild(exportJSONBtn);
        actions.appendChild(deleteAllBtn);
        actions.appendChild(refreshBtn);

        return actions;
    }

    /**
     * Crea la lista de submissions
     * @private
     */
    createSubmissionsList(submissions) {
        const list = createElement('div', 'submissions-list');

        // Mostrar las últimas 10 submissions (más recientes primero)
        const recent = submissions.slice(-10).reverse();

        recent.forEach(submission => {
            const item = this.createSubmissionItem(submission);
            list.appendChild(item);
        });

        if (submissions.length > 10) {
            const moreInfo = createElement('p', 'submissions-info',
                `Mostrando las 10 más recientes de ${submissions.length} totales`
            );
            list.appendChild(moreInfo);
        }

        return list;
    }

    /**
     * Crea un item de submission
     * @private
     */
    createSubmissionItem(submission) {
        const item = createElement('div', 'submission-item');

        const header = createElement('div', 'submission-item-header');
        const idSpan = createElement('span', 'submission-id');
        idSpan.textContent = submission.id;
        const dateSpan = createElement('span', 'submission-date');
        dateSpan.textContent = submission.createdAt;
        header.appendChild(idSpan);
        header.appendChild(dateSpan);

        const data = createElement('div', 'submission-item-data');
        const label = createElement('strong');
        label.textContent = 'Datos: ';
        data.appendChild(label);
        data.appendChild(document.createTextNode(
            Object.entries(submission.data)
                .map(([key, value]) => `${key}: "${value}"`)
                .join(', ')
        ));

        const deleteBtn = createElement('button', 'btn-delete-item', '🗑️');
        deleteBtn.title = 'Eliminar';
        deleteBtn.onclick = () => this.deleteSubmission(submission.id);

        item.appendChild(header);
        item.appendChild(data);
        item.appendChild(deleteBtn);

        return item;
    }

    /**
     * Crea el estado vacío
     * @private
     */
    createEmptyState() {
        const empty = createElement('div', 'submissions-empty');
        empty.innerHTML = `
            <p>📭 No hay submissions guardadas aún.</p>
            <p>Completa y envía el formulario para ver los datos aquí.</p>
        `;
        return empty;
    }

    /**
     * Exporta a CSV
     */
    exportCSV() {
        PersistenceService.exportCSV(this.formId);
    }

    /**
     * Exporta a JSON
     */
    exportJSON() {
        PersistenceService.exportJSON(this.formId);
    }

    /**
     * Elimina una submission específica
     */
    deleteSubmission(submissionId) {
        if (confirm('¿Eliminar esta submission?')) {
            PersistenceService.delete(this.formId, submissionId);
            this.render(); // Refrescar vista
        }
    }

    /**
     * Elimina todas las submissions
     */
    deleteAll() {
        const count = PersistenceService.count(this.formId);
        if (count === 0) {
            alert('No hay submissions para eliminar');
            return;
        }

        if (confirm(`¿Eliminar todas las ${count} submissions? Esta acción no se puede deshacer.`)) {
            PersistenceService.deleteAll(this.formId);
            this.render(); // Refrescar vista
        }
    }
}

export default SubmissionsViewer;
