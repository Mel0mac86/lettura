import initSqlJs from 'sql.js';

import { runMigrations } from '@/database/migrate';
import { SqlJsDatabase } from '@/services/database/sqlJsDatabase';

export { SqlJsDatabase };

/** Fresh in-memory SQLite database with the app schema. */
export async function createTestDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  const db = new SqlJsDatabase(new SQL.Database());
  await runMigrations(db);
  return db;
}
