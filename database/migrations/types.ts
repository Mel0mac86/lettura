import type { SqlDatabase } from '@/services/database/SqlDatabase';

export interface Migration {
  /** Target `PRAGMA user_version` after this migration. Must be strictly increasing. */
  version: number;
  name: string;
  up(db: SqlDatabase): Promise<void>;
}
