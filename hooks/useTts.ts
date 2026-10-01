import { useCallback, useEffect, useRef, useState } from 'react';

import { useSettings } from '@/providers/SettingsProvider';
import { createSpeechEngine } from '@/services/tts/createSpeechEngine';
import type { SpeechSegment, SpeechSource } from '@/services/tts/SpeechSource';
import { TtsController, type TtsState } from '@/services/tts/TextToSpeech';
import { showAlert } from '@/utils/dialogs';

/**
 * Continuous "Leggi ad alta voce": reads section after section (chapters or
 * pages) until the end of the book or until stopped, and asks the reader to
 * follow the voice (turn pages, mark the sentence being read).
 */
export function useTts(languageOf: (text: string) => string) {
  const { settings } = useSettings();
  const { rate, voice, naturalVoice } = settings.speech;
  const [state, setState] = useState<TtsState>('idle');
  const [buffering, setBuffering] = useState(false);
  const controller = useRef<TtsController | null>(null);
  const naturalRef = useRef(naturalVoice);
  const sourceRef = useRef<SpeechSource | null>(null);
  const segmentRef = useRef<SpeechSegment | null>(null);
  const languageRef = useRef(languageOf);
  const prefsRef = useRef({ rate, voice });
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    naturalRef.current = naturalVoice;
    languageRef.current = languageOf;
    prefsRef.current = { rate, voice };
  }, [naturalVoice, languageOf, rate, voice]);

  const playSegment = useCallback((c: TtsController, segment: SpeechSegment) => {
    segmentRef.current = segment;
    c.load(segment.text);
    c.configure({ language: languageRef.current(segment.text), ...prefsRef.current });
    c.play();
  }, []);

  const get = useCallback(() => {
    if (!controller.current) {
      const engine = createSpeechEngine({
        isNaturalEnabled: () => naturalRef.current,
        onNaturalError: (error) => showAlert('Voce naturale non disponibile', `Uso la voce di sistema. (${error.message})`),
      });
      const c: TtsController = new TtsController(
        engine,
        (next, _position, isBuffering) => {
          setState(next);
          // Show "Preparo la voce…" only if preparing takes a while (no flicker between sentences).
          if (bufferTimer.current) clearTimeout(bufferTimer.current);
          bufferTimer.current = null;
          if (isBuffering) bufferTimer.current = setTimeout(() => setBuffering(true), 700);
          else setBuffering(false);
          // The voice starts a sentence: the page follows it.
          const segment = segmentRef.current;
          const range = c.currentRange;
          if (next === 'playing' && segment && range) sourceRef.current?.follow(segment, segment.startOffset + range.start, segment.startOffset + range.end);
        },
        {},
        () => {
          // End of the section: continue with the next chapter/page.
          const source = sourceRef.current;
          const segment = segmentRef.current;
          if (!source || !segment) return;
          setBuffering(true);
          setState('playing');
          source
            .next(segment)
            .then((next) => {
              if (sourceRef.current !== source || segmentRef.current !== segment) return; // stopped meanwhile
              if (next) playSegment(c, next);
              else {
                setState('idle');
                setBuffering(false);
                source.clear();
              }
            })
            .catch(() => setState('idle'));
        },
      );
      controller.current = c;
    }
    return controller.current;
  }, [playSegment]);

  // Create the engine early so voices are loaded before the first tap.
  useEffect(() => {
    get();
    return () => {
      sourceRef.current?.clear();
      controller.current?.stop();
    };
  }, [get]);

  // Apply rate/voice changes immediately, also while speaking.
  useEffect(() => {
    controller.current?.configure({ rate, voice });
  }, [rate, voice]);

  const stop = useCallback(() => {
    const source = sourceRef.current;
    sourceRef.current = null;
    segmentRef.current = null;
    get().stop();
    source?.clear();
  }, [get]);

  return {
    state,
    /** True while the audio of the current sentence is being prepared. */
    buffering,
    /** Call synchronously in the tap handler before any await (iPhone audio rules). */
    unlock: useCallback(() => get().unlock(), [get]),
    /** Starts reading from the current position of `source`. Returns false if there is nothing to read. */
    startReading: useCallback(
      async (source: SpeechSource): Promise<boolean> => {
        const c = get();
        c.stop();
        sourceRef.current?.clear();
        sourceRef.current = source;
        let segment = await source.first();
        if (segment && !segment.text.trim()) segment = await source.next(segment);
        if (!segment || sourceRef.current !== source) return false;
        playSegment(c, segment);
        return true;
      },
      [get, playSegment],
    ),
    play: useCallback(() => get().play(), [get]),
    pause: useCallback(() => get().pause(), [get]),
    stop,
    seek: useCallback((seconds: number) => get().seek(seconds), [get]),
  };
}
