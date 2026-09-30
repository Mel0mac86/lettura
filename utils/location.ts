import type { PdfLocation, ReaderLocation, ReflowLocation, ReflowRange } from '@/types/reader';

/**
 * Reader locations are stored as JSON strings in the database. These helpers
 * keep (de)serialisation in one place and validate untrusted input.
 */

export function serializeLocation(location: ReaderLocation): string {
  return JSON.stringify(location);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseLocation(raw: string | null | undefined): ReaderLocation | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  switch (v.type) {
    case 'reflow':
      if (!isFiniteNumber(v.chapter) || !isFiniteNumber(v.progress)) return null;
      return {
        type: 'reflow',
        chapter: Math.max(0, Math.floor(v.chapter)),
        progress: clamp01(v.progress),
        ...(isFiniteNumber(v.offset) ? { offset: Math.max(0, Math.floor(v.offset)) } : {}),
      };
    case 'reflow-range':
      if (!isFiniteNumber(v.chapter) || !isFiniteNumber(v.start) || !isFiniteNumber(v.end)) return null;
      return {
        type: 'reflow-range',
        chapter: Math.max(0, Math.floor(v.chapter)),
        start: Math.max(0, Math.floor(Math.min(v.start, v.end))),
        end: Math.max(0, Math.floor(Math.max(v.start, v.end))),
      };
    case 'pdf':
      if (!isFiniteNumber(v.page)) return null;
      return { type: 'pdf', page: Math.max(1, Math.floor(v.page)) };
    default:
      return null;
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function reflowLocation(chapter: number, progress: number, offset?: number): ReflowLocation {
  return { type: 'reflow', chapter, progress: clamp01(progress), ...(offset !== undefined ? { offset } : {}) };
}

export function reflowRange(chapter: number, start: number, end: number): ReflowRange {
  return { type: 'reflow-range', chapter, start: Math.min(start, end), end: Math.max(start, end) };
}

export function pdfLocation(page: number): PdfLocation {
  return { type: 'pdf', page: Math.max(1, Math.floor(page)) };
}

/**
 * Converts any location into the reflow position it points to, so that a
 * highlight or bookmark can be used as a navigation target.
 */
export function toNavigationTarget(location: ReaderLocation): ReflowLocation | PdfLocation {
  if (location.type === 'reflow-range') {
    return { type: 'reflow', chapter: location.chapter, progress: 0, offset: location.start };
  }
  return location;
}
