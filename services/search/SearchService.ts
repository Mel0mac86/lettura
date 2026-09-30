import type { WithBook } from '@/services/annotations/types';
import type { HighlightRepository } from '@/services/annotations/HighlightRepository';
import type { NoteRepository } from '@/services/annotations/NoteRepository';
import type { BookRepository } from '@/services/books/BookRepository';
import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { Book, BookFormat, Highlight, Note, TextSection } from '@/types/models';
import { buildSnippet, findAllOccurrences, normalizeForSearch } from '@/utils/text';

export interface ContentHit {
  bookId: string;
  bookTitle: string;
  bookFormat: BookFormat;
  sectionIndex: number;
  sectionTitle: string | null;
  page: number | null;
  /** Character offset of the match inside the section text. */
  offset: number;
  length: number;
  snippet: string;
  /** Total matches in this section (global search shows only the first one). */
  matchesInSection: number;
}

export interface GlobalSearchResults {
  query: string;
  books: Book[];
  content: ContentHit[];
  notes: WithBook<Note>[];
  highlights: WithBook<Highlight>[];
}

interface TextRow {
  bookId: string;
  sectionIndex: number;
  page: number | null;
  title: string | null;
  text: string;
  bookTitle: string;
  bookFormat: BookFormat;
}

export const MIN_QUERY_LENGTH = 2;

/**
 * Full-text search across the library.
 *
 * The text of each chapter/page is stored in `book_text` together with a
 * length-preserving normalised copy (lower case, no accents). Matching uses
 * SQLite `instr()` on the normalised column, which is fast for a personal
 * library, works on every platform (including the sql.js test database) and
 * lets us map match positions back to the original text.
 */
export class SearchService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly repos: {
      books: BookRepository;
      notes: NoteRepository;
      highlights: HighlightRepository;
    },
  ) {}

  /** Replaces the indexed text of a book. */
  async indexBook(bookId: string, sections: readonly TextSection[]): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM book_text WHERE bookId = ?', [bookId]);
      await this.insertSections(bookId, sections);
    });
    await this.repos.books.setIndexed(bookId, sections.length > 0);
  }

  /** Adds (or replaces) some sections — used to index PDFs page by page. */
  async upsertSections(bookId: string, sections: readonly TextSection[]): Promise<void> {
    await this.db.transaction(() => this.insertSections(bookId, sections));
  }

  private async insertSections(bookId: string, sections: readonly TextSection[]): Promise<void> {
    for (const section of sections) {
      await this.db.run(
        `INSERT OR REPLACE INTO book_text (bookId, sectionIndex, page, title, text, normalized)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookId, section.index, section.page, section.title, section.text, normalizeForSearch(section.text)],
      );
    }
  }

  async getSections(bookId: string): Promise<TextSection[]> {
    return this.db.getAll<TextSection>(
      'SELECT sectionIndex AS "index", title, page, text FROM book_text WHERE bookId = ? ORDER BY sectionIndex',
      [bookId],
    );
  }

  async getSectionText(bookId: string, sectionIndex: number): Promise<string | null> {
    const row = await this.db.getFirst<{ text: string }>(
      'SELECT text FROM book_text WHERE bookId = ? AND sectionIndex = ?',
      [bookId, sectionIndex],
    );
    return row?.text ?? null;
  }

  async search(query: string, limit = 30): Promise<GlobalSearchResults> {
    const trimmed = query.trim();
    const empty: GlobalSearchResults = { query: trimmed, books: [], content: [], notes: [], highlights: [] };
    if (trimmed.length < MIN_QUERY_LENGTH) return empty;
    const needle = normalizeForSearch(trimmed);

    const [books, content, notes, highlights] = await Promise.all([
      this.repos.books.list({ query: trimmed, sort: 'title', limit }),
      this.searchContent(needle, trimmed, { limit, firstMatchOnly: true }),
      this.repos.notes.listAll(),
      this.repos.highlights.listAll(),
    ]);

    const matches = (...values: (string | null | undefined)[]) =>
      values.some((v) => !!v && normalizeForSearch(v).includes(needle));

    return {
      query: trimmed,
      books,
      content,
      notes: notes.filter((n) => matches(n.text, n.quote, n.bookTitle)).slice(0, limit),
      highlights: highlights.filter((h) => matches(h.text, h.note)).slice(0, limit),
    };
  }

  /** Every match inside a single book, in reading order. */
  async searchInBook(bookId: string, query: string, limit = 200): Promise<ContentHit[]> {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return [];
    return this.searchContent(normalizeForSearch(trimmed), trimmed, { bookId, limit, firstMatchOnly: false });
  }

  private async searchContent(
    needle: string,
    query: string,
    options: { bookId?: string; limit: number; firstMatchOnly: boolean },
  ): Promise<ContentHit[]> {
    const params: (string | number)[] = [needle];
    let filter = '';
    if (options.bookId) {
      filter = 'AND t.bookId = ?';
      params.push(options.bookId);
    }
    params.push(options.firstMatchOnly ? options.limit : 1000);
    const rows = await this.db.getAll<TextRow>(
      `SELECT t.bookId, t.sectionIndex, t.page, t.title, t.text, b.title AS bookTitle, b.format AS bookFormat
       FROM book_text t INNER JOIN books b ON b.id = t.bookId
       WHERE instr(t.normalized, ?) > 0 ${filter}
       ORDER BY b.lastReadAt IS NULL, b.lastReadAt DESC, t.bookId, t.sectionIndex
       LIMIT ?`,
      params,
    );

    const hits: ContentHit[] = [];
    for (const row of rows) {
      const occurrences = findAllOccurrences(row.text, query);
      if (occurrences.length === 0) continue;
      const selected = options.firstMatchOnly ? occurrences.slice(0, 1) : occurrences;
      for (const offset of selected) {
        hits.push({
          bookId: row.bookId,
          bookTitle: row.bookTitle,
          bookFormat: row.bookFormat,
          sectionIndex: row.sectionIndex,
          sectionTitle: row.title,
          page: row.page,
          offset,
          length: query.length,
          snippet: buildSnippet(row.text, offset, query.length),
          matchesInSection: occurrences.length,
        });
        if (hits.length >= options.limit) return hits;
      }
    }
    return hits;
  }
}
