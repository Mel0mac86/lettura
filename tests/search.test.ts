import { buildEpub, buildPdf, buildTxt } from './helpers/fixtures';
import { createTestContext, type TestContext } from './helpers/services';

describe('ricerca', () => {
  let ctx: TestContext;
  let epubId: string;
  let pdfId: string;

  async function importFile(bytes: Uint8Array, fileName: string) {
    await ctx.storage.writeBytes(`file:///${fileName}`, bytes);
    return (await ctx.services.importer.importBook({ sourceUri: `file:///${fileName}`, fileName })).book;
  }

  beforeEach(async () => {
    ctx = await createTestContext();
    epubId = (await importFile(await buildEpub({ title: 'Abitudini Atomiche', author: 'Giacomo Città' }), 'a.epub')).id;
    await importFile(buildTxt('Trading\n\nIl mercato sale e scende.'), 'trading.txt');
    pdfId = (await importFile(buildPdf({ title: 'Finanza personale' }), 'f.pdf')).id;
  });

  it('trova libri per titolo e autore ignorando maiuscole e accenti', async () => {
    expect((await ctx.services.search.search('atomiche')).books.map((b) => b.id)).toEqual([epubId]);
    expect((await ctx.services.search.search('CITTA')).books.map((b) => b.id)).toEqual([epubId]);
  });

  it('trova il testo nei contenuti con snippet e posizione', async () => {
    const { content } = await ctx.services.search.search('perche');
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ bookId: epubId, sectionIndex: 1, sectionTitle: 'Capitolo 2' });
    expect(content[0].snippet).toContain('Perché è così?');
    const text = (await ctx.services.search.getSectionText(epubId, 1))!;
    expect(text.slice(content[0].offset, content[0].offset + 6)).toBe('Perché');
  });

  it('indicizza il testo dei PDF (inviato dal lettore) e lo rende ricercabile', async () => {
    await ctx.services.search.upsertSections(pdfId, [
      { index: 0, page: 1, title: 'Pagina 1', text: 'Il budget mensile' },
      { index: 1, page: 2, title: 'Pagina 2', text: 'Risparmio e budget' },
    ]);
    const hits = await ctx.services.search.searchInBook(pdfId, 'budget');
    expect(hits.map((h) => h.page)).toEqual([1, 2]);
  });

  it('trova note ed evidenziazioni', async () => {
    await ctx.services.notes.create({ bookId: epubId, text: 'Idea per il progetto di lettura' });
    await ctx.services.highlights.create({
      bookId: epubId,
      location: { type: 'reflow-range', chapter: 0, start: 0, end: 5 },
      text: 'Piccoli cambiamenti',
      note: 'Rileggere',
    });
    const results = await ctx.services.search.search('progetto');
    expect(results.notes).toHaveLength(1);
    expect((await ctx.services.search.search('rileggere')).highlights).toHaveLength(1);
  });

  it('ignora query troppo corte e restituisce tutte le occorrenze nel libro', async () => {
    expect(await ctx.services.search.search('a')).toMatchObject({ books: [], content: [] });
    await ctx.services.search.indexBook(epubId, [{ index: 0, page: null, title: 'X', text: 'uno due uno tre uno' }]);
    expect((await ctx.services.search.searchInBook(epubId, 'uno')).map((h) => h.offset)).toEqual([0, 8, 16]);
  });
});
