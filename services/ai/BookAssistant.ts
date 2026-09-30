import type { TextSection } from '@/types/models';

import { chunkSections, type ChunkOptions } from './chunker';
import type { AssistantAnswer, Citation, EmbeddingProvider, LlmMessage, LlmProvider, VectorMatch, VectorStore } from './types';

export const NOT_IN_BOOK_ANSWER = 'Non ho trovato questa informazione nel libro.';

export const GROUNDED_SYSTEM_PROMPT = `Sei un assistente di lettura. Rispondi SOLO usando i passaggi del libro forniti tra i tag <fonte>.
Regole:
- Non inventare informazioni che non sono nei passaggi.
- Se i passaggi non contengono la risposta, rispondi esattamente: "${NOT_IN_BOOK_ANSWER}"
- Cita le fonti usate con il loro numero tra parentesi quadre, ad esempio [1] o [2][3].
- Rispondi nella lingua della domanda.`;

export interface BookAssistantOptions {
  topK?: number;
  /** Minimum similarity for a passage to be considered relevant. */
  minScore?: number;
  chunking?: ChunkOptions;
}

/**
 * RAG assistant for a single book: indexes the book text and answers questions
 * using only retrieved passages, returning citations (chapter, page, passage).
 * Summaries, explanations, flashcards and quizzes (V4) are built on `ask()`.
 */
export class BookAssistant {
  private readonly topK: number;
  private readonly minScore: number;

  constructor(
    private readonly deps: { embeddings: EmbeddingProvider; store: VectorStore; llm: LlmProvider },
    private readonly options: BookAssistantOptions = {},
  ) {
    this.topK = options.topK ?? 5;
    this.minScore = options.minScore ?? 0.2;
  }

  async indexBook(bookId: string, sections: readonly TextSection[]): Promise<number> {
    const chunks = chunkSections(bookId, sections, this.options.chunking);
    await this.deps.store.deleteBook(bookId);
    const batchSize = 64;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await this.deps.store.upsert(batch, await this.deps.embeddings.embed(batch.map((c) => c.text)));
    }
    return chunks.length;
  }

  async retrieve(bookId: string, question: string): Promise<VectorMatch[]> {
    const [vector] = await this.deps.embeddings.embed([question]);
    const matches = await this.deps.store.search(bookId, vector, this.topK);
    return matches.filter((m) => m.score >= this.minScore);
  }

  async ask(bookId: string, question: string): Promise<AssistantAnswer> {
    const matches = await this.retrieve(bookId, question);
    // No relevant passage: never ask the model, so it cannot make things up.
    if (matches.length === 0) return { answer: NOT_IN_BOOK_ANSWER, citations: [], grounded: false };

    const citations: Citation[] = matches.map((m, i) => ({
      index: i + 1,
      bookId: m.chunk.bookId,
      sectionTitle: m.chunk.sectionTitle,
      page: m.chunk.page,
      start: m.chunk.start,
      end: m.chunk.end,
      excerpt: m.chunk.text,
    }));
    const answer = (await this.deps.llm.complete(buildGroundedMessages(question, citations))).trim();
    const grounded = answer !== NOT_IN_BOOK_ANSWER;
    const used = new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (m) => Number(m[1])));
    return {
      answer,
      grounded,
      citations: grounded ? citations.filter((c) => used.size === 0 || used.has(c.index)) : [],
    };
  }
}

export function buildGroundedMessages(question: string, citations: readonly Citation[]): LlmMessage[] {
  const sources = citations
    .map((c) => {
      const where = [c.sectionTitle, c.page ? `pagina ${c.page}` : null].filter(Boolean).join(', ');
      return `<fonte n="${c.index}" posizione="${where}">\n${c.excerpt}\n</fonte>`;
    })
    .join('\n');
  return [
    { role: 'system', content: GROUNDED_SYSTEM_PROMPT },
    { role: 'user', content: `${sources}\n\nDomanda: ${question}` },
  ];
}
