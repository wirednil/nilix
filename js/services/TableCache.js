const CACHE_PREFIX = 'nil_catalog_';
const INVALIDATION_KEY = 'nil_invalidation_time';
const DEFAULT_TTL = 86400;

class TableCache {
    static getGlobalInvalidationTime() {
        const stored = localStorage.getItem(INVALIDATION_KEY);
        return stored ? parseInt(stored) : 0;
    }
    
    static setGlobalInvalidationTime(time) {
        localStorage.setItem(INVALIDATION_KEY, String(time));
    }
    
    static get(tableName) {
        const key = CACHE_PREFIX + tableName;
        const raw = localStorage.getItem(key);
        const globalInvalidationTime = this.getGlobalInvalidationTime();
        
        if (!raw) {
            // console.log(`🔍 TableCache.get: ${tableName} - no cache`);
            return null;
        }
        
        try {
            const cached = JSON.parse(raw);
            const now = Date.now();
            
            if (cached.savedAt && cached.savedAt < globalInvalidationTime) {
                // console.log(`🔍 TableCache.get: ${tableName} - invalidated by global timestamp`);
                localStorage.removeItem(key);
                return null;
            }
            
            if (cached.expiresAt && now > cached.expiresAt) {
                // console.log(`🔍 TableCache.get: ${tableName} - expired, removing`);
                localStorage.removeItem(key);
                return null;
            }
            
            // console.log(`🔍 TableCache.get: ${tableName} - hit, rows=${cached.rows?.length}`);
            return cached;
        } catch (e) {
            localStorage.removeItem(key);
            return null;
        }
    }
    
    static set(tableName, data, ttl = DEFAULT_TTL) {
        const key = CACHE_PREFIX + tableName;
        const now = Date.now();
        
        const cached = {
            table: tableName,
            rows: data.rows,
            count: data.count || data.rows?.length || 0,
            timestamp: data.timestamp || now,
            fetchedAt: now,
            savedAt: now,
            expiresAt: now + (ttl * 1000),
            ttl: ttl
        };
        
        localStorage.setItem(key, JSON.stringify(cached));
        return cached;
    }
    
    static invalidate(tableName) {
        const now = Date.now();
        this.setGlobalInvalidationTime(now);
        const key = CACHE_PREFIX + tableName;
        // console.log(`🔍 TableCache.invalidate: ${tableName}, globalTime=${now}`);
        localStorage.removeItem(key);
    }
    
    static invalidateAll() {
        const now = Date.now();
        this.setGlobalInvalidationTime(now);
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
    
    static getInfo() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
        
        const info = cacheKeys.map(key => {
            const raw = localStorage.getItem(key);
            try {
                const cached = JSON.parse(raw);
                return {
                    table: cached.table,
                    count: cached.count,
                    fetchedAt: cached.fetchedAt,
                    expiresAt: cached.expiresAt,
                    isExpired: Date.now() > cached.expiresAt
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        
        return {
            totalCatalogs: info.length,
            catalogs: info
        };
    }
    
    static getRemainingTTL(tableName) {
        const cached = this.get(tableName);
        if (!cached) return 0;
        
        const remaining = Math.max(0, cached.expiresAt - Date.now());
        return Math.floor(remaining / 1000);
    }
}

export default TableCache;
