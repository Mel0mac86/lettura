/**
 * Continuous reading aloud: the reader provides the text section by section
 * (chapter for EPUB/TXT, page for PDF) and follows the voice.
 */
export interface SpeechSegment {
  /** Chapter index (EPUB/TXT) or 0-based page index (PDF). */
  section: number;
  /** Offset of `text` inside the section text. */
  startOffset: number;
  text: string;
}

export interface SpeechSource {
  /** Text from the current reading position. */
  first(): Promise<SpeechSegment | null>;
  /** Text of the section after `segment` (skipping empty ones), or null at the end of the book. */
  next(segment: SpeechSegment): Promise<SpeechSegment | null>;
  /** The voice started a sentence: show its page and mark it. Offsets are relative to the section text. */
  follow(segment: SpeechSegment, start: number, end: number): void;
  /** Reading stopped or finished: remove the sentence mark. */
  clear(): void;
}

/** Finds the next non-empty section after `from` using `textOf`, up to `count` sections. */
export async function nextNonEmptySection(
  from: number,
  count: number,
  textOf: (section: number) => Promise<string | null>,
): Promise<SpeechSegment | null> {
  for (let section = from + 1; section < count; section++) {
    const text = await textOf(section);
    if (text && text.trim()) return { section, startOffset: 0, text };
  }
  return null;
}
