export function tableExists(tableName: string): boolean;
export function getAllTables(): string[];
export function getTableInfo(tableName: string): Array<{
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}> | null;
export function getPrimaryKey(tableName: string): string | null;
export function hasColumn(tableName: string, columnName: string): boolean;
export function isTableAllowed(tableName: string): boolean;
export function isColumnAllowed(tableName: string, columnName: string): boolean;
