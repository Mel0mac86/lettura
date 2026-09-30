import { bytesToLatin1, collapseWhitespace } from '@/utils/text';

export interface PdfBasicMetadata {
  title: string | null;
  author: string | null;
  pageCount: number | null;
  isEncrypted: boolean;
}

/** Max bytes scanned at each end of the file (Info dictionary / page tree are usually there). */
const SCAN_WINDOW = 2 * 1024 * 1024;

/**
 * Best-effort extraction of PDF metadata without a full PDF engine (pdf.js
 * cannot run in the React Native JS runtime). Handles the Info dictionary and
 * the uncompressed page tree; values missing here are filled in by the reader
 * (pdf.js in the WebView) the first time the book is opened.
 */
export function extractPdfMetadata(bytes: Uint8Array): PdfBasicMetadata {
  const head = bytesToLatin1(bytes, 0, Math.min(bytes.length, SCAN_WINDOW));
  const tail =
    bytes.length > SCAN_WINDOW ? bytesToLatin1(bytes, Math.max(SCAN_WINDOW, bytes.length - SCAN_WINDOW)) : '';
  const source = head + '\n' + tail;

  return {
    title: readInfoString(source, 'Title'),
    author: readInfoString(source, 'Author'),
    pageCount: readPageCount(source),
    isEncrypted: /\/Encrypt\s+\d+\s+\d+\s+R/.test(source) || /\/Encrypt\s*<</.test(source),
  };
}

function readPageCount(source: string): number | null {
  let max = 0;
  const pagesDict = /\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)|\/Count\s+(\d+)[\s\S]{0,400}?\/Type\s*\/Pages\b/g;
  for (const match of source.matchAll(pagesDict)) {
    const value = parseInt(match[1] ?? match[2], 10);
    if (Number.isFinite(value) && value > max && value < 100_000) max = value;
  }
  return max > 0 ? max : null;
}

function readInfoString(source: string, key: string): string | null {
  const literal = new RegExp(`/${key}\\s*\\(`, 'g');
  const literalMatch = literal.exec(source);
  if (literalMatch) {
    const value = decodePdfString(readLiteral(source, literalMatch.index + literalMatch[0].length));
    const cleaned = collapseWhitespace(value.replace(/\0/g, ''));
    if (cleaned) return cleaned;
  }
  const hex = new RegExp(`/${key}\\s*<([0-9A-Fa-f\\s]+)>`).exec(source);
  if (hex) {
    const cleaned = collapseWhitespace(decodePdfString(hexToBinary(hex[1])).replace(/\0/g, ''));
    if (cleaned) return cleaned;
  }
  return null;
}

/** Reads a PDF literal string starting after "(" handling nesting and escapes. */
function readLiteral(source: string, start: number): string {
  let depth = 1;
  let out = '';
  for (let i = start; i < source.length && i < start + 4096; i++) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (next in escapes) {
        out += escapes[next];
        i++;
      } else if (/[0-7]/.test(next)) {
        const octal = /^[0-7]{1,3}/.exec(source.slice(i + 1, i + 4))![0];
        out += String.fromCharCode(parseInt(octal, 8));
        i += octal.length;
      } else if (next === '\n' || next === '\r') {
        i++;
      }
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) break;
    }
    out += ch;
  }
  return out;
}

function hexToBinary(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.substr(i, 2).padEnd(2, '0'), 16));
  return out;
}

/** PDF text strings are PDFDocEncoding (~Latin-1) or UTF-16BE with a BOM. */
function decodePdfString(binary: string): string {
  if (binary.charCodeAt(0) === 0xfe && binary.charCodeAt(1) === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < binary.length; i += 2) out += String.fromCharCode((binary.charCodeAt(i) << 8) | binary.charCodeAt(i + 1));
    return out;
  }
  return binary;
}
