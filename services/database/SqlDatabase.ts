/**
 * Minimal async SQL interface used by every repository.
 *
 * The app uses expo-sqlite ({@link ./expoSqliteDatabase}); tests use an
 * in-memory sql.js implementation. Keeping repositories behind this interface
 * also makes it possible to swap the storage engine (e.g. for web or a
 * cloud-synced database) without touching business logic.
 */
export type SqlValue = string | number | null;
export type SqlParams = readonly SqlValue[];

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDatabase {
  /** Executes one or more statements without parameters (DDL, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<SqlRunResult>;
  getAll<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirst<T>(sql: string, params?: SqlParams): Promise<T | null>;
  /** Runs `task` inside a transaction; rolls back if it throws. */
  transaction(task: () => Promise<void>): Promise<void>;
}
