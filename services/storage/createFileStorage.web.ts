import type { FileStorage } from './FileStorage';
import { WebFileStorage } from './webFileStorage';

/** Web: files in IndexedDB (see WebFileStorage). */
export async function createFileStorage(): Promise<FileStorage> {
  const storage = new WebFileStorage();
  await storage.init();
  return storage;
}
