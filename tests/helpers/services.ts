import { createHash } from 'crypto';

import { createServices, type AppServices } from '@/services/container';

import { MemoryStorage } from './memoryStorage';
import { createTestDatabase, type SqlJsDatabase } from './sqlJsDatabase';

export interface TestContext {
  db: SqlJsDatabase;
  storage: MemoryStorage;
  services: AppServices;
}

export async function createTestContext(): Promise<TestContext> {
  const db = await createTestDatabase();
  const storage = new MemoryStorage();
  let counter = 0;
  const services = createServices({
    db,
    storage,
    newId: () => `id-${++counter}`,
    hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  });
  return { db, storage, services };
}
