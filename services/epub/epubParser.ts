import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import type { ChapterInfo, ReflowableDocument } from '@/services/reader/ReflowableDocument';
import type { TocItem } from '@/types/models';
import { DrmProtectedError, InvalidFileError } from '@/utils/errors';
import { collapseWhitespace, htmlToText } from '@/utils/text';

import { dirname, isExternalHref, resolvePath, splitFragment } from './paths';
import { sanitizeChapterHtml } from './sanitize';

type XmlNode = Record<string, unknown>;

export interface EpubManifestItem {
  id: string;
  /** Full path inside the zip. */
  path: string;
  mediaType: string;
  properties: string[];
}

export interface EpubMetadata {
  title: string | null;
  authors: string[];
  language: string | null;
  description: string | null;
  publisher: string | null;
  identifier: string | null;
}

export interface EpubCover {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
}

/** Encryption algorithms used only for font obfuscation (not DRM). */
const FONT_OBFUSCATION_ALGORITHMS = new Set([
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

function parseXml(source: string): XmlNode {
  try {
    return xmlParser.parse(source) as XmlNode;
  } catch (error) {
    throw new InvalidFileError(`EPUB non valido: XML malformato (${(error as Error).message}).`);
  }
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Concatenates every text node below `node` (attributes excluded). */
function textOf(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node === 'object') {
    return Object.entries(node as XmlNode)
      .filter(([key]) => !key.startsWith('@_'))
      .map(([, value]) => textOf(value))
      .join(' ');
  }
  return '';
}

function cleanText(node: unknown): string | null {
  const text = collapseWhitespace(textOf(node));
  return text || null;
}

function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const value = (node as XmlNode)[`@_${name}`];
  return value === undefined || value === null ? undefined : String(value);
}

/** Depth-first search of all nodes stored under `key`. */
function findAll(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, key, out));
    return out;
  }
  for (const [k, value] of Object.entries(node as XmlNode)) {
    if (k === key) out.push(...toArray(value));
    else if (!k.startsWith('@_')) findAll(value, key, out);
  }
  return out;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * EPUB 2/3 document backed by JSZip. Everything happens in memory and in
 * JavaScript, so it works in Expo Go, on web and in Node (tests).
 */
export class EpubDocument implements ReflowableDocument {
  readonly chapters: ChapterInfo[] = [];
  readonly toc: TocItem[] = [];
  metadata: EpubMetadata = {
    title: null,
    authors: [],
    language: null,
    description: null,
    publisher: null,
    identifier: null,
  };

  private manifest = new Map<string, EpubManifestItem>();
  private spine: EpubManifestItem[] = [];
  private spineIndexByPath = new Map<string, number>();
  private coverPath: string | null = null;
  private textCache = new Map<number, string>();

  private constructor(private readonly zip: JSZip) {}

  /** Opens and validates an EPUB. Throws {@link DrmProtectedError} for protected books. */
  static async open(data: Uint8Array | ArrayBuffer): Promise<EpubDocument> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      throw new InvalidFileError('Il file EPUB è danneggiato o non è un archivio valido.');
    }
    const doc = new EpubDocument(zip);
    await doc.checkDrm();
    await doc.load();
    return doc;
  }

  get spineLength(): number {
    return this.spine.length;
  }

  private async readText(path: string): Promise<string | null> {
    const file = this.zip.file(path);
    return file ? file.async('string') : null;
  }

  private async checkDrm(): Promise<void> {
    // Apple FairPlay.
    if (this.zip.file('META-INF/sinf.xml')) throw new DrmProtectedError();
    const encryption = await this.readText('META-INF/encryption.xml');
    if (!encryption) return;
    const methods = findAll(parseXml(encryption), 'EncryptionMethod');
    const isDrm = methods.some((method) => {
      const algorithm = attr(method, 'Algorithm') ?? '';
      return !FONT_OBFUSCATION_ALGORITHMS.has(algorithm);
    });
    if (isDrm) throw new DrmProtectedError();
  }

  private async load(): Promise<void> {
    const container = await this.readText('META-INF/container.xml');
    if (!container) throw new InvalidFileError('EPUB non valido: manca META-INF/container.xml.');
    const rootfile = findAll(parseXml(container), 'rootfile')
      .map((node) => attr(node, 'full-path'))
      .find((path): path is string => !!path);
    if (!rootfile) throw new InvalidFileError('EPUB non valido: nessun file OPF indicato.');

    const opfSource = await this.readText(rootfile);
    if (!opfSource) throw new InvalidFileError(`EPUB non valido: file OPF mancante (${rootfile}).`);
    const opf = parseXml(opfSource);
    const pkg = (opf.package ?? {}) as XmlNode;
    const opfDir = dirname(rootfile);

    this.readMetadata((pkg.metadata ?? {}) as XmlNode);

    for (const item of toArray(((pkg.manifest ?? {}) as XmlNode).item)) {
      const id = attr(item, 'id');
      const href = attr(item, 'href');
      if (!id || !href) continue;
      this.manifest.set(id, {
        id,
        path: resolvePath(opfDir, href),
        mediaType: attr(item, 'media-type') ?? '',
        properties: (attr(item, 'properties') ?? '').split(/\s+/).filter(Boolean),
      });
    }

    const spineNode = (pkg.spine ?? {}) as XmlNode;
    for (const ref of toArray(spineNode.itemref)) {
      const item = this.manifest.get(attr(ref, 'idref') ?? '');
      if (!item || !/x?html|xml/i.test(item.mediaType)) continue;
      if (!this.zip.file(item.path)) continue;
      this.spineIndexByPath.set(item.path, this.spine.length);
      this.spine.push(item);
    }
    if (this.spine.length === 0) throw new InvalidFileError('EPUB non valido: nessun capitolo leggibile.');

    this.coverPath = this.findCoverPath((pkg.metadata ?? {}) as XmlNode);
    await this.loadToc(attr(spineNode, 'toc'));
    await this.buildChapters();
  }

  private readMetadata(metadata: XmlNode): void {
    const first = (key: string) => cleanText(toArray(metadata[key])[0]);
    this.metadata = {
      title: first('title'),
      authors: toArray(metadata.creator)
        .map(cleanText)
        .filter((a): a is string => !!a),
      language: first('language'),
      description: (() => {
        const raw = first('description');
        return raw ? collapseWhitespace(htmlToText(raw)) || null : null;
      })(),
      publisher: first('publisher'),
      identifier: first('identifier'),
    };
  }

  private findCoverPath(metadata: XmlNode): string | null {
    const items = Array.from(this.manifest.values());
    const isImage = (item: EpubManifestItem) => item.mediaType.startsWith('image/');
    const byProperty = items.find((item) => item.properties.includes('cover-image'));
    if (byProperty) return byProperty.path;
    const coverMeta = toArray(metadata.meta).find((m) => attr(m, 'name') === 'cover');
    const metaId = coverMeta ? attr(coverMeta, 'content') : undefined;
    const byMeta = metaId ? this.manifest.get(metaId) : undefined;
    if (byMeta && isImage(byMeta)) return byMeta.path;
    const byName = items.find((item) => isImage(item) && /cover/i.test(item.id + item.path));
    return byName?.path ?? null;
  }

  private async loadToc(ncxId: string | undefined): Promise<void> {
    const navItem = Array.from(this.manifest.values()).find((item) => item.properties.includes('nav'));
    if (navItem) {
      const source = await this.readText(navItem.path);
      if (source) {
        try {
          this.parseNav(parseXml(source), dirname(navItem.path));
        } catch {
          // A broken nav document must not prevent reading: fall back to NCX.
        }
      }
    }
    if (this.toc.length > 0) return;
    const ncxItem =
      (ncxId ? this.manifest.get(ncxId) : undefined) ??
      Array.from(this.manifest.values()).find((item) => item.mediaType === 'application/x-dtbncx+xml');
    if (!ncxItem) return;
    const source = await this.readText(ncxItem.path);
    if (!source) return;
    const ncx = parseXml(source);
    const navMap = findAll(ncx, 'navMap')[0];
    this.parseNavPoints(toArray((navMap as XmlNode | undefined)?.navPoint), dirname(ncxItem.path), 0);
  }

  private addTocEntry(title: string | null, href: string | undefined, baseDir: string, depth: number): void {
    if (!title || !href) return;
    const { fragment } = splitFragment(href);
    const chapterIndex = this.spineIndexByPath.get(resolvePath(baseDir, href));
    if (chapterIndex === undefined) return;
    this.toc.push({ title, chapterIndex, depth, ...(fragment ? { anchor: fragment } : {}) });
  }

  private parseNavPoints(points: unknown[], baseDir: string, depth: number): void {
    for (const point of points) {
      const node = point as XmlNode;
      this.addTocEntry(cleanText((node.navLabel as XmlNode | undefined)?.text), attr(node.content, 'src'), baseDir, depth);
      this.parseNavPoints(toArray(node.navPoint), baseDir, depth + 1);
    }
  }

  private parseNav(doc: XmlNode, baseDir: string): void {
    const navs = findAll(doc, 'nav') as XmlNode[];
    const tocNav = navs.find((nav) => (attr(nav, 'type') ?? '').split(/\s+/).includes('toc')) ?? navs[0];
    if (!tocNav) return;
    const walkList = (list: unknown, depth: number) => {
      for (const li of toArray((list as XmlNode | undefined)?.li)) {
        const node = li as XmlNode;
        const anchor = toArray(node.a)[0];
        const label = anchor ?? toArray(node.span)[0];
        this.addTocEntry(cleanText(label), attr(anchor, 'href'), baseDir, depth);
        for (const sub of toArray(node.ol)) walkList(sub, depth + 1);
      }
    };
    for (const list of findAll(tocNav, 'ol').slice(0, 1)) walkList(list, 0);
  }

  private async buildChapters(): Promise<void> {
    for (let index = 0; index < this.spine.length; index++) {
      const text = await this.getChapterText(index);
      const tocTitle = this.toc.find((entry) => entry.chapterIndex === index && !entry.anchor)?.title ??
        this.toc.find((entry) => entry.chapterIndex === index)?.title;
      this.chapters.push({
        index,
        title: tocTitle ?? (await this.guessChapterTitle(index)) ?? `Capitolo ${index + 1}`,
        textLength: text.length,
      });
    }
  }

  private async guessChapterTitle(index: number): Promise<string | null> {
    const source = (await this.readText(this.spine[index].path)) ?? '';
    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(source)?.[1];
    const title = heading ? collapseWhitespace(htmlToText(heading)) : '';
    return title ? title.slice(0, 120) : null;
  }

  private async getRawBody(index: number): Promise<string> {
    const item = this.spine[index];
    if (!item) throw new InvalidFileError(`Capitolo ${index + 1} inesistente.`);
    const source = (await this.readText(item.path)) ?? '';
    const body = /<body[^>]*>([\s\S]*)<\/body\s*>/i.exec(source)?.[1] ?? source;
    return sanitizeChapterHtml(body);
  }

  async getChapterText(index: number): Promise<string> {
    const cached = this.textCache.get(index);
    if (cached !== undefined) return cached;
    const text = htmlToText(await this.getRawBody(index));
    this.textCache.set(index, text);
    return text;
  }

  async getChapterHtml(index: number): Promise<string> {
    const item = this.spine[index];
    const baseDir = dirname(item.path);
    let html = await this.getRawBody(index);
    html = await this.inlineImages(html, baseDir);
    return this.rewriteLinks(html);
  }

  resolveHref(fromChapter: number, href: string): { chapter: number; anchor?: string } | null {
    if (isExternalHref(href)) return null;
    const { path, fragment } = splitFragment(href);
    if (!path) return { chapter: fromChapter, ...(fragment ? { anchor: fragment } : {}) };
    const from = this.spine[fromChapter];
    const target = this.spineIndexByPath.get(resolvePath(from ? dirname(from.path) : '', path));
    if (target === undefined) return null;
    return { chapter: target, ...(fragment ? { anchor: fragment } : {}) };
  }

  /** Replaces image references with base64 data URIs so the WebView needs no file access. */
  private async inlineImages(html: string, baseDir: string): Promise<string> {
    const pattern = /(<(?:img|image)\b[^>]*?\s(?:src|xlink:href|href)\s*=\s*)(["'])([^"']*)\2/gi;
    const refs = new Set<string>();
    for (const match of html.matchAll(pattern)) {
      if (!isExternalHref(match[3])) refs.add(match[3]);
    }
    const dataUris = new Map<string, string>();
    for (const ref of refs) {
      const path = resolvePath(baseDir, ref);
      const file = this.zip.file(path);
      if (!file) continue;
      const item = Array.from(this.manifest.values()).find((m) => m.path === path);
      const mime = item?.mediaType || guessImageMime(path);
      dataUris.set(ref, `data:${mime};base64,${await file.async('base64')}`);
    }
    return html.replace(pattern, (full, prefix: string, quote: string, ref: string) => {
      const uri = dataUris.get(ref);
      return uri ? `${prefix}${quote}${uri}${quote}` : full;
    });
  }

  /** Internal links become `data-epub-href` so the reader can intercept them. */
  private rewriteLinks(html: string): string {
    return html.replace(/<a\b([^>]*?)\shref\s*=\s*(["'])([^"']*)\2/gi, (_full, before: string, quote: string, href: string) => {
      const marker = isExternalHref(href) ? 'data-external-href' : 'data-epub-href';
      return `<a${before} ${marker}=${quote}${href}${quote} href=${quote}#${quote}`;
    });
  }

  async getCover(): Promise<EpubCover | null> {
    if (!this.coverPath) return null;
    const file = this.zip.file(this.coverPath);
    if (!file) return null;
    const item = Array.from(this.manifest.values()).find((m) => m.path === this.coverPath);
    const mimeType = item?.mediaType || guessImageMime(this.coverPath);
    const extension = IMAGE_EXTENSIONS[mimeType];
    if (!extension || extension === 'svg') return null;
    return { bytes: await file.async('uint8array'), mimeType, extension };
  }
}

function guessImageMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
