import { useCallback, useEffect, useRef, useState } from 'react';

import { useSettings } from '@/providers/SettingsProvider';
import { ExpoSpeechEngine } from '@/services/tts/expoSpeechEngine';
import { TtsController, type TtsState } from '@/services/tts/TextToSpeech';

/** React binding of {@link TtsController}: native voices + user speech preferences. */
export function useTts() {
  const { settings } = useSettings();
  const { rate, voice } = settings.speech;
  const [state, setState] = useState<TtsState>('idle');
  const controller = useRef<TtsController | null>(null);

  const get = useCallback(() => {
    if (!controller.current) {
      controller.current = new TtsController(new ExpoSpeechEngine(), (next) => setState(next));
    }
    return controller.current;
  }, []);

  // Create the engine early so voices are loaded before the first tap.
  useEffect(() => {
    get();
    return () => controller.current?.stop();
  }, [get]);

  // Apply rate/voice changes immediately, also while speaking.
  useEffect(() => {
    controller.current?.configure({ rate, voice });
  }, [rate, voice]);

  return {
    state,
    /** Loads `text` (spoken in `language`, e.g. "it-IT") and starts from the beginning. */
    start: useCallback(
      (text: string, language?: string) => {
        const c = get();
        c.load(text);
        c.configure({ language, rate, voice });
        if (c.hasContent) c.play();
      },
      [get, rate, voice],
    ),
    play: useCallback(() => get().play(), [get]),
    pause: useCallback(() => get().pause(), [get]),
    stop: useCallback(() => get().stop(), [get]),
    seek: useCallback((seconds: number) => get().seek(seconds), [get]),
  };
}
