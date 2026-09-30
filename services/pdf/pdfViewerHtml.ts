import { BRIDGE_SCRIPT } from '@/services/reader/bridge';

import { PDFJS_SOURCE, PDFJS_WORKER_SOURCE } from './generated/pdfjsSource';

/** RN → WebView commands of the PDF viewer. */
export type PdfCommand =
  | { type: 'chunk'; data: string }
  | { type: 'open'; page: number; zoom: number; style: PdfStyle }
  | { type: 'style'; style: PdfStyle }
  | { type: 'goto'; page: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'zoom'; zoom: number }
  | { type: 'search'; query: string }
  | { type: 'extractText' }
  | { type: 'thumbnail' };

/** WebView → RN events of the PDF viewer. */
export type PdfEvent =
  | { type: 'ready' }
  | { type: 'opened'; numPages: number; title: string | null; author: string | null }
  | { type: 'page'; page: number; numPages: number }
  | { type: 'pageTurn' }
  | { type: 'tap' }
  | { type: 'searchResults'; query: string; results: { page: number; snippet: string }[]; done: boolean }
  | { type: 'text'; pages: { page: number; text: string }[]; done: boolean }
  | { type: 'thumbnail'; dataUrl: string }
  | { type: 'error'; message: string; code?: 'password' | 'invalid' };

export interface PdfStyle {
  background: string;
  pageFilter: string;
  insetTop: number;
  insetBottom: number;
}

const escapeScript = (source: string) => source.replace(/<\/script/gi, '<\\/script');

const PDF_CSS = `
html, body { margin:0; padding:0; height:100%; background:var(--bg,#525659); -webkit-tap-highlight-color:transparent; }
#pages { position:fixed; inset:0; overflow:auto; -webkit-overflow-scrolling:touch; padding:var(--top,48px) 0 var(--bottom,48px); box-sizing:border-box; }
.page { position:relative; margin:0 auto 12px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.35); }
.page canvas { display:block; width:100%; height:100%; filter:var(--page-filter,none); }
.page .num { position:absolute; bottom:-18px; right:0; font:11px -apple-system,sans-serif; color:#999; }
#status { position:fixed; top:45%; left:0; right:0; text-align:center; font:15px -apple-system,sans-serif; color:#aaa; }
`;

const PDF_SCRIPT = `
(function () {
  var pdfjsLib = window.pdfjsLib;
  var container = document.getElementById('pages');
  var statusEl = document.getElementById('status');
  var doc = null, pages = [], baseWidths = [], zoom = 1, current = 1, chunks = [], textCache = {};
  var rendering = {}, observer = null, searchToken = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 3);

  // pdf.js runs in a dedicated Web Worker created from the inlined source (no
  // network). If workers are unavailable it falls back to the main thread.
  var pdfWorker = null;
  function mainThreadFallback() {
    if (!window.pdfjsWorker) (0, eval)(PDFJS_WORKER_SOURCE);
    pdfWorker = null;
  }
  try {
    if (typeof Worker === 'undefined') throw new Error('no worker');
    var workerUrl = URL.createObjectURL(new Blob([PDFJS_WORKER_SOURCE], { type: 'application/javascript' }));
    pdfWorker = new pdfjsLib.PDFWorker({ port: new Worker(workerUrl) });
  } catch (e) {
    mainThreadFallback();
  }

  function fitWidth() { return Math.min(window.innerWidth - 16, 1100); }

  function layoutPages() {
    var width = fitWidth() * zoom;
    for (var i = 0; i < pages.length; i++) {
      var ratio = baseWidths[i].h / baseWidths[i].w;
      pages[i].style.width = width + 'px';
      pages[i].style.height = Math.round(width * ratio) + 'px';
      pages[i].dataset.rendered = '';
    }
  }

  function renderPage(index) {
    var el = pages[index];
    if (!el || el.dataset.rendered === String(zoom) || rendering[index]) return;
    rendering[index] = true;
    doc.getPage(index + 1).then(function (page) {
      var cssWidth = fitWidth() * zoom;
      var viewport = page.getViewport({ scale: (cssWidth / page.getViewport({ scale: 1 }).width) * DPR });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
        var old = el.querySelector('canvas');
        if (old) el.removeChild(old);
        el.insertBefore(canvas, el.firstChild);
        el.dataset.rendered = String(zoom);
      });
    }).catch(function (e) { mbrPost({ type: 'error', message: String(e && e.message || e) }); })
      .then(function () { rendering[index] = false; });
  }

  function releaseFarPages(center) {
    for (var i = 0; i < pages.length; i++) {
      if (Math.abs(i - center) > 4 && pages[i].dataset.rendered) {
        var canvas = pages[i].querySelector('canvas');
        if (canvas) { canvas.width = 0; canvas.height = 0; pages[i].removeChild(canvas); }
        pages[i].dataset.rendered = '';
      }
    }
  }

  function visiblePage() {
    var mid = container.scrollTop + container.clientHeight / 2;
    for (var i = 0; i < pages.length; i++) {
      var top = pages[i].offsetTop, bottom = top + pages[i].offsetHeight + 12;
      if (mid >= top && mid < bottom) return i + 1;
    }
    return current;
  }

  function onScroll() {
    var page = visiblePage();
    for (var i = Math.max(0, page - 2); i < Math.min(pages.length, page + 2); i++) renderPage(i);
    if (page !== current) {
      current = page;
      releaseFarPages(page - 1);
      mbrPost({ type: 'page', page: page, numPages: pages.length });
      mbrPost({ type: 'pageTurn' });
    }
  }

  function goTo(page, smooth) {
    page = Math.max(1, Math.min(pages.length, page));
    var el = pages[page - 1];
    if (!el) return;
    container.scrollTo({ top: el.offsetTop - parseInt(getComputedStyle(container).paddingTop, 10) + 4, behavior: smooth ? 'smooth' : 'auto' });
    current = page;
    renderPage(page - 1);
    mbrPost({ type: 'page', page: page, numPages: pages.length });
  }

  function setZoom(value) {
    var page = current;
    zoom = Math.max(0.5, Math.min(4, value));
    layoutPages();
    goTo(page);
    onScroll();
  }

  function applyStyle(style) {
    var root = document.documentElement.style;
    root.setProperty('--bg', style.background);
    root.setProperty('--page-filter', style.pageFilter || 'none');
    root.setProperty('--top', style.insetTop + 'px');
    root.setProperty('--bottom', style.insetBottom + 'px');
  }

  function readMeta(info) {
    var i = (info && info.info) || {};
    return { title: i.Title ? String(i.Title).trim() || null : null, author: i.Author ? String(i.Author).trim() || null : null };
  }

  /** Loads with the Web Worker; on failure retries once on the main thread. */
  function loadPdf(bytes) {
    if (!pdfWorker) return pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
    // The worker takes ownership of the buffer: keep the original for the fallback.
    return pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false, worker: pdfWorker }).promise
      .catch(function (e) {
        if (e && e.name === 'PasswordException') throw e;
        mainThreadFallback();
        return pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      });
  }

  function open(cmd) {
    applyStyle(cmd.style);
    zoom = cmd.zoom || 1;
    var binary = atob(chunks.join(''));
    chunks = [];
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    statusEl.textContent = 'Apertura del PDF…';
    loadPdf(bytes).then(function (pdf) {
      doc = pdf;
      var sizes = [];
      for (var p = 1; p <= pdf.numPages; p++) sizes.push(pdf.getPage(p));
      return Promise.all(sizes).then(function (list) {
        baseWidths = list.map(function (page) { var v = page.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; });
        pages = list.map(function (_, idx) {
          var el = document.createElement('div');
          el.className = 'page';
          var num = document.createElement('span'); num.className = 'num'; num.textContent = String(idx + 1);
          el.appendChild(num);
          container.appendChild(el);
          return el;
        });
        layoutPages();
        statusEl.textContent = '';
        return pdf.getMetadata().catch(function () { return null; });
      });
    }).then(function (meta) {
      if (!doc) return;
      var m = readMeta(meta);
      mbrPost({ type: 'opened', numPages: doc.numPages, title: m.title, author: m.author });
      goTo(cmd.page || 1);
      onScroll();
    }).catch(function (e) {
      statusEl.textContent = '';
      var isPassword = e && e.name === 'PasswordException';
      mbrPost({ type: 'error', code: isPassword ? 'password' : 'invalid', message: String(e && e.message || e) });
    });
  }

  function pageText(pageNumber) {
    if (textCache[pageNumber] !== undefined) return Promise.resolve(textCache[pageNumber]);
    return doc.getPage(pageNumber).then(function (page) { return page.getTextContent(); }).then(function (tc) {
      var text = tc.items.map(function (item) { return item.str + (item.hasEOL ? '\\n' : ' '); }).join('');
      text = text.replace(/[ \\t]+/g, ' ').trim();
      textCache[pageNumber] = text;
      return text;
    });
  }

  function normalize(s) { return s.normalize ? s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase() : s.toLowerCase(); }

  function search(query) {
    var token = ++searchToken;
    var needle = normalize(query.trim());
    var results = [];
    function step(p) {
      if (token !== searchToken) return;
      if (!needle || p > doc.numPages || results.length >= 300) {
        mbrPost({ type: 'searchResults', query: query, results: results, done: true });
        return;
      }
      pageText(p).then(function (text) {
        var hay = normalize(text), idx = hay.indexOf(needle);
        while (idx !== -1 && results.length < 300) {
          var from = Math.max(0, idx - 50), to = Math.min(text.length, idx + needle.length + 50);
          results.push({ page: p, snippet: (from > 0 ? '…' : '') + text.slice(from, to).replace(/\\s+/g, ' ') + (to < text.length ? '…' : '') });
          idx = hay.indexOf(needle, idx + needle.length);
        }
        if (p % 20 === 0) mbrPost({ type: 'searchResults', query: query, results: results.slice(), done: false });
        step(p + 1);
      }).catch(function () { step(p + 1); });
    }
    step(1);
  }

  function extractText() {
    var batch = [];
    function step(p) {
      if (p > doc.numPages) { mbrPost({ type: 'text', pages: batch, done: true }); return; }
      pageText(p).then(function (text) {
        batch.push({ page: p, text: text });
        if (batch.length >= 25) { mbrPost({ type: 'text', pages: batch, done: false }); batch = []; }
        setTimeout(function () { step(p + 1); }, 0);
      }).catch(function () { step(p + 1); });
    }
    step(1);
  }

  function thumbnail() {
    doc.getPage(1).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: 360 / base.width });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        mbrPost({ type: 'thumbnail', dataUrl: canvas.toDataURL('image/jpeg', 0.8) });
      });
    }).catch(function () {});
  }

  var scrollTimer = null;
  container.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(onScroll, 80);
  }, { passive: true });
  container.addEventListener('click', function () { mbrPost({ type: 'tap' }); });
  window.addEventListener('resize', function () { if (doc) { var p = current; layoutPages(); goTo(p); onScroll(); } });

  window.__mbrReceive = function (cmd) {
    try {
      switch (cmd.type) {
        case 'chunk': chunks.push(cmd.data); break;
        case 'open': open(cmd); break;
        case 'style': applyStyle(cmd.style); break;
        case 'goto': if (doc) goTo(cmd.page); break;
        case 'next': if (doc && current < pages.length) { goTo(current + 1, true); mbrPost({ type: 'pageTurn' }); } break;
        case 'prev': if (doc && current > 1) { goTo(current - 1, true); mbrPost({ type: 'pageTurn' }); } break;
        case 'zoom': if (doc) setZoom(cmd.zoom); break;
        case 'search': if (doc) search(cmd.query); break;
        case 'extractText': if (doc) extractText(); break;
        case 'thumbnail': if (doc) thumbnail(); break;
      }
    } catch (e) {
      mbrPost({ type: 'error', message: String(e && e.message || e) });
    }
  };
  mbrPost({ type: 'ready' });
})();
`;

let cachedHtml: string | null = null;

/**
 * Self-contained HTML page embedding pdf.js (no network access needed).
 * The document bytes are streamed in base64 chunks through the bridge.
 */
export function buildPdfViewerHtml(): string {
  if (cachedHtml) return cachedHtml;
  cachedHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
<style>${PDF_CSS}</style>
</head>
<body>
<div id="pages"></div>
<div id="status"></div>
<script>${escapeScript(PDFJS_SOURCE)}</script>
<script>var PDFJS_WORKER_SOURCE = ${escapeScript(JSON.stringify(PDFJS_WORKER_SOURCE))};</script>
<script>${BRIDGE_SCRIPT}${PDF_SCRIPT}</script>
</body></html>`;
  return cachedHtml;
}
