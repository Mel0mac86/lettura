/**
 * Text helpers: decoding, HTML→text, search normalisation and snippets.
 * All functions are pure and platform independent (no DOM, no Node APIs).
 */

const ACCENT_MAP: Record<string, string> = (() => {
  const groups: Record<string, string> = {
    a: 'àáâãäåāăą',
    c: 'çćĉċč',
    d: 'ďđ',
    e: 'èéêëēĕėęě',
    g: 'ĝğġģ',
    h: 'ĥħ',
    i: 'ìíîïĩīĭįı',
    j: 'ĵ',
    k: 'ķ',
    l: 'ĺļľŀł',
    n: 'ñńņňŉ',
    o: 'òóôõöøōŏő',
    r: 'ŕŗř',
    s: 'śŝşšſ',
    t: 'ţťŧ',
    u: 'ùúûüũūŭůűų',
    w: 'ŵ',
    y: 'ýÿŷ',
    z: 'źżž',
  };
  const map: Record<string, string> = {};
  for (const [base, chars] of Object.entries(groups)) {
    for (const ch of chars) map[ch] = base;
  }
  // Typographic punctuation folded to ASCII (1:1, length preserving).
  map['’'] = "'";
  map['‘'] = "'";
  map['“'] = '"';
  map['”'] = '"';
  map[' '] = ' ';
  return map;
})();

/**
 * Lower-cases and removes diacritics **one character at a time**, so the output
 * has exactly the same length as the input. This lets us map a match position
 * in the normalised text back to the original text.
 */
export function normalizeForSearch(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const lower = ch.toLowerCase();
    const safeLower = lower.length === 1 ? lower : ch;
    out += ACCENT_MAP[safeLower] ?? safeLower;
  }
  return out;
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '­',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  middot: '·',
  bull: '•',
  euro: '€',
  agrave: 'à',
  aacute: 'á',
  egrave: 'è',
  eacute: 'é',
  igrave: 'ì',
  iacute: 'í',
  ograve: 'ò',
  oacute: 'ó',
  ugrave: 'ù',
  uacute: 'ú',
  Agrave: 'À',
  Egrave: 'È',
  Eacute: 'É',
  Igrave: 'Ì',
  Ograve: 'Ò',
  Ugrave: 'Ù',
  ccedil: 'ç',
  ntilde: 'ñ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  szlig: 'ß',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts an HTML fragment to plain text the same way the DOM computes
 * `textContent`: tags are removed without inserting separators. This keeps
 * character offsets consistent between the search index and the reader WebView.
 */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, '');
  return decodeHtmlEntities(withoutBlocks.replace(/<[^>]*>/g, ''));
}

/** Builds a short, single-line snippet around a match. */
export function buildSnippet(text: string, start: number, length: number, radius = 60): string {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, start + length + radius);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return prefix + collapseWhitespace(text.slice(from, to)) + suffix;
}

/** Returns all start positions of `query` inside `text` (case/accents insensitive). */
export function findAllOccurrences(text: string, query: string, limit = 500): number[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return [];
  const haystack = normalizeForSearch(text);
  const result: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1 && result.length < limit) {
    result.push(index);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return result;
}

/** Derives a readable title from a file name: "il_mio_libro.epub" → "Il mio libro". */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const cleaned = collapseWhitespace(base.replace(/[_]+/g, ' ').replace(/\s+-\s+/g, ' - '));
  const text = cleaned.replace(/^[-\s]+|[-\s]+$/g, '') || 'Senza titolo';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getFileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

/**
 * Decodes bytes as UTF-8 (with BOM handling). If the bytes are not valid UTF-8
 * it falls back to Windows-1252/Latin-1, the most common legacy encoding for
 * Italian and Western European TXT files.
 */
export function decodeText(bytes: Uint8Array): string {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes, 2, true);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes, 2, false);
  const utf8 = decodeUtf8Strict(bytes, start);
  return utf8 ?? decodeWindows1252(bytes);
}

function decodeUtf16(bytes: Uint8Array, start: number, littleEndian: boolean): string {
  const parts: string[] = [];
  let chunk: number[] = [];
  for (let i = start; i + 1 < bytes.length; i += 2) {
    chunk.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
    if (chunk.length === 8192) {
      parts.push(String.fromCharCode(...chunk));
      chunk = [];
    }
  }
  parts.push(String.fromCharCode(...chunk));
  return parts.join('');
}

/** Strict UTF-8 decoder; returns null when the input is not valid UTF-8. */
export function decodeUtf8Strict(bytes: Uint8Array, start = 0): string | null {
  const parts: string[] = [];
  let codes: number[] = [];
  const flush = () => {
    parts.push(String.fromCharCode(...codes));
    codes = [];
  };
  let i = start;
  while (i < bytes.length) {
    const b0 = bytes[i];
    let cp: number;
    let needed: number;
    if (b0 < 0x80) {
      cp = b0;
      needed = 0;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      cp = b0 & 0x1f;
      needed = 1;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      cp = b0 & 0x0f;
      needed = 2;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      cp = b0 & 0x07;
      needed = 3;
    } else {
      return null;
    }
    if (i + needed >= bytes.length && needed > 0) return null;
    for (let k = 1; k <= needed; k++) {
      const b = bytes[i + k];
      if ((b & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (b & 0x3f);
    }
    i += needed + 1;
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      codes.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      codes.push(cp);
    }
    if (codes.length >= 8192) flush();
  }
  flush();
  return parts.join('');
}

const CP1252_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

export function decodeWindows1252(bytes: Uint8Array): string {
  const parts: string[] = [];
  let codes: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    codes.push(CP1252_HIGH[b] ?? b);
    if (codes.length >= 8192) {
      parts.push(String.fromCharCode(...codes));
      codes = [];
    }
  }
  parts.push(String.fromCharCode(...codes));
  return parts.join('');
}

/** Latin-1 view of (a slice of) binary data; used to scan PDF structures. */
export function bytesToLatin1(bytes: Uint8Array, start = 0, end = bytes.length): string {
  const parts: string[] = [];
  const step = 8192;
  for (let i = start; i < end; i += step) {
    parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(end, i + step))));
  }
  return parts.join('');
}
