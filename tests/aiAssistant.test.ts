import { BookAssistant, NOT_IN_BOOK_ANSWER } from '@/services/ai/BookAssistant';
import { chunkSections } from '@/services/ai/chunker';
import { InMemoryVectorStore } from '@/services/ai/InMemoryVectorStore';
import type { EmbeddingProvider, LlmMessage, LlmProvider } from '@/services/ai/types';

/** Bag-of-words embeddings: deterministic and good enough to test retrieval. */
const VOCAB = ['abitudini', 'piccole', 'cambiamenti', 'mercato', 'rischio', 'budget'];
const fakeEmbeddings: EmbeddingProvider = {
  id: 'fake',
  async embed(texts) {
    return texts.map((t) => VOCAB.map((w) => (t.toLowerCase().includes(w) ? 1 : 0)));
  },
};

class FakeLlm implements LlmProvider {
  readonly id = 'fake';
  calls: LlmMessage[][] = [];
  async complete(messages: LlmMessage[]) {
    this.calls.push(messages);
    return 'Le piccole abitudini producono grandi cambiamenti [1].';
  }
}

const sections = [
  { index: 0, title: 'Capitolo 1', page: null, text: 'Le piccole abitudini producono grandi cambiamenti nel tempo.' },
  { index: 1, title: 'Capitolo 2', page: null, text: 'Il mercato è pieno di rischio.' },
];

describe('assistente AI (RAG)', () => {
  it('divide il testo in chunk con posizione e sovrapposizione', () => {
    const text = 'Frase uno. '.repeat(50);
    const chunks = chunkSections('b', [{ index: 3, title: 'C', page: 7, text }], { maxChars: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0]).toMatchObject({ bookId: 'b', sectionIndex: 3, page: 7, start: 0 });
    expect(chunks[1].start).toBeLessThan(chunks[0].end);
    expect(text.slice(chunks[1].start, chunks[1].end).trim()).toBe(chunks[1].text);
  });

  it('risponde solo con i passaggi del libro e cita le fonti', async () => {
    const llm = new FakeLlm();
    const assistant = new BookAssistant({ embeddings: fakeEmbeddings, store: new InMemoryVectorStore(), llm });
    await assistant.indexBook('libro', sections);
    const result = await assistant.ask('libro', 'Cosa producono le piccole abitudini?');
    expect(result.grounded).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({ sectionTitle: 'Capitolo 1', index: 1 });
    expect(llm.calls[0][0].content).toContain('Non inventare');
    expect(llm.calls[0][1].content).toContain('<fonte n="1"');
  });

  it('non interroga il modello se il libro non contiene la risposta', async () => {
    const llm = new FakeLlm();
    const assistant = new BookAssistant({ embeddings: fakeEmbeddings, store: new InMemoryVectorStore(), llm });
    await assistant.indexBook('libro', sections);
    const result = await assistant.ask('libro', 'Chi ha vinto i mondiali?');
    expect(result).toEqual({ answer: NOT_IN_BOOK_ANSWER, citations: [], grounded: false });
    expect(llm.calls).toHaveLength(0);
  });
});
