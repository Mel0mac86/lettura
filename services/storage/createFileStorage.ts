import { ExpoFileStorage } from './expoFileStorage';
import type { FileStorage } from './FileStorage';

/** Native (iOS/Android): files in the app's private document directory. */
export async function createFileStorage(): Promise<FileStorage> {
  return new ExpoFileStorage();
}
