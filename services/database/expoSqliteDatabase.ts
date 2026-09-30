import * as SQLite from 'expo-sqlite';

import type { SqlDatabase, SqlParams } from './SqlDatabase';

export const DATABASE_NAME = 'my-book-reader.db';

/** {@link SqlDatabase} implementation backed by expo-sqlite (iOS, Android, web). */
export class ExpoSqliteDatabase implements SqlDatabase {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(name: string = DATABASE_NAME): Promise<ExpoSqliteDatabase> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    return new ExpoSqliteDatabase(db);
  }

  exec(sql: string): Promise<void> {
    return this.db.execAsync(sql);
  }

  async run(sql: string, params: SqlParams = []) {
    const result = await this.db.runAsync(sql, [...params]);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  getAll<T>(sql: string, params: SqlParams = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, [...params]);
  }

  getFirst<T>(sql: string, params: SqlParams = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, [...params]);
  }

  transaction(task: () => Promise<void>): Promise<void> {
    return this.db.withTransactionAsync(task);
  }
}
