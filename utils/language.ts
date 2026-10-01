/**
 * Language helpers for text-to-speech: books often lack a language tag (PDF,
 * TXT), and speaking Italian text with an English voice is unintelligible.
 */

const STOPWORDS: Record<string, readonly string[]> = {
  'it-IT': ['il', 'lo', 'la', 'gli', 'le', 'di', 'che', 'non', 'per', 'una', 'sono', 'della', 'del', 'con', 'questo', 'anche', 'più', 'come', 'è', 'nel'],
  'en-US': ['the', 'and', 'of', 'to', 'is', 'that', 'it', 'with', 'for', 'was', 'this', 'are', 'you', 'not', 'have', 'from', 'they', 'which', 'be', 'by'],
  'fr-FR': ['le', 'les', 'des', 'est', 'et', 'que', 'une', 'pas', 'pour', 'dans', 'qui', 'sur', 'au', 'avec', 'ce', 'sont', 'du', 'mais', 'nous', 'vous'],
  'es-ES': ['el', 'los', 'las', 'que', 'y', 'en', 'es', 'por', 'una', 'con', 'para', 'del', 'como', 'pero', 'más', 'su', 'se', 'lo', 'muy', 'está'],
  'de-DE': ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'zu', 'mit', 'den', 'von', 'sich', 'auch', 'auf', 'für', 'dem', 'es', 'ich', 'wir'],
};

/** Guesses the language of a text (BCP-47 tag) from common words; null if unsure. */
export function guessLanguage(text: string): string | null {
  const words = text.toLowerCase().slice(0, 20_000).match(/[\p{L}']+/gu) ?? [];
  if (words.length < 5) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const [tag, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    const score = words.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = tag;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

/** "it" → "it-IT", "en" → "en-US", keeps full tags ("pt-BR") as they are. */
export function normalizeLanguageTag(language: string | null | undefined): string | null {
  const value = language?.trim().replace('_', '-');
  if (!value) return null;
  if (value.includes('-')) return value;
  const known = Object.keys(STOPWORDS).find((tag) => tag.startsWith(`${value.toLowerCase()}-`));
  return known ?? value.toLowerCase();
}

function deviceLanguage(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/**
 * Language for reading aloud: the text itself wins (a book tagged "en" by its
 * publisher may be an Italian translation), then the book metadata, then the
 * device language, then Italian.
 */
export function resolveSpeechLanguage(bookLanguage: string | null, text: string): string {
  return guessLanguage(text) ?? normalizeLanguageTag(bookLanguage) ?? normalizeLanguageTag(deviceLanguage()) ?? 'it-IT';
}
