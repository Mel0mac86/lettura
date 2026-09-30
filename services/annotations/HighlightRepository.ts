import type { SqlDatabase } from '@/services/database/SqlDatabase';
import { optional } from '@/services/database/rows';
import type { Highlight } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import type { IdGenerator } from '@/utils/ids';
import { serializeLocation } from '@/utils/location';

import { DEFAULT_HIGHLIGHT_COLOR, type WithBook } from './types';

interface HighlightRow {
  id: string;
  bookId: string;
  location: string;
  chapter: string | null;
  page: number | null;
  text: string;
  color: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapHighlight<R extends HighlightRow>(row: R): Highlight & Omit<R, keyof HighlightRow> {
  const { chapter, page, note, ...rest } = row;
  return { ...rest, chapter: optional(chapter), page: optional(page), note: optional(note) } as Highlight &
    Omit<R, keyof HighlightRow>;
}

export interface NewHighlightInput {
  bookId: string;
  location: ReaderLocation;
  text: string;
  color?: string;
  chapter?: string | null;
  page?: number | null;
  note?: string | null;
}

export class HighlightRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly newId: IdGenerator,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async create(input: NewHighlightInput): Promise<Highlight> {
    const text = input.text.trim();
    if (!text) throw new Error('Il testo evidenziato è vuoto.');
    const now = this.now();
    const row: HighlightRow = {
      id: this.newId(),
      bookId: input.bookId,
      location: serializeLocation(input.location),
      chapter: input.chapter ?? null,
      page: input.page ?? null,
      text,
      color: input.color ?? DEFAULT_HIGHLIGHT_COLOR,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.run(
      `INSERT INTO highlights (id, bookId, location, chapter, page, text, color, note, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.bookId, row.location, row.chapter, row.page, row.text, row.color, row.note, row.createdAt, row.updatedAt],
    );
    return mapHighlight(row);
  }

  async listByBook(bookId: string): Promise<Highlight[]> {
    const rows = await this.db.getAll<HighlightRow>(
      'SELECT * FROM highlights WHERE bookId = ? ORDER BY createdAt ASC',
      [bookId],
    );
    return rows.map(mapHighlight);
  }

  async listAll(): Promise<WithBook<Highlight>[]> {
    const rows = await this.db.getAll<WithBook<HighlightRow>>(
      `SELECT h.*, b.title AS bookTitle, b.format AS bookFormat FROM highlights h
       INNER JOIN books b ON b.id = h.bookId ORDER BY h.createdAt DESC`,
    );
    return rows.map(mapHighlight);
  }

  async getById(id: string): Promise<Highlight | null> {
    const row = await this.db.getFirst<HighlightRow>('SELECT * FROM highlights WHERE id = ?', [id]);
    return row ? mapHighlight(row) : null;
  }

  async update(id: string, changes: { color?: string; note?: string | null }): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    await this.db.run('UPDATE highlights SET color = ?, note = ?, updatedAt = ? WHERE id = ?', [
      changes.color ?? current.color,
      changes.note === undefined ? (current.note ?? null) : changes.note?.trim() || null,
      this.now(),
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM highlights WHERE id = ?', [id]);
  }
}
