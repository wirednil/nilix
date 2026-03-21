/**
 * DataSourceManager.js
 * Build and execute queries from dbRef and dataSources definitions
 * 
 * v2.0 - DuckDB-WASM backend for efficient joins and aggregations
 * Falls back to JS loops if DuckDB unavailable
 */

import { DuckDBAdapter } from './DuckDBAdapter.js';
import { QueryBuilder } from './QueryBuilder.js';
import { authFetch } from '../../api/client.js';

export class DataSourceManager {
    constructor() {
        this.cache = new Map();
        this.duckdb = null;
        this.queryBuilder = new QueryBuilder();
        this.useDuckDB = true;
        this.publicMode = false;
        this.publicReportName = null;
        this.params = {};
    }

    setPublicMode(reportName, token = null) {
        this.publicMode = true;
        this.publicReportName = reportName;
        this.publicToken = token;
    }

    setParams(params) {
        this.params = params || {};
    }

    _unaliasJoinColumns(rows, joins) {
        if (!joins || joins.length === 0) return rows;
        return rows.map(row => {
            const out = { ...row };
            joins.forEach(join => {
                const prefix = join.from.replace(/_/g, '') + '_';
                (join.include || []).forEach(col => {
                    const aliased = `${prefix}${col}`;
                    if (aliased in out && !(col in out)) {
                        out[col] = out[aliased];
                    }
                });
            });
            return out;
        });
    }

    _substituteParams(filterStr) {
        if (!filterStr || !filterStr.includes(':')) return filterStr;
        return filterStr.replace(/:(\w+)/g, (_, name) => {
            if (!(name in this.params)) {
                throw new Error(`Missing required report param: ${name}`);
            }
            const val = this.params[name];
            const n = parseFloat(val);
            if (!isNaN(n) && String(n) === String(val).trim()) return String(n);
            // String: allow only safe chars to prevent injection
            const safe = String(val).replace(/[^\w\s@.-]/g, '');
            if (safe !== String(val)) {
                throw new Error(`Invalid characters in report param: ${name}`);
            }
            return `'${safe.replace(/'/g, "''")}'`;
        });
    }

    async initDuckDB() {
        if (this.duckdb) return;
        
        try {
            this.duckdb = new DuckDBAdapter();
            await this.duckdb.init();
            console.log('✅ DataSourceManager: DuckDB ready');
        } catch (error) {
            console.warn('⚠️ DuckDB unavailable, falling back to JS:', error.message);
            this.useDuckDB = false;
            this.duckdb = null;
        }
    }

    async loadDataSource(dataSource, fields) {
        const cacheKey = dataSource.name;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let data;
        
        if (this.useDuckDB && this.duckdb) {
            data = await this.loadWithDuckDB(dataSource, fields);
        } else {
            data = await this.loadWithJS(dataSource, fields);
        }

        this.cache.set(cacheKey, data);
        console.log(`✅ DataSource "${dataSource.name}" loaded: ${data.length} records`);
        
        return data;
    }

    async loadWithDuckDB(dataSource, fields) {
        const mainTable = dataSource.table;
        const rawData = await this.fetchTable(mainTable);
        
        if (rawData.length === 0) {
            return [];
        }
        
        await this.duckdb.loadTable(mainTable, rawData);
        
        if (dataSource.joins && dataSource.joins.length > 0) {
            for (const join of dataSource.joins) {
                const [joinTable] = join.to.split('.');
                if (!this.duckdb.getLoadedTables().includes(joinTable)) {
                    const joinData = await this.fetchTable(joinTable);
                    if (joinData.length > 0) {
                        await this.duckdb.loadTable(joinTable, joinData);
                    }
                }
            }
        }
        
        // Substitute URL params before building SQL
        if (dataSource.filter) {
            dataSource._substitutedFilter = this._substituteParams(dataSource.filter);
        }

        const sql = this.queryBuilder.buildQuery(dataSource, fields);
        console.log('📊 Generated SQL:', sql);
        
        const results = await this.duckdb.query(sql);

        // DuckDB aliases join columns as "fromfield_col" (e.g. idequipo_tipo).
        // Restore original column names so zone expressions work the same as JS path.
        const unaliased = this._unaliasJoinColumns(results, dataSource.joins);

        return this.mapFieldsFromSchema(unaliased, fields);
    }

    async loadWithJS(dataSource, fields) {
        let data = await this.fetchTable(dataSource.table);

        if (dataSource.joins && dataSource.joins.length > 0) {
            data = await this.resolveJoinsJS(data, dataSource.joins, fields);
        }

        data = this.mapFieldsFromSchema(data, fields);
        const substitutedFilter = this._substituteParams(dataSource.filter);
        data = this.applyFilter(data, substitutedFilter, fields);
        data = this.applyOrderBy(data, dataSource.orderBy, fields);

        return data;
    }

    async fetchTable(tableName) {
        try {
            let response;
            if (this.publicMode) {
                const tokenQ = this.publicToken != null ? `?t=${this.publicToken}` : '';
                response = await fetch(`/api/public/report-data/${this.publicReportName}/${encodeURIComponent(tableName)}${tokenQ}`);
            } else {
                response = await authFetch(`/api/catalogs/${tableName}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const data = result.rows || result.data || result;

            if (!Array.isArray(data)) {
                console.warn(`⚠️ fetchTable: ${tableName} is not array`);
                return [];
            }

            return data;
        } catch (error) {
            console.error(`Error fetching table ${tableName}:`, error);
            return [];
        }
    }

    async resolveJoinsJS(data, joins, fields) {
        const yamlToDbField = new Map();
        fields.forEach(f => {
            if (f.dbRef && f.dbRef.field) {
                yamlToDbField.set(f.name, f.dbRef.field);
            }
        });
        
        const referenceMap = new Map();
        
        fields.forEach(f => {
            if (f.references && f.references.displayField) {
                const dbField = yamlToDbField.get(f.name) || f.name;
                referenceMap.set(f.name, {
                    dbField: dbField,
                    displayField: f.references.displayField
                });
            }
            
            if (f.resolvedFrom) {
                const sourceField = fields.find(sf => sf.name === f.resolvedFrom);
                if (sourceField && sourceField.references) {
                    const dbField = yamlToDbField.get(f.resolvedFrom) || f.resolvedFrom;
                    referenceMap.set(f.name, {
                        dbField: dbField,
                        displayField: sourceField.references.displayField
                    });
                }
            }
        });

        const joinCache = new Map();

        for (const join of joins) {
            const joinFromDb = yamlToDbField.get(join.from) || join.from;
            const [joinTable, joinField] = join.to.split('.');
            
            if (!joinTable) continue;

            if (!joinCache.has(joinTable)) {
                const joinData = await this.fetchTable(joinTable);
                joinCache.set(joinTable, joinData);
            }

            const joinData = joinCache.get(joinTable);

            data.forEach(row => {
                const fromValue = row[joinFromDb];
                if (fromValue === undefined) return;

                const matchedRecord = joinData.find(r => r[joinField] === fromValue);
                
                if (matchedRecord) {
                    if (join.include) {
                        join.include.forEach(field => {
                            if (matchedRecord[field] !== undefined) {
                                row[field] = matchedRecord[field];
                            }
                        });
                    }
                    
                    referenceMap.forEach((ref, fieldName) => {
                        if (ref.dbField === joinFromDb && ref.displayField) {
                            row[fieldName] = matchedRecord[ref.displayField];
                        }
                    });
                }
            });
        }

        return data;
    }

    mapFieldsFromSchema(data, fields) {
        const fieldMap = new Map();
        const dateFieldKeys = new Set();

        fields.forEach(f => {
            if (f.dbRef) {
                fieldMap.set(f.name, f.dbRef.field);
            }
            if (f.type === 'date') {
                dateFieldKeys.add(f.name);
                if (f.dbRef?.field) dateFieldKeys.add(f.dbRef.field);
            }
        });

        return data.map(row => {
            const mapped = { ...row };

            fieldMap.forEach((dbColumn, yamlName) => {
                if (row[dbColumn] !== undefined) {
                    mapped[yamlName] = row[dbColumn];
                }
            });

            // Normalize date fields: strip time component from ISO datetimes
            dateFieldKeys.forEach(key => {
                if (typeof mapped[key] === 'string' && mapped[key].includes('T')) {
                    mapped[key] = mapped[key].substring(0, 10);
                }
            });

            return mapped;
        });
    }

    applyFilter(data, filter, fields) {
        if (!filter) return data;

        const yamlToDbField = new Map();
        fields?.forEach(f => {
            if (f.dbRef && f.dbRef.field) {
                yamlToDbField.set(f.name, f.dbRef.field);
            }
        });

        // Handle quoted string values (e.g. from param substitution: field = 'value')
        const quotedMatch = filter.match(/^(\w+)\s*=\s*'([^']*)'$/);
        if (quotedMatch) {
            const dbField = yamlToDbField.get(quotedMatch[1]) || quotedMatch[1];
            const cmpVal = quotedMatch[2];
            return data.filter(row => String(row[dbField] ?? '') === cmpVal);
        }

        const filterMatch = filter.match(/(\w+)\s*=\s*(\w+)/);

        if (!filterMatch) return data;

        const [, fieldName, value] = filterMatch;

        const dbField = yamlToDbField.get(fieldName) || fieldName;

        const filterValue = value === 'true' ? true :
                           value === 'false' ? false :
                           isNaN(value) ? value :
                           (value.includes('.') ? parseFloat(value) : parseInt(value));

        return data.filter(row => {
            const rowValue = row[dbField];
            if (typeof filterValue === 'boolean') {
                return rowValue === filterValue || rowValue === (filterValue ? 1 : 0);
            }
            return rowValue === filterValue;
        });
    }

    applyOrderBy(data, orderBy, fields) {
        if (!orderBy || orderBy.length === 0) return data;

        const yamlToDbField = new Map();
        fields?.forEach(f => {
            if (f.dbRef && f.dbRef.field) {
                yamlToDbField.set(f.name, f.dbRef.field);
            }
        });

        return [...data].sort((a, b) => {
            for (const field of orderBy) {
                const dbField = yamlToDbField.get(field) || field;
                const aVal = a[dbField];
                const bVal = b[dbField];
                
                if (aVal === undefined || bVal === undefined) continue;
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
            }
            return 0;
        });
    }

    clearCache() {
        this.cache.clear();
    }

    async close() {
        if (this.duckdb) {
            await this.duckdb.close();
            this.duckdb = null;
        }
        this.clearCache();
    }

    isDuckDBActive() {
        return this.useDuckDB && this.duckdb !== null;
    }
}

export default DataSourceManager;
