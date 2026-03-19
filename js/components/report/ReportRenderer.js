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
            case 'detail':
            default:
                return this.renderDetailZone(zone, context);
        }
    }

    determineZoneType(zone) {
        if (!zone.printCondition) return 'detail';

        const triggers = zone.printCondition.triggers;
        const hasReportTrigger = triggers.some(t => t.type === 'report');
        const hasPageTrigger = triggers.some(t => t.type === 'page');
        const hasFieldTrigger = triggers.some(t => t.type === 'field');

        if (hasReportTrigger && zone.printCondition.when === 'before') {
            if (zone.layout === 'horizontal-scroll') return 'nav';
            return 'header';
        }
        
        if (hasReportTrigger && zone.printCondition.when === 'after') {
            return 'footer';
        }

        if (hasFieldTrigger && zone.printCondition.when === 'before') {
            return 'separator';
        }

        if (hasFieldTrigger && zone.printCondition.when === 'after') {
            return 'subtotal';
        }

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

    renderDetailZone(zone, context) {
        return this.renderCardZone(zone, context);
    }

    evaluateExpressions(expressions, context, accumulators = null, breakLevel = null) {
        const ctx = Array.isArray(context) ? (context[0] ?? {}) : context;
        const result = { ...ctx };

        expressions.forEach(expr => {
            if (expr.value !== undefined) {
                result[expr.name] = expr.value;
            } else if (expr.aggregate && accumulators) {
                result[expr.name] = accumulators.evaluate(expr.aggregate, expr.argument, breakLevel);
            } else if (expr.field) {
                result[expr.name] = ctx[expr.field];
            } else if (expr.expression) {
                result[expr.name] = this.evaluator.evaluate(expr.expression, ctx);
            }
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
