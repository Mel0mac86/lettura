import type { SearchService } from '@/services/search/SearchService';
import { bookFilePath, coverFilePath, type FileStorage } from '@/services/storage/FileStorage';
import type { Book, BookFormat } from '@/types/models';
import { DuplicateBookError, InvalidFileError } from '@/utils/errors';
import type { IdGenerator } from '@/utils/ids';
import { titleFromFileName } from '@/utils/text';

import type { BookRepository } from './BookRepository';
import { FORMAT_HANDLERS, type BookFormatHandler } from './bookFormatHandlers';
import { detectFormat, validateBookBytes } from './formats';

export type ImportStep = 'reading' | 'detecting' | 'extracting' | 'saving' | 'indexing' | 'done';

export interface ImportRequest {
  /** Absolute URI of the picked file (usually a cache copy made by the picker). */
  sourceUri: string;
  fileName: string;
  mimeType?: string | null;
}

export interface ImportResult {
  book: Book;
  /** True when title/author could not be read from the file and should be reviewed. */
  needsMetadataReview: boolean;
}

export interface BookImporterDeps {
  storage: FileStorage;
  books: BookRepository;
  search: SearchService;
  newId: IdGenerator;
  /** Content hash used to detect duplicates (SHA-256 in the app). */
  hash: (bytes: Uint8Array) => Promise<string>;
  handlers?: Record<BookFormat, BookFormatHandler>;
}

/**
 * Imports a book into the local library:
 * read → detect format → validate → extract metadata → store file & cover →
 * create the database record → index the text for search.
 *
 * The file never leaves the device. On failure every file written so far is removed.
 */
export class BookImporter {
  private readonly handlers: Record<BookFormat, BookFormatHandler>;

  constructor(private readonly deps: BookImporterDeps) {
    this.handlers = deps.handlers ?? FORMAT_HANDLERS;
  }

  async importBook(request: ImportRequest, onStep?: (step: ImportStep) => void): Promise<ImportResult> {
    const { storage, books, search, newId, hash } = this.deps;

    onStep?.('reading');
    let bytes: Uint8Array;
    try {
      bytes = await storage.readBytes(request.sourceUri);
    } catch {
      throw new InvalidFileError('Impossibile leggere il file selezionato.');
    }

    onStep?.('detecting');
    const format = detectFormat(bytes, request.fileName, request.mimeType);
    validateBookBytes(bytes, format);

    const fileHash = await hash(bytes);
    const existing = await books.findByHash(fileHash);
    if (existing) throw new DuplicateBookError(existing.id);

    onStep?.('extracting');
    const handler = this.handlers[format];
    const extracted = await handler.extract(bytes, request.fileName);

    onStep?.('saving');
    const id = newId();
    const filePath = bookFilePath(id, handler.extension);
    const coverPath = extracted.cover ? coverFilePath(id, extracted.cover.extension) : null;
    const written: string[] = [];
    try {
      await storage.writeBytes(filePath, bytes);
      written.push(filePath);
      if (extracted.cover && coverPath) {
        await storage.writeBytes(coverPath, extracted.cover.bytes);
        written.push(coverPath);
      }

      const fallbackTitle = titleFromFileName(request.fileName);
      const author = extracted.authors.length ? extracted.authors.join(', ') : null;
      const book = await books.create({
        id,
        title: extracted.title ?? fallbackTitle,
        author,
        cover: coverPath,
        filePath,
        originalFileName: request.fileName,
        format,
        language: extracted.language,
        description: extracted.description,
        publisher: extracted.publisher,
        totalPages: extracted.totalPages,
        totalChapters: extracted.totalChapters,
        fileSize: bytes.length,
        fileHash,
        isIndexed: false,
      });

      if (extracted.sections && extracted.sections.length > 0) {
        onStep?.('indexing');
        await search.indexBook(id, extracted.sections);
      }

      onStep?.('done');
      return {
        book: (await books.getById(id)) ?? book,
        needsMetadataReview: !extracted.title || !author,
      };
    } catch (error) {
      await books.delete(id).catch(() => undefined);
      await Promise.all(written.map((path) => storage.delete(path).catch(() => undefined)));
      throw error;
    }
  }

  /** Removes a book, its files and (via ON DELETE CASCADE) all its annotations. */
  async deleteBook(book: Book): Promise<void> {
    await this.deps.books.delete(book.id);
    await this.deps.storage.delete(book.filePath).catch(() => undefined);
    if (book.cover) await this.deps.storage.delete(book.cover).catch(() => undefined);
  }
}
