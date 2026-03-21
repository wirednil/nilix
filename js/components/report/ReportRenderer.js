/**
 * ReportRenderer.js
 * Render report zones to HTML
 */

import { ExpressionEvaluator } from './ExpressionEvaluator.js';

export class ReportRenderer {
    constructor() {
        this.evaluator = new ExpressionEvaluator();
        this.renderedZones = new Set();
    }

    renderZone(zone, context, options = {}) {
        if (zone.noPrint) {
            return null;
        }

        const flatContext = Array.isArray(context) ? (context[0] ?? {}) : context;
        if (zone.ifCondition && !this.evaluator.evaluateCondition(zone.ifCondition, flatContext)) {
            return null;
        }

        const zoneType = this.determineZoneType(zone);
        
        switch (zoneType) {
            case 'header':
                return this.renderHeaderZone(zone, context);
            case 'footer':
                return this.renderFooterZone(zone, context, options.accumulators);
            case 'nav':
                return this.renderNavZone(zone, context);
            case 'separator':
                return this.renderSeparatorZone(zone, context);
            case 'subtotal':
                return this.renderSubtotalZone(zone, context, options.accumulators, options.breakLevel);
            case 'card':
                return this.renderCardZone(zone, context);
            case 'lines':
                return this.renderLinesZone(zone, context, options.accumulators, options.breakLevel);
            case 'table':
                return this.renderTableZone(zone, context);
            case 'detail':
            default:
                return this.renderDetailZone(zone, context);
        }
    }

    determineZoneType(zone) {
        if (!zone.printCondition) {
            if (zone.layout === 'lines') return 'lines';
            if (zone.layout === 'table') return 'table';
            return 'detail';
        }

        const triggers = zone.printCondition.triggers;
        const hasReportTrigger = triggers.some(t => t.type === 'report');
        const hasPageTrigger = triggers.some(t => t.type === 'page');
        const hasFieldTrigger = triggers.some(t => t.type === 'field');

        if (hasReportTrigger && zone.printCondition.when === 'before') {
            if (zone.layout === 'horizontal-scroll') return 'nav';
            if (zone.layout === 'lines') return 'lines';
            return 'header';
        }
        
        if (hasReportTrigger && zone.printCondition.when === 'after') {
            if (zone.layout === 'lines') return 'lines';
            return 'footer';
        }

        if (hasFieldTrigger && zone.printCondition.when === 'before') {
            if (zone.layout === 'lines') return 'lines';
            return 'separator';
        }

        if (hasFieldTrigger && zone.printCondition.when === 'after') {
            if (zone.layout === 'lines') return 'lines';
            return 'subtotal';
        }

        if (zone.layout === 'lines') return 'lines';
        return 'detail';
    }

    renderHeaderZone(zone, context) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context);
        
        const header = document.createElement('div');
        header.className = 'report-header';
        header.dataset.zone = zone.name;

        zone.template.forEach(line => {
            const p = document.createElement('div');
            p.className = 'report-header-line';
            p.textContent = this.evaluator.evaluate(line, evaluatedContext);
            header.appendChild(p);
        });

        this.renderedZones.add(zone.name);
        return header;
    }

    renderSubtotalZone(zone, context, accumulators, breakLevel) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context, accumulators, breakLevel);

        const el = document.createElement('div');
        el.className = 'report-subtotal';
        el.dataset.zone = zone.name;

        zone.template.forEach(line => {
            const p = document.createElement('div');
            p.className = 'report-subtotal-line';
            p.textContent = this.evaluator.evaluate(line, evaluatedContext);
            el.appendChild(p);
        });

        return el;
    }

    renderFooterZone(zone, context, accumulators = null) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context, accumulators, null);
        
        const footer = document.createElement('div');
        footer.className = 'report-footer';
        footer.dataset.zone = zone.name;

        zone.template.forEach(line => {
            const p = document.createElement('div');
            p.className = 'report-footer-line';
            p.textContent = this.evaluator.evaluate(line, evaluatedContext);
            footer.appendChild(p);
        });

        this.renderedZones.add(zone.name);
        return footer;
    }

    renderNavZone(zone, context) {
        const nav = document.createElement('nav');
        nav.className = 'report-nav';
        nav.dataset.zone = zone.name;

        const container = document.createElement('div');
        container.className = 'report-nav-scroll';

        if (Array.isArray(context)) {
            context.forEach((item, index) => {
                const evaluatedContext = this.evaluateExpressions(zone.expressions, item);
                const catId = item.cat_id ?? item.id;

                const link = document.createElement('a');
                link.href = `#category-${catId}`;
                link.className = 'report-nav-item';
                if (index === 0) link.classList.add('active');

                zone.template.forEach(line => {
                    link.textContent = this.evaluator.evaluate(line, evaluatedContext);
                });

                link.addEventListener('click', () => {
                    container.querySelectorAll('.report-nav-item').forEach(el => el.classList.remove('active'));
                    link.classList.add('active');
                });

                container.appendChild(link);
            });
        }

        nav.appendChild(container);
        return nav;
    }

    renderSeparatorZone(zone, context) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context);
        const categoryId = context.prod_id_categoria ?? 
                          context.id_categoria ?? 
                          context.cat_id ?? 
                          context.id_categoria ?? 
                          context.id;

        const separator = document.createElement('div');
        separator.className = 'report-separator';
        separator.dataset.zone = zone.name;
        separator.id = `category-${categoryId}`;
        separator.dataset.category = categoryId;

        zone.template.forEach(line => {
            const evaluated = this.evaluator.evaluate(line, evaluatedContext);
            
            // Check for separator line
            if (evaluated === '---SEPARATOR---' || line.trim() === '---') {
                const hr = document.createElement('hr');
                hr.className = 'report-separator-hr';
                separator.appendChild(hr);
                return;
            }
            
            const p = document.createElement('div');
            p.className = 'report-separator-line';
            
            // Check for centered text (starts/ends with spaces)
            if (line !== line.trim() && line.trim() !== '') {
                p.classList.add('report-separator-center');
            }
            
            if (evaluated.trim() === '') {
                p.innerHTML = '&nbsp;';
            } else {
                p.textContent = evaluated;
            }
            
            separator.appendChild(p);
        });

        return separator;
    }

    renderCardZone(zone, context) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context);

        const card = document.createElement('div');
        card.className = 'report-card';
        card.dataset.zone = zone.name;

        zone.template.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'report-card-line';
            
            if (line.includes('{prod_nombre}')) {
                lineDiv.classList.add('report-card-title');
            } else if (line.includes('{prod_descripcion}')) {
                lineDiv.classList.add('report-card-description');
            } else if (line.includes('{prod_precio}')) {
                lineDiv.classList.add('report-card-price');
            }

            lineDiv.textContent = this.evaluator.evaluate(line, evaluatedContext);
            card.appendChild(lineDiv);
        });

        return card;
    }

    renderTableZone(zone, context) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context);
        const columns = zone.columns || [];

        const table = document.createElement('table');
        table.className = 'report-table';
        table.dataset.zone = zone.name;

        if (columns.length > 0) {
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const th = document.createElement('th');
                th.className = 'report-table-th';
                th.style.textAlign = col.align || 'left';
                if (col.width) th.style.width = col.width;
                th.textContent = col.label || col.field || '';
                tr.appendChild(th);
            });
            thead.appendChild(tr);
            table.appendChild(thead);
        }

        const tbody = document.createElement('tbody');
        const contexts = Array.isArray(context) ? context : [context];
        contexts.forEach(row => {
            const rowCtx = this.evaluateExpressions(zone.expressions, row);
            const tr = document.createElement('tr');
            tr.className = 'report-table-row';
            columns.forEach(col => {
                const td = document.createElement('td');
                td.className = 'report-table-td';
                td.style.textAlign = col.align || 'left';
                const fieldName = col.field;
                let val = rowCtx[fieldName] ?? row[fieldName] ?? '';
                if (col.format) val = this.evaluator.formatValue(val, col.format);
                td.textContent = String(val);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        return table;
    }

    renderLinesZone(zone, context, accumulators = null, breakLevel = null) {
        const evaluatedContext = this.evaluateExpressions(zone.expressions, context, accumulators, breakLevel);

        const el = document.createElement('div');
        el.className = 'report-lines';
        el.dataset.zone = zone.name;

        zone.template.forEach(line => {
            const p = document.createElement('div');
            p.className = 'report-lines-line';

            if (line.includes('||')) {
                const splitIdx = line.indexOf('||');
                const left  = this.evaluator.evaluate(line.slice(0, splitIdx), evaluatedContext);
                const right = this.evaluator.evaluate(line.slice(splitIdx + 2).trim(), evaluatedContext);
                p.classList.add('report-lines-split');
                const spanL = document.createElement('span');
                spanL.textContent = left;
                const spanR = document.createElement('span');
                spanR.textContent = right;
                p.appendChild(spanL);
                p.appendChild(spanR);
            } else {
                const evaluated = this.evaluator.evaluate(line, evaluatedContext);
                if (evaluated.trim() === '') {
                    p.innerHTML = '&nbsp;';
                } else {
                    p.textContent = evaluated;
                }
            }

            el.appendChild(p);
        });

        return el;
    }

    renderDetailZone(zone, context) {
        return this.renderCardZone(zone, context);
    }

    evaluateExpressions(expressions, context, accumulators = null, breakLevel = null) {
        const ctx = Array.isArray(context) ? (context[0] ?? {}) : context;
        const result = { ...ctx };
        // rawValues holds pre-format values so formulas can reference prior
        // expressions numerically (e.g. if(balance_dia > 0, ...))
        const rawValues = { ...ctx };

        expressions.forEach(expr => {
            let val;
            if (expr.value !== undefined) {
                val = expr.value;
            } else if (expr.formula) {
                val = this.evaluator.evaluateFormula(expr.formula, rawValues);
            } else if (expr.scope === 'lookahead') {
                val = ctx[`_lookahead_${expr.name}`] ?? 0;
            } else if (expr.scope === 'dataset') {
                val = ctx[`_dataset_${expr.name}`] ?? 0;
            } else if (expr.aggregate && accumulators) {
                val = accumulators.evaluate(expr.aggregate, expr.argument, breakLevel);
            } else if (expr.field) {
                val = ctx[expr.field];
            } else if (expr.expression) {
                val = this.evaluator.evaluate(expr.expression, ctx);
            }
            rawValues[expr.name] = val;
            if (expr.format && val !== undefined && val !== null) {
                val = this.evaluator.formatValue(val, expr.format);
            }
            result[expr.name] = val;
        });

        return result;
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'report-container';
        return container;
    }

    createProductsGrid() {
        const grid = document.createElement('div');
        grid.className = 'report-products-grid';
        return grid;
    }

    reset() {
        this.renderedZones.clear();
    }
}

export default ReportRenderer;
