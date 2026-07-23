import { Database } from 'sql.js';

export function initAuthDatabase(): Promise<Database>;
export function getAuthDatabase(): Database;
export function saveAuthDatabase(): void;
export function closeAuthDatabase(): void;

export function getNilConfig(empresaId: number): Record<string, string>;
export function setNilConfig(empresaId: number, clave: string, valor: string): void;
export function getNilConfigValue(empresaId: number, clave: string, defaultValue?: unknown): string;

export function insertAuditLog(params: {
  usuarioId?: number;
  empresaId?: number;
  method: string;
  path: string;
  status: number;
  ms?: number;
  ip?: string;
}): void;

export function queryAuditLog(
  empresaId: number,
  options?: { limit?: number; offset?: number }
): Record<string, unknown>[];

export function queryUsuarios(empresaId: number): Record<string, unknown>[];
export function getUserPermisos(usuarioId: number): string;

export const AUTH_DB_PATH: string;
