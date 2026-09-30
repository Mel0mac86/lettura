import type { SqlDatabase } from '@/services/database/SqlDatabase';
import type { ReadingSession, ReadingStats } from '@/types/models';
import { computeStreak } from '@/utils/dates';
import type { IdGenerator } from '@/utils/ids';

/** Sessions shorter than this are ignored (e.g. opening a book by mistake). */
export const MIN_SESSION_SECONDS = 5;

export class StatsRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly newId: IdGenerator,
  ) {}

  async recordSession(input: Omit<ReadingSession, 'id'>): Promise<ReadingSession | null> {
    if (input.durationSeconds < MIN_SESSION_SECONDS) return null;
    const session: ReadingSession = { id: this.newId(), ...input };
    await this.db.run(
      `INSERT INTO reading_sessions (id, bookId, startedAt, endedAt, durationSeconds, pagesRead)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.bookId,
        session.startedAt,
        session.endedAt,
        Math.round(session.durationSeconds),
        Math.max(0, Math.round(session.pagesRead)),
      ],
    );
    return session;
  }

  async getStats(today: Date = new Date()): Promise<ReadingStats> {
    const counts = await this.db.getFirst<{
      total: number;
      reading: number;
      completed: number;
      favorites: number;
    }>(
      `SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END), 0) AS reading,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(isFavorite), 0) AS favorites
       FROM books`,
    );
    const totals = await this.db.getFirst<{ seconds: number; pages: number }>(
      `SELECT COALESCE(SUM(durationSeconds), 0) AS seconds, COALESCE(SUM(pagesRead), 0) AS pages
       FROM reading_sessions`,
    );
    const since = new Date(today.getTime() - 400 * 86_400_000).toISOString();
    const sessions = await this.db.getAll<{ startedAt: string }>(
      'SELECT startedAt FROM reading_sessions WHERE startedAt >= ?',
      [since],
    );
    return {
      totalBooks: counts?.total ?? 0,
      readingBooks: counts?.reading ?? 0,
      completedBooks: counts?.completed ?? 0,
      favoriteBooks: counts?.favorites ?? 0,
      pagesRead: totals?.pages ?? 0,
      readingTimeSeconds: totals?.seconds ?? 0,
      streakDays: computeStreak(
        sessions.map((s) => new Date(s.startedAt)),
        today,
      ),
    };
  }
}
