import { BookmarkRepository } from '@/services/annotations/BookmarkRepository';
import { HighlightRepository } from '@/services/annotations/HighlightRepository';
import { NoteRepository } from '@/services/annotations/NoteRepository';
import { BookImporter } from '@/services/books/BookImporter';
import { BookRepository } from '@/services/books/BookRepository';
import { CategoryRepository } from '@/services/categories/CategoryRepository';
import type { SqlDatabase } from '@/services/database/SqlDatabase';
import { SearchService } from '@/services/search/SearchService';
import { SettingsRepository } from '@/services/settings/SettingsRepository';
import { StatsRepository } from '@/services/stats/StatsRepository';
import type { FileStorage } from '@/services/storage/FileStorage';
import type { IdGenerator } from '@/utils/ids';

export interface ServiceDeps {
  db: SqlDatabase;
  storage: FileStorage;
  newId: IdGenerator;
  hash: (bytes: Uint8Array) => Promise<string>;
}

/** All app services, wired together. Created once at startup (see providers/AppServicesProvider). */
export interface AppServices {
  db: SqlDatabase;
  storage: FileStorage;
  books: BookRepository;
  bookmarks: BookmarkRepository;
  highlights: HighlightRepository;
  notes: NoteRepository;
  categories: CategoryRepository;
  settings: SettingsRepository;
  stats: StatsRepository;
  search: SearchService;
  importer: BookImporter;
}

export function createServices({ db, storage, newId, hash }: ServiceDeps): AppServices {
  const books = new BookRepository(db);
  const bookmarks = new BookmarkRepository(db, newId);
  const highlights = new HighlightRepository(db, newId);
  const notes = new NoteRepository(db, newId);
  const search = new SearchService(db, { books, notes, highlights });
  return {
    db,
    storage,
    books,
    bookmarks,
    highlights,
    notes,
    categories: new CategoryRepository(db, newId),
    settings: new SettingsRepository(db),
    stats: new StatsRepository(db, newId),
    search,
    importer: new BookImporter({ storage, books, search, newId, hash }),
  };
}
