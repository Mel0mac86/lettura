import * as Speech from 'expo-speech';

import type { SpeakOptions, TextToSpeechEngine } from './TextToSpeech';

/** Native iOS (AVSpeechSynthesizer) / Android (TextToSpeech) voices via expo-speech. */
export class ExpoSpeechEngine implements TextToSpeechEngine {
  readonly maxInputLength = Math.min(Speech.maxSpeechInputLength || 4000, 4000);

  speak(text: string, options: SpeakOptions): void {
    Speech.speak(text, {
      language: options.language,
      rate: options.rate,
      onDone: options.onDone,
      onError: (error) => options.onError?.(error instanceof Error ? error : new Error(String(error))),
    });
  }

  stop(): void {
    void Speech.stop();
  }
}
