import { computeStreak, formatDuration, formatRelativeDate, greetingForHour } from '@/utils/dates';

import { buildEpub } from './helpers/fixtures';
import { createTestContext } from './helpers/services';

describe('statistiche di lettura', () => {
  it('calcola i giorni consecutivi di lettura', () => {
    const today = new Date(2026, 8, 30, 20);
    const day = (d: number) => new Date(2026, 8, d, 10);
    expect(computeStreak([day(30), day(29), day(28)], today)).toBe(3);
    expect(computeStreak([day(29), day(28)], today)).toBe(2); // oggi non ancora letto
    expect(computeStreak([day(27)], today)).toBe(0);
    expect(computeStreak([], today)).toBe(0);
  });

  it('formatta durate, date e saluto', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(59 * 60)).toBe('59 min');
    expect(formatDuration(3 * 3600 + 25 * 60)).toBe('3 h 25 min');
    const now = new Date(2026, 8, 30, 12);
    expect(formatRelativeDate(new Date(2026, 8, 29, 23).toISOString(), now)).toBe('Ieri');
    expect(greetingForHour(20)).toBe('Buonasera');
    expect(greetingForHour(9)).toBe('Buongiorno');
  });

  it('aggrega libri, sessioni, pagine e tempo', async () => {
    const { services, storage } = await createTestContext();
    await storage.writeBytes('file:///a.epub', await buildEpub());
    const { book } = await services.importer.importBook({ sourceUri: 'file:///a.epub', fileName: 'a.epub' });
    await services.books.setFavorite(book.id, true);
    await services.books.savePosition(book.id, { location: { type: 'pdf', page: 2 }, progress: 0.3 });
    const now = new Date();
    await services.stats.recordSession({ bookId: book.id, startedAt: now.toISOString(), endedAt: now.toISOString(), durationSeconds: 600, pagesRead: 12 });
    expect(await services.stats.recordSession({ bookId: book.id, startedAt: now.toISOString(), endedAt: now.toISOString(), durationSeconds: 2, pagesRead: 1 })).toBeNull();
    expect(await services.stats.getStats(now)).toEqual({
      totalBooks: 1,
      readingBooks: 1,
      completedBooks: 0,
      favoriteBooks: 1,
      pagesRead: 12,
      readingTimeSeconds: 600,
      streakDays: 1,
    });
  });
});
