/**
 * Text-to-Speech abstraction ("🔊 Leggi ad alta voce").
 *
 * V1 ships a simple engine based on the native iOS/Android voices (expo-speech).
 * The controller is engine-agnostic so a future engine (cloud voices, offline
 * neural TTS) can be plugged in without touching the UI.
 */
export interface SpeakOptions {
  language?: string;
  rate?: number;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface TextToSpeechEngine {
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
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
    if (current.length + match[0].length > Math.min(maxLength, 400) && current) {
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
    private readonly onChange: (state: TtsState, position: number) => void,
    private readonly options: { language?: string; rate?: number } = {},
  ) {}

  load(text: string): void {
    this.stop();
    this.chunks = splitIntoUtterances(text, this.engine.maxInputLength);
    this.index = 0;
  }

  get position(): number {
    return this.chunks[this.index]?.start ?? 0;
  }

  get hasContent(): boolean {
    return this.chunks.length > 0;
  }

  play(): void {
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
    this.onChange(this.state, this.position);
  }

  stop(): void {
    this.session++;
    this.engine.stop();
    this.index = 0;
    this.state = 'idle';
    this.onChange(this.state, 0);
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
      this.onChange(this.state, this.position);
    }
  }

  private speakCurrent(): void {
    const session = ++this.session;
    const chunk = this.chunks[this.index];
    if (!chunk) {
      this.state = 'idle';
      this.index = 0;
      this.onChange(this.state, 0);
      return;
    }
    this.onChange(this.state, chunk.start);
    this.engine.speak(chunk.text, {
      language: this.options.language,
      rate: this.options.rate,
      onDone: () => {
        if (session !== this.session || this.state !== 'playing') return;
        this.index++;
        this.speakCurrent();
      },
      onError: () => {
        if (session !== this.session) return;
        this.state = 'idle';
        this.onChange(this.state, this.position);
      },
    });
  }
}
