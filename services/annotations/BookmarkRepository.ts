import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { Bookmark } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import type { IdGenerator } from '@/utils/ids';
import { serializeLocation } from '@/utils/location';

import type { WithBook } from './types';

export interface NewBookmarkInput {
  bookId: string;
  location: ReaderLocation;
  page?: number | null;
  chapter?: string | null;
  text?: string | null;
}

export class BookmarkRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly newId: IdGenerator,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: NewBookmarkInput): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: this.newId(),
      bookId: input.bookId,
      location: serializeLocation(input.location),
      page: input.page ?? null,
      chapter: input.chapter ?? null,
      text: input.text?.trim() ? input.text.trim().slice(0, 500) : null,
      createdAt: this.now(),
    };
    await this.db.run(
      'INSERT INTO bookmarks (id, bookId, location, page, chapter, text, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [bookmark.id, bookmark.bookId, bookmark.location, bookmark.page, bookmark.chapter, bookmark.text, bookmark.createdAt],
    );
    return bookmark;
  }

  listByBook(bookId: string): Promise<Bookmark[]> {
    return this.db.getAll<Bookmark>('SELECT * FROM bookmarks WHERE bookId = ? ORDER BY createdAt DESC', [bookId]);
  }

  listAll(): Promise<WithBook<Bookmark>[]> {
    return this.db.getAll<WithBook<Bookmark>>(
      `SELECT bm.*, b.title AS bookTitle, b.format AS bookFormat FROM bookmarks bm
       INNER JOIN books b ON b.id = bm.bookId ORDER BY bm.createdAt DESC`,
    );
  }

  getById(id: string): Promise<Bookmark | null> {
    return this.db.getFirst<Bookmark>('SELECT * FROM bookmarks WHERE id = ?', [id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM bookmarks WHERE id = ?', [id]);
  }
}
