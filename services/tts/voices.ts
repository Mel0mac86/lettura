/** Voice selection, independent from the speech engine (testable). */
export interface VoiceInfo {
  identifier: string;
  name: string;
  language: string;
  enhanced: boolean;
}

const norm = (tag: string) => tag.replace('_', '-').toLowerCase();
export const baseLanguage = (tag: string) => norm(tag).split('-')[0];

/**
 * Voice to use for `language`: the preferred one if it speaks that language,
 * otherwise the best installed voice (exact region + enhanced quality first).
 */
export function pickVoice(voices: readonly VoiceInfo[], language: string | undefined, preferred?: string): VoiceInfo | undefined {
  if (!language) return voices.find((v) => v.identifier === preferred);
  const base = baseLanguage(language);
  const same = voices.filter((v) => baseLanguage(v.language) === base);
  const chosen = same.find((v) => v.identifier === preferred);
  if (chosen) return chosen;
  const exact = (v: VoiceInfo) => norm(v.language) === norm(language);
  return (
    same.find((v) => exact(v) && v.enhanced) ??
    same.find((v) => v.enhanced) ??
    same.find(exact) ??
    same[0]
  );
}

/** Voices grouped and sorted for the settings screen (better voices first). */
export function voicesForLanguage(voices: readonly VoiceInfo[], language: string): VoiceInfo[] {
  const base = baseLanguage(language);
  return voices
    .filter((v) => baseLanguage(v.language) === base)
    .sort((a, b) => Number(b.enhanced) - Number(a.enhanced) || a.name.localeCompare(b.name));
}
