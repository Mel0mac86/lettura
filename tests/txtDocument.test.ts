import { splitTxtIntoChapters, TXT_SECTION_SIZE, TxtDocument } from '@/services/txt/txtDocument';
import { decodeText, htmlToText } from '@/utils/text';

describe('documento TXT', () => {
  it('divide il testo in capitoli usando i titoli', () => {
    const chapters = splitTxtIntoChapters('Prefazione breve.\n\nCapitolo 1\n\nUno.\n\nCapitolo 2\nDue.');
    expect(chapters.map((c) => c.title)).toEqual(['Inizio', 'Capitolo 1', 'Capitolo 2']);
  });

  it('divide i testi lunghi senza titoli in sezioni', () => {
    const paragraph = 'a'.repeat(1000);
    const chapters = splitTxtIntoChapters(Array.from({ length: 80 }, () => paragraph).join('\n\n'));
    expect(chapters.length).toBe(Math.ceil((80 * 1000) / TXT_SECTION_SIZE));
  });

  it('il testo del capitolo coincide con il textContent dell’HTML', async () => {
    const doc = new TxtDocument('Capitolo 1\n\nCiao <mondo> & amici\n\nCapitolo 2\n\nFine');
    const html = await doc.getChapterHtml(0);
    expect(html).toContain('&lt;mondo&gt;');
    expect(htmlToText(html)).toBe(await doc.getChapterText(0));
    expect(doc.toc).toHaveLength(2);
  });

  it('decodifica UTF-8 (con BOM) e Windows-1252', () => {
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, 0x63, 0x69, 0x74, 0x74, 0xc3, 0xa0]))).toBe('città');
    expect(decodeText(Uint8Array.from([0x63, 0x69, 0x74, 0x74, 0xe0, 0x20, 0x80]))).toBe('città €');
  });
});
