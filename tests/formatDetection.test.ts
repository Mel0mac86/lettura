import { detectFormat, isEpubBytes, isPdfBytes, validateBookBytes } from '@/services/books/formats';
import { InvalidFileError, UnsupportedFormatError } from '@/utils/errors';

import { buildEpub, buildPdf, buildTxt } from './helpers/fixtures';

describe('rilevamento formato', () => {
  it('riconosce un EPUB dal contenuto, anche con estensione errata', async () => {
    const epub = await buildEpub();
    expect(isEpubBytes(epub)).toBe(true);
    expect(detectFormat(epub, 'libro.epub')).toBe('epub');
    expect(detectFormat(epub, 'download.bin')).toBe('epub');
  });

  it('riconosce un PDF dalla firma %PDF-', () => {
    const pdf = buildPdf();
    expect(isPdfBytes(pdf)).toBe(true);
    expect(detectFormat(pdf, 'documento.pdf', 'application/pdf')).toBe('pdf');
    expect(detectFormat(pdf, 'senza-estensione')).toBe('pdf');
  });

  it('riconosce un TXT tramite estensione o MIME type', () => {
    const txt = buildTxt('Ciao, questo è un testo semplice.');
    expect(detectFormat(txt, 'appunti.txt')).toBe('txt');
    expect(detectFormat(txt, 'appunti', 'text/plain')).toBe('txt');
  });

  it('rifiuta formati non supportati con un messaggio chiaro', () => {
    const mobi = new Uint8Array(100);
    'BOOKMOBI'.split('').forEach((ch, i) => (mobi[60 + i] = ch.charCodeAt(0)));
    expect(() => detectFormat(mobi, 'libro.mobi')).toThrow(/MOBI non è ancora supportato/);
    expect(() => detectFormat(buildTxt('x'), 'libro.azw3')).toThrow(UnsupportedFormatError);
    expect(() => detectFormat(new Uint8Array([0, 1, 2, 3]), 'foto.jpg')).toThrow(UnsupportedFormatError);
  });

  it('non tratta come testo un file binario con estensione .txt', () => {
    expect(() => detectFormat(new Uint8Array([0, 0, 0, 1, 2]), 'finto.txt')).toThrow(UnsupportedFormatError);
  });

  it('valida file vuoti o PDF troncati', () => {
    expect(() => validateBookBytes(new Uint8Array(), 'txt')).toThrow(InvalidFileError);
    const truncated = buildPdf().subarray(0, 40);
    expect(() => validateBookBytes(truncated, 'pdf')).toThrow(/incompleto/);
    expect(() => validateBookBytes(buildPdf(), 'pdf')).not.toThrow();
  });
});
