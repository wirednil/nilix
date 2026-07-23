export type RecordErrorCode = 'TABLE_NOT_FOUND' | 'COLUMN_FORBIDDEN' | 'RECORD_NOT_FOUND' | 'INSERT_FAILED' | 'UPDATE_FAILED' | 'DELETE_FAILED';
export declare function findById<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string, keyField: string, id: unknown, empresaId?: number | null): T | null;
export declare function insert<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string, data: Record<string, unknown>, empresaId?: number | null): {
    success: true;
    data: T;
};
export declare function update<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string, keyField: string, id: unknown, data: Record<string, unknown>, empresaId?: number | null): T;
export declare function upsert<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string, keyField: string, data: Record<string, unknown>, empresaId?: number | null): ({
    success: true;
    data: T;
} | T) & {
    created?: true;
    updated?: true;
};
export declare function remove(tableName: string, keyField: string, id: unknown, empresaId?: number | null): boolean;
export declare function navigate<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string, keyField: string, currentKey: unknown, dir: 'next' | 'prev', empresaId?: number | null): T | null;
//# sourceMappingURL=recordService.d.ts.map