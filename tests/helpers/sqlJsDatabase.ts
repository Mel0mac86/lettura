import initSqlJs, { type Database } from 'sql.js';

import { runMigrations } from '@/database/migrate';
import type { SqlDatabase, SqlParams, SqlRunResult } from '@/services/database/SqlDatabase';

/** In-memory SQLite (sql.js / WebAssembly) implementing the app's SqlDatabase interface. */
export class SqlJsDatabase implements SqlDatabase {
  private depth = 0;

  constructor(private readonly db: Database) {}

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: SqlParams = []): Promise<SqlRunResult> {
    this.db.run(sql, [...params]);
    const changes = this.db.getRowsModified();
    const row = this.db.exec('SELECT last_insert_rowid() AS id')[0];
    return { changes, lastInsertRowId: Number(row?.values[0]?.[0] ?? 0) };
  }

  async getAll<T>(sql: string, params: SqlParams = []): Promise<T[]> {
    const statement = this.db.prepare(sql);
    try {
      statement.bind([...params]);
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  }

  async getFirst<T>(sql: string, params: SqlParams = []): Promise<T | null> {
    const rows = await this.getAll<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction(task: () => Promise<void>): Promise<void> {
    if (this.depth > 0) return task();
    this.depth++;
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.depth--;
    }
  }
}

export async function createTestDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  const db = new SqlJsDatabase(new SQL.Database());
  await runMigrations(db);
  return db;
}
