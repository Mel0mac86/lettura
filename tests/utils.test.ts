import { runMigrations } from '@/database/migrate';
import { extractPdfMetadata } from '@/services/pdf/pdfMetadata';
import { base64ToBytes, dataUrlToBytes } from '@/utils/base64';
import { buildSnippet, decodeHtmlEntities, findAllOccurrences, normalizeForSearch, titleFromFileName } from '@/utils/text';

import { buildPdf } from './helpers/fixtures';
import { createTestDatabase } from './helpers/sqlJsDatabase';

describe('utility', () => {
  it('normalizza per la ricerca mantenendo la lunghezza', () => {
    const input = 'Perché È Così’';
    expect(normalizeForSearch(input)).toBe("perche e cosi'");
    expect(normalizeForSearch(input)).toHaveLength(input.length);
    expect(findAllOccurrences('Città e citta', 'CITTÀ')).toEqual([0, 8]);
  });

  it('decodifica entità HTML e costruisce snippet', () => {
    expect(decodeHtmlEntities('a &amp; b &eacute; &#8364; &#x41;')).toBe('a & b é € A');
    expect(buildSnippet('x'.repeat(100) + 'parola' + 'y'.repeat(100), 100, 6, 5)).toBe('…xxxxxparolayyyyy…');
    expect(titleFromFileName('/path/Autore - Il_libro.pdf')).toBe('Autore - Il libro');
  });

  it('decodifica base64 e data URL', () => {
    expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(dataUrlToBytes('data:image/jpeg;base64,/9j/'))).toEqual([0xff, 0xd8, 0xff]);
  });

  it('legge i metadati PDF da stringhe esadecimali UTF-16', () => {
    const pdf = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj << /Type /Pages /Count 42 >> endobj\n2 0 obj << /Title <FEFF00430069> /Author (A \\(B\\)) >> endobj\n%%EOF',
    );
    expect(extractPdfMetadata(pdf)).toEqual({ title: 'Ci', author: 'A (B)', pageCount: 42, isEncrypted: false });
    expect(extractPdfMetadata(buildPdf({ pages: 2 })).pageCount).toBe(2);
  });

  it('le migrazioni sono idempotenti', async () => {
    const db = await createTestDatabase();
    expect(await runMigrations(db)).toBe(1);
    expect((await db.getAll('SELECT * FROM categories')).length).toBe(5);
  });
});
