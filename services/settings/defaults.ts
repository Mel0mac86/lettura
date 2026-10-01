import type { AppSettings } from '@/types/reader';

export const DEFAULT_SETTINGS: AppSettings = {
  appTheme: 'system',
  libraryView: 'grid',
  reader: {
    theme: 'light',
    fontFamily: 'serif',
    fontSize: 19,
    lineHeight: 1.55,
    margin: 24,
    maxTextWidth: 680,
    justify: false,
  },
  speech: {
    voice: null,
    rate: 1,
    naturalVoice: false,
  },
};

export const SPEECH_RATE_LIMITS = { min: 0.5, max: 2, step: 0.1 } as const;

export const READER_LIMITS = {
  fontSize: { min: 12, max: 36, step: 1 },
  lineHeight: { min: 1.1, max: 2.2, step: 0.1 },
  margin: { min: 8, max: 64, step: 4 },
  maxTextWidth: { min: 400, max: 1000, step: 40 },
} as const;
