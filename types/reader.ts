/**
 * Reader-specific types: locations, preferences and themes.
 */

/** Position inside a reflowable document (EPUB / TXT). */
export interface ReflowLocation {
  type: 'reflow';
  chapter: number;
  /** Start of the visible page as a fraction of the chapter, in [0, 1]. */
  progress: number;
  /** Character offset (in the chapter plain text) of the first visible character. */
  offset?: number;
}

/** A text range inside a reflowable chapter (used by highlights). */
export interface ReflowRange {
  type: 'reflow-range';
  chapter: number;
  start: number;
  end: number;
}

/** Position inside a fixed-layout document (PDF). Pages are 1-based. */
export interface PdfLocation {
  type: 'pdf';
  page: number;
}

export type ReaderLocation = ReflowLocation | ReflowRange | PdfLocation;

export type ReaderThemeName = 'light' | 'dark' | 'sepia' | 'night';
export type AppThemePreference = 'system' | 'light' | 'dark';
export type ReaderFontFamily = 'serif' | 'sans' | 'classic' | 'mono';
export type LibraryViewMode = 'grid' | 'list';

export interface ReaderPreferences {
  theme: ReaderThemeName;
  fontFamily: ReaderFontFamily;
  /** Font size in CSS pixels. */
  fontSize: number;
  /** Line height multiplier. */
  lineHeight: number;
  /** Horizontal margin in CSS pixels. */
  margin: number;
  /** Maximum text column width in CSS pixels. */
  maxTextWidth: number;
  /** Justified text (with hyphenation) instead of left aligned. */
  justify: boolean;
}

/** "Leggi ad alta voce" preferences. */
export interface SpeechPreferences {
  /** Preferred voice identifier; null = choose automatically for the book language. */
  voice: string | null;
  /** Speaking rate multiplier (1 = normal). */
  rate: number;
  /** Use the downloaded natural (neural) voice when available (web). */
  naturalVoice: boolean;
}

export interface AppSettings {
  appTheme: AppThemePreference;
  libraryView: LibraryViewMode;
  reader: ReaderPreferences;
  speech: SpeechPreferences;
}

export interface ReaderPalette {
  background: string;
  text: string;
  secondaryText: string;
  accent: string;
  selection: string;
}
