import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { Note } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import type { IdGenerator } from '@/utils/ids';
import { serializeLocation } from '@/utils/location';

import type { WithBook } from './types';

export interface NewNoteInput {
  bookId: string;
  text: string;
  location?: ReaderLocation | null;
  chapter?: string | null;
  page?: number | null;
  quote?: string | null;
}

export class NoteRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly newId: IdGenerator,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: NewNoteInput): Promise<Note> {
    const text = input.text.trim();
    if (!text) throw new Error('La nota è vuota.');
    const now = this.now();
    const note: Note = {
      id: this.newId(),
      bookId: input.bookId,
      location: input.location ? serializeLocation(input.location) : null,
      chapter: input.chapter ?? null,
      page: input.page ?? null,
      quote: input.quote?.trim() || null,
      text,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.run(
      `INSERT INTO notes (id, bookId, location, chapter, page, quote, text, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [note.id, note.bookId, note.location, note.chapter, note.page, note.quote, note.text, note.createdAt, note.updatedAt],
    );
    return note;
  }

  listByBook(bookId: string): Promise<Note[]> {
    return this.db.getAll<Note>('SELECT * FROM notes WHERE bookId = ? ORDER BY createdAt DESC', [bookId]);
  }

  listAll(): Promise<WithBook<Note>[]> {
    return this.db.getAll<WithBook<Note>>(
      `SELECT n.*, b.title AS bookTitle, b.format AS bookFormat FROM notes n
       INNER JOIN books b ON b.id = n.bookId ORDER BY n.updatedAt DESC`,
    );
  }

  getById(id: string): Promise<Note | null> {
    return this.db.getFirst<Note>('SELECT * FROM notes WHERE id = ?', [id]);
  }

  async update(id: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('La nota è vuota.');
    await this.db.run('UPDATE notes SET text = ?, updatedAt = ? WHERE id = ?', [trimmed, this.now(), id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM notes WHERE id = ?', [id]);
  }
}
