import type { BookFormat } from '@/types/models';
import { InvalidFileError, UnsupportedFormatError } from '@/utils/errors';
import { getFileExtension } from '@/utils/text';

/** Largest file accepted by the importer. */
export const MAX_BOOK_SIZE_BYTES = 500 * 1024 * 1024;

interface FormatSpec {
  format: BookFormat;
  label: string;
  extensions: string[];
  mimeTypes: string[];
}

/** Formats supported in V1. Add an entry + a handler in bookFormatHandlers.ts to support more. */
export const SUPPORTED_FORMATS: readonly FormatSpec[] = [
  { format: 'epub', label: 'EPUB', extensions: ['epub'], mimeTypes: ['application/epub+zip'] },
  { format: 'pdf', label: 'PDF', extensions: ['pdf'], mimeTypes: ['application/pdf'] },
  { format: 'txt', label: 'TXT', extensions: ['txt', 'text'], mimeTypes: ['text/plain'] },
];

/** Formats recognised but not yet supported (see docs/ROADMAP.md). */
export const PLANNED_FORMATS: readonly { label: string; extensions: string[] }[] = [
  { label: 'MOBI', extensions: ['mobi', 'prc'] },
  { label: 'AZW/AZW3 (Kindle)', extensions: ['azw', 'azw3', 'kfx'] },
  { label: 'CBZ', extensions: ['cbz'] },
  { label: 'CBR', extensions: ['cbr'] },
  { label: 'FB2', extensions: ['fb2'] },
];

/** MIME types passed to the document picker. */
export const PICKER_MIME_TYPES = [
  ...SUPPORTED_FORMATS.flatMap((f) => f.mimeTypes),
  // Some providers (e.g. iCloud, Google Drive) report generic types for EPUB/TXT.
  'application/octet-stream',
  'application/zip',
  'text/*',
];

const startsWith = (bytes: Uint8Array, signature: string, offset = 0) =>
  signature.split('').every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));

export function isPdfBytes(bytes: Uint8Array): boolean {
  // The header may be preceded by a few junk bytes (allowed by most readers).
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) if (startsWith(bytes, '%PDF-', i)) return true;
  return false;
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length > 4 && startsWith(bytes, 'PK\u0003\u0004');
}

/** EPUB = zip whose first entry is "mimetype" containing "application/epub+zip". */
export function isEpubBytes(bytes: Uint8Array): boolean {
  if (!isZipBytes(bytes)) return false;
  if (startsWith(bytes, 'mimetype', 30)) return startsWith(bytes, 'application/epub+zip', 38);
  return false;
}

export function isMobiBytes(bytes: Uint8Array): boolean {
  return bytes.length > 68 && (startsWith(bytes, 'BOOKMOBI', 60) || startsWith(bytes, 'TEXtREAd', 60));
}

/** Heuristic: text files contain no NUL bytes in the first KBs. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (sample.length >= 2 && ((sample[0] === 0xff && sample[1] === 0xfe) || (sample[0] === 0xfe && sample[1] === 0xff))) {
    return true;
  }
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return control / Math.max(1, sample.length) < 0.02;
}

/**
 * Identifies the format using the file content first (magic bytes) and the
 * extension/MIME type as hints. Throws {@link UnsupportedFormatError}.
 */
export function detectFormat(bytes: Uint8Array, fileName: string, mimeType?: string | null): BookFormat {
  const extension = getFileExtension(fileName);
  if (isPdfBytes(bytes)) return 'pdf';
  if (isEpubBytes(bytes)) return 'epub';
  // Some EPUB generators do not store "mimetype" first: trust the extension for zips.
  if (isZipBytes(bytes) && (extension === 'epub' || mimeType === 'application/epub+zip')) return 'epub';

  const planned = PLANNED_FORMATS.find((f) => f.extensions.includes(extension));
  if (planned || isMobiBytes(bytes)) {
    throw new UnsupportedFormatError(
      `Il formato ${planned?.label ?? 'MOBI'} non è ancora supportato. Formati disponibili: EPUB, PDF, TXT.`,
    );
  }
  const textHint = extension === 'txt' || extension === 'text' || (mimeType ?? '').startsWith('text/plain');
  if (textHint && looksLikeText(bytes)) return 'txt';
  throw new UnsupportedFormatError();
}

/** Basic structural validation common to all formats. */
export function validateBookBytes(bytes: Uint8Array, format: BookFormat): void {
  if (bytes.length === 0) throw new InvalidFileError('Il file è vuoto.');
  if (bytes.length > MAX_BOOK_SIZE_BYTES) {
    throw new InvalidFileError('Il file è troppo grande (massimo 500 MB).');
  }
  if (format === 'pdf') {
    const tail = String.fromCharCode(...bytes.subarray(Math.max(0, bytes.length - 2048)));
    if (!tail.includes('%%EOF') && !tail.includes('startxref')) {
      throw new InvalidFileError('Il PDF sembra incompleto o danneggiato.');
    }
  }
  if (format === 'txt' && !looksLikeText(bytes)) {
    throw new InvalidFileError('Il file TXT contiene dati binari non leggibili.');
  }
}

export function formatLabel(format: BookFormat): string {
  return SUPPORTED_FORMATS.find((f) => f.format === format)?.label ?? format.toUpperCase();
}
