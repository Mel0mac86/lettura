import { splitIntoUtterances, TtsController, type SpeakOptions, type TextToSpeechEngine } from '@/services/tts/TextToSpeech';

class FakeEngine implements TextToSpeechEngine {
  readonly maxInputLength = 50;
  spoken: string[] = [];
  private pending: SpeakOptions | null = null;
  speak(text: string, options: SpeakOptions) {
    this.spoken.push(text);
    this.pending = options;
  }
  stop() {
    this.pending = null;
  }
  finish() {
    const p = this.pending;
    this.pending = null;
    p?.onDone?.();
  }
}

describe('lettura ad alta voce (architettura TTS)', () => {
  it('divide il testo in frasi rispettando la lunghezza massima', () => {
    const chunks = splitIntoUtterances('Prima frase. Seconda frase! Terza?', 20);
    expect(chunks.map((c) => c.text.trim())).toEqual(['Prima frase.', 'Seconda frase!', 'Terza?']);
    expect(chunks[1].start).toBe(13);
  });

  it('play, pausa, stop e salto di ±15 secondi', () => {
    const engine = new FakeEngine();
    const states: string[] = [];
    const tts = new TtsController(engine, (s) => states.push(s));
    tts.load('Uno. Due. Tre. '.repeat(20));
    tts.play();
    expect(tts.state).toBe('playing');
    engine.finish();
    expect(engine.spoken).toHaveLength(2);
    tts.pause();
    expect(tts.state).toBe('paused');
    const pausedAt = tts.position;
    tts.seek(15);
    expect(tts.position).toBeGreaterThan(pausedAt);
    tts.seek(-15);
    expect(tts.position).toBeLessThanOrEqual(pausedAt);
    tts.stop();
    expect(tts.state).toBe('idle');
    expect(states).toContain('paused');
  });
});
