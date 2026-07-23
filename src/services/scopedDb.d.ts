import type { Database, Statement } from 'sql.js';
export interface ScopedDb {
    find<T extends Record<string, unknown>>(table: string, conditions?: Record<string, unknown>): T | null;
    findAll<T extends Record<string, unknown>>(table: string, conditions?: Record<string, unknown>): T[];
    insert(table: string, data: Record<string, unknown>): number;
    exec(sql: string, params?: unknown[]): Array<{
        columns: string[];
        values: unknown[][];
    }>;
    prepare(sql: string): Statement;
}
export declare function createScopedDb(rawDb: Database, empresaId: number | null): ScopedDb;
//# sourceMappingURL=scopedDb.d.ts.map