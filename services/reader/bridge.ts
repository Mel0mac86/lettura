/**
 * Message protocol between React Native and the reader WebViews.
 * RN → WebView: commands (`window.__mbrReceive(command)`).
 * WebView → RN: events (`ReactNativeWebView.postMessage(JSON)`).
 */

export interface ReaderStyle {
  background: string;
  text: string;
  secondaryText: string;
  accent: string;
  selection: string;
  isDark: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: number;
  maxTextWidth: number;
  justify: boolean;
  /** Space reserved above/below the text for the reader chrome (px). */
  insetTop: number;
  insetBottom: number;
}

export interface HighlightMark {
  id: string;
  start: number;
  end: number;
  color: string;
}

export type ChapterTarget =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'progress'; value: number }
  | { kind: 'offset'; value: number; flashLength?: number }
  | { kind: 'anchor'; id: string };

export type ReflowCommand =
  | { type: 'style'; style: ReaderStyle }
  | { type: 'load'; chapter: number; html: string; highlights: HighlightMark[]; target: ChapterTarget; lang?: string }
  | { type: 'goto'; target: ChapterTarget }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'addHighlight'; mark: HighlightMark }
  | { type: 'removeHighlight'; id: string }
  | { type: 'updateHighlight'; mark: HighlightMark }
  | { type: 'clearSelection' };

export type ReflowEvent =
  | { type: 'ready' }
  | {
      type: 'location';
      chapter: number;
      page: number;
      pageCount: number;
      startOffset: number | null;
      endOffset: number | null;
      snippet: string;
    }
  | { type: 'selection'; chapter: number; start: number; end: number; text: string }
  | { type: 'selectionCleared' }
  | { type: 'tap' }
  | { type: 'pageTurn' }
  | { type: 'boundary'; direction: 'next' | 'prev' }
  | { type: 'link'; href: string }
  | { type: 'externalLink'; href: string }
  | { type: 'highlightTap'; id: string }
  | { type: 'error'; message: string };

/** Parses a message coming from a WebView; returns null for malformed data. */
export function parseBridgeMessage<T extends { type: string }>(raw: string): T | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string') {
      return value as T;
    }
  } catch {
    // ignore malformed messages
  }
  return null;
}

/** JS snippet shared by all reader pages to talk to React Native (native WebView or web iframe). */
export const BRIDGE_SCRIPT = `
function mbrPost(msg) {
  var data = JSON.stringify(msg);
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(data);
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage({ __mbr: true, data: data }, '*');
  }
}
window.addEventListener('error', function (e) { mbrPost({ type: 'error', message: String(e.message || e) }); });
`;
