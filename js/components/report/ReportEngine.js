/**
 * ReportEngine.js
 * Main report engine - coordinates parsing, data loading, and rendering
 * 
 * v2.0 - DuckDB-WASM backend for efficient OLAP queries
 */

import { YamlParser } from './parsers/YamlParser.js';
import { DataSourceManager } from './DataSourceManager.js';
import { AccumulatorManager } from './AccumulatorManager.js';
import { BreakDetector } from './BreakDetector.js';
import { ReportRenderer } from './ReportRenderer.js';

export class ReportEngine {
    constructor() {
        this.parser = new YamlParser();
        this.dataSourceManager = new DataSourceManager();
        this.accumulators = new AccumulatorManager();
        this.breakDetector = new BreakDetector();
        this.renderer = new ReportRenderer();
        
        this.schema = null;
        this.data = new Map();
        this.duckdbReady = false;
    }

    async load(reportPath, yamlContent = null, empresaId = null) {
        if (yamlContent === null) {
            const response = await fetch(reportPath);
            if (!response.ok) {
                throw new Error(`Failed to load report: ${response.status}`);
            }
            yamlContent = await response.text();
        }

        this.schema = await this.parser.parse(yamlContent);

        if (this.schema.public) {
            const reportName = reportPath.split('/').pop().replace(/\.ya?ml$/, '');
            this.dataSourceManager.setPublicMode(reportName, empresaId);
        }

        await this.dataSourceManager.initDuckDB();
        this.duckdbReady = this.dataSourceManager.isDuckDBActive();

        if (this.duckdbReady) {
            console.log('📊 ReportEngine: Using DuckDB backend');
        } else {
            console.log('📊 ReportEngine: Using JS fallback backend');
        }

        await this.loadDataSources();

        return this;
    }

    async loadDataSources() {
        if (!this.schema || !this.schema.dataSources) return;

        for (const [name, dataSource] of Object.entries(this.schema.dataSources)) {
            const data = await this.dataSourceManager.loadDataSource(dataSource, this.schema.fields);
            this.data.set(name, data);
        }
    }

    async render() {
        if (!this.schema) {
            throw new Error('No report loaded. Call load() first.');
        }

        this.accumulators.reset();
        this.breakDetector.reset();
        this.renderer.reset();

        const container = this.renderer.createContainer();
        
        // Render header and nav
        this.renderBeforeReport(container);

        const mainDataSource = this.findMainDataSource();
        if (!mainDataSource) {
            console.warn('No main data source found');
            return container;
        }

        const data = this.data.get(mainDataSource) || [];
        console.log(`📊 Rendering ${data.length} records from "${mainDataSource}"`);
        
        // Log first record for debugging
        if (data.length > 0) {
            console.log('📊 Sample record:', data[0]);
        }
        
        // Extract break fields
        const breakFields = this.breakDetector.extractBreakFields(this.schema.zones);

        // Group by category
        const groups = this.groupByCategory(data, breakFields);
        console.log(`📦 Grouped into ${groups.length} categories`);

        // Pre-compute lookahead aggregates (scope: lookahead)
        const lookaheadMap = this.precomputeGroupAggregates(groups, this.schema.zones);

        // Pre-compute dataset aggregates (scope: dataset, optional filter)
        const datasetMap = this.precomputeDatasetAggregates(data, this.schema.zones);

        // Render each group
        groups.forEach((group, idx) => {
            // Render separator (before-break zone)
            if (group.categoryValue !== null || idx === 0) {
                this.renderCategorySeparator(container, group.records[0], breakFields, group.categoryValue, lookaheadMap);
            }

            // Render grid with records + populate accumulators
            const grid = this.renderer.createProductsGrid();
            group.records.forEach(record => {
                this.renderDetail(grid, record);
                this.updateAccumulators(record, breakFields[0] ?? null);
            });
            container.appendChild(grid);

            // Render after-break zones (subtotals per group)
            this.renderAfterCategory(container, group.records[group.records.length - 1], breakFields);

            // Reset level accumulator for next group
            if (breakFields[0]) this.accumulators.resetLevel(breakFields[0]);
        });

        // Render footer
        this.renderAfterReport(container, datasetMap);

        return container;
    }

    groupByCategory(data, breakFields) {
        const groups = [];
        let currentGroup = null;
        
        const breakField = breakFields.length > 0 ? breakFields[0] : null;
        console.log('📦 Grouping by field:', breakField);

        data.forEach((record, idx) => {
            const categoryValue = breakField ? record[breakField] : null;
            
            if (!currentGroup || currentGroup.categoryValue !== categoryValue) {
                currentGroup = {
                    categoryValue: categoryValue,
                    records: []
                };
                groups.push(currentGroup);
            }
            
            currentGroup.records.push(record);
        });

        return groups;
    }

    findMainDataSource() {
        const detailZones = this.schema.zones.filter(z => !z.printCondition);
        
        if (detailZones.length > 0 && detailZones[0].dataSource) {
            return detailZones[0].dataSource;
        }

        const dsNames = Object.keys(this.schema.dataSources);
        return dsNames.length > 0 ? dsNames[0] : null;
    }

    renderBeforeReport(container) {
        const beforeReportZones = this.schema.zones.filter(z => 
            z.printCondition?.when === 'before' &&
            z.printCondition.triggers.some(t => t.type === 'report')
        );

        beforeReportZones.forEach(zone => {
            let context = {};

            if (zone.dataSource) {
                context = this.data.get(zone.dataSource) || [];
            }

            const element = this.renderer.renderZone(zone, context);
            if (element) {
                container.appendChild(element);
            }
        });
    }

    updateAccumulators(record, breakLevel = null) {
        for (const [key, value] of Object.entries(record)) {
            this.accumulators.update(key, value, breakLevel);
        }
    }

    renderAfterCategory(container, record, breakFields) {
        const afterBreakZones = this.schema.zones.filter(z =>
            z.printCondition?.when === 'after' &&
            z.printCondition.triggers.some(t => t.type === 'field')
        );
        const breakLevel = breakFields[0] ?? null;

        afterBreakZones.forEach(zone => {
            const element = this.renderer.renderZone(zone, { ...record }, {
                accumulators: this.accumulators,
                breakLevel
            });
            if (element) container.appendChild(element);
        });
    }

    renderAfterReport(container, datasetMap = {}) {
        const afterReportZones = this.schema.zones.filter(z =>
            z.printCondition?.when === 'after' &&
            z.printCondition.triggers.some(t => t.type === 'report')
        );

        afterReportZones.forEach(zone => {
            const element = this.renderer.renderZone(zone, { ...datasetMap }, {
                accumulators: this.accumulators,
                breakLevel: null
            });
            if (element) {
                container.appendChild(element);
            }
        });
    }

    precomputeGroupAggregates(groups, zones) {
        const lookaheadMap = new Map();

        // Collect all lookahead expressions across all zones
        const lookaheadExprs = [];
        zones.forEach(zone => {
            (zone.expressions || []).forEach(expr => {
                if (expr.scope === 'lookahead' && expr.aggregate && expr.argument) {
                    lookaheadExprs.push(expr);
                }
            });
        });
        if (lookaheadExprs.length === 0) return lookaheadMap;

        groups.forEach(group => {
            const aggs = {};
            lookaheadExprs.forEach(expr => {
                const values = group.records
                    .map(r => parseFloat(r[expr.argument]))
                    .filter(v => !isNaN(v));
                let raw = 0;
                switch (expr.aggregate) {
                    case 'sum':   raw = values.reduce((a, b) => a + b, 0); break;
                    case 'count': raw = values.length; break;
                    case 'avg':   raw = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
                    case 'min':   raw = values.length ? Math.min(...values) : 0; break;
                    case 'max':   raw = values.length ? Math.max(...values) : 0; break;
                }
                aggs[`_lookahead_${expr.name}`] = raw;
            });
            lookaheadMap.set(group.categoryValue, aggs);
        });

        return lookaheadMap;
    }

    precomputeDatasetAggregates(data, zones) {
        const map = {};
        const datasetExprs = [];

        zones.forEach(zone => {
            (zone.expressions || []).forEach(expr => {
                if (expr.scope === 'dataset' && expr.aggregate && expr.argument) {
                    datasetExprs.push(expr);
                }
            });
        });
        if (datasetExprs.length === 0) return map;

        datasetExprs.forEach(expr => {
            const rows = expr.filter
                ? data.filter(r => this._matchSimpleFilter(r, expr.filter))
                : data;
            const values = rows.map(r => parseFloat(r[expr.argument])).filter(v => !isNaN(v));
            let raw = 0;
            switch (expr.aggregate) {
                case 'sum':   raw = values.reduce((a, b) => a + b, 0); break;
                case 'count': raw = values.length; break;
                case 'avg':   raw = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
                case 'min':   raw = values.length ? Math.min(...values) : 0; break;
                case 'max':   raw = values.length ? Math.max(...values) : 0; break;
            }
            map[`_dataset_${expr.name}`] = raw;
        });

        return map;
    }

    _matchSimpleFilter(record, filterExpr) {
        const s = filterExpr.trim();
        const mStr = s.match(/^(\w+)\s*==\s*'([^']*)'$/) || s.match(/^(\w+)\s*==\s*"([^"]*)"/);
        if (mStr) return String(record[mStr[1]] ?? '') === mStr[2];
        const mNum = s.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
        if (mNum) {
            const l = parseFloat(record[mNum[1]]), r = parseFloat(mNum[3]);
            switch (mNum[2]) {
                case '==': return l === r;
                case '!=': return l !== r;
                case '>':  return l > r;
                case '<':  return l < r;
                case '>=': return l >= r;
                case '<=': return l <= r;
            }
        }
        return true;
    }

    renderCategorySeparator(container, record, breakFields, categoryValue, lookaheadMap = null) {
        const separatorZones = this.schema.zones.filter(z => 
            z.printCondition?.when === 'before' &&
            z.printCondition.triggers.some(t => t.type === 'field')
        );

        separatorZones.forEach(zone => {
            // Ensure category info is in context
            const context = { ...record };
            if (categoryValue !== undefined) {
                const breakField = breakFields[0];
                context[breakField] = categoryValue;
            }
            // Inject pre-computed lookahead aggregates for this group
            if (lookaheadMap) {
                const groupAggs = lookaheadMap.get(categoryValue);
                if (groupAggs) Object.assign(context, groupAggs);
            }
            
            const element = this.renderer.renderZone(zone, context);
            if (element) {
                // Set data-category for nav scroll target
                element.dataset.category = categoryValue;
                container.appendChild(element);
            }
        });
    }

    renderDetail(container, record) {
        const detailZones = this.schema.zones.filter(z => !z.printCondition);

        detailZones.forEach(zone => {
            const element = this.renderer.renderZone(zone, record);
            if (element) {
                container.appendChild(element);
            }
        });
    }

    getSchema() {
        return this.schema;
    }

    getData(dataSourceName) {
        return this.data.get(dataSourceName);
    }

    isDuckDBActive() {
        return this.duckdbReady;
    }

    async close() {
        await this.dataSourceManager.close();
        this.data.clear();
    }
}

export default ReportEngine;
