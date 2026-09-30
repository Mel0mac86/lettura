import type { TextSection } from '@/types/models';

import type { BookChunk } from './types';

export interface ChunkOptions {
  /** Target maximum chunk length in characters. */
  maxChars?: number;
  /** Characters shared between consecutive chunks (keeps context across boundaries). */
  overlap?: number;
}

/**
 * Splits the text sections of a book into overlapping chunks, preferring
 * paragraph and sentence boundaries. Each chunk keeps its exact position so
 * answers can cite chapter, page and passage.
 */
export function chunkSections(bookId: string, sections: readonly TextSection[], options: ChunkOptions = {}): BookChunk[] {
  const maxChars = options.maxChars ?? 1200;
  const overlap = Math.min(options.overlap ?? 150, Math.floor(maxChars / 2));
  const chunks: BookChunk[] = [];

  for (const section of sections) {
    const text = section.text;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + maxChars);
      if (end < text.length) {
        const window = text.slice(start, end);
        const breakAt = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
        if (breakAt > maxChars * 0.5) end = start + breakAt + 1;
      }
      const slice = text.slice(start, end);
      if (slice.trim()) {
        chunks.push({
          id: `${bookId}:${section.index}:${start}`,
          bookId,
          sectionIndex: section.index,
          sectionTitle: section.title,
          page: section.page,
          start,
          end,
          text: slice.trim(),
        });
      }
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}
