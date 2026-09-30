import { DrmProtectedError, DuplicateBookError, UnsupportedFormatError } from '@/utils/errors';

import { buildEpub, buildPdf, buildTxt } from './helpers/fixtures';
import { createTestContext, type TestContext } from './helpers/services';

describe('importazione libro', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function importFile(bytes: Uint8Array, fileName: string, mimeType?: string) {
    const uri = `file:///picker/${fileName}`;
    await ctx.storage.writeBytes(uri, bytes);
    return ctx.services.importer.importBook({ sourceUri: uri, fileName, mimeType });
  }

  it('importa un EPUB: metadati, copertina, file, database e indice', async () => {
    const steps: string[] = [];
    const uri = 'file:///picker/libro.epub';
    await ctx.storage.writeBytes(uri, await buildEpub({ title: 'Abitudini', author: 'Anna Bianchi', withCover: true }));
    const { book, needsMetadataReview } = await ctx.services.importer.importBook(
      { sourceUri: uri, fileName: 'libro.epub' },
      (s) => steps.push(s),
    );

    expect(steps).toEqual(['reading', 'detecting', 'extracting', 'saving', 'indexing', 'done']);
    expect(book).toMatchObject({
      title: 'Abitudini',
      author: 'Anna Bianchi',
      format: 'epub',
      language: 'it',
      status: 'not_started',
      progress: 0,
      totalChapters: 2,
      isIndexed: true,
      filePath: `books/${book.id}.epub`,
      cover: `covers/${book.id}.png`,
    });
    expect(needsMetadataReview).toBe(false);
    expect(await ctx.storage.exists(book.filePath)).toBe(true);
    expect(await ctx.storage.exists(book.cover!)).toBe(true);
    expect(await ctx.services.books.getById(book.id)).toEqual(book);
    const sections = await ctx.services.search.getSections(book.id);
    expect(sections).toHaveLength(2);
    expect(sections[1].text).toContain('Piccoli cambiamenti');
  });

  it('usa il nome del file quando mancano i metadati e chiede la revisione', async () => {
    const { book, needsMetadataReview } = await importFile(
      await buildEpub({ title: null, author: null }),
      'il_mio_libro.epub',
    );
    expect(book.title).toBe('Il mio libro');
    expect(book.author).toBeNull();
    expect(needsMetadataReview).toBe(true);
  });

  it('importa un PDF leggendo titolo, autore e numero di pagine', async () => {
    const { book } = await importFile(buildPdf({ title: 'Manuale', author: 'Luca Verdi', pages: 7 }), 'manuale.pdf');
    expect(book).toMatchObject({ format: 'pdf', title: 'Manuale', author: 'Luca Verdi', totalPages: 7, isIndexed: false });
  });

  it('importa un TXT e lo indicizza', async () => {
    const { book } = await importFile(buildTxt('Diario\n\nOggi ho letto molto.\n\nDomani leggerò ancora.'), 'diario.txt');
    expect(book).toMatchObject({ format: 'txt', title: 'Diario', totalChapters: 1, isIndexed: true });
  });

  it('rifiuta i duplicati', async () => {
    const bytes = await buildEpub();
    const first = await importFile(bytes, 'a.epub');
    await expect(importFile(bytes, 'b.epub')).rejects.toEqual(new DuplicateBookError(first.book.id));
  });

  it('rifiuta EPUB protetti da DRM senza salvare nulla', async () => {
    await expect(importFile(await buildEpub({ drm: true }), 'drm.epub')).rejects.toBeInstanceOf(DrmProtectedError);
    expect(await ctx.services.books.count()).toBe(0);
    expect(Array.from(ctx.storage.files.keys()).filter((k) => !k.startsWith('file://'))).toEqual([]);
  });

  it('rifiuta formati non supportati', async () => {
    await expect(importFile(new Uint8Array([1, 2, 3, 0]), 'immagine.png')).rejects.toBeInstanceOf(UnsupportedFormatError);
  });

  it('elimina libro, file e annotazioni', async () => {
    const { book } = await importFile(await buildEpub({ withCover: true }), 'x.epub');
    await ctx.services.bookmarks.create({ bookId: book.id, location: { type: 'reflow', chapter: 0, progress: 0 } });
    await ctx.services.importer.deleteBook(book);
    expect(await ctx.services.books.getById(book.id)).toBeNull();
    expect(await ctx.storage.exists(book.filePath)).toBe(false);
    expect(await ctx.services.bookmarks.listByBook(book.id)).toEqual([]);
    expect(await ctx.services.search.getSections(book.id)).toEqual([]);
  });
});
