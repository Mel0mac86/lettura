import type { Database } from 'sql.js';

import type { SqlDatabase, SqlParams, SqlRunResult } from './SqlDatabase';

/**
 * {@link SqlDatabase} on top of sql.js (SQLite compiled to WebAssembly).
 * Used by the web app and by the automated tests. `onChange` is called after
 * every write so the owner can persist the database.
 */
export class SqlJsDatabase implements SqlDatabase {
  private depth = 0;

  constructor(
    readonly db: Database,
    private readonly onChange: () => void = () => undefined,
  ) {}

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
    if (this.depth === 0) this.onChange();
  }

  async run(sql: string, params: SqlParams = []): Promise<SqlRunResult> {
    this.db.run(sql, [...params]);
    const changes = this.db.getRowsModified();
    const row = this.db.exec('SELECT last_insert_rowid() AS id')[0];
    if (this.depth === 0 && changes > 0) this.onChange();
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
    this.onChange();
  }
}
