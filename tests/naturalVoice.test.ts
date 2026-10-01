import { RoutingEngine } from '@/services/tts/RoutingEngine';
import { TtsController, type SpeakOptions, type TextToSpeechEngine } from '@/services/tts/TextToSpeech';

class RecordingEngine implements TextToSpeechEngine {
  readonly maxInputLength = 400;
  spoken: string[] = [];
  prepared: string[] = [];
  unlocked = 0;
  last: SpeakOptions | null = null;
  constructor(private readonly fail = false) {}
  speak(text: string, options: SpeakOptions) {
    this.spoken.push(text);
    this.last = options;
    if (this.fail) options.onError?.(new Error('boom'));
  }
  prepare(text: string) {
    this.prepared.push(text);
  }
  unlock() {
    this.unlocked++;
  }
  stop() {}
}

describe('voce naturale (routing e preparazione anticipata)', () => {
  it('usa la voce naturale solo per l’italiano e solo se attiva', () => {
    const system = new RecordingEngine();
    const natural = new RecordingEngine();
    let enabled = true;
    const engine = new RoutingEngine(system, natural, 'it-IT', () => enabled);
    engine.speak('Ciao', { language: 'it-IT' });
    engine.speak('Hello', { language: 'en-US' });
    enabled = false;
    engine.speak('Ciao di nuovo', { language: 'it-IT' });
    expect(natural.spoken).toEqual(['Ciao']);
    expect(system.spoken).toEqual(['Hello', 'Ciao di nuovo']);
  });

  it('se la voce naturale fallisce continua con la voce di sistema', () => {
    const system = new RecordingEngine();
    const errors: string[] = [];
    const engine = new RoutingEngine(system, new RecordingEngine(true), 'it-IT', () => true, (e) => errors.push(e.message));
    engine.speak('Uno', { language: 'it-IT' });
    engine.speak('Due', { language: 'it-IT' });
    expect(system.spoken).toEqual(['Uno', 'Due']);
    expect(errors).toEqual(['boom']);
  });

  it('prepara la frase successiva, sblocca l’audio e segnala il buffering', () => {
    const engine = new RecordingEngine();
    const buffering: boolean[] = [];
    const tts = new TtsController(engine, (_s, _p, b) => buffering.push(b), { language: 'it-IT' });
    const sentence = (n: string) => `${n} frase abbastanza lunga da occupare da sola buona parte di un blocco di lettura ad alta voce, così da essere separata. `;
    tts.load(sentence('Prima') + sentence('Seconda') + sentence('Terza'));
    tts.play();
    expect(engine.unlocked).toBe(1);
    expect(engine.prepared.length).toBe(1);
    expect(buffering.at(-1)).toBe(true);
    engine.last?.onStart?.();
    expect(buffering.at(-1)).toBe(false);
  });
});
