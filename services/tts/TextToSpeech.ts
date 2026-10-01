/**
 * Text-to-Speech abstraction ("🔊 Leggi ad alta voce").
 *
 * Engines: the native iOS/Android/browser voices (expo-speech) and, on the web,
 * an offline neural Italian voice (Piper). The controller is engine-agnostic.
 */
export interface SpeakOptions {
  language?: string;
  rate?: number;
  /** Preferred voice; the engine ignores it when it does not speak `language`. */
  voice?: string;
  /** Called when audio actually starts (engines that need time to synthesize). */
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface TextToSpeechEngine {
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
  /** Optional: synthesize `text` ahead of time to avoid pauses between sentences. */
  prepare?(text: string, options: SpeakOptions): void;
  /** Optional: unlock audio playback; must be called synchronously in a tap handler (iOS). */
  unlock?(): void;
  /** Max characters accepted by a single `speak` call. */
  readonly maxInputLength: number;
}

export type TtsState = 'idle' | 'playing' | 'paused';

/** Average speech speed used to convert seconds into characters for ±15 s. */
export const CHARS_PER_SECOND = 14;

/** Splits text in chunks at sentence boundaries, each shorter than `maxLength`. */
export function splitIntoUtterances(text: string, maxLength: number): { start: number; text: string }[] {
  const chunks: { start: number; text: string }[] = [];
  const sentence = /[^.!?…\n]+[.!?…]*[\s\n]*/g;
  let current = '';
  let currentStart = 0;
  let match: RegExpExecArray | null;
  const push = () => {
    if (current.trim()) chunks.push({ start: currentStart, text: current });
  };
  while ((match = sentence.exec(text)) !== null) {
    if (match[0].length === 0) {
      sentence.lastIndex++;
      continue;
    }
    if (current.length + match[0].length > Math.min(maxLength, 220) && current) {
      push();
      current = '';
      currentStart = match.index;
    }
    if (!current) currentStart = match.index;
    current += match[0];
    while (current.length > maxLength) {
      chunks.push({ start: currentStart, text: current.slice(0, maxLength) });
      current = current.slice(maxLength);
      currentStart += maxLength;
    }
  }
  push();
  return chunks;
}

/**
 * Plays a text utterance by utterance. Pause/seek are implemented by stopping
 * and restarting from a character position, which works with every engine.
 */
export class TtsController {
  private chunks: { start: number; text: string }[] = [];
  private index = 0;
  private session = 0;
  state: TtsState = 'idle';

  constructor(
    private readonly engine: TextToSpeechEngine,
    /** `buffering` is true while the engine prepares the audio of the current sentence. */
    private readonly onChange: (state: TtsState, position: number, buffering: boolean) => void,
    private readonly options: { language?: string; rate?: number; voice?: string } = {},
  ) {}

  load(text: string): void {
    this.stop();
    this.chunks = splitIntoUtterances(text, this.engine.maxInputLength);
    this.index = 0;
  }

  /** Changes language/rate/voice; while playing, the current sentence restarts with the new settings. */
  configure(options: { language?: string; rate?: number; voice?: string | null }): void {
    if (options.language !== undefined) this.options.language = options.language;
    if (options.rate !== undefined) this.options.rate = options.rate;
    if (options.voice !== undefined) this.options.voice = options.voice ?? undefined;
    if (this.state === 'playing') {
      this.session++;
      this.engine.stop();
      this.speakCurrent();
    }
  }

  get position(): number {
    return this.chunks[this.index]?.start ?? 0;
  }

  get hasContent(): boolean {
    return this.chunks.length > 0;
  }

  /** See {@link TextToSpeechEngine.unlock}. */
  unlock(): void {
    this.engine.unlock?.();
  }

  play(): void {
    this.engine.unlock?.();
    if (!this.chunks.length || this.index >= this.chunks.length) {
      this.index = 0;
    }
    this.state = 'playing';
    this.speakCurrent();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.session++;
    this.engine.stop();
    this.state = 'paused';
    this.onChange(this.state, this.position, false);
  }

  stop(): void {
    this.session++;
    this.engine.stop();
    this.index = 0;
    this.state = 'idle';
    this.onChange(this.state, 0, false);
  }

  /** Moves forward/backward by a number of seconds (estimated). */
  seek(seconds: number): void {
    const targetChar = Math.max(0, this.position + seconds * CHARS_PER_SECOND * (this.options.rate ?? 1));
    let next = this.chunks.findIndex((chunk) => chunk.start + chunk.text.length > targetChar);
    if (next === -1) next = this.chunks.length - 1;
    this.index = Math.max(0, next);
    if (this.state === 'playing') {
      this.session++;
      this.engine.stop();
      this.speakCurrent();
    } else {
      this.onChange(this.state, this.position, false);
    }
  }

  private speakCurrent(): void {
    const session = ++this.session;
    const chunk = this.chunks[this.index];
    if (!chunk) {
      this.state = 'idle';
      this.index = 0;
      this.onChange(this.state, 0, false);
      return;
    }
    this.onChange(this.state, chunk.start, true);
    const options = { language: this.options.language, rate: this.options.rate, voice: this.options.voice };
    this.engine.speak(chunk.text, {
      ...options,
      onStart: () => {
        if (session === this.session && this.state === 'playing') this.onChange(this.state, chunk.start, false);
      },
      onDone: () => {
        if (session !== this.session || this.state !== 'playing') return;
        this.index++;
        this.speakCurrent();
      },
      onError: () => {
        if (session !== this.session) return;
        this.state = 'idle';
        this.onChange(this.state, this.position, false);
      },
    });
    const next = this.chunks[this.index + 1];
    if (next) this.engine.prepare?.(next.text, options);
  }
}
