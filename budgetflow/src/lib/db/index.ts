import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dataDir = join(process.cwd(), '.data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const client = createClient({
  url: `file:${join(dataDir, 'budgetflow.db')}`,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;

let _initPromise: Promise<void> | null = null;

export function ensureInitialized(): Promise<void> {
  if (!_initPromise) {
    _initPromise = import('./migrate').then((m) => m.initializeDatabase());
  }
  return _initPromise;
}
