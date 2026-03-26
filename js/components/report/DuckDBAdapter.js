/**
 * DuckDBAdapter.js
 * Wrapper for DuckDB-WASM with CDN lazy loading
 * 
 * Usage:
 *   const adapter = new DuckDBAdapter();
 *   await adapter.init();
 *   await adapter.loadTable('productos', jsonData);
 *   const results = await adapter.query('SELECT * FROM productos');
 */

const DUCKDB_VERSION = '1.29.0';

const DUCKDB_BUNDLES = {
    eh: {
        mainModule: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-eh.wasm`,
        mainWorker: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-browser-eh.worker.js`
    },
    mvp: {
        mainModule: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-mvp.wasm`,
        mainWorker: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist/duckdb-browser-mvp.worker.js`
    }
};

export class DuckDBAdapter {
    constructor() {
        this.db = null;
        this.conn = null;
        this.tablesLoaded = new Set();
        this.initialized = false;
        this.duckdb = null;
        this.worker = null;
    }

    async init() {
        if (this.initialized) return;

        try {
            console.log('📦 Loading DuckDB-WASM library...');
            
            this.duckdb = await import(
                `https://esm.sh/@duckdb/duckdb-wasm@${DUCKDB_VERSION}?deps=@apache-arrow/ts@17.0.0`
            );
            
            // Use MVP bundle — universal compatibility (EH requires full WASM Exception Handling support)
            const bundle = DUCKDB_BUNDLES.mvp;

            console.log(`📦 Using MVP bundle...`);
            console.log(`📦 Worker: ${bundle.mainWorker}`);
            
            // Polyfill _setThrew before loading the worker — missing in duckdb-wasm 1.29.0
            // (Emscripten invoke_* stubs call it but it's not defined when compiled with WASM exceptions)
            const workerBlob = new Blob(
                [`var _setThrew = function(a, b) {}; importScripts("${bundle.mainWorker}");`],
                { type: 'application/javascript' }
            );
            const workerUrl = URL.createObjectURL(workerBlob);
            
            this.worker = new Worker(workerUrl);
            
            const logger = new this.duckdb.ConsoleLogger();
            this.db = new this.duckdb.AsyncDuckDB(logger, this.worker);
            
            console.log('📦 Instantiating WASM module...');
            await this.db.instantiate(bundle.mainModule);
            URL.revokeObjectURL(workerUrl);
            
            this.conn = await this.db.connect();
            this.initialized = true;
            
            console.log('✅ DuckDB-WASM initialized successfully');
        } catch (error) {
            console.error('❌ DuckDB init failed:', error);
            if (this.worker) {
                this.worker.terminate();
                this.worker = null;
            }
            throw error;
        }
    }

    async loadTable(name, jsonData) {
        if (!this.initialized) {
            await this.init();
        }

        if (this.tablesLoaded.has(name)) {
            return;
        }

        try {
            const jsonStr = JSON.stringify(jsonData);
            const filename = `${name}.json`;
            
            await this.db.registerFileText(filename, jsonStr);
            
            await this.conn.insertJSONFromPath(filename, { name });
            
            this.tablesLoaded.add(name);
            console.log(`✅ Table "${name}" loaded: ${jsonData.length} rows`);
        } catch (error) {
            console.error(`❌ Failed to load table "${name}":`, error);
            throw error;
        }
    }

    async query(sql) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const result = await this.conn.query(sql);
            
            const rows = [];
            for (const row of result.toArray()) {
                rows.push(row.toJSON());
            }
            
            return rows;
        } catch (error) {
            console.error('❌ Query failed:', error);
            console.error('SQL:', sql);
            throw error;
        }
    }

    async tableExists(name) {
        if (!this.initialized) return false;
        
        const result = await this.query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
        );
        return result.length > 0;
    }

    async getTableInfo(name) {
        if (!this.initialized) return null;
        
        return await this.query(`PRAGMA table_info(${name})`);
    }

    async close() {
        if (this.conn) {
            await this.conn.close();
            this.conn = null;
        }
        
        if (this.db) {
            await this.db.terminate();
            this.db = null;
        }
        
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.initialized = false;
        this.tablesLoaded.clear();
    }

    isInitialized() {
        return this.initialized;
    }

    getLoadedTables() {
        return Array.from(this.tablesLoaded);
    }
}

export default DuckDBAdapter;
