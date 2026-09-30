import type { ChapterInfo, ReflowableDocument } from '@/services/reader/ReflowableDocument';
import type { TocItem } from '@/types/models';
import { collapseWhitespace, escapeHtml } from '@/utils/text';

/** Target size of a section when the text has no recognisable chapter headings. */
export const TXT_SECTION_SIZE = 30_000;

/** Lines like "Capitolo 3", "CHAPTER IV", "Parte prima", "Prologo". */
const HEADING_PATTERN =
  /^\s*((capitolo|chapter|cap\.|parte|part|libro|book)\s+([0-9]+|[ivxlcdm]+|[a-zàèéìòù]+)\b.*|prologo|epilogo|prologue|epilogue|introduzione|introduction|prefazione|preface)\s*$/i;

interface TxtChapter {
  title: string;
  paragraphs: string[];
}

function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, ' ').trim())
    .filter(Boolean);
}

/** Splits a plain text into chapters, using headings when present or size-based sections. */
export function splitTxtIntoChapters(rawText: string): TxtChapter[] {
  const text = rawText.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const headingLines: number[] = [];
  lines.forEach((line, i) => {
    if (line.length < 80 && HEADING_PATTERN.test(line)) headingLines.push(i);
  });

  if (headingLines.length >= 2) {
    const chapters: TxtChapter[] = [];
    const preface = lines.slice(0, headingLines[0]).join('\n');
    if (preface.trim()) chapters.push({ title: 'Inizio', paragraphs: toParagraphs(preface) });
    headingLines.forEach((start, i) => {
      const end = headingLines[i + 1] ?? lines.length;
      chapters.push({
        title: collapseWhitespace(lines[start]),
        paragraphs: toParagraphs(lines.slice(start + 1, end).join('\n')),
      });
    });
    return chapters;
  }

  const paragraphs = toParagraphs(text);
  const chapters: TxtChapter[] = [];
  let current: string[] = [];
  let size = 0;
  for (const paragraph of paragraphs) {
    current.push(paragraph);
    size += paragraph.length;
    if (size >= TXT_SECTION_SIZE) {
      chapters.push({ title: `Sezione ${chapters.length + 1}`, paragraphs: current });
      current = [];
      size = 0;
    }
  }
  if (current.length > 0 || chapters.length === 0) {
    chapters.push({ title: chapters.length === 0 ? 'Testo' : `Sezione ${chapters.length + 1}`, paragraphs: current });
  }
  return chapters;
}

// Blocks are separated by a newline so that snippets and TTS read naturally.
function chapterHtml(chapter: TxtChapter, showTitle: boolean): string {
  const blocks = chapter.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`);
  if (showTitle) blocks.unshift(`<h2>${escapeHtml(chapter.title)}</h2>`);
  return blocks.join('\n');
}

function chapterText(chapter: TxtChapter, showTitle: boolean): string {
  // Must equal the `textContent` of chapterHtml().
  return (showTitle ? [chapter.title, ...chapter.paragraphs] : chapter.paragraphs).join('\n');
}

/** A TXT file exposed as a {@link ReflowableDocument}. */
export class TxtDocument implements ReflowableDocument {
  readonly chapters: ChapterInfo[];
  readonly toc: TocItem[];
  private readonly parts: TxtChapter[];
  private readonly showTitles: boolean;

  constructor(text: string) {
    this.parts = splitTxtIntoChapters(text);
    this.showTitles = this.parts.length > 1;
    this.chapters = this.parts.map((part, index) => ({
      index,
      title: part.title,
      textLength: chapterText(part, this.showTitles).length,
    }));
    this.toc = this.parts.length > 1 ? this.chapters.map((c) => ({ title: c.title, chapterIndex: c.index, depth: 0 })) : [];
  }

  async getChapterHtml(index: number): Promise<string> {
    return chapterHtml(this.parts[index], this.showTitles);
  }

  async getChapterText(index: number): Promise<string> {
    return chapterText(this.parts[index], this.showTitles);
  }

  resolveHref(): null {
    return null;
  }

  /** First non-empty line, used as title fallback when it looks like a title. */
  static guessTitle(text: string): string | null {
    const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim())?.trim();
    if (!firstLine || firstLine.length > 80 || /[.!?;:,]$/.test(firstLine)) return null;
    return firstLine;
  }
}
