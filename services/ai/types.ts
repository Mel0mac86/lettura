/**
 * AI assistant architecture (V4) — Retrieval-Augmented Generation.
 *
 *   Libro → Parsing → Chunks → Embeddings → Vector store → AI Assistant
 *
 * Only interfaces and provider-agnostic logic live here. No book content is
 * sent anywhere in V1: concrete providers will be opt-in and configured by the user.
 */

/** A passage of a book, the unit that is embedded and retrieved. */
export interface BookChunk {
  id: string;
  bookId: string;
  /** Chapter (EPUB/TXT) or page index (PDF) of the section the chunk comes from. */
  sectionIndex: number;
  sectionTitle: string | null;
  page: number | null;
  /** Character range inside the section text (to jump to the exact passage). */
  start: number;
  end: number;
  text: string;
}

export interface EmbeddingProvider {
  readonly id: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorMatch {
  chunk: BookChunk;
  score: number;
}

export interface VectorStore {
  upsert(chunks: BookChunk[], vectors: number[][]): Promise<void>;
  search(bookId: string, vector: number[], topK: number): Promise<VectorMatch[]>;
  deleteBook(bookId: string): Promise<void>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  readonly id: string;
  complete(messages: LlmMessage[]): Promise<string>;
}

/** Where an answer comes from: shown to the user as "Capitolo 3, pag. 12". */
export interface Citation {
  index: number;
  bookId: string;
  sectionTitle: string | null;
  page: number | null;
  start: number;
  end: number;
  excerpt: string;
}

export interface AssistantAnswer {
  answer: string;
  citations: Citation[];
  /** False when the book does not contain enough information to answer. */
  grounded: boolean;
}
