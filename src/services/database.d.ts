import type { Database } from 'sql.js';

export function initDatabase(): Promise<Database>;
export function getDatabase(): Database;
export function saveDatabase(): void;
export function closeDatabase(): void;
