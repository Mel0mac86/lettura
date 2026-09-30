import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { AppSettings, ReaderPreferences } from '@/types/reader';

import { DEFAULT_SETTINGS } from './defaults';

const KEY = 'app_settings';

/** Stores the user preferences as a single JSON document. */
export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  async load(): Promise<AppSettings> {
    const row = await this.db.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [KEY]);
    if (!row) return DEFAULT_SETTINGS;
    try {
      const stored = JSON.parse(row.value) as Partial<AppSettings> & { reader?: Partial<ReaderPreferences> };
      // Merge with defaults so new settings get a value after an app update.
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        reader: { ...DEFAULT_SETTINGS.reader, ...(stored.reader ?? {}) },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [KEY, JSON.stringify(settings)],
    );
  }
}
