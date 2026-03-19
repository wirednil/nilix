/**
 * @file RecordService.js
 * @description Frontend client for CRUD API
 * @module services/RecordService
 */

const API_BASE = '/api/records';

import { authFetch } from '../api/client.js';
import LookupService from './LookupService.js';

class RecordService {
    static async load(table, keyField, id) {
        const response = await authFetch(
            `${API_BASE}/${table}?keyField=${encodeURIComponent(keyField)}&id=${encodeURIComponent(id)}`
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to load record`);
        }
        
        const data = await response.json();
        return data.data;
    }
    
    static async create(table, keyField, data, options = {}) {
        const response = await authFetch(`${API_BASE}/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                keyField, 
                data,
                handler: options.handler,
                crudMode: options.crudMode
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to create record`);
        }
        
        const result = await response.json();
        console.log(`🔍 RecordService.create: invalidating cache for ${table}`);
        LookupService.invalidateCache(table);
        if (options.handler?.invalidateTables) {
            console.log(`🔍 RecordService.create: also invalidating`, options.handler.invalidateTables);
            options.handler.invalidateTables.forEach(t => LookupService.invalidateCache(t));
        }
        return result.data;
    }
    
    static async upsert(table, keyField, id, data, options = {}) {
        const response = await authFetch(`${API_BASE}/${table}/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                keyField, 
                data,
                handler: options.handler,
                crudMode: options.crudMode
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to save record`);
        }
        
        const result = await response.json();
        console.log(`🔍 RecordService.upsert: invalidating cache for ${table}`);
        LookupService.invalidateCache(table);
        return { data: result.data, created: result.created, updated: result.updated };
    }
    
    static async update(table, keyField, id, data, options = {}) {
        const response = await authFetch(`${API_BASE}/${table}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                keyField, 
                data,
                handler: options.handler,
                crudMode: options.crudMode
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to update record`);
        }
        
        const result = await response.json();
        LookupService.invalidateCache(table);
        return result.data;
    }
    
    static async delete(table, keyField, id, options = {}) {
        const response = await authFetch(`${API_BASE}/${table}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                keyField, 
                handler: options.handler,
                crudMode: options.crudMode
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to delete record`);
        }
        
        LookupService.invalidateCache(table);
        return true;
    }
    
    static async save(table, keyField, data, options = {}) {
        const id = data[keyField];
        if (id !== undefined && id !== null && id !== '') {
            return this.upsert(table, keyField, id, data, options);
        } else {
            return this.create(table, keyField, data, options);
        }
    }
    
    static async navigate(table, keyField, currentKey, dir) {
        const url = `${API_BASE}/${table}/navigate?keyField=${encodeURIComponent(keyField)}&current=${encodeURIComponent(currentKey)}&dir=${encodeURIComponent(dir)}`;
        const response = await authFetch(url);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Navigate failed: ${response.status}`);
        const data = await response.json();
        return data.data;
    }

    static async getTables() {
        const response = await authFetch(`${API_BASE}/tables`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Failed to get tables`);
        }
        
        const result = await response.json();
        return result.data;
    }
}

export default RecordService;
