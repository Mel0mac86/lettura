/** Path helpers for resources inside an EPUB (zip) container. */

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index + 1);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolves `href` relative to `baseDir` ("OEBPS/text/") → normalised zip path. */
export function resolvePath(baseDir: string, href: string): string {
  const clean = safeDecode(href.split('#')[0].split('?')[0]);
  const joined = clean.startsWith('/') ? clean.slice(1) : baseDir + clean;
  const out: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export function splitFragment(href: string): { path: string; fragment?: string } {
  const index = href.indexOf('#');
  if (index === -1) return { path: href };
  return { path: href.slice(0, index), fragment: safeDecode(href.slice(index + 1)) || undefined };
}

export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}
