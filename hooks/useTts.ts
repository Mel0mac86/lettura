import { useCallback, useEffect, useRef, useState } from 'react';

import { ExpoSpeechEngine } from '@/services/tts/expoSpeechEngine';
import { TtsController, type TtsState } from '@/services/tts/TextToSpeech';

/** React binding of {@link TtsController} using the native voices. */
export function useTts(language: string | null) {
  const [state, setState] = useState<TtsState>('idle');
  const controller = useRef<TtsController | null>(null);

  const get = useCallback(() => {
    if (!controller.current) {
      controller.current = new TtsController(new ExpoSpeechEngine(), (next) => setState(next), {
        language: language ?? undefined,
      });
    }
    return controller.current;
  }, [language]);

  useEffect(() => () => controller.current?.stop(), []);

  return {
    state,
    /** Loads `text` and starts speaking from the beginning. */
    start: useCallback(
      (text: string) => {
        const c = get();
        c.load(text);
        if (c.hasContent) c.play();
      },
      [get],
    ),
    play: useCallback(() => get().play(), [get]),
    pause: useCallback(() => get().pause(), [get]),
    stop: useCallback(() => get().stop(), [get]),
    seek: useCallback((seconds: number) => get().seek(seconds), [get]),
  };
}
