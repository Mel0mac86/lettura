/**
 * Domain models shared across the app.
 * Dates are ISO-8601 strings (UTC) so they can be stored in SQLite and synced later.
 */

export type BookFormat = 'epub' | 'pdf' | 'txt';

export type ReadingStatus = 'not_started' | 'reading' | 'completed';

export interface Book {
  id: string;
  title: string;
  author: string | null;
  /** Relative path of the cover image inside the app storage (or null). */
  cover: string | null;
  /** Relative path of the book file inside the app storage. */
  filePath: string;
  originalFileName: string;
  format: BookFormat;
  language: string | null;
  description: string | null;
  publisher: string | null;
  status: ReadingStatus;
  /** Reading progress in the range [0, 1]. */
  progress: number;
  currentPage: number | null;
  currentChapter: string | null;
  /** Serialized {@link ReaderLocation} of the last reading position. */
  location: string | null;
  totalPages: number | null;
  totalChapters: number | null;
  fileSize: number;
  fileHash: string;
  isFavorite: boolean;
  /** True when the full text has been indexed for global search. */
  isIndexed: boolean;
  createdAt: string;
  updatedAt: string;
  lastReadAt: string | null;
}

export interface Bookmark {
  id: string;
  bookId: string;
  location: string;
  page: number | null;
  chapter: string | null;
  text: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  location: string;
  chapter?: string;
  page?: number;
  text: string;
  color: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  bookId: string;
  location: string | null;
  chapter: string | null;
  page: number | null;
  /** Optional quoted passage the note refers to. */
  quote: string | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  createdAt: string;
}

export interface CategoryWithCount extends Category {
  bookCount: number;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pagesRead: number;
}

export interface ReadingStats {
  totalBooks: number;
  readingBooks: number;
  completedBooks: number;
  favoriteBooks: number;
  pagesRead: number;
  readingTimeSeconds: number;
  streakDays: number;
}

/** A text section of a book (chapter for EPUB/TXT, page for PDF) used for search and AI. */
export interface TextSection {
  index: number;
  title: string | null;
  page: number | null;
  text: string;
}

export interface TocItem {
  title: string;
  chapterIndex: number;
  depth: number;
  anchor?: string;
}
