import schemaService from './schemaService';
import type { Database, Statement } from 'sql.js';

export interface ScopedDb {
  find<T extends Record<string, unknown>>(table: string, conditions?: Record<string, unknown>): T | null;
  findAll<T extends Record<string, unknown>>(table: string, conditions?: Record<string, unknown>): T[];
  insert(table: string, data: Record<string, unknown>): number;
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
  prepare(sql: string): Statement;
}

function isTenantTable(tableName: string): boolean {
  return schemaService.hasColumn(tableName, 'empresa_id');
}

export function createScopedDb(rawDb: Database, empresaId: number | null): ScopedDb {
  return {
    find<T extends Record<string, unknown>>(table: string, conditions: Record<string, unknown> = {}): T | null {
      const tenant = empresaId != null && isTenantTable(table);
      const all: Record<string, unknown> = tenant
        ? { ...conditions, empresa_id: empresaId }
        : { ...conditions };
      const keys = Object.keys(all);
      const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
      const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where} LIMIT 1`);
      if (keys.length) stmt.bind(keys.map(k => all[k]));
      let row: T | null = null;
      if (stmt.step()) row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    },

    findAll<T extends Record<string, unknown>>(table: string, conditions: Record<string, unknown> = {}): T[] {
      const tenant = empresaId != null && isTenantTable(table);
      const all: Record<string, unknown> = tenant
        ? { ...conditions, empresa_id: empresaId }
        : { ...conditions };
      const keys = Object.keys(all);
      const where = keys.length ? 'WHERE ' + keys.map(k => `${k} = ?`).join(' AND ') : '';
      const stmt = rawDb.prepare(`SELECT * FROM ${table} ${where}`);
      if (keys.length) stmt.bind(keys.map(k => all[k]));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      stmt.free();
      return rows;
    },

    insert(table: string, data: Record<string, unknown>): number {
      const tenant = empresaId != null && isTenantTable(table);
      const row: Record<string, unknown> = tenant
        ? { ...data, empresa_id: empresaId }
        : { ...data };
      const keys = Object.keys(row);
      const stmt = rawDb.prepare(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
      );
      stmt.bind(keys.map(k => row[k]));
      stmt.step();
      stmt.free();
      const result = rawDb.exec("SELECT last_insert_rowid()");
      return result[0]?.values[0]?.[0] as number;
    },

    exec(sql: string, params: unknown[] = []): Array<{ columns: string[]; values: unknown[][] }> {
      return rawDb.exec(sql, params);
    },

    prepare(sql: string): Statement {
      return rawDb.prepare(sql);
    }
  };
}
