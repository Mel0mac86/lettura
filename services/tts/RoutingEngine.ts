import type { SpeakOptions, TextToSpeechEngine } from './TextToSpeech';
import { baseLanguage } from './voices';

/**
 * Uses the natural (neural) voice for the languages it supports and the system
 * voices for everything else. If the natural voice fails, it falls back to the
 * system voice for the rest of the session so reading never stops.
 */
export class RoutingEngine implements TextToSpeechEngine {
  readonly maxInputLength = 400;
  private naturalFailed = false;

  constructor(
    private readonly system: TextToSpeechEngine,
    private readonly natural: TextToSpeechEngine,
    private readonly naturalLanguage: string,
    private readonly isNaturalEnabled: () => boolean,
    private readonly onNaturalError?: (error: Error) => void,
  ) {}

  private useNatural(options: SpeakOptions): boolean {
    return (
      !this.naturalFailed &&
      this.isNaturalEnabled() &&
      !!options.language &&
      baseLanguage(options.language) === baseLanguage(this.naturalLanguage)
    );
  }

  speak(text: string, options: SpeakOptions): void {
    if (!this.useNatural(options)) {
      this.system.speak(text, options);
      return;
    }
    this.natural.speak(text, {
      ...options,
      onError: (error) => {
        this.naturalFailed = true;
        this.onNaturalError?.(error);
        this.system.speak(text, options);
      },
    });
  }

  prepare(text: string, options: SpeakOptions): void {
    if (this.useNatural(options)) this.natural.prepare?.(text, options);
  }

  unlock(): void {
    this.natural.unlock?.();
    this.system.unlock?.();
  }

  stop(): void {
    this.natural.stop();
    this.system.stop();
  }
}
