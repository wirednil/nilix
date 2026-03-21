/**
 * QueryBuilder.js
 * Converts YAML dataSource definitions to DuckDB SQL queries
 * 
 * Generates:
 * - SELECT with proper column aliases
 * - JOIN clauses from references
 * - WHERE from filter expressions
 * - ORDER BY from orderBy array
 */

export class QueryBuilder {
    constructor() {
        this.yamlToDbField = new Map();
    }

    buildQuery(dataSource, fields) {
        this.buildFieldMap(fields);
        
        const selectClause = this.buildSelect(dataSource, fields);
        const fromClause = this.buildFrom(dataSource);
        const joinClauses = this.buildJoins(dataSource, fields);
        const whereClause = this.buildWhere(dataSource);
        const orderByClause = this.buildOrderBy(dataSource, fields);
        
        const parts = [selectClause, fromClause];
        
        if (joinClauses) {
            parts.push(joinClauses);
        }
        
        if (whereClause) {
            parts.push(whereClause);
        }
        
        if (orderByClause) {
            parts.push(orderByClause);
        }
        
        return parts.join('\n');
    }

    buildFieldMap(fields) {
        this.yamlToDbField.clear();
        
        fields.forEach(f => {
            if (f.dbRef && f.dbRef.field) {
                this.yamlToDbField.set(f.name, f.dbRef.field);
            }
        });
    }

    buildSelect(dataSource, fields) {
        const tableAlias = 't';
        const columns = [`${tableAlias}.*`];
        
        dataSource.joins?.forEach(join => {
            const joinFromDb = this.yamlToDbField.get(join.from) || join.from;
            const joinTable = join.to.split('.')[0];
            const joinAlias = `j_${joinTable}`;
            
            join.include?.forEach(field => {
                columns.push(`${joinAlias}.${field} AS ${join.from.replace(/_/g, '')}_${field}`);
            });
            
            fields.forEach(f => {
                if (f.resolvedFrom === join.from) {
                    const sourceField = fields.find(sf => sf.name === join.from);
                    if (sourceField?.references?.displayField) {
                        columns.push(`${joinAlias}.${sourceField.references.displayField} AS ${f.name}`);
                    }
                }
            });
        });
        
        return `SELECT ${columns.join(', ')}`;
    }

    buildFrom(dataSource) {
        return `FROM ${dataSource.table} t`;
    }

    buildJoins(dataSource, fields) {
        if (!dataSource.joins || dataSource.joins.length === 0) {
            return null;
        }

        const joins = [];
        // fieldSource tracks which alias provides each column (first-win, no overwrite)
        const fieldSource = new Map(); // columnName → alias ('t' or 'j_table')

        dataSource.joins.forEach(join => {
            const [joinTable, joinField] = join.to.split('.');
            const joinFromDb = this.yamlToDbField.get(join.from) || join.from;
            const joinAlias = `j_${joinTable}`;

            // The `from` field might come from a previous join rather than the main table
            const fromAlias = fieldSource.has(joinFromDb) ? fieldSource.get(joinFromDb) : 't';

            const existingJoin = joins.find(j => j.includes(`JOIN ${joinTable} `));

            if (!existingJoin) {
                joins.push(
                    `LEFT JOIN ${joinTable} ${joinAlias} ON ${fromAlias}.${joinFromDb} = ${joinAlias}.${joinField}`
                );
            }

            // Register included fields (first join that provides a column wins)
            (join.include || []).forEach(col => {
                if (!fieldSource.has(col)) fieldSource.set(col, joinAlias);
            });
        });

        return joins.join('\n');
    }

    buildWhere(dataSource) {
        const filter = dataSource._substitutedFilter ?? dataSource.filter;
        if (!filter) return null;

        // Handle quoted string value: fieldName = 'value'
        const quotedMatch = filter.match(/^(\w+)\s*=\s*'([^']*)'$/);
        if (quotedMatch) {
            const dbField = this.yamlToDbField.get(quotedMatch[1]) || quotedMatch[1];
            return `WHERE t.${dbField} = '${quotedMatch[2]}'`;
        }

        const filterMatch = filter.match(/(\w+)\s*=\s*(\w+)/);

        if (!filterMatch) {
            console.warn('⚠️ Could not parse filter:', filter);
            return null;
        }

        const [, fieldName, value] = filterMatch;

        const dbField = this.yamlToDbField.get(fieldName) || fieldName;

        let sqlValue = value;
        if (value === 'true') {
            sqlValue = '1';
        } else if (value === 'false') {
            sqlValue = '0';
        } else if (!isNaN(value)) {
            sqlValue = value;
        } else {
            sqlValue = `'${value}'`;
        }

        return `WHERE t.${dbField} = ${sqlValue}`;
    }

    buildOrderBy(dataSource, fields) {
        if (!dataSource.orderBy || dataSource.orderBy.length === 0) {
            return null;
        }
        
        const orderColumns = dataSource.orderBy.map(fieldName => {
            const dbField = this.yamlToDbField.get(fieldName) || fieldName;
            return `t.${dbField}`;
        });
        
        return `ORDER BY ${orderColumns.join(', ')}`;
    }

    buildCountQuery(dataSource) {
        return `SELECT COUNT(*) as count FROM ${dataSource.table}`;
    }

    buildAggregateQuery(dataSource, aggregations, groupBy = null) {
        const selectParts = [];
        
        if (groupBy) {
            const groupField = this.yamlToDbField.get(groupBy) || groupBy;
            selectParts.push(`t.${groupField}`);
        }
        
        aggregations.forEach(agg => {
            const field = this.yamlToDbField.get(agg.field) || agg.field;
            selectParts.push(`${agg.func}(t.${field}) AS ${agg.alias || agg.field}`);
        });
        
        let sql = `SELECT ${selectParts.join(', ')} FROM ${dataSource.table} t`;
        
        if (dataSource.filter) {
            const where = this.buildWhere(dataSource);
            if (where) sql += `\n${where}`;
        }
        
        if (groupBy) {
            const groupField = this.yamlToDbField.get(groupBy) || groupBy;
            sql += `\nGROUP BY t.${groupField}`;
        }
        
        return sql;
    }

    getFieldMap() {
        return this.yamlToDbField;
    }
}

export default QueryBuilder;
