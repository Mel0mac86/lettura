import { ExpoSpeechEngine } from './expoSpeechEngine';
import { NATURAL_VOICE } from './piperClient';
import { PiperEngine } from './piperEngine';
import { RoutingEngine } from './RoutingEngine';
import type { TextToSpeechEngine } from './TextToSpeech';

/** Web: natural Italian voice (Piper) when downloaded and enabled, browser voices otherwise. */
export function createSpeechEngine(options: { isNaturalEnabled: () => boolean; onNaturalError?: (e: Error) => void }): TextToSpeechEngine {
  return new RoutingEngine(new ExpoSpeechEngine(), new PiperEngine(), NATURAL_VOICE.language, options.isNaturalEnabled, options.onNaturalError);
}
