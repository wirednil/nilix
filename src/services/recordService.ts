import { getDatabase, saveDatabase } from './database';
import schemaService from './schemaService';

// ─── Error codes ─────────────────────────────────────────────────────────────

export type RecordErrorCode =
  | 'TABLE_NOT_FOUND'
  | 'COLUMN_FORBIDDEN'
  | 'RECORD_NOT_FOUND'
  | 'INSERT_FAILED'
  | 'UPDATE_FAILED'
  | 'DELETE_FAILED';

function createError(code: RecordErrorCode, message: string): Error & { code: RecordErrorCode } {
  const err = new Error(message) as Error & { code: RecordErrorCode };
  err.code = code;
  return err;
}

function assertTableExists(tableName: string): void {
  if (!schemaService.tableExists(tableName)) {
    throw createError('TABLE_NOT_FOUND', `Table not found: ${tableName}`);
  }
}

function assertColumnAllowed(tableName: string, columnName: string): void {
  if (!schemaService.isColumnAllowed(tableName, columnName)) {
    throw createError('COLUMN_FORBIDDEN', `Column not allowed: ${columnName}`);
  }
}

function isTenantTable(tableName: string): boolean {
  return schemaService.hasColumn(tableName, 'empresa_id');
}

function filterValidFields(tableName: string, data: Record<string, unknown>): Record<string, unknown> {
  const tableInfo = schemaService.getTableInfo(tableName);
  if (!tableInfo) return {};

  const validColumns = new Set(tableInfo.map(col => col.name));
  const filtered: Record<string, unknown> = {};

  Object.keys(data).forEach(key => {
    if (validColumns.has(key)) {
      filtered[key] = data[key];
    }
  });

  return filtered;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function findById<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string, keyField: string, id: unknown, empresaId?: number | null
): T | null {
  assertTableExists(tableName);
  assertColumnAllowed(tableName, keyField);

  const db = getDatabase();
  const tenant = empresaId != null && isTenantTable(tableName);
  const sql = tenant
    ? `SELECT * FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`
    : `SELECT * FROM ${tableName} WHERE ${keyField} = ?`;

  const stmt = db.prepare(sql);
  stmt.bind(tenant ? [id, empresaId] : [id]);

  let result: T | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();

  return result;
}

export function insert<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string, data: Record<string, unknown>, empresaId?: number | null
): { success: true; data: T } {
  assertTableExists(tableName);

  // Always enforce empresa_id from token — never trust client value
  if (empresaId != null && isTenantTable(tableName)) {
    data = { ...data, empresa_id: empresaId };
  }

  const filteredData = filterValidFields(tableName, data) as T;

  const db = getDatabase();
  const fields = Object.keys(filteredData).filter(f => filteredData[f] !== undefined);
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(f => filteredData[f]);

  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;

  try {
    const stmt = db.prepare(sql);
    stmt.bind(values);
    stmt.step();
    stmt.free();

    // Inject auto-generated PK back into result data
    const pkCol = schemaService.getPrimaryKey(tableName);
    if (pkCol && filteredData[pkCol] == null) {
      const rowidRows = db.exec('SELECT last_insert_rowid()');
      const rowid = rowidRows[0]?.values[0]?.[0];
      if (rowid != null) (filteredData as Record<string, unknown>)[pkCol] = rowid;
    }

    saveDatabase();

    return { success: true, data: filteredData };
  } catch (error) {
    throw createError('INSERT_FAILED', `Insert failed: ${(error as Error).message}`);
  }
}

export function update<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string, keyField: string, id: unknown, data: Record<string, unknown>, empresaId?: number | null
): T {
  assertTableExists(tableName);
  assertColumnAllowed(tableName, keyField);

  const existing = findById(tableName, keyField, id, empresaId);
  if (!existing) {
    throw createError('RECORD_NOT_FOUND', `Record not found: ${keyField}=${id}`);
  }

  const filteredData = filterValidFields(tableName, data);
  const db = getDatabase();
  const tenant = empresaId != null && isTenantTable(tableName);

  const fields = Object.keys(filteredData).filter(f =>
    filteredData[f] !== undefined && f !== keyField && f !== 'empresa_id'
  );

  if (fields.length === 0) {
    return existing as T;
  }

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => filteredData[f]);
  const sql = tenant
    ? `UPDATE ${tableName} SET ${setClause} WHERE ${keyField} = ? AND empresa_id = ?`
    : `UPDATE ${tableName} SET ${setClause} WHERE ${keyField} = ?`;

  try {
    const stmt = db.prepare(sql);
    stmt.bind(tenant ? [...values, id, empresaId] : [...values, id]);
    stmt.step();
    stmt.free();

    saveDatabase();

    return findById(tableName, keyField, id, empresaId) as T;
  } catch (error) {
    throw createError('UPDATE_FAILED', `Update failed: ${(error as Error).message}`);
  }
}

export function upsert<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string, keyField: string, data: Record<string, unknown>, empresaId?: number | null
): ({ success: true; data: T } | T) & { created?: true; updated?: true } {
  assertTableExists(tableName);

  const keyValue = data[keyField];
  if (keyValue === undefined || keyValue === null || keyValue === '') {
    return { ...insert(tableName, data, empresaId), created: true };
  }

  const existing = findById(tableName, keyField, keyValue, empresaId);

  if (existing) {
    return { ...update(tableName, keyField, keyValue, data, empresaId), updated: true };
  } else {
    return { ...insert(tableName, data, empresaId), created: true };
  }
}

export function remove(
  tableName: string, keyField: string, id: unknown, empresaId?: number | null
): boolean {
  assertTableExists(tableName);
  assertColumnAllowed(tableName, keyField);

  const existing = findById(tableName, keyField, id, empresaId);
  if (!existing) {
    throw createError('RECORD_NOT_FOUND', `Record not found: ${keyField}=${id}`);
  }

  const db = getDatabase();
  const tenant = empresaId != null && isTenantTable(tableName);
  const sql = tenant
    ? `DELETE FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`
    : `DELETE FROM ${tableName} WHERE ${keyField} = ?`;

  try {
    const stmt = db.prepare(sql);
    stmt.bind(tenant ? [id, empresaId] : [id]);
    stmt.step();
    stmt.free();

    saveDatabase();

    return true;
  } catch (error) {
    throw createError('DELETE_FAILED', `Delete failed: ${(error as Error).message}`);
  }
}

export function navigate<T extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string, keyField: string, currentKey: unknown, dir: 'next' | 'prev', empresaId?: number | null
): T | null {
  assertTableExists(tableName);
  assertColumnAllowed(tableName, keyField);

  const db = getDatabase();
  const tenant = empresaId != null && isTenantTable(tableName);

  let sql: string;
  if (dir === 'next') {
    sql = tenant
      ? `SELECT * FROM ${tableName} WHERE ${keyField} > ? AND empresa_id = ? ORDER BY ${keyField} ASC LIMIT 1`
      : `SELECT * FROM ${tableName} WHERE ${keyField} > ? ORDER BY ${keyField} ASC LIMIT 1`;
  } else {
    sql = tenant
      ? `SELECT * FROM ${tableName} WHERE ${keyField} < ? AND empresa_id = ? ORDER BY ${keyField} DESC LIMIT 1`
      : `SELECT * FROM ${tableName} WHERE ${keyField} < ? ORDER BY ${keyField} DESC LIMIT 1`;
  }

  const stmt = db.prepare(sql);
  stmt.bind(tenant ? [currentKey, empresaId] : [currentKey]);

  let result: T | null = null;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();

  return result;
}
