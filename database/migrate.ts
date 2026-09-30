import type { SqlDatabase } from '@/services/database/SqlDatabase';
import { MIGRATIONS, type Migration } from './migrations';

/**
 * Brings the database schema up to date using `PRAGMA user_version`.
 * Each migration runs in its own transaction.
 *
 * @returns the schema version after migrating
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= current) continue;
    await db.transaction(async () => {
      await migration.up(db);
      // PRAGMA does not support bound parameters; the version is a trusted integer.
      await db.exec(`PRAGMA user_version = ${Math.floor(migration.version)}`);
    });
    current = migration.version;
  }
  return current;
}
