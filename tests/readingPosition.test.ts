import { parseLocation } from '@/utils/location';

import { buildEpub } from './helpers/fixtures';
import { createTestContext, type TestContext } from './helpers/services';

describe('posizione di lettura', () => {
  let ctx: TestContext;
  let bookId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    await ctx.storage.writeBytes('file:///b.epub', await buildEpub());
    bookId = (await ctx.services.importer.importBook({ sourceUri: 'file:///b.epub', fileName: 'b.epub' })).book.id;
  });

  it('crea il libro nel database con stato "non iniziato"', async () => {
    const position = await ctx.services.books.getPosition(bookId);
    expect(position).toEqual({
      location: null,
      progress: 0,
      currentPage: null,
      currentChapter: null,
      lastReadAt: null,
      status: 'not_started',
    });
  });

  it('salva e ricarica la posizione', async () => {
    await ctx.services.books.savePosition(bookId, {
      location: { type: 'reflow', chapter: 1, progress: 0.5, offset: 120 },
      progress: 0.72,
      currentPage: 4,
      currentChapter: 'Capitolo 2',
    });
    const position = await ctx.services.books.getPosition(bookId);
    expect(position.location).toEqual({ type: 'reflow', chapter: 1, progress: 0.5, offset: 120 });
    expect(position).toMatchObject({ progress: 0.72, currentPage: 4, currentChapter: 'Capitolo 2', status: 'reading' });
    expect(position.lastReadAt).not.toBeNull();
  });

  it('segna il libro come completato alla fine e lo esclude da "continua a leggere"', async () => {
    await ctx.services.books.savePosition(bookId, { location: { type: 'pdf', page: 10 }, progress: 1 });
    expect((await ctx.services.books.getPosition(bookId)).status).toBe('completed');
    expect(await ctx.services.books.listContinueReading()).toEqual([]);
  });

  it('reimposta la posizione quando lo stato torna a "non iniziato"', async () => {
    await ctx.services.books.savePosition(bookId, { location: { type: 'pdf', page: 3 }, progress: 0.3 });
    await ctx.services.books.setStatus(bookId, 'not_started');
    const position = await ctx.services.books.getPosition(bookId);
    expect(position).toMatchObject({ location: null, progress: 0, status: 'not_started' });
  });

  it('ignora posizioni salvate corrotte', () => {
    expect(parseLocation('{not json')).toBeNull();
    expect(parseLocation('{"type":"pdf","page":"x"}')).toBeNull();
    expect(parseLocation('{"type":"reflow","chapter":2,"progress":3}')).toEqual({ type: 'reflow', chapter: 2, progress: 1 });
  });
});
