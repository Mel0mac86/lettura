import { useCallback } from 'react';

import { useServices } from '@/providers/AppServicesProvider';
import type { Bookmark, Highlight, Note } from '@/types/models';

import { useAsyncData } from './useAsyncData';

export interface BookAnnotations {
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
}

const EMPTY: BookAnnotations = { bookmarks: [], highlights: [], notes: [] };

/** Bookmarks, highlights and notes of one book, refreshed on every change. */
export function useBookAnnotations(bookId: string) {
  const services = useServices();
  const load = useCallback(async (): Promise<BookAnnotations> => {
    const [bookmarks, highlights, notes] = await Promise.all([
      services.bookmarks.listByBook(bookId),
      services.highlights.listByBook(bookId),
      services.notes.listByBook(bookId),
    ]);
    return { bookmarks, highlights, notes };
  }, [services, bookId]);
  const { data, reload } = useAsyncData(load, ['annotations']);
  return { ...(data ?? EMPTY), reload };
}
