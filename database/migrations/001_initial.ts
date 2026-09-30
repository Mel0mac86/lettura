import { SCHEMA_V1 } from '../schema';
import type { Migration } from './types';

/** Default categories created on first launch (the user can rename/delete them). */
const DEFAULT_CATEGORIES: readonly [string, string, string][] = [
  ['cat-trading', 'Trading', '📈'],
  ['cat-ai', 'Intelligenza Artificiale', '🤖'],
  ['cat-finance', 'Finanza', '💰'],
  ['cat-novels', 'Romanzi', '📖'],
  ['cat-study', 'Studio', '🎓'],
];

export const migration001: Migration = {
  version: 1,
  name: 'initial schema',
  async up(db) {
    await db.exec(SCHEMA_V1);
    const now = new Date().toISOString();
    for (const [id, name, icon] of DEFAULT_CATEGORIES) {
      await db.run('INSERT OR IGNORE INTO categories (id, name, icon, createdAt) VALUES (?, ?, ?, ?)', [
        id,
        name,
        icon,
        now,
      ]);
    }
  },
};
