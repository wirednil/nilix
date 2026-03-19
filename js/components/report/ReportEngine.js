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

        // Render each group
        groups.forEach((group, idx) => {
            // Render separator (before-break zone)
            if (group.categoryValue !== null || idx === 0) {
                this.renderCategorySeparator(container, group.records[0], breakFields, group.categoryValue);
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
        this.renderAfterReport(container);

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

    renderAfterReport(container) {
        const afterReportZones = this.schema.zones.filter(z =>
            z.printCondition?.when === 'after' &&
            z.printCondition.triggers.some(t => t.type === 'report')
        );

        afterReportZones.forEach(zone => {
            const element = this.renderer.renderZone(zone, {}, {
                accumulators: this.accumulators,
                breakLevel: null
            });
            if (element) {
                container.appendChild(element);
            }
        });
    }

    renderCategorySeparator(container, record, breakFields, categoryValue) {
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
