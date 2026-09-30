import type { TextSection, TocItem } from '@/types/models';

/** A chapter of a reflowable document (EPUB chapter or TXT section). */
export interface ChapterInfo {
  index: number;
  title: string;
  /** Length of the chapter plain text; used to weight progress. */
  textLength: number;
}

/**
 * Format-independent view of a reflowable book. The reader only depends on
 * this interface, so new reflowable formats (MOBI, FB2, …) can be added by
 * implementing it.
 */
export interface ReflowableDocument {
  readonly chapters: readonly ChapterInfo[];
  readonly toc: readonly TocItem[];
  /** Sanitised XHTML body of a chapter, ready to be injected in the reader WebView. */
  getChapterHtml(index: number): Promise<string>;
  /** Plain text of a chapter; offsets match the WebView `textContent`. */
  getChapterText(index: number): Promise<string>;
  /** Resolves an internal link (e.g. "chapter2.xhtml#note1") to a chapter index. */
  resolveHref(fromChapter: number, href: string): { chapter: number; anchor?: string } | null;
}

export async function extractSections(doc: ReflowableDocument): Promise<TextSection[]> {
  const sections: TextSection[] = [];
  for (const chapter of doc.chapters) {
    sections.push({ index: chapter.index, title: chapter.title, page: null, text: await doc.getChapterText(chapter.index) });
  }
  return sections;
}
