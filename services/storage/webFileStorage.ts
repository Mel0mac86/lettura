import type { FileStorage } from './FileStorage';

const DB_NAME = 'my-book-reader-files';
const STORE = 'files';

function isAbsoluteUri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'));
  });
}

function mimeFor(path: string): string {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.gif$/i.test(path)) return 'image/gif';
  if (/\.webp$/i.test(path)) return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Web implementation of {@link FileStorage}: files are stored in the browser's
 * IndexedDB (private to this site, available offline). Image object URLs are
 * cached in memory so that `toUri()` can stay synchronous.
 */
export class WebFileStorage implements FileStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly objectUrls = new Map<string, string>();

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(STORE);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error ?? new Error('Impossibile aprire IndexedDB'));
      });
    }
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.db()).transaction(STORE, mode).objectStore(STORE);
  }

  /** Loads cover images into memory so they can be displayed synchronously. */
  async init(): Promise<void> {
    const keys = (await request((await this.store('readonly')).getAllKeys())) as string[];
    for (const key of keys.filter((k) => k.startsWith('covers/'))) {
      const bytes = await this.readBytes(key);
      this.cacheObjectUrl(key, bytes);
    }
  }

  private cacheObjectUrl(path: string, bytes: Uint8Array): void {
    const previous = this.objectUrls.get(path);
    if (previous) URL.revokeObjectURL(previous);
    this.objectUrls.set(path, URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeFor(path) })));
  }

  async readBytes(uriOrPath: string): Promise<Uint8Array> {
    if (isAbsoluteUri(uriOrPath)) {
      const response = await fetch(uriOrPath);
      return new Uint8Array(await response.arrayBuffer());
    }
    const value = (await request((await this.store('readonly')).get(uriOrPath))) as Uint8Array | undefined;
    if (!value) throw new Error(`File non trovato: ${uriOrPath}`);
    return value;
  }

  async readText(uriOrPath: string): Promise<string> {
    return new TextDecoder().decode(await this.readBytes(uriOrPath));
  }

  async readBase64(uriOrPath: string): Promise<string> {
    const bytes = await this.readBytes(uriOrPath);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    await request((await this.store('readwrite')).put(bytes, path));
    if (path.startsWith('covers/')) this.cacheObjectUrl(path, bytes);
  }

  async copyIn(sourceUri: string, path: string): Promise<void> {
    await this.writeBytes(path, await this.readBytes(sourceUri));
  }

  async delete(path: string): Promise<void> {
    await request((await this.store('readwrite')).delete(path));
    const url = this.objectUrls.get(path);
    if (url) URL.revokeObjectURL(url);
    this.objectUrls.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return (await request((await this.store('readonly')).count(path))) > 0;
  }

  toUri(path: string): string {
    return isAbsoluteUri(path) ? path : (this.objectUrls.get(path) ?? '');
  }
}
