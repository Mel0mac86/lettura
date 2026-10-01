import * as Speech from 'expo-speech';

import type { SpeakOptions, TextToSpeechEngine } from './TextToSpeech';

/** Native iOS (AVSpeechSynthesizer) / Android (TextToSpeech) / browser voices via expo-speech. */
export class ExpoSpeechEngine implements TextToSpeechEngine {
  readonly maxInputLength = Math.min(Speech.maxSpeechInputLength || 4000, 4000);
  private readonly voiceByLanguage = new Map<string, string | undefined>();

  /** Picks an installed voice for the language (exact tag first, then same base language). */
  private async voiceFor(language: string | undefined): Promise<string | undefined> {
    if (!language) return undefined;
    if (this.voiceByLanguage.has(language)) return this.voiceByLanguage.get(language);
    let voice: string | undefined;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const norm = (tag: string) => tag.replace('_', '-').toLowerCase();
      const wanted = norm(language);
      const base = wanted.split('-')[0];
      const candidates = voices.filter((v) => norm(v.language).split('-')[0] === base);
      const pick =
        candidates.find((v) => norm(v.language) === wanted && v.quality === Speech.VoiceQuality.Enhanced) ??
        candidates.find((v) => norm(v.language) === wanted) ??
        candidates[0];
      voice = pick?.identifier;
    } catch {
      voice = undefined;
    }
    this.voiceByLanguage.set(language, voice);
    return voice;
  }

  speak(text: string, options: SpeakOptions): void {
    void this.voiceFor(options.language).then((voice) =>
      Speech.speak(text, {
        language: options.language,
        voice,
        rate: options.rate,
        onDone: options.onDone,
        onError: (error) => options.onError?.(error instanceof Error ? error : new Error(String(error))),
      }),
    );
  }

  stop(): void {
    void Speech.stop();
  }
}
