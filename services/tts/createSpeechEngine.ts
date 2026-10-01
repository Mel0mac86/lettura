import { ExpoSpeechEngine } from './expoSpeechEngine';
import type { TextToSpeechEngine } from './TextToSpeech';

/** iOS/Android: native voices (including downloaded Enhanced/Premium voices). */
export function createSpeechEngine(_options: { isNaturalEnabled: () => boolean; onNaturalError?: (e: Error) => void }): TextToSpeechEngine {
  return new ExpoSpeechEngine();
}
