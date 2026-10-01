import * as Speech from 'expo-speech';

import type { SpeakOptions, TextToSpeechEngine } from './TextToSpeech';
import { pickVoice, type VoiceInfo } from './voices';

let voicesCache: VoiceInfo[] | null = null;
let voicesPromise: Promise<VoiceInfo[]> | null = null;

/** Installed voices (loaded once; browsers populate the list asynchronously). */
export function loadVoices(): Promise<VoiceInfo[]> {
  if (!voicesPromise) {
    // Some browsers never fire "voiceschanged" when no voice is installed: give up after 3 s.
    const timeout = new Promise<Speech.Voice[]>((resolve) => setTimeout(() => resolve([]), 3000));
    voicesPromise = Promise.race([Speech.getAvailableVoicesAsync(), timeout])
      .then((voices) =>
        voices.map((v) => ({
          identifier: v.identifier,
          name: v.name,
          language: v.language,
          enhanced: v.quality === Speech.VoiceQuality.Enhanced || /premium|enhanced|migliorat|siri/i.test(v.name),
        })),
      )
      .catch(() => [] as VoiceInfo[])
      .then((voices) => {
        voicesCache = voices;
        if (voices.length === 0) voicesPromise = null; // retry later (lists can be empty at startup)
        return voices;
      });
  }
  return voicesPromise;
}

/** Native iOS (AVSpeechSynthesizer) / Android (TextToSpeech) / browser voices via expo-speech. */
export class ExpoSpeechEngine implements TextToSpeechEngine {
  readonly maxInputLength = Math.min(Speech.maxSpeechInputLength || 4000, 4000);

  constructor() {
    // Preload so that speaking can start synchronously in the tap handler:
    // iPhone Safari only allows speech started right after a user gesture.
    void loadVoices();
  }

  speak(text: string, options: SpeakOptions): void {
    const voice = voicesCache ? pickVoice(voicesCache, options.language, options.voice)?.identifier : undefined;
    Speech.speak(text, {
      language: options.language,
      voice,
      rate: options.rate,
      onDone: options.onDone,
      onError: (error) => options.onError?.(error instanceof Error ? error : new Error(String(error))),
    });
  }

  stop(): void {
    void Speech.stop();
  }
}

/** Speaks a short sample (settings "Prova voce"). */
export function previewVoice(voice: VoiceInfo, rate: number): void {
  void Speech.stop();
  const samples: Record<string, string> = {
    it: 'Ciao! Questa è la voce che leggerà i tuoi libri.',
    en: 'Hello! This is the voice that will read your books.',
    fr: 'Bonjour ! Voici la voix qui lira vos livres.',
    es: '¡Hola! Esta es la voz que leerá tus libros.',
    de: 'Hallo! Das ist die Stimme, die deine Bücher vorliest.',
  };
  const base = voice.language.slice(0, 2).toLowerCase();
  Speech.speak(samples[base] ?? samples.en, { voice: voice.identifier, language: voice.language, rate });
}
