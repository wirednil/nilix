import TableCache from './TableCache.js';
import { authFetch } from '../api/client.js';

const API_BASE = '/api/catalogs';
const RECORDS_API = '/api/records';
let invalidationTimestamp = Date.now();
const forceRefreshSet = new Set();

class LookupService {
    static getInvalidationTimestamp() {
        return invalidationTimestamp;
    }
    
    static forceRefreshOnNextLoad(tableName) {
        forceRefreshSet.add(tableName);
        // console.log(`🔍 forceRefreshOnNextLoad: ${tableName}`);
    }
    
    static async getCatalog(tableName, forceRefresh = false) {
        const needsRefresh = forceRefresh || forceRefreshSet.has(tableName);
        if (needsRefresh) {
            forceRefreshSet.delete(tableName);
        }
        
        const cached = TableCache.get(tableName);
        
        if (!needsRefresh && cached) {
            try {
                const response = await authFetch(`${API_BASE}/${tableName}`, {
                    headers: {
                        'X-Cache-Count': String(cached.count || 0)
                    }
                });
                
                if (response.status === 304) {
                    // console.log(`🔍 getCatalog: ${tableName} - sin cambios (304), usando cache`);
                    return cached;
                }
                
                if (response.ok) {
                    const data = await response.json();
                    // console.log(`🔍 getCatalog: ${tableName} - datos actualizados, count=${data.count}`);
                    return TableCache.set(tableName, data, data.ttl);
                }
            } catch (error) {
                // console.warn(`🔍 getCatalog: ${tableName} - error validando cache, usando cache local`);
                return cached;
            }
        }
        
        const response = await authFetch(`${API_BASE}/${tableName}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to fetch catalog: ${tableName}`);
        }
        
        const data = await response.json();
        // console.log(`🔍 getCatalog: ${tableName} - fetched, count=${data.count}`);
        return TableCache.set(tableName, data, data.ttl);
    }
    
    static async loadRecord(tableName, keyField, id) {
        const response = await authFetch(
            `${RECORDS_API}/${tableName}?keyField=${encodeURIComponent(keyField)}&id=${encodeURIComponent(id)}`
        );
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        return data.data;
    }
    
    static async validate(tableName, keyField, value) {
        const catalog = await this.getCatalog(tableName);
        
        if (!catalog || !catalog.rows) {
            return { valid: false, row: null };
        }
        
        const row = catalog.rows.find(r => r[keyField] == value);
        
        return {
            valid: !!row,
            row: row || null
        };
    }
    
    static async validateAndCopy(tableName, keyField, value, copyFields = [], useRecordApi = false) {
        let row = null;
        let valid = false;
        
        if (useRecordApi) {
            row = await this.loadRecord(tableName, keyField, value);
            valid = !!row;
        } else {
            const result = await this.validate(tableName, keyField, value);
            valid = result.valid;
            row = result.row;
        }
        
        const result = { valid, row };
        
        if (valid && copyFields.length > 0) {
            result.copies = {};
            
            copyFields.forEach(copy => {
                const fromField = copy.from || copy.getAttribute?.('from') || copy.from;
                const toField = copy.to || copy.getAttribute?.('to') || copy.to;
                
                if (fromField && toField && row[fromField] !== undefined) {
                    result.copies[toField] = row[fromField];
                }
            });
        }
        
        return result;
    }
    
    static copyFieldsToForm(copies, formRenderer) {
        if (!copies || !formRenderer) return;
        
        Object.entries(copies).forEach(([fieldId, value]) => {
            const field = formRenderer.container.querySelector(`#${fieldId}`);
            if (field) {
                field.value = value;
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    
    static async invalidateCache(tableName = null) {
        invalidationTimestamp = Date.now();
        console.log(`🔍 LookupService invalidateCache: tableName=${tableName}, timestamp=${invalidationTimestamp}`);
        if (tableName) {
            TableCache.invalidate(tableName);
        } else {
            TableCache.invalidateAll();
        }
    }
    
    static getCacheInfo() {
        return TableCache.getInfo();
    }
}

export default LookupService;
