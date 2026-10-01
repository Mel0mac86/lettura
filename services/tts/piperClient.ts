import Constants from 'expo-constants';

/**
 * Client of the Piper neural-voice Web Worker (web/piper-worker.js, served from
 * `<site>/piper/`). Web only: the worker runs the Italian voice "Paola" offline.
 */
type WorkerReply =
  | { id: number; type: 'result'; downloaded?: boolean; totalSize?: number; wav?: ArrayBuffer }
  | { id: number; type: 'error'; message: string }
  | { id: number; type: 'progress'; loaded: number; total: number };

export const NATURAL_VOICE = { name: 'Paola', language: 'it-IT', approxDownloadMb: 93 } as const;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (r: Extract<WorkerReply, { type: 'result' }>) => void; reject: (e: Error) => void; onProgress?: (fraction: number) => void }
>();

function workerUrl(): string {
  const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
  return `${base}/piper/piper-worker.js`;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(workerUrl());
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      const entry = pending.get(reply.id);
      if (!entry) return;
      if (reply.type === 'progress') {
        entry.onProgress?.(reply.total > 0 ? reply.loaded / reply.total : 0);
        return;
      }
      pending.delete(reply.id);
      if (reply.type === 'error') entry.reject(new Error(reply.message));
      else entry.resolve(reply);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Errore del motore vocale');
      pending.forEach((entry) => entry.reject(error));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

function call(message: object, onProgress?: (fraction: number) => void) {
  return new Promise<Extract<WorkerReply, { type: 'result' }>>((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ ...message, id });
  });
}

export function isNaturalVoiceSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof caches !== 'undefined' && typeof WebAssembly !== 'undefined';
}

export async function isNaturalVoiceDownloaded(): Promise<boolean> {
  if (!isNaturalVoiceSupported()) return false;
  return (await call({ type: 'status' })).downloaded === true;
}

export async function downloadNaturalVoice(onProgress: (fraction: number) => void): Promise<void> {
  await call({ type: 'download' }, onProgress);
}

export async function removeNaturalVoice(): Promise<void> {
  await call({ type: 'remove' });
}

/** Synthesizes `text` and returns a WAV file. */
export async function synthesizeNaturalVoice(text: string, rate: number): Promise<Blob> {
  const reply = await call({ type: 'synthesize', text, rate });
  if (!reply.wav) throw new Error('Nessun audio generato');
  return new Blob([reply.wav], { type: 'audio/wav' });
}
