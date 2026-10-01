/**
 * Book-wide page numbers for reflowable books (EPUB/TXT).
 *
 * The reader only knows the exact page count of the chapter on screen (it
 * depends on font, margins and screen size). Chapters already laid out with the
 * current settings use their real page count; the others are estimated from
 * the average number of characters per page measured so far. The estimate
 * becomes exact as the user reads.
 */
export interface BookPagination {
  /** 1-based page number in the whole book. */
  page: number;
  totalPages: number;
  /** Pages left before the end of the current chapter (0 on its last page). */
  remainingInChapter: number;
}

/** Fallback when nothing has been measured yet (≈ a paperback page). */
const DEFAULT_CHARS_PER_PAGE = 1500;

export function computeBookPagination(
  chapterLengths: readonly number[],
  measuredPageCounts: ReadonlyMap<number, number>,
  chapter: number,
  pageInChapter: number,
): BookPagination {
  let measuredChars = 0;
  let measuredPages = 0;
  measuredPageCounts.forEach((pages, index) => {
    const length = chapterLengths[index] ?? 0;
    // Very short chapters (title pages, images) say little about text density.
    if (length >= 500 && pages > 0) {
      measuredChars += length;
      measuredPages += pages;
    }
  });
  const charsPerPage = measuredPages > 0 ? measuredChars / measuredPages : DEFAULT_CHARS_PER_PAGE;

  const pagesOf = (index: number) =>
    measuredPageCounts.get(index) ?? Math.max(1, Math.ceil((chapterLengths[index] ?? 0) / charsPerPage));

  let before = 0;
  let total = 0;
  for (let i = 0; i < chapterLengths.length; i++) {
    const pages = pagesOf(i);
    if (i < chapter) before += pages;
    total += pages;
  }
  const chapterPages = pagesOf(chapter);
  const page = Math.min(total, before + Math.min(pageInChapter, chapterPages - 1) + 1);
  return {
    page: Math.max(1, page),
    totalPages: Math.max(1, total),
    remainingInChapter: Math.max(0, chapterPages - 1 - pageInChapter),
  };
}
