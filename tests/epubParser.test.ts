import { EpubDocument } from '@/services/epub/epubParser';
import { sanitizeChapterHtml } from '@/services/epub/sanitize';
import { DrmProtectedError, InvalidFileError } from '@/utils/errors';

import { buildEpub } from './helpers/fixtures';

describe('parser EPUB', () => {
  it('legge metadati, capitoli e indice (EPUB 3 nav)', async () => {
    const doc = await EpubDocument.open(await buildEpub({ title: 'Titolo', author: 'Autore' }));
    expect(doc.metadata).toMatchObject({ title: 'Titolo', authors: ['Autore'], language: 'it' });
    expect(doc.chapters.map((c) => c.title)).toEqual(['Capitolo 1', 'Capitolo 2']);
    expect(doc.toc).toEqual([
      { title: 'Capitolo 1', chapterIndex: 0, depth: 0 },
      { title: 'Capitolo 2', chapterIndex: 1, depth: 0 },
    ]);
  });

  it('legge l’indice NCX degli EPUB 2', async () => {
    const doc = await EpubDocument.open(await buildEpub({ ncx: true }));
    expect(doc.toc.map((t) => t.chapterIndex)).toEqual([0, 1]);
  });

  it('produce HTML sicuro e testo coerente con textContent', async () => {
    const doc = await EpubDocument.open(
      await buildEpub({
        chapters: [{ title: 'Uno', body: '<p onclick="evil()">Ciao &amp; <a href="ch2.xhtml#n1">nota</a><a id="x"/>fine</p><script>alert(1)</script>' }],
      }),
    );
    const html = await doc.getChapterHtml(0);
    expect(html).not.toMatch(/script|onclick|<link/);
    expect(html).toContain('data-epub-href="ch2.xhtml#n1"');
    expect(html).toContain('<a id="x"></a>');
    expect(await doc.getChapterText(0)).toBe('UnoCiao & notafine');
  });

  it('restituisce la copertina', async () => {
    const doc = await EpubDocument.open(await buildEpub({ withCover: true }));
    const cover = await doc.getCover();
    expect(cover?.mimeType).toBe('image/png');
    expect(cover?.bytes.length).toBeGreaterThan(10);
  });

  it('risolve i link interni ai capitoli', async () => {
    const doc = await EpubDocument.open(await buildEpub());
    expect(doc.resolveHref(0, 'ch2.xhtml#sez')).toEqual({ chapter: 1, anchor: 'sez' });
    expect(doc.resolveHref(0, 'https://example.com')).toBeNull();
  });

  it('segnala DRM e file danneggiati', async () => {
    await expect(EpubDocument.open(await buildEpub({ drm: true }))).rejects.toBeInstanceOf(DrmProtectedError);
    await expect(EpubDocument.open(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('normalizza CRLF e tag auto-chiusi', () => {
    expect(sanitizeChapterHtml('<p>a\r\nb</p><span class="x"/><br/>')).toBe('<p>a\nb</p><span class="x"></span><br/>');
  });
});
