/**
 * YamlParser.js
 * Parse report YAML definitions to ReportSchema
 * Uses js-yaml from CDN if available, falls back to simple parser
 */

let jsyaml = null;

async function loadJsYaml() {
    if (jsyaml) return jsyaml;
    
    try {
        const module = await import('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm');
        jsyaml = module.default || module;
        console.log('✅ js-yaml loaded from CDN');
        return jsyaml;
    } catch (e) {
        console.warn('⚠️ Could not load js-yaml from CDN, using simple parser');
        return null;
    }
}

export class YamlParser {
    constructor() {
        this.useSimpleParser = false;
    }

    async parse(yamlContent) {
        let raw;
        
        const yamlLib = await loadJsYaml();
        
        if (yamlLib && !this.useSimpleParser) {
            try {
                raw = yamlLib.load(yamlContent);
                console.log('✅ Parsed with js-yaml');
            } catch (e) {
                console.warn('⚠️ js-yaml parse error, trying simple parser:', e);
                raw = this.simpleParse(yamlContent);
            }
        } else {
            raw = this.simpleParse(yamlContent);
        }
        
        return this.buildSchema(raw);
    }

    simpleParse(content) {
        const lines = content.split('\n');
        const result = {};
        const stack = [{ obj: result, indent: -1 }];
        let currentArray = null;
        let currentArrayParent = null;
        let currentArrayKey = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trimEnd();
            
            if (trimmed === '' || trimmed.startsWith('#')) continue;

            const indent = line.search(/\S/);

            // Pop stack until we're at the right level
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            const top = stack[stack.length - 1];

            if (trimmed.startsWith('- ')) {
                // Array item
                const itemValue = trimmed.substring(2).trim();
                
                // Find or create array
                if (!currentArray || stack[stack.length - 1].indent !== indent - 2) {
                    // Need to find/create the array in parent
                    const parentObj = top.obj;
                    // Look back to find the key for this array
                    const prevLine = lines[i - 1];
                    if (prevLine && !prevLine.trim().startsWith('-') && prevLine.includes(':')) {
                        const keyMatch = prevLine.match(/^(\s*)([^:]+):\s*$/);
                        if (keyMatch) {
                            currentArrayKey = keyMatch[2].trim();
                            currentArrayParent = parentObj;
                            if (!Array.isArray(parentObj[currentArrayKey])) {
                                parentObj[currentArrayKey] = [];
                            }
                            currentArray = parentObj[currentArrayKey];
                        }
                    }
                }

                if (currentArray) {
                    if (itemValue.includes(':')) {
                        const obj = {};
                        const colonIdx = itemValue.indexOf(':');
                        const key = itemValue.substring(0, colonIdx).trim();
                        const val = itemValue.substring(colonIdx + 1).trim();
                        
                        if (val === '') {
                            obj[key] = {};
                        } else {
                            obj[key] = this.parseValue(val);
                        }
                        
                        currentArray.push(obj);
                        stack.push({ obj: obj, indent: indent });
                    } else {
                        currentArray.push(this.parseValue(itemValue));
                        stack.push({ obj: currentArray[currentArray.length - 1], indent: indent });
                    }
                }
            } else if (trimmed.includes(':')) {
                const colonIdx = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIdx).trim();
                const value = trimmed.substring(colonIdx + 1).trim();

                // Reset array context if we're at a new key at this level
                currentArray = null;

                if (value === '' || value === '|' || value === '>') {
                    // Check next line
                    const nextLine = lines[i + 1];
                    
                    if (value === '|' || value === '>') {
                        // Multiline
                        const multiline = this.extractMultiline(lines, i + 1, indent);
                        top.obj[key] = multiline;
                        i += multiline.split('\n').length;
                    } else if (nextLine && nextLine.trim().startsWith('-')) {
                        // Array follows
                        top.obj[key] = [];
                        currentArray = top.obj[key];
                        currentArrayParent = top.obj;
                        currentArrayKey = key;
                    } else {
                        // Object follows
                        top.obj[key] = {};
                        stack.push({ obj: top.obj[key], indent: indent });
                    }
                } else if (value === '[]') {
                    top.obj[key] = [];
                } else if (value.startsWith('[') && value.endsWith(']')) {
                    top.obj[key] = this.parseInlineArray(value);
                } else {
                    top.obj[key] = this.parseValue(value);
                }
            }
        }

        return result;
    }

    extractMultiline(lines, start, baseIndent) {
        const result = [];
        let i = start;
        
        while (i < lines.length) {
            const line = lines[i];
            const indent = line.search(/\S/);
            
            if (line.trim() === '' || line.trim().startsWith('#')) {
                i++;
                continue;
            }
            
            if (indent <= baseIndent) break;
            
            result.push(line.substring(indent));
            i++;
        }
        
        return result.join('\n');
    }

    parseInlineArray(val) {
        const content = val.slice(1, -1);
        return content.split(',').map(s => this.parseValue(s.trim()));
    }

    parseValue(val) {
        if (!val) return '';
        val = String(val).trim();
        
        if ((val.startsWith('"') && val.endsWith('"')) || 
            (val.startsWith("'") && val.endsWith("'"))) {
            return val.slice(1, -1);
        }
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (val === 'null' || val === '~') return null;
        if (val !== '' && !isNaN(val)) {
            return val.includes('.') ? parseFloat(val) : parseInt(val);
        }
        return val;
    }

    buildSchema(raw) {
        if (!raw) raw = {};

        return {
            name: raw.name || 'report',
            description: raw.description || '',
            public: raw.public === true,
            params: this.buildParams(raw.params),
            config: this.buildConfig(raw.config || {}),
            fields: this.buildFields(raw.fields),
            dataSources: this.buildDataSources(raw.dataSources || {}),
            zones: this.buildZones(raw.zones),
            meta: raw.meta || {}
        };
    }

    buildParams(arr) {
        return (arr || []).map(p => ({
            name: p.name,
            type: p.type || 'string',
            source: p.source || 'jwt'
        }));
    }

    buildConfig(c) {
        return {
            paginationMode: c.paginationMode || 'scroll',
            schema: c.schema || 'catalogs',
            outputTo: c.outputTo || 'display',
            formFeed: c.formFeed !== false,
            pageLength: c.pageLength || 66,
            pageWidth: c.pageWidth || 80
        };
    }

    buildFields(fields) {
        if (!Array.isArray(fields)) {
            console.warn('⚠️ fields not array:', fields);
            return [];
        }
        
        return fields.map((f, i) => ({
            name: f.name || `field_${i}`,
            type: f.type || 'string',
            length: f.length || 50,
            decimals: f.decimals,
            dbRef: f.dbRef ? { table: f.dbRef.table, field: f.dbRef.field } : null,
            references: f.references ? {
                table: f.references.table,
                field: f.references.field,
                displayField: f.references.displayField
            } : null,
            resolvedFrom: f.resolvedFrom,
            inputOrder: i
        }));
    }

    buildDataSources(ds) {
        if (!ds || typeof ds !== 'object') return {};
        
        const result = {};
        for (const [name, d] of Object.entries(ds)) {
            if (!d) continue;
            result[name] = {
                name,
                table: d.table || name,
                orderBy: Array.isArray(d.orderBy) ? d.orderBy : (d.orderBy ? [d.orderBy] : []),
                filter: d.filter || null,
                joins: (Array.isArray(d.joins) ? d.joins : []).map(j => ({
                    from: j.from || '',
                    to: j.to || '',
                    include: Array.isArray(j.include) ? j.include : []
                }))
            };
        }
        return result;
    }

    buildZones(zones) {
        if (!Array.isArray(zones)) {
            console.warn('⚠️ zones not array:', zones);
            return [];
        }
        
        return zones.map(z => ({
            name: z.name || 'zone',
            dataSource: z.dataSource,
            layout: z.layout || 'vertical',
            expressions: Array.isArray(z.expressions) ? z.expressions.map(e => ({
                name: e.name,
                field: e.field,
                value: e.value,
                expression: e.expression,
                type: e.type,
                format: e.format,
                aggregate: e.aggregate,
                argument: e.argument
            })) : [],
            printCondition: z.condition ? {
                when: z.condition.when,
                triggers: this.buildTriggers(z.condition.on)
            } : null,
            ifCondition: z.ifCondition || null,
            template: this.buildTemplate(z.template),
            noPrint: z.noPrint === true
        }));
    }

    buildTriggers(on) {
        if (!on) return [];
        if (on === 'report') return [{ type: 'report' }];
        if (on === 'page') return [{ type: 'page' }];
        if (Array.isArray(on)) return on.map(f => ({ type: 'field', fieldName: f }));
        if (typeof on === 'string') return [{ type: 'field', fieldName: on }];
        return [];
    }

    buildTemplate(t) {
        if (!t) return [];
        if (Array.isArray(t)) return t;
        if (typeof t === 'string') return [t];
        return [];
    }
}

export default YamlParser;
