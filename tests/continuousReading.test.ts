import { nextNonEmptySection } from '@/services/tts/SpeechSource';
import { TtsController, type SpeakOptions, type TextToSpeechEngine } from '@/services/tts/TextToSpeech';

class InstantEngine implements TextToSpeechEngine {
  readonly maxInputLength = 400;
  spoken: string[] = [];
  speak(text: string, options: SpeakOptions) {
    this.spoken.push(text.trim());
    options.onStart?.();
    queueMicrotask(() => options.onDone?.());
  }
  stop() {}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('lettura continua', () => {
  it('trova la sezione successiva saltando quelle vuote', async () => {
    const pages = ['Uno.', '', '   ', 'Quattro.'];
    expect(await nextNonEmptySection(0, pages.length, async (i) => pages[i])).toEqual({ section: 3, startOffset: 0, text: 'Quattro.' });
    expect(await nextNonEmptySection(3, pages.length, async (i) => pages[i])).toBeNull();
  });

  it('avvisa a fine testo per passare alla sezione successiva, non quando si ferma', async () => {
    const engine = new InstantEngine();
    let ends = 0;
    const tts = new TtsController(engine, () => undefined, {}, () => ends++);
    tts.load('Prima frase. Seconda frase.');
    tts.play();
    await flush();
    expect(engine.spoken).toEqual(['Prima frase. Seconda frase.']);
    expect(ends).toBe(1);

    tts.load('Altro testo.');
    tts.play();
    tts.stop();
    await flush();
    expect(ends).toBe(1);
  });

  it('indica l’intervallo della frase letta (per evidenziarla nella pagina)', () => {
    const tts = new TtsController(new InstantEngine(), () => undefined);
    tts.load('  Ciao mondo.  ');
    expect(tts.currentRange).toEqual({ start: 2, end: 13 });
  });
});
