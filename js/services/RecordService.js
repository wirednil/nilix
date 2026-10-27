/**
 * @file RecordService.js
 * @description Frontend client for CRUD API
 * @module services/RecordService
 */

const API_BASE = '/api/v1/records';

import { authFetch } from '../api/client.js';
import LookupService from './LookupService.js';

/**
 * Error de una respuesta no-ok del API de records. Un validate() de handler
 * que falla llega como 400 { error: { message: 'Validation failed', errors:
 * [<texto del handler>] } } (recordController.js) — el texto que tiene que
 * ver el usuario está en `errors`, no en `message`. err.userFacing marca que
 * el mensaje se puede mostrar tal cual (ver SubmitManager.js).
 */
async function responseError(response, fallback) {
    let body = null;
    try { body = await response.json(); } catch { /* respuesta sin JSON */ }
    const errors = Array.isArray(body?.error?.errors) ? body.error.errors.filter(Boolean) : [];
    const message = errors.length > 0
        ? errors.join(' ')
        : (body?.error?.message || (typeof body?.error === 'string' ? body.error : null) || fallback);
    const err = new Error(message);
    err.status = response.status;
    err.code = body?.error?.code ?? null;
    err.userFacing = errors.length > 0;
    return err;
}

class RecordService {
    static async load(table, keyField, id, db = 'app') {
        const response = await authFetch(
            `${API_BASE}/${db}/${table}?keyField=${encodeURIComponent(keyField)}&id=${encodeURIComponent(id)}`
        );
        
        if (!response.ok) {
            throw await responseError(response, `Failed to load record`);
        }
        
        const data = await response.json();
        return data.data;
    }
    
    static async create(table, keyField, data, options = {}) {
        const { db = 'app', ...rest } = options;
        const response = await authFetch(`${API_BASE}/${db}/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyField,
                data,
                handler: rest.handler,
                crudMode: rest.crudMode
            })
        });

        if (!response.ok) {
            throw await responseError(response, `Failed to create record`);
        }
        
        const result = await response.json();
        console.log(`🔍 RecordService.create: invalidating cache for ${table}`);
        LookupService.invalidateCache(table);
        if (options.handler?.invalidateTables) {
            console.log(`🔍 RecordService.create: also invalidating`, options.handler.invalidateTables);
            options.handler.invalidateTables.forEach(t => LookupService.invalidateCache(t));
        }
        return { data: result.data, created: true, output: result.output ?? null };
    }
    
    static async upsert(table, keyField, id, data, options = {}) {
        const { db = 'app', ...rest } = options;
        const response = await authFetch(`${API_BASE}/${db}/${table}/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyField,
                data,
                handler: rest.handler,
                crudMode: rest.crudMode
            })
        });

        if (!response.ok) {
            throw await responseError(response, `Failed to save record`);
        }
        
        const result = await response.json();
        console.log(`🔍 RecordService.upsert: invalidating cache for ${table}`);
        LookupService.invalidateCache(table);
        return { data: result.data, created: result.created, updated: result.updated, output: result.output ?? null };
    }
    
    static async update(table, keyField, id, data, options = {}) {
        const { db = 'app', ...rest } = options;
        const response = await authFetch(`${API_BASE}/${db}/${table}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyField,
                data,
                handler: rest.handler,
                crudMode: rest.crudMode
            })
        });

        if (!response.ok) {
            throw await responseError(response, `Failed to update record`);
        }
        
        const result = await response.json();
        LookupService.invalidateCache(table);
        return result.data;
    }
    
    static async delete(table, keyField, id, options = {}) {
        const { db = 'app', ...rest } = options;
        const params = new URLSearchParams({ keyField });
        if (rest.handler) params.set('handler', rest.handler);
        if (rest.crudMode) params.set('crudMode', rest.crudMode);
        const response = await authFetch(
            `${API_BASE}/${db}/${table}/${encodeURIComponent(id)}?${params}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) {
            throw await responseError(response, `Failed to delete record`);
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
    
    static async navigate(table, keyField, currentKey, dir, db = 'app') {
        const url = `${API_BASE}/${db}/${table}/navigate?keyField=${encodeURIComponent(keyField)}&current=${encodeURIComponent(currentKey)}&dir=${encodeURIComponent(dir)}`;
        const response = await authFetch(url);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Navigate failed: ${response.status}`);
        const data = await response.json();
        return data.data;
    }

    static async getTables() {
        const response = await authFetch(`${API_BASE}/tables`);
        
        if (!response.ok) {
            throw await responseError(response, `Failed to get tables`);
        }
        
        const result = await response.json();
        return result.data;
    }
}

export default RecordService;
