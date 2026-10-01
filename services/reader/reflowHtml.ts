import { BRIDGE_SCRIPT } from './bridge';

/**
 * HTML page used by the EPUB/TXT reader inside a WebView.
 *
 * Pagination uses CSS multi-column layout: the chapter is laid out in columns
 * as wide as the screen and the reader translates the content horizontally.
 * Positions are expressed as character offsets in the chapter `textContent`,
 * which makes bookmarks, highlights and search results independent from font
 * size, margins and screen size.
 */
const READER_CSS = `
:root { --bg:#fff; --fg:#111; --muted:#777; --accent:#2F5D8A; --selection:rgba(47,93,138,.25);
  --font:Georgia,serif; --align:start; --size:19px; --lh:1.55; --top:48px; --bottom:40px; --img-max-h:600px; }
html, body { margin:0; padding:0; height:100%; overflow:hidden; background:var(--bg); color:var(--fg);
  -webkit-text-size-adjust:100%; -webkit-tap-highlight-color:transparent; }
#viewport { position:fixed; left:0; right:0; top:var(--top); bottom:var(--bottom); overflow:hidden; }
#content { box-sizing:border-box; height:100%; column-fill:auto; font-family:var(--font); font-size:var(--size);
  line-height:var(--lh); overflow-wrap:break-word; text-align:var(--align);
  transform:translateX(0); will-change:transform; }
#content * { color:inherit !important; background-color:transparent !important; font-family:inherit !important;
  max-width:100%; box-sizing:border-box; }
#content a { color:var(--accent) !important; text-decoration:none; }
#content p { margin:0 0 .75em 0; text-indent:0; }
#content h1, #content h2, #content h3, #content h4 { line-height:1.25; text-align:left; break-after:avoid; margin:.6em 0 .5em; }
#content h1 { font-size:1.5em; } #content h2 { font-size:1.3em; } #content h3 { font-size:1.15em; }
#content img, #content svg, #content image { max-width:100%; max-height:var(--img-max-h); height:auto;
  object-fit:contain; break-inside:avoid; display:block; margin:.5em auto; }
#content pre { white-space:pre-wrap; }
#content.justify { -webkit-hyphens:auto; hyphens:auto; }
#content table { border-collapse:collapse; }
#content blockquote { margin:.5em 1em; font-style:italic; }
#content mark.mbr-hl { color:inherit !important; border-radius:2px; padding:0; }
#content mark.mbr-speaking { background-color:var(--selection) !important; border-radius:2px; }
#content mark.mbr-flash { background-color:var(--selection) !important; outline:2px solid var(--accent); border-radius:2px; }
::selection { background:var(--selection); }
`;

const READER_SCRIPT = `
(function () {
  var viewport = document.getElementById('viewport');
  var content = document.getElementById('content');
  var state = { chapter: -1, page: 0, pageCount: 1, W: window.innerWidth, M: 24, style: null, hadSelection: false };
  var textNodes = [], textStarts = [];

  function cssVar(name, value) { document.documentElement.style.setProperty(name, value); }

  function hexToRgba(hex, alpha) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return hex;
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + alpha + ')';
  }
  function highlightColor(color) { return hexToRgba(color, state.style && state.style.isDark ? 0.45 : 0.75); }

  // ---- text index -------------------------------------------------------
  function buildIndex() {
    textNodes = []; textStarts = [];
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    var total = 0, node;
    while ((node = walker.nextNode())) { textNodes.push(node); textStarts.push(total); total += node.data.length; }
  }
  function offsetOf(node, offset) {
    try {
      var range = document.createRange();
      range.setStart(content, 0);
      range.setEnd(node, offset);
      return range.toString().length;
    } catch (e) { return null; }
  }
  function positionOf(offset) {
    if (!textNodes.length) return null;
    var lo = 0, hi = textNodes.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (textStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    var node = textNodes[lo];
    return { node: node, offset: Math.max(0, Math.min(node.data.length, offset - textStarts[lo])) };
  }
  function textSlice(start, length) {
    var out = '', i;
    for (i = 0; i < textNodes.length && out.length < length; i++) {
      var s = textStarts[i], e = s + textNodes[i].data.length;
      if (e <= start) continue;
      out += textNodes[i].data.slice(Math.max(0, start - s));
    }
    return out.slice(0, length);
  }

  /** Moves an offset back to the beginning of its word (for readable snippets). */
  function wordStart(offset) {
    var from = Math.max(0, offset - 40);
    var before = textSlice(from, offset - from);
    var match = /\S*$/.exec(before);
    return offset - (match ? match[0].length : 0);
  }

  // ---- layout & paging ---------------------------------------------------
  function absoluteX(rect) { return rect.left + state.page * state.W; }
  function pageOfX(x) { return Math.max(0, Math.min(state.pageCount - 1, Math.floor((x + 1) / state.W))); }

  function layout() {
    var W = window.innerWidth;
    var H = viewport.clientHeight;
    var style = state.style || { margin: 24, maxTextWidth: 680 };
    var M = Math.max(style.margin, Math.floor((W - style.maxTextWidth) / 2));
    state.W = W; state.M = M;
    content.style.width = (W - 2 * M) + 'px';
    content.style.marginLeft = M + 'px';
    content.style.columnWidth = (W - 2 * M) + 'px';
    content.style.columnGap = (2 * M) + 'px';
    cssVar('--img-max-h', Math.max(100, H - 24) + 'px');
    var byScroll = Math.round((content.scrollWidth + 2 * M) / W);
    var byMarker = 1;
    var marker = document.getElementById('mbr-end');
    if (marker) {
      var rect = marker.getBoundingClientRect();
      byMarker = Math.floor((absoluteX(rect) - 1) / W) + 1;
    }
    state.pageCount = Math.max(1, byScroll, byMarker);
  }

  function offsetAtPoint(x, y) {
    var range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
    }
    if (!range || !content.contains(range.startContainer)) return null;
    return offsetOf(range.startContainer, range.startOffset);
  }

  function visibleStartOffset() {
    var top = viewport.getBoundingClientRect().top;
    var H = viewport.clientHeight;
    for (var y = 4; y < H; y += 16) {
      var off = offsetAtPoint(state.M + 1, top + y);
      if (off !== null) return off;
    }
    // Fallback: first text node that starts on the current page.
    for (var i = 0; i < textNodes.length; i++) {
      var r = document.createRange(); r.selectNodeContents(textNodes[i]);
      var rect = r.getBoundingClientRect();
      if (rect.width && pageOfX(absoluteX(rect)) >= state.page) return textStarts[i];
    }
    return null;
  }
  function visibleEndOffset() {
    var top = viewport.getBoundingClientRect().top;
    var H = viewport.clientHeight;
    for (var y = H - 4; y > 0; y -= 16) {
      var off = offsetAtPoint(state.W - state.M - 4, top + y);
      if (off !== null) return off;
    }
    return null;
  }

  function pageForOffset(offset) {
    var pos = positionOf(offset);
    if (!pos) return 0;
    var range = document.createRange();
    range.setStart(pos.node, pos.offset);
    range.setEnd(pos.node, Math.min(pos.node.data.length, pos.offset + 1));
    var rects = range.getClientRects();
    var rect = rects.length ? rects[0] : range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) rect = pos.node.parentNode.getBoundingClientRect();
    return pageOfX(absoluteX(rect));
  }

  function report() {
    var start = visibleStartOffset();
    var end = visibleEndOffset();
    mbrPost({ type: 'location', chapter: state.chapter, page: state.page, pageCount: state.pageCount,
      startOffset: start, endOffset: end, snippet: start === null ? '' : textSlice(wordStart(start), 200) });
  }

  function goToPage(page, silent) {
    state.page = Math.max(0, Math.min(state.pageCount - 1, page));
    content.style.transform = 'translateX(' + (-state.page * state.W) + 'px)';
    if (!silent) report();
  }

  function goTarget(target) {
    if (!target) return goToPage(0);
    switch (target.kind) {
      case 'end': return goToPage(state.pageCount - 1);
      case 'progress': return goToPage(Math.floor(target.value * state.pageCount + 1e-6));
      case 'offset':
        goToPage(pageForOffset(target.value));
        if (target.flashLength) flash(target.value, target.value + target.flashLength);
        return;
      case 'anchor':
        var el = document.getElementById(target.id) || document.querySelector('[name="' + target.id.replace(/"/g, '') + '"]');
        if (el) return goToPage(pageOfX(absoluteX(el.getBoundingClientRect())));
        return goToPage(0);
      default: return goToPage(0);
    }
  }

  function relayoutKeepingPosition() {
    var offset = visibleStartOffset();
    layout();
    goToPage(offset === null ? state.page : pageForOffset(offset));
  }

  function next() {
    if (state.page < state.pageCount - 1) { goToPage(state.page + 1); mbrPost({ type: 'pageTurn' }); }
    else mbrPost({ type: 'boundary', direction: 'next' });
  }
  function prev() {
    if (state.page > 0) { goToPage(state.page - 1); mbrPost({ type: 'pageTurn' }); }
    else mbrPost({ type: 'boundary', direction: 'prev' });
  }

  // ---- highlights --------------------------------------------------------
  function wrapRange(start, end, className, id, color) {
    buildIndex();
    var nodes = textNodes.slice(), starts = textStarts.slice();
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], s = starts[i], e = s + node.data.length;
      if (e <= start || s >= end) continue;
      var a = Math.max(start, s) - s, b = Math.min(end, e) - s;
      var target = node;
      if (a > 0) { target = target.splitText(a); b -= a; }
      if (b < target.data.length) target.splitText(b);
      if (!/\\S/.test(target.data)) continue;
      var mark = document.createElement('mark');
      mark.className = className;
      if (id) mark.setAttribute('data-id', id);
      if (color) mark.style.setProperty('background-color', highlightColor(color), 'important');
      target.parentNode.insertBefore(mark, target);
      mark.appendChild(target);
    }
    buildIndex();
  }
  function unwrap(selector) {
    var marks = content.querySelectorAll(selector);
    for (var i = 0; i < marks.length; i++) {
      var mark = marks[i], parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    }
    content.normalize();
    buildIndex();
  }
  function addHighlight(mark) { wrapRange(mark.start, mark.end, 'mbr-hl', mark.id, mark.color); }
  function flash(start, end) {
    unwrap('mark.mbr-flash');
    wrapRange(start, end, 'mbr-flash');
    setTimeout(function () { unwrap('mark.mbr-flash'); }, 2500);
  }

  // ---- selection -----------------------------------------------------------
  function hasSelection() { var s = window.getSelection(); return !!(s && !s.isCollapsed && s.toString().trim()); }
  var selectionTimer = null;
  document.addEventListener('selectionchange', function () {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.toString().trim()) {
        if (state.hadSelection) { state.hadSelection = false; mbrPost({ type: 'selectionCleared' }); }
        return;
      }
      var range = sel.getRangeAt(0);
      if (!content.contains(range.commonAncestorContainer)) return;
      var start = offsetOf(range.startContainer, range.startOffset);
      var end = offsetOf(range.endContainer, range.endOffset);
      if (start === null || end === null || end <= start) return;
      state.hadSelection = true;
      mbrPost({ type: 'selection', chapter: state.chapter, start: start, end: end, text: sel.toString().slice(0, 5000) });
    }, 250);
  });

  // ---- input -------------------------------------------------------------
  var touch = null, swiped = false;
  document.addEventListener('touchstart', function (e) {
    swiped = false;
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!touch) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touch.x, dy = t.clientY - touch.y, dt = Date.now() - touch.t;
    touch = null;
    if (hasSelection()) return;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
      swiped = true;
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });
  document.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    var el = e.target && e.target.closest ? e.target : e.target.parentElement;
    var link = el && el.closest ? el.closest('a') : null;
    if (link) {
      var href = link.getAttribute('data-epub-href');
      var external = link.getAttribute('data-external-href');
      if (href || external) {
        e.preventDefault();
        mbrPost(href ? { type: 'link', href: href } : { type: 'externalLink', href: external });
        return;
      }
    }
    var mark = el && el.closest ? el.closest('mark.mbr-hl') : null;
    if (mark && !hasSelection()) { mbrPost({ type: 'highlightTap', id: mark.getAttribute('data-id') }); return; }
    if (hasSelection()) return;
    var x = e.clientX, W = window.innerWidth;
    if (x < W * 0.28) prev();
    else if (x > W * 0.72) next();
    else mbrPost({ type: 'tap' });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
  });
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayoutKeepingPosition, 150);
  });

  // ---- commands from React Native -----------------------------------------
  function applyStyle(style) {
    state.style = style;
    cssVar('--bg', style.background); cssVar('--fg', style.text); cssVar('--muted', style.secondaryText);
    cssVar('--accent', style.accent); cssVar('--selection', style.selection);
    cssVar('--font', style.fontFamily); cssVar('--size', style.fontSize + 'px'); cssVar('--lh', String(style.lineHeight));
    cssVar('--top', style.insetTop + 'px'); cssVar('--bottom', style.insetBottom + 'px');
    cssVar('--align', style.justify ? 'justify' : 'start');
    content.className = style.justify ? 'justify' : '';
    var marks = content.querySelectorAll('mark.mbr-hl');
    for (var i = 0; i < marks.length; i++) {
      var color = marks[i].getAttribute('data-color');
      if (color) marks[i].style.setProperty('background-color', highlightColor(color), 'important');
    }
  }

  function load(cmd) {
    if (cmd.lang) document.documentElement.lang = cmd.lang;
    content.innerHTML = cmd.html + '<span id="mbr-end"></span>';
    state.chapter = cmd.chapter;
    state.page = 0;
    buildIndex();
    (cmd.highlights || []).forEach(addHighlightWithColor);
    layout();
    goTarget(cmd.target);
    var images = content.querySelectorAll('img, image');
    for (var i = 0; i < images.length; i++) {
      images[i].addEventListener('load', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayoutKeepingPosition, 100);
      });
    }
  }
  function addHighlightWithColor(mark) {
    addHighlight(mark);
    var nodes = content.querySelectorAll('mark.mbr-hl[data-id="' + mark.id + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute('data-color', mark.color);
  }

  window.__mbrReceive = function (cmd) {
    try {
      switch (cmd.type) {
        case 'style':
          var hadContent = state.chapter >= 0;
          var offset = hadContent ? visibleStartOffset() : null;
          applyStyle(cmd.style);
          if (hadContent) { layout(); goToPage(offset === null ? state.page : pageForOffset(offset)); }
          break;
        case 'load': load(cmd); break;
        case 'goto': goTarget(cmd.target); break;
        case 'next': next(); break;
        case 'prev': prev(); break;
        case 'addHighlight':
          addHighlightWithColor(cmd.mark);
          if (window.getSelection()) window.getSelection().removeAllRanges();
          break;
        case 'removeHighlight': unwrap('mark.mbr-hl[data-id="' + cmd.id + '"]'); break;
        case 'updateHighlight':
          unwrap('mark.mbr-hl[data-id="' + cmd.mark.id + '"]');
          addHighlightWithColor(cmd.mark);
          break;
        case 'speaking':
          unwrap('mark.mbr-speaking');
          wrapRange(cmd.start, cmd.end, 'mbr-speaking');
          var speakingPage = pageForOffset(cmd.start);
          if (speakingPage !== state.page) goToPage(speakingPage);
          break;
        case 'clearSpeaking':
          unwrap('mark.mbr-speaking');
          break;
        case 'clearSelection':
          if (window.getSelection()) window.getSelection().removeAllRanges();
          break;
      }
    } catch (e) {
      mbrPost({ type: 'error', message: String(e && e.message || e) });
    }
  };
  mbrPost({ type: 'ready' });
})();
`;

export function buildReflowReaderHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${READER_CSS}</style>
</head>
<body>
<div id="viewport"><div id="content"></div></div>
<script>${BRIDGE_SCRIPT}${READER_SCRIPT}</script>
</body></html>`;
}
