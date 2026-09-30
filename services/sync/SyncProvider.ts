/**
 * Cloud sync contract (V2). The local SQLite database stays the source of
 * truth (offline-first); a provider pushes local changes and pulls remote ones.
 *
 * Planned implementation: Supabase (Postgres + Row Level Security + Storage).
 * Every table already uses UUID primary keys and ISO `updatedAt`/`createdAt`
 * timestamps, which allows "last write wins" conflict resolution per record.
 */
export type SyncEntity = 'books' | 'bookmarks' | 'highlights' | 'notes' | 'categories' | 'positions';

export interface SyncResult {
  pushed: number;
  pulled: number;
  finishedAt: string;
}

export interface SyncProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  /** Syncs the given entities; book files are uploaded only if the user enables backup. */
  sync(entities: readonly SyncEntity[], options: { includeFiles: boolean }): Promise<SyncResult>;
}

/** V1 default: everything stays on the device. */
export class LocalOnlySyncProvider implements SyncProvider {
  readonly id = 'local-only';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async sync(): Promise<SyncResult> {
    return { pushed: 0, pulled: 0, finishedAt: new Date().toISOString() };
  }
}
