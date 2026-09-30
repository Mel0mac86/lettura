import type { BookChunk, VectorMatch, VectorStore } from './types';

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Simple local vector store (brute-force cosine). Enough for a single book on device. */
export class InMemoryVectorStore implements VectorStore {
  private readonly entries = new Map<string, { chunk: BookChunk; vector: number[] }>();

  async upsert(chunks: BookChunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) throw new Error('chunks and vectors must have the same length');
    chunks.forEach((chunk, i) => this.entries.set(chunk.id, { chunk, vector: vectors[i] }));
  }

  async search(bookId: string, vector: number[], topK: number): Promise<VectorMatch[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.chunk.bookId === bookId)
      .map((e) => ({ chunk: e.chunk, score: cosineSimilarity(vector, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteBook(bookId: string): Promise<void> {
    for (const [id, entry] of this.entries) if (entry.chunk.bookId === bookId) this.entries.delete(id);
  }
}
