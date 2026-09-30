/**
 * Typed errors used by the services layer. Each error has a user-facing Italian
 * message so screens can display it directly.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(detail?: string) {
    super(
      detail ?? 'Formato non supportato. Puoi importare file EPUB, PDF o TXT.',
      'unsupported_format',
    );
  }
}

export class InvalidFileError extends AppError {
  constructor(detail: string) {
    super(detail, 'invalid_file');
  }
}

export class DrmProtectedError extends AppError {
  constructor() {
    super(
      'Questo libro è protetto da DRM e non può essere aperto. My Book Reader non rimuove protezioni anticopia.',
      'drm_protected',
    );
  }
}

export class DuplicateBookError extends AppError {
  constructor(public readonly existingBookId: string) {
    super('Questo libro è già presente nella tua libreria.', 'duplicate_book');
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(`${what} non trovato.`, 'not_found');
  }
}

/** Returns a message suitable for the UI from any thrown value. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return `Si è verificato un errore: ${error.message}`;
  return 'Si è verificato un errore imprevisto.';
}
