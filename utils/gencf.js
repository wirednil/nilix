#!/usr/bin/env node
/**
 * @file gencf.js
 * @description Generate custom handler from XML form definition
 * @usage node gencf.js <form.xml> [-o output.js] [-a] [-b]
 * 
 * Examples:
 *   node gencf.js forms/demo/clientes.xml
 *   node gencf.js forms/clientes.xml -o handlers/clientes.handler.js -a -b
 * 
 * Options:
 *   -o, --output <file>   Output file (default: handlers/<form>.handler.js)
 *   -a, --after           Include after-field hooks
 *   -b, --before          Include before-field hooks
 *   -f, --force           Overwrite existing file
 *   -h, --help            Show help
 */

const fs = require('fs');
const path = require('path');

function parseArgs(args) {
    const result = {
        inputFile: null,
        outputFile: null,
        includeAfter: false,
        includeBefore: false,
        force: false,
        help: false
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '-h' || arg === '--help') {
            result.help = true;
        } else if (arg === '-o' || arg === '--output') {
            result.outputFile = args[++i];
        } else if (arg === '-a' || arg === '--after') {
            result.includeAfter = true;
        } else if (arg === '-b' || arg === '--before') {
            result.includeBefore = true;
        } else if (arg === '-f' || arg === '--force') {
            result.force = true;
        } else if (!arg.startsWith('-') && !result.inputFile) {
            result.inputFile = arg;
        }
    }
    
    return result;
}

function showHelp() {
    console.log(`
gencf - Generate custom handler from XML form definition

Usage:
  node gencf.js <form.xml> [options]

Options:
  -o, --output <file>   Output file (default: handlers/<form>.handler.js)
  -a, --after            Include after-field validation hooks
  -b, --before           Include before-field validation hooks
  -f, --force            Overwrite existing file
  -h, --help             Show this help

Examples:
  node gencf.js forms/demo/clientes.xml
  node gencf.js forms/clientes.xml -o handlers/clientes.handler.js -a -b
  node gencf.js forms/provin.xml -b

Output:
  Generates a JavaScript handler module with hooks for custom validation logic.
`);
}

function parseFormXml(xmlContent) {
    const form = {
        title: '',
        database: '',
        fields: [],
        lookupConfig: null
    };
    
    const titleMatch = xmlContent.match(/title="([^"]+)"/);
    if (titleMatch) form.title = titleMatch[1];
    
    const dbMatch = xmlContent.match(/database="([^"]+)"/);
    if (dbMatch) form.database = dbMatch[1];
    
    const fieldRegex = /<field\s+id="([^"]+)"[^>]*>/g;
    let match;
    while ((match = fieldRegex.exec(xmlContent)) !== null) {
        const fieldId = match[1];
        form.fields.push({
            id: fieldId,
            hasInTable: xmlContent.includes(`<in-table`) && 
                        xmlContent.substring(match.index, xmlContent.indexOf('</field>', match.index)).includes('<in-table')
        });
    }
    
    const inTableMatch = xmlContent.match(/<in-table\s+table="([^"]+)"\s+key="([^"]+)"[^>]*>/);
    if (inTableMatch) {
        form.lookupConfig = {
            table: inTableMatch[1],
            key: inTableMatch[2]
        };
    }
    
    return form;
}

function generateHandler(form, options) {
    const className = form.database || 'form';
    const handlerName = className.replace(/[^a-zA-Z0-9]/g, '_');
    
    let code = `/**
 * @file ${handlerName}.handler.js
 * @description Custom handler for ${form.title || form.database} form
 * @generated-by gencf
 * @date ${new Date().toISOString().split('T')[0]}
 */

module.exports = {
    /**
     * Table name for this handler
     */
    table: '${form.database || 'unknown'}',
    
    /**
     * Primary key field
     */
    keyField: '${form.lookupConfig?.key || 'id'}',
`;

    if (options.includeBefore) {
        code += `
    /**
     * Before-field validation hooks
     * Called before user enters each field
     * @param {string} fieldId - Field identifier
     * @param {object} data - Current form data
     * @param {object} db - ScopedDb instance (empresa_id auto-injected)
     * @returns {object} - { valid: boolean, message?: string, skip?: boolean }
     */
    before(fieldId, data, db) {
        switch (fieldId) {
`;
        
        form.fields.forEach(field => {
            code += `            case '${field.id}':
                // TODO: Add before validation for ${field.id}
                break;
`;
        });
        
        code += `            default:
                return { valid: true };
        }
    },
`;
    }

    if (options.includeAfter) {
        code += `
    /**
     * After-field validation hooks
     * Called after user leaves each field
     * @param {string} fieldId - Field identifier
     * @param {*} value - Field value
     * @param {object} data - Current form data
     * @param {object} db - ScopedDb instance (empresa_id auto-injected)
     * @returns {object|null} - { setValues, enableFields, disableFields, populate } | null
     */
    after(fieldId, value, data, db) {
        switch (fieldId) {
`;
        
        form.fields.forEach(field => {
            code += `            case '${field.id}':
                // TODO: Add after validation for ${field.id}
                break;
`;
        });
        
        code += `            default:
                return { valid: true };
        }
    },
`;
    }

    code += `
    /**
     * Validate entire form before save
     * @param {object} data - Complete form data
     * @returns {object} - { valid: boolean, errors: array }
     */
    validate(data) {
        const errors = [];
        
        // TODO: Add form-level validations
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    /**
     * Transform data before save
     * @param {object} data - Form data
     * @param {object} db - ScopedDb instance (empresa_id auto-injected)
     * @returns {object} - Transformed data, or null to bypass standard CRUD
     */
    beforeSave(data, db) {
        const transformed = { ...data };

        // TODO: Add transformations (timestamps, calculated fields, etc.)

        // IMPORTANT: If reading multifield deleted rows, always wrap JSON.parse in try/catch.
        // Malformed input otherwise throws an uncaught exception → 500 response.
        // Example:
        //   let deleted = [];
        //   try { deleted = JSON.parse(data.items_deleted || '[]'); } catch { deleted = []; }

        // IMPORTANT: If using db.prepare() directly (escape hatch), always:
        //   1. Use ? placeholders — never interpolate data.* into SQL strings.
        //   2. Cast numeric values: parseInt(), parseFloat() before bind().
        // Example:
        //   const stmt = db.prepare('UPDATE items SET price = ? WHERE id = ?');
        //   stmt.bind([parseFloat(data.price), parseInt(data.id)]);
        //   stmt.step(); stmt.free();

        return transformed;
    },
    
    /**
     * Called after successful save
     * @param {object} data - Saved data
     * @param {boolean} isInsert - True if new record
     */
    afterSave(data, isInsert) {
        // TODO: Add post-save logic (logs, emails, etc.)
        console.log(\`Record \${isInsert ? 'created' : 'updated'}: \${JSON.stringify(data)}\`);
    },
    
    /**
     * Called on delete
     * @param {string|number} id - Record ID
     */
    beforeDelete(id) {
        // TODO: Add pre-delete validation
        return true;
    },
    
    /**
     * Called after delete
     * @param {string|number} id - Deleted record ID
     */
    afterDelete(id) {
        // TODO: Add post-delete logic
        console.log(\`Record deleted: \${id}\`);
    }
};
`;
    
    return code;
}

async function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    
    if (options.help) {
        showHelp();
        process.exit(0);
    }
    
    if (!options.inputFile) {
        console.error('Error: Missing input file');
        console.error('Usage: node gencf.js <form.xml> [options]');
        process.exit(1);
    }
    
    const inputPath = path.resolve(options.inputFile);
    
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
    }
    
    const formName = path.basename(inputPath, '.xml');
    // Default: app dir first ($NIL_APP_DIR/apps/), fallback to nilix/handlers/
    const appDir = process.env.NIL_APP_DIR;
    const defaultOutput = appDir
        ? path.join(appDir, 'apps', `${formName}.handler.js`)
        : path.join(__dirname, '..', 'handlers', `${formName}.handler.js`);
    const outputPath = options.outputFile ? path.resolve(options.outputFile) : defaultOutput;
    
    console.log(`\n>>> gencf: Generating handler for ${formName}`);
    console.log(`    Input:  ${inputPath}`);
    console.log(`    Output: ${outputPath}`);
    console.log(`    After hooks:  ${options.includeAfter ? 'Yes' : 'No'}`);
    console.log(`    Before hooks: ${options.includeBefore ? 'Yes' : 'No'}`);
    
    if (fs.existsSync(outputPath) && !options.force) {
        console.error(`\nError: Output file exists: ${outputPath}`);
        console.error('Use -f or --force to overwrite');
        process.exit(1);
    }
    
    const xmlContent = fs.readFileSync(inputPath, 'utf-8');
    const form = parseFormXml(xmlContent);
    
    console.log(`\n    Form: ${form.title || formName}`);
    console.log(`    Database: ${form.database || 'not specified'}`);
    console.log(`    Fields: ${form.fields.length}`);
    
    const handlerCode = generateHandler(form, options);
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, handlerCode);
    
    console.log(`\n>>> Handler generated successfully`);
    console.log(`    ${outputPath}\n`);
}

main();
