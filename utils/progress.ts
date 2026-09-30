import type { ReadingStatus } from '@/types/models';
import { clamp01 } from './location';

/** Progress at or above this value marks a book as completed. */
export const COMPLETED_THRESHOLD = 0.995;

/**
 * Overall progress of a reflowable book. Chapters are weighted by their text
 * length so that a short preface does not count as much as a long chapter.
 *
 * @param chapterLengths text length of every chapter (spine order)
 * @param chapterIndex current chapter (0-based)
 * @param readFractionInChapter fraction of the current chapter already read, in [0, 1]
 */
export function computeReflowProgress(
  chapterLengths: readonly number[],
  chapterIndex: number,
  readFractionInChapter: number,
): number {
  if (chapterLengths.length === 0) return 0;
  const index = Math.min(Math.max(0, chapterIndex), chapterLengths.length - 1);
  // Every chapter weighs at least 1 so that image-only chapters still count.
  const weights = chapterLengths.map((len) => Math.max(1, len));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const before = weights.slice(0, index).reduce((sum, w) => sum + w, 0);
  return clamp01((before + weights[index] * clamp01(readFractionInChapter)) / total);
}

/** Progress of a paged book (PDF). Pages are 1-based: the last page is 100%. */
export function computePageProgress(page: number, totalPages: number): number {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0;
  return clamp01(Math.min(Math.max(page, 0), totalPages) / totalPages);
}

/** Derives the reading status from progress. */
export function statusFromProgress(progress: number): ReadingStatus {
  if (progress >= COMPLETED_THRESHOLD) return 'completed';
  if (progress > 0) return 'reading';
  return 'not_started';
}

/** 0.7234 → "72%" */
export function formatPercent(progress: number): string {
  return `${Math.floor(clamp01(progress) * 100 + 1e-9)}%`;
}
