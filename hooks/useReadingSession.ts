import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useServices } from '@/providers/AppServicesProvider';
import { dataEvents } from '@/services/events';

/**
 * Tracks reading time and pages turned while the reader is open. A session is
 * saved when the reader closes or the app goes to background.
 */
export function useReadingSession(bookId: string) {
  const { stats } = useServices();
  const startedAt = useRef<Date | null>(new Date());
  const pages = useRef(0);

  const flush = useCallback(() => {
    const start = startedAt.current;
    if (!start) return;
    const end = new Date();
    const durationSeconds = (end.getTime() - start.getTime()) / 1000;
    const pagesRead = pages.current;
    startedAt.current = null;
    pages.current = 0;
    stats
      .recordSession({ bookId, startedAt: start.toISOString(), endedAt: end.toISOString(), durationSeconds, pagesRead })
      .then((saved) => saved && dataEvents.emit('stats'))
      .catch(() => undefined);
  }, [bookId, stats]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!startedAt.current) startedAt.current = new Date();
      } else {
        flush();
      }
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  /** Adds pages actually read (forward reading only). */
  const addPagesRead = useCallback((count: number) => {
    pages.current += Math.max(0, count);
  }, []);

  return { addPagesRead };
}
