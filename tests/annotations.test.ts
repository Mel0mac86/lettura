import { DEFAULT_HIGHLIGHT_COLOR } from '@/services/annotations/types';

import { buildEpub } from './helpers/fixtures';
import { createTestContext, type TestContext } from './helpers/services';

describe('segnalibri, evidenziazioni e note', () => {
  let ctx: TestContext;
  let bookId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    await ctx.storage.writeBytes('file:///b.epub', await buildEpub({ title: 'Atomic' }));
    bookId = (await ctx.services.importer.importBook({ sourceUri: 'file:///b.epub', fileName: 'b.epub' })).book.id;
  });

  it('crea, elenca ed elimina un segnalibro', async () => {
    const bookmark = await ctx.services.bookmarks.create({
      bookId,
      location: { type: 'reflow', chapter: 1, progress: 0.25, offset: 42 },
      page: 3,
      chapter: 'Capitolo 2',
      text: '  Piccoli cambiamenti  ',
    });
    expect(bookmark).toMatchObject({ bookId, page: 3, chapter: 'Capitolo 2', text: 'Piccoli cambiamenti' });
    expect(JSON.parse(bookmark.location)).toEqual({ type: 'reflow', chapter: 1, progress: 0.25, offset: 42 });

    const all = await ctx.services.bookmarks.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: bookmark.id, bookTitle: 'Atomic', bookFormat: 'epub' });

    await ctx.services.bookmarks.delete(bookmark.id);
    expect(await ctx.services.bookmarks.listByBook(bookId)).toEqual([]);
  });

  it('crea un’evidenziazione con il formato richiesto', async () => {
    const highlight = await ctx.services.highlights.create({
      bookId,
      location: { type: 'reflow-range', chapter: 1, start: 10, end: 30 },
      text: 'Small changes make a big difference.',
      chapter: 'Capitolo 2',
    });
    expect(highlight).toEqual({
      id: expect.any(String),
      bookId,
      location: expect.any(String),
      chapter: 'Capitolo 2',
      page: undefined,
      text: 'Small changes make a big difference.',
      color: DEFAULT_HIGHLIGHT_COLOR,
      note: undefined,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    await ctx.services.highlights.update(highlight.id, { color: '#A8E6A1', note: 'Importante per il progetto' });
    const [updated] = await ctx.services.highlights.listByBook(bookId);
    expect(updated).toMatchObject({ color: '#A8E6A1', note: 'Importante per il progetto' });

    await ctx.services.highlights.delete(highlight.id);
    expect(await ctx.services.highlights.listAll()).toEqual([]);
  });

  it('rifiuta evidenziazioni vuote', async () => {
    await expect(
      ctx.services.highlights.create({ bookId, location: { type: 'pdf', page: 1 }, text: '   ' }),
    ).rejects.toThrow('vuoto');
  });

  it('crea, modifica ed elimina una nota', async () => {
    const note = await ctx.services.notes.create({
      bookId,
      text: 'Questo concetto è importante per il mio progetto.',
      quote: 'Small changes make a big difference.',
      location: { type: 'reflow', chapter: 0, progress: 0 },
      chapter: 'Capitolo 1',
    });
    expect(note).toMatchObject({ quote: 'Small changes make a big difference.', chapter: 'Capitolo 1' });
    await ctx.services.notes.update(note.id, 'Testo aggiornato');
    expect((await ctx.services.notes.getById(note.id))?.text).toBe('Testo aggiornato');
    await expect(ctx.services.notes.update(note.id, '  ')).rejects.toThrow('vuota');
    await ctx.services.notes.delete(note.id);
    expect(await ctx.services.notes.listAll()).toEqual([]);
  });
});
