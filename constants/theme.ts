import type { ReaderFontFamily, ReaderPalette, ReaderThemeName } from '@/types/reader';

export interface AppColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  danger: string;
  success: string;
  warning: string;
  progressTrack: string;
  overlay: string;
}

export const LIGHT_COLORS: AppColors = {
  background: '#F7F4EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE3',
  text: '#1D1B18',
  textSecondary: '#55514B',
  textMuted: '#8C867D',
  border: '#E2DDD3',
  primary: '#2F5D8A',
  onPrimary: '#FFFFFF',
  primarySoft: '#DCE7F2',
  danger: '#C0392B',
  success: '#2E8B57',
  warning: '#C98A10',
  progressTrack: '#E4DFD6',
  overlay: 'rgba(0,0,0,0.45)',
};

export const DARK_COLORS: AppColors = {
  background: '#121212',
  surface: '#1C1C1E',
  surfaceAlt: '#262628',
  text: '#F2F0EC',
  textSecondary: '#C4C0B8',
  textMuted: '#8E8A83',
  border: '#34343A',
  primary: '#7FB2E5',
  onPrimary: '#0E2236',
  primarySoft: '#23374B',
  danger: '#FF6B5E',
  success: '#5CC98B',
  warning: '#F2B544',
  progressTrack: '#3A3A3E',
  overlay: 'rgba(0,0,0,0.6)',
};

/** Reading themes: Light, Dark, Sepia (cream background) and Night (very dark, low contrast). */
export const READER_PALETTES: Record<ReaderThemeName, ReaderPalette & { label: string; isDark: boolean }> = {
  light: { label: 'Chiaro', isDark: false, background: '#FFFFFF', text: '#1D1B18', secondaryText: '#77736C', accent: '#2F5D8A', selection: 'rgba(47,93,138,0.25)' },
  sepia: { label: 'Seppia', isDark: false, background: '#F4ECD8', text: '#5B4636', secondaryText: '#8F7A66', accent: '#8B5A2B', selection: 'rgba(139,90,43,0.25)' },
  dark: { label: 'Scuro', isDark: true, background: '#1E1E1E', text: '#E6E1D9', secondaryText: '#9A958D', accent: '#7FB2E5', selection: 'rgba(127,178,229,0.3)' },
  night: { label: 'Notte', isDark: true, background: '#000000', text: '#A39E93', secondaryText: '#5F5B55', accent: '#B08D57', selection: 'rgba(176,141,87,0.3)' },
};

export const FONT_OPTIONS: Record<ReaderFontFamily, { label: string; css: string }> = {
  serif: { label: 'Serif', css: 'Georgia, "Iowan Old Style", "Noto Serif", "Times New Roman", serif' },
  sans: { label: 'Sans', css: '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  classic: { label: 'Classico', css: 'Palatino, "Palatino Linotype", "Book Antiqua", "Noto Serif", serif' },
  mono: { label: 'Mono', css: 'Menlo, "SF Mono", "Roboto Mono", Consolas, monospace' },
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
