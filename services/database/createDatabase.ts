import { ExpoSqliteDatabase } from './expoSqliteDatabase';
import type { SqlDatabase } from './SqlDatabase';

/** iOS/Android: native SQLite through expo-sqlite. */
export function createDatabase(): Promise<SqlDatabase> {
  return ExpoSqliteDatabase.open();
}
