import { FONT_OPTIONS, READER_PALETTES } from '@/constants/theme';
import type { ReaderPreferences } from '@/types/reader';

import type { ReaderStyle } from './bridge';

/** Space for the always-visible info line (chapter title / page) above and below the text. */
export const READER_INFO_LINE = 30;

export function buildReaderStyle(prefs: ReaderPreferences, insets: { top: number; bottom: number }): ReaderStyle {
  const palette = READER_PALETTES[prefs.theme];
  return {
    background: palette.background,
    text: palette.text,
    secondaryText: palette.secondaryText,
    accent: palette.accent,
    selection: palette.selection,
    isDark: palette.isDark,
    fontFamily: FONT_OPTIONS[prefs.fontFamily].css,
    fontSize: prefs.fontSize,
    lineHeight: prefs.lineHeight,
    margin: prefs.margin,
    maxTextWidth: prefs.maxTextWidth,
    justify: prefs.justify,
    insetTop: insets.top + READER_INFO_LINE,
    insetBottom: insets.bottom + READER_INFO_LINE,
  };
}

/** CSS filter applied to PDF pages for dark/sepia reading themes. */
export function pdfPageFilter(theme: ReaderPreferences['theme']): string {
  switch (theme) {
    case 'dark':
      return 'invert(0.88) hue-rotate(180deg)';
    case 'night':
      return 'invert(0.92) hue-rotate(180deg) brightness(0.75)';
    case 'sepia':
      return 'sepia(0.35) brightness(0.97)';
    default:
      return 'none';
  }
}
