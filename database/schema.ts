/**
 * SQLite schema of My Book Reader.
 *
 * Conventions:
 * - primary keys are UUID strings (safe for future cloud sync);
 * - timestamps are ISO-8601 strings;
 * - booleans are stored as INTEGER 0/1;
 * - locations are JSON strings (see utils/location.ts).
 */
export const TABLES = {
  books: 'books',
  bookmarks: 'bookmarks',
  highlights: 'highlights',
  notes: 'notes',
  categories: 'categories',
  bookCategories: 'book_categories',
  bookTags: 'book_tags',
  bookText: 'book_text',
  readingSessions: 'reading_sessions',
  settings: 'settings',
} as const;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover TEXT,
  filePath TEXT NOT NULL,
  originalFileName TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('epub', 'pdf', 'txt')),
  language TEXT,
  description TEXT,
  publisher TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'reading', 'completed')),
  progress REAL NOT NULL DEFAULT 0,
  currentPage INTEGER,
  currentChapter TEXT,
  location TEXT,
  totalPages INTEGER,
  totalChapters INTEGER,
  fileSize INTEGER NOT NULL DEFAULT 0,
  fileHash TEXT NOT NULL,
  isFavorite INTEGER NOT NULL DEFAULT 0,
  isIndexed INTEGER NOT NULL DEFAULT 0,
  searchKey TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastReadAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_books_lastReadAt ON books(lastReadAt);
CREATE INDEX IF NOT EXISTS idx_books_fileHash ON books(fileHash);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  page INTEGER,
  chapter TEXT,
  text TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_bookId ON bookmarks(bookId);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY NOT NULL,
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  chapter TEXT,
  page INTEGER,
  text TEXT NOT NULL,
  color TEXT NOT NULL,
  note TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_highlights_bookId ON highlights(bookId);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  location TEXT,
  chapter TEXT,
  page INTEGER,
  quote TEXT,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_bookId ON notes(bookId);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  icon TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_categories (
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (bookId, categoryId)
);

CREATE TABLE IF NOT EXISTS book_tags (
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (bookId, tag)
);

-- Plain text of every chapter (EPUB/TXT) or page (PDF): powers full-text search
-- and is the input of the future RAG pipeline (see docs/AI_ARCHITECTURE.md).
CREATE TABLE IF NOT EXISTS book_text (
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  sectionIndex INTEGER NOT NULL,
  page INTEGER,
  title TEXT,
  text TEXT NOT NULL,
  normalized TEXT NOT NULL,
  PRIMARY KEY (bookId, sectionIndex)
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  bookId TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  startedAt TEXT NOT NULL,
  endedAt TEXT NOT NULL,
  durationSeconds INTEGER NOT NULL,
  pagesRead INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_startedAt ON reading_sessions(startedAt);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
