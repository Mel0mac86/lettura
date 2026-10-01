import { useCallback, useEffect, useRef, useState } from 'react';

import { useSettings } from '@/providers/SettingsProvider';
import { createSpeechEngine } from '@/services/tts/createSpeechEngine';
import { TtsController, type TtsState } from '@/services/tts/TextToSpeech';
import { showAlert } from '@/utils/dialogs';

/** React binding of {@link TtsController}: speech engine + user speech preferences. */
export function useTts() {
  const { settings } = useSettings();
  const { rate, voice, naturalVoice } = settings.speech;
  const [state, setState] = useState<TtsState>('idle');
  const [buffering, setBuffering] = useState(false);
  const controller = useRef<TtsController | null>(null);
  const naturalRef = useRef(naturalVoice);

  useEffect(() => {
    naturalRef.current = naturalVoice;
  }, [naturalVoice]);

  const get = useCallback(() => {
    if (!controller.current) {
      const engine = createSpeechEngine({
        isNaturalEnabled: () => naturalRef.current,
        onNaturalError: (error) =>
          showAlert('Voce naturale non disponibile', `Uso la voce di sistema. (${error.message})`),
      });
      controller.current = new TtsController(engine, (next, _position, isBuffering) => {
        setState(next);
        setBuffering(isBuffering);
      });
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
    /** True while the audio of the current sentence is being prepared. */
    buffering,
    /** Call synchronously in the tap handler before any await (iPhone audio rules). */
    unlock: useCallback(() => get().unlock(), [get]),
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
