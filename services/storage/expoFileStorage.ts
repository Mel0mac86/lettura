import { Directory, File, Paths } from 'expo-file-system';

import type { FileStorage } from './FileStorage';

const ROOT_DIR = 'library';

function isAbsoluteUri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

/**
 * {@link FileStorage} backed by expo-file-system. Files live in the app's
 * private document directory (`<documents>/library/...`), which is excluded
 * from other apps and included in the device backup.
 */
export class ExpoFileStorage implements FileStorage {
  private readonly root: Directory;

  constructor() {
    this.root = new Directory(Paths.document, ROOT_DIR);
  }

  private fileFor(uriOrPath: string): File {
    return isAbsoluteUri(uriOrPath) ? new File(uriOrPath) : new File(this.root, uriOrPath);
  }

  private ensureParent(file: File): void {
    const parent = file.parentDirectory;
    if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  }

  async readBytes(uriOrPath: string): Promise<Uint8Array> {
    return this.fileFor(uriOrPath).bytes();
  }

  async readText(uriOrPath: string): Promise<string> {
    return this.fileFor(uriOrPath).text();
  }

  async readBase64(uriOrPath: string): Promise<string> {
    return this.fileFor(uriOrPath).base64();
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const file = this.fileFor(path);
    this.ensureParent(file);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
  }

  async copyIn(sourceUri: string, path: string): Promise<void> {
    const target = this.fileFor(path);
    this.ensureParent(target);
    if (target.exists) target.delete();
    await new File(sourceUri).copy(target);
  }

  async delete(path: string): Promise<void> {
    const file = this.fileFor(path);
    if (file.exists) file.delete();
  }

  async exists(path: string): Promise<boolean> {
    return this.fileFor(path).exists;
  }

  toUri(path: string): string {
    return isAbsoluteUri(path) ? path : this.fileFor(path).uri;
  }
}
