import type { SpeakOptions, TextToSpeechEngine } from './TextToSpeech';
import { synthesizeNaturalVoice } from './piperClient';

/** Smallest valid WAV (silence) used to unlock audio playback on iOS. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

/**
 * Web engine for the natural voice: audio is synthesized in the Piper worker
 * and played with a single <audio> element. The next sentence is synthesized
 * while the current one plays, so reading flows without pauses.
 */
export class PiperEngine implements TextToSpeechEngine {
  readonly maxInputLength = 400;
  private readonly audio: HTMLAudioElement = new Audio();
  private readonly prepared = new Map<string, Promise<Blob>>();
  private token = 0;
  private objectUrl: string | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  private key(text: string, rate: number | undefined) {
    return `${rate ?? 1}|${text}`;
  }

  private synth(text: string, rate: number | undefined): Promise<Blob> {
    const key = this.key(text, rate);
    let promise = this.prepared.get(key);
    if (!promise) {
      promise = synthesizeNaturalVoice(text, rate ?? 1);
      this.prepared.set(key, promise);
      // Keep only a few sentences in memory.
      while (this.prepared.size > 4) this.prepared.delete(this.prepared.keys().next().value as string);
      promise.catch(() => this.prepared.delete(key));
    }
    return promise;
  }

  unlock(): void {
    // iOS only lets a page play audio started in a tap: play silence now on the
    // same element that will later play the voice.
    if (this.audio.src) return;
    this.audio.src = SILENT_WAV;
    void this.audio.play().catch(() => undefined);
  }

  prepare(text: string, options: SpeakOptions): void {
    void this.synth(text, options.rate).catch(() => undefined);
  }

  speak(text: string, options: SpeakOptions): void {
    const token = ++this.token;
    this.synth(text, options.rate)
      .then((wav) => {
        if (token !== this.token) return;
        this.prepared.delete(this.key(text, options.rate));
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = URL.createObjectURL(wav);
        let finished = false;
        const done = () => {
          if (finished || token !== this.token) return;
          finished = true;
          if (this.watchdog) clearTimeout(this.watchdog);
          options.onDone?.();
        };
        this.audio.onended = done;
        this.audio.onerror = () => token === this.token && options.onError?.(new Error('Riproduzione non riuscita'));
        this.audio.src = this.objectUrl;
        return this.audio.play().then(() => {
          if (token !== this.token) return;
          options.onStart?.();
          // Safety net: never get stuck if the browser does not fire "ended" (very short clips, iOS quirks).
          const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 30;
          if (this.watchdog) clearTimeout(this.watchdog);
          this.watchdog = setTimeout(done, duration * 1000 + 2000);
        });
      })
      .catch((error: unknown) => {
        if (token === this.token) options.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
  }

  stop(): void {
    this.token++;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.pause();
  }
}
