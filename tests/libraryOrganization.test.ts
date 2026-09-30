import { buildEpub, buildTxt } from './helpers/fixtures';
import { createTestContext } from './helpers/services';

describe('organizzazione della libreria', () => {
  it('categorie, tag, preferiti, filtri e ordinamento', async () => {
    const { services, storage } = await createTestContext();
    await storage.writeBytes('file:///a.epub', await buildEpub({ title: 'Zeta', author: 'Rossi' }));
    await storage.writeBytes('file:///b.txt', buildTxt('Alfa\n\nTesto'));
    const a = (await services.importer.importBook({ sourceUri: 'file:///a.epub', fileName: 'a.epub' })).book;
    const b = (await services.importer.importBook({ sourceUri: 'file:///b.txt', fileName: 'b.txt' })).book;

    const trading = await services.categories.create('Filosofia', '🧠');
    await expect(services.categories.create('filosofia')).rejects.toThrow('esiste già');
    await services.categories.setBookCategories(a.id, [trading.id]);
    await services.books.setFavorite(b.id, true);
    await services.books.setTags(a.id, ['#saggio', 'Saggio', 'da rileggere']);

    expect(await services.books.getTags(a.id)).toEqual(['da rileggere', 'Saggio']);
    expect((await services.books.list({ categoryId: trading.id })).map((x) => x.id)).toEqual([a.id]);
    expect((await services.books.list({ filter: 'favorites' })).map((x) => x.id)).toEqual([b.id]);
    expect((await services.books.list({ query: 'saggio' })).map((x) => x.id)).toEqual([a.id]);
    expect((await services.books.list({ sort: 'title' })).map((x) => x.title)).toEqual(['Alfa', 'Zeta']);
    expect((await services.categories.list()).find((c) => c.id === trading.id)?.bookCount).toBe(1);

    const updated = await services.books.updateMetadata(b.id, { author: 'Verdi', title: '  ' });
    expect(updated).toMatchObject({ title: 'Alfa', author: 'Verdi' });
    expect((await services.books.list({ query: 'verdi' })).map((x) => x.id)).toEqual([b.id]);

    await services.categories.delete(trading.id);
    expect(await services.categories.listForBook(a.id)).toEqual([]);
  });

  it('salva e ricarica le impostazioni con i valori predefiniti', async () => {
    const { services } = await createTestContext();
    const defaults = await services.settings.load();
    await services.settings.save({ ...defaults, appTheme: 'dark', reader: { ...defaults.reader, theme: 'sepia', fontSize: 24 } });
    expect(await services.settings.load()).toMatchObject({ appTheme: 'dark', reader: { theme: 'sepia', fontSize: 24, lineHeight: defaults.reader.lineHeight } });
  });
});
