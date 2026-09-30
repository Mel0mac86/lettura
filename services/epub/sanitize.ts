/**
 * Sanitises chapter markup before it is injected into the reader WebView.
 *
 * - removes scripts, styles, external stylesheets, iframes and forms: the reader
 *   applies its own typography and never executes code coming from a book;
 * - removes inline event handlers and `javascript:` URLs;
 * - expands XHTML self-closing tags (e.g. `<a id="p1"/>`) that the HTML parser
 *   would otherwise treat as open tags, swallowing the following content.
 */
const VOID_ELEMENTS =
  'area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr|image|path|rect|circle|ellipse|line|polyline|polygon|use|stop';

export function sanitizeChapterHtml(html: string): string {
  return html
    // The HTML parser normalises CRLF to LF: do the same to keep text offsets aligned.
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(new RegExp(`<((?!(?:${VOID_ELEMENTS})\\b)[a-zA-Z][\\w:-]*)(\\s[^<>]*?)?\\s*\\/>`, 'g'), '<$1$2></$1>');
}
