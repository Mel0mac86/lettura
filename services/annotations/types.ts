import type { BookFormat } from '@/types/models';

/** An annotation joined with the title/format of its book (for global lists). */
export type WithBook<T> = T & { bookTitle: string; bookFormat: BookFormat };

export const HIGHLIGHT_COLORS = [
  { name: 'Giallo', value: '#FFE066' },
  { name: 'Verde', value: '#A8E6A1' },
  { name: 'Azzurro', value: '#9CD3FF' },
  { name: 'Rosa', value: '#FFB3C7' },
  { name: 'Arancione', value: '#FFC48C' },
] as const;

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].value;
