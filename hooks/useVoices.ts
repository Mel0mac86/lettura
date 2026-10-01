import { useEffect, useState } from 'react';

import { loadVoices } from '@/services/tts/expoSpeechEngine';
import type { VoiceInfo } from '@/services/tts/voices';

/** Installed text-to-speech voices; `null` while loading. */
export function useVoices(): VoiceInfo[] | null {
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  useEffect(() => {
    let active = true;
    const attempt = (tries: number) =>
      loadVoices().then((list) => {
        if (!active) return;
        setVoices(list);
        // Browsers may return an empty list until voices are ready: retry in background.
        if (list.length === 0 && tries > 0) setTimeout(() => attempt(tries - 1), 1000);
      });
    void attempt(3);
    return () => {
      active = false;
    };
  }, []);
  return voices;
}
