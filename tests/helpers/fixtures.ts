import JSZip from 'jszip';

/**
 * Programmatically generated test books (no copyrighted content is stored in
 * the repository).
 */

export interface EpubFixtureOptions {
  title?: string | null;
  author?: string | null;
  language?: string;
  chapters?: { title: string; body: string }[];
  withCover?: boolean;
  /** Adds META-INF/encryption.xml with a DRM (non font-obfuscation) algorithm. */
  drm?: boolean;
  /** Use an EPUB 2 NCX table of contents instead of an EPUB 3 nav document. */
  ncx?: boolean;
}

export const PNG_1PX = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

export async function buildEpub(options: EpubFixtureOptions = {}): Promise<Uint8Array> {
  const chapters = options.chapters ?? [
    { title: 'Capitolo 1', body: '<p>Il primo capitolo parla di abitudini.</p>' },
    { title: 'Capitolo 2', body: '<p>Piccoli cambiamenti fanno una grande differenza.</p><p>Perché è così?</p>' },
  ];
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  if (options.drm) {
    zip.file(
      'META-INF/encryption.xml',
      `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
        <enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/>
        <enc:CipherData><enc:CipherReference URI="OEBPS/ch1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>`,
    );
  }
  const manifest = chapters
    .map((_, i) => `<item id="ch${i + 1}" href="text/ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('');
  const spine = chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('');
  const meta = [
    options.title === null ? '' : `<dc:title>${options.title ?? 'Libro di prova'}</dc:title>`,
    options.author === null ? '' : `<dc:creator>${options.author ?? 'Mario Rossi'}</dc:creator>`,
    `<dc:language>${options.language ?? 'it'}</dc:language>`,
    '<dc:identifier id="uid">urn:uuid:test-book</dc:identifier>',
  ].join('');
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${meta}</metadata>
      <manifest>
        ${options.ncx ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'}
        ${options.withCover ? '<item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/>' : ''}
        ${manifest}
      </manifest>
      <spine${options.ncx ? ' toc="ncx"' : ''}>${spine}</spine>
    </package>`,
  );
  if (options.ncx) {
    const points = chapters
      .map(
        (c, i) =>
          `<navPoint id="p${i + 1}" playOrder="${i + 1}"><navLabel><text>${c.title}</text></navLabel><content src="text/ch${i + 1}.xhtml"/></navPoint>`,
      )
      .join('');
    zip.file('OEBPS/toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>${points}</navMap></ncx>`);
  } else {
    const items = chapters.map((c, i) => `<li><a href="text/ch${i + 1}.xhtml">${c.title}</a></li>`).join('');
    zip.file(
      'OEBPS/nav.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
      <body><nav epub:type="toc"><ol>${items}</ol></nav></body></html>`,
    );
  }
  if (options.withCover) zip.file('OEBPS/images/cover.png', PNG_1PX);
  chapters.forEach((c, i) => {
    zip.file(
      `OEBPS/text/ch${i + 1}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c.title}</title>
      <link rel="stylesheet" href="../style.css"/></head><body><h1>${c.title}</h1>${c.body}</body></html>`,
    );
  });
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}

/** Minimal valid single/multi-page PDF with an Info dictionary. */
export function buildPdf(options: { title?: string; author?: string; pages?: number } = {}): Uint8Array {
  const pages = options.pages ?? 3;
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i} 0 R`).join(' ');
  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages} >> endobj`,
    `3 0 obj << ${options.title ? `/Title (${options.title})` : ''} ${options.author ? `/Author (${options.author})` : ''} >> endobj`,
    ...Array.from({ length: pages }, (_, i) => `${4 + i} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj`),
  ];
  const body = `%PDF-1.4\n${objects.join('\n')}\ntrailer << /Root 1 0 R /Info 3 0 R >>\nstartxref\n0\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(body, 'latin1'));
}

export function buildTxt(text: string): Uint8Array {
  return Uint8Array.from(Buffer.from(text, 'utf8'));
}
