import type { SqlDatabase, SqlValue } from '@/services/database/SqlDatabase';
import { fromBool, toBool } from '@/services/database/rows';
import type { Book, BookFormat, ReadingStatus } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import { NotFoundError } from '@/utils/errors';
import { parseLocation, serializeLocation } from '@/utils/location';
import { statusFromProgress } from '@/utils/progress';
import { normalizeForSearch } from '@/utils/text';

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  filePath: string;
  originalFileName: string;
  format: BookFormat;
  language: string | null;
  description: string | null;
  publisher: string | null;
  status: ReadingStatus;
  progress: number;
  currentPage: number | null;
  currentChapter: string | null;
  location: string | null;
  totalPages: number | null;
  totalChapters: number | null;
  fileSize: number;
  fileHash: string;
  isFavorite: number;
  isIndexed: number;
  createdAt: string;
  updatedAt: string;
  lastReadAt: string | null;
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    cover: row.cover,
    filePath: row.filePath,
    originalFileName: row.originalFileName,
    format: row.format,
    language: row.language,
    description: row.description,
    publisher: row.publisher,
    status: row.status,
    progress: row.progress,
    currentPage: row.currentPage,
    currentChapter: row.currentChapter,
    location: row.location,
    totalPages: row.totalPages,
    totalChapters: row.totalChapters,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    isFavorite: toBool(row.isFavorite),
    isIndexed: toBool(row.isIndexed),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastReadAt: row.lastReadAt,
  };
}

export interface NewBookInput {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  filePath: string;
  originalFileName: string;
  format: BookFormat;
  language: string | null;
  description: string | null;
  publisher: string | null;
  totalPages: number | null;
  totalChapters: number | null;
  fileSize: number;
  fileHash: string;
  isIndexed: boolean;
}

export interface BookMetadataUpdate {
  title?: string;
  author?: string | null;
  language?: string | null;
  description?: string | null;
  publisher?: string | null;
}

export interface ReadingPositionUpdate {
  location: ReaderLocation;
  progress: number;
  currentPage?: number | null;
  currentChapter?: string | null;
}

export interface ReadingPosition {
  location: ReaderLocation | null;
  progress: number;
  currentPage: number | null;
  currentChapter: string | null;
  lastReadAt: string | null;
  status: ReadingStatus;
}

export type BookFilter = 'all' | 'reading' | 'not_started' | 'completed' | 'favorites';
export type BookSort = 'recent' | 'added' | 'title' | 'author' | 'progress';

export interface BookListOptions {
  filter?: BookFilter;
  sort?: BookSort;
  categoryId?: string | null;
  query?: string;
  limit?: number;
}

const ORDER_BY: Record<BookSort, string> = {
  recent: 'COALESCE(b.lastReadAt, b.createdAt) DESC',
  added: 'b.createdAt DESC',
  title: 'b.title COLLATE NOCASE ASC',
  author: 'b.author IS NULL, b.author COLLATE NOCASE ASC, b.title COLLATE NOCASE ASC',
  progress: 'b.progress DESC, b.title COLLATE NOCASE ASC',
};

function buildSearchKey(title: string, author: string | null): string {
  return normalizeForSearch(`${title} ${author ?? ''}`);
}

/** Data access for the `books` table (and book tags). */
export class BookRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: NewBookInput): Promise<Book> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO books (id, title, author, cover, filePath, originalFileName, format, language, description,
        publisher, status, progress, totalPages, totalChapters, fileSize, fileHash, isFavorite, isIndexed,
        searchKey, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started', 0, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        input.id,
        input.title,
        input.author,
        input.cover,
        input.filePath,
        input.originalFileName,
        input.format,
        input.language,
        input.description,
        input.publisher,
        input.totalPages,
        input.totalChapters,
        input.fileSize,
        input.fileHash,
        fromBool(input.isIndexed),
        buildSearchKey(input.title, input.author),
        now,
        now,
      ],
    );
    return this.require(input.id);
  }

  async getById(id: string): Promise<Book | null> {
    const row = await this.db.getFirst<BookRow>('SELECT * FROM books WHERE id = ?', [id]);
    return row ? mapBook(row) : null;
  }

  async require(id: string): Promise<Book> {
    const book = await this.getById(id);
    if (!book) throw new NotFoundError('Libro');
    return book;
  }

  async findByHash(fileHash: string): Promise<Book | null> {
    const row = await this.db.getFirst<BookRow>('SELECT * FROM books WHERE fileHash = ? LIMIT 1', [fileHash]);
    return row ? mapBook(row) : null;
  }

  async list(options: BookListOptions = {}): Promise<Book[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    let join = '';

    switch (options.filter ?? 'all') {
      case 'reading':
      case 'not_started':
      case 'completed':
        where.push('b.status = ?');
        params.push(options.filter as ReadingStatus);
        break;
      case 'favorites':
        where.push('b.isFavorite = 1');
        break;
      default:
        break;
    }
    if (options.categoryId) {
      join = 'INNER JOIN book_categories bc ON bc.bookId = b.id';
      where.push('bc.categoryId = ?');
      params.push(options.categoryId);
    }
    const query = options.query ? normalizeForSearch(options.query.trim()) : '';
    if (query) {
      where.push(`(instr(b.searchKey, ?) > 0 OR b.id IN (SELECT bookId FROM book_tags WHERE lower(tag) = ?))`);
      params.push(query, query);
    }
    const sql = `SELECT b.* FROM books b ${join}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${ORDER_BY[options.sort ?? 'recent']}
      ${options.limit ? `LIMIT ${Math.floor(options.limit)}` : ''}`;
    const rows = await this.db.getAll<BookRow>(sql, params);
    return rows.map(mapBook);
  }

  /** Books currently being read, most recent first. */
  async listContinueReading(limit = 5): Promise<Book[]> {
    const rows = await this.db.getAll<BookRow>(
      `SELECT * FROM books WHERE status = 'reading' AND lastReadAt IS NOT NULL
       ORDER BY lastReadAt DESC LIMIT ?`,
      [limit],
    );
    return rows.map(mapBook);
  }

  async updateMetadata(id: string, update: BookMetadataUpdate): Promise<Book> {
    const current = await this.require(id);
    const next = {
      title: update.title?.trim() || current.title,
      author: update.author === undefined ? current.author : update.author?.trim() || null,
      language: update.language === undefined ? current.language : update.language?.trim() || null,
      description:
        update.description === undefined ? current.description : update.description?.trim() || null,
      publisher: update.publisher === undefined ? current.publisher : update.publisher?.trim() || null,
    };
    await this.db.run(
      `UPDATE books SET title = ?, author = ?, language = ?, description = ?, publisher = ?, searchKey = ?,
       updatedAt = ? WHERE id = ?`,
      [
        next.title,
        next.author,
        next.language,
        next.description,
        next.publisher,
        buildSearchKey(next.title, next.author),
        this.now(),
        id,
      ],
    );
    return this.require(id);
  }

  /** Saves the reading position. Status is derived from progress. */
  async savePosition(id: string, position: ReadingPositionUpdate): Promise<void> {
    const now = this.now();
    const progress = Math.min(1, Math.max(0, position.progress));
    const result = await this.db.run(
      `UPDATE books SET location = ?, progress = ?, currentPage = ?, currentChapter = ?, status = ?,
       lastReadAt = ?, updatedAt = ? WHERE id = ?`,
      [
        serializeLocation(position.location),
        progress,
        position.currentPage ?? null,
        position.currentChapter ?? null,
        // Opening a book always means it is being read, even at 0%.
        statusFromProgress(progress) === 'completed' ? 'completed' : 'reading',
        now,
        now,
        id,
      ],
    );
    if (result.changes === 0) throw new NotFoundError('Libro');
  }

  async getPosition(id: string): Promise<ReadingPosition> {
    const book = await this.require(id);
    return {
      location: parseLocation(book.location),
      progress: book.progress,
      currentPage: book.currentPage,
      currentChapter: book.currentChapter,
      lastReadAt: book.lastReadAt,
      status: book.status,
    };
  }

  /** Manually sets the reading status. "Non iniziato" also resets the position. */
  async setStatus(id: string, status: ReadingStatus): Promise<void> {
    const now = this.now();
    if (status === 'not_started') {
      await this.db.run(
        `UPDATE books SET status = 'not_started', progress = 0, location = NULL, currentPage = NULL,
         currentChapter = NULL, updatedAt = ? WHERE id = ?`,
        [now, id],
      );
    } else if (status === 'completed') {
      await this.db.run(`UPDATE books SET status = 'completed', progress = 1, updatedAt = ? WHERE id = ?`, [
        now,
        id,
      ]);
    } else {
      await this.db.run(`UPDATE books SET status = 'reading', updatedAt = ? WHERE id = ?`, [now, id]);
    }
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<void> {
    await this.db.run('UPDATE books SET isFavorite = ?, updatedAt = ? WHERE id = ?', [
      fromBool(isFavorite),
      this.now(),
      id,
    ]);
  }

  async setCover(id: string, cover: string | null): Promise<void> {
    await this.db.run('UPDATE books SET cover = ?, updatedAt = ? WHERE id = ?', [cover, this.now(), id]);
  }

  async setIndexed(id: string, isIndexed: boolean): Promise<void> {
    await this.db.run('UPDATE books SET isIndexed = ? WHERE id = ?', [fromBool(isIndexed), id]);
  }

  async updateTotals(id: string, totals: { totalPages?: number | null; totalChapters?: number | null }) {
    const current = await this.require(id);
    await this.db.run('UPDATE books SET totalPages = ?, totalChapters = ?, updatedAt = ? WHERE id = ?', [
      totals.totalPages === undefined ? current.totalPages : totals.totalPages,
      totals.totalChapters === undefined ? current.totalChapters : totals.totalChapters,
      this.now(),
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM books WHERE id = ?', [id]);
  }

  async count(): Promise<number> {
    const row = await this.db.getFirst<{ n: number }>('SELECT COUNT(*) AS n FROM books');
    return row?.n ?? 0;
  }

  // --- Tags ---------------------------------------------------------------

  async getTags(bookId: string): Promise<string[]> {
    const rows = await this.db.getAll<{ tag: string }>(
      'SELECT tag FROM book_tags WHERE bookId = ? ORDER BY tag COLLATE NOCASE',
      [bookId],
    );
    return rows.map((r) => r.tag);
  }

  async setTags(bookId: string, tags: readonly string[]): Promise<void> {
    const unique = Array.from(
      new Map(tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean).map((t) => [t.toLowerCase(), t])).values(),
    );
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM book_tags WHERE bookId = ?', [bookId]);
      for (const tag of unique) {
        await this.db.run('INSERT INTO book_tags (bookId, tag) VALUES (?, ?)', [bookId, tag]);
      }
    });
  }

  async listAllTags(): Promise<string[]> {
    const rows = await this.db.getAll<{ tag: string }>(
      'SELECT DISTINCT tag FROM book_tags ORDER BY tag COLLATE NOCASE',
    );
    return rows.map((r) => r.tag);
  }
}
