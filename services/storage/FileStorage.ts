/**
 * Abstraction over the device file system. Paths passed to these methods are
 * **relative** to the app's private storage root (e.g. "books/<id>.epub").
 * Absolute URIs are never persisted because on iOS the app container path can
 * change between app updates.
 */
export interface FileStorage {
  /** Reads a file given an absolute URI (e.g. the picker result) or a relative path. */
  readBytes(uriOrPath: string): Promise<Uint8Array>;
  readText(uriOrPath: string): Promise<string>;
  readBase64(uriOrPath: string): Promise<string>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /** Copies an external file (absolute URI) into the private storage. */
  copyIn(sourceUri: string, path: string): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Absolute URI usable by <Image> / WebView for a relative path. */
  toUri(path: string): string;
}

export const STORAGE_DIRS = {
  books: 'books',
  covers: 'covers',
} as const;

export function bookFilePath(bookId: string, extension: string): string {
  return `${STORAGE_DIRS.books}/${bookId}.${extension}`;
}

export function coverFilePath(bookId: string, extension: string): string {
  return `${STORAGE_DIRS.covers}/${bookId}.${extension}`;
}
