import type { FileStorage } from '@/services/storage/FileStorage';
import { decodeText } from '@/utils/text';

/** In-memory FileStorage used by tests. */
export class MemoryStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();

  async readBytes(uriOrPath: string): Promise<Uint8Array> {
    const bytes = this.files.get(uriOrPath);
    if (!bytes) throw new Error(`File not found: ${uriOrPath}`);
    return bytes;
  }

  async readText(uriOrPath: string): Promise<string> {
    return decodeText(await this.readBytes(uriOrPath));
  }

  async readBase64(uriOrPath: string): Promise<string> {
    return Buffer.from(await this.readBytes(uriOrPath)).toString('base64');
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.files.set(path, bytes);
  }

  async copyIn(sourceUri: string, path: string): Promise<void> {
    this.files.set(path, await this.readBytes(sourceUri));
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  toUri(path: string): string {
    return `memory://${path}`;
  }
}
