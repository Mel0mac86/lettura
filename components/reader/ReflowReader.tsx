import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { READER_PALETTES } from '@/constants/theme';
import { useBookAnnotations } from '@/hooks/useBookAnnotations';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useReadingSession } from '@/hooks/useReadingSession';
import { useServices } from '@/providers/AppServicesProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { HIGHLIGHT_COLORS } from '@/services/annotations/types';
import { dataEvents } from '@/services/events';
import { parseBridgeMessage, type ChapterTarget, type HighlightMark, type ReflowCommand, type ReflowEvent } from '@/services/reader/bridge';
import type { ReflowableDocument } from '@/services/reader/ReflowableDocument';
import { buildReflowReaderHtml } from '@/services/reader/reflowHtml';
import { buildReaderStyle } from '@/services/reader/style';
import { nextNonEmptySection, type SpeechSource } from '@/services/tts/SpeechSource';
import type { Book, Highlight } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';
import { parseLocation, reflowLocation, reflowRange } from '@/utils/location';
import { computeBookPagination } from '@/utils/pagination';
import { computeReflowProgress } from '@/utils/progress';
import { buildSnippet, findAllOccurrences } from '@/utils/text';

import { showNoteActions } from './noteActions';
import { ReaderShell } from './ReaderShell';
import { ReaderWebView, type ReaderWebViewHandle } from './ReaderWebView';
import { SelectionToolbar } from './SelectionToolbar';
import type { InBookResult } from './InBookSearchSheet';
import type { TocEntry } from './TocSheet';

interface Props {
  book: Book;
  doc: ReflowableDocument;
  /** Where to open the book (saved position, bookmark, search result…). */
  initialLocation: ReaderLocation | null;
}

interface CurrentLocation {
  chapter: number;
  page: number;
  pageCount: number;
  startOffset: number | null;
  endOffset: number | null;
  snippet: string;
  /** Book-wide page numbering (see utils/pagination.ts). */
  bookPage: number;
  totalPages: number;
  remainingInChapter: number;
}

interface Selection {
  chapter: number;
  start: number;
  end: number;
  text: string;
}

const SAVE_DELAY_MS = 700;

function toMark(highlight: Highlight, chapter: number): HighlightMark | null {
  const location = parseLocation(highlight.location);
  if (location?.type !== 'reflow-range' || location.chapter !== chapter) return null;
  return { id: highlight.id, start: location.start, end: location.end, color: highlight.color };
}

function targetFor(location: ReaderLocation | null): { chapter: number; target: ChapterTarget } {
  if (!location || location.type === 'pdf') return { chapter: 0, target: { kind: 'start' } };
  if (location.type === 'reflow-range') {
    return { chapter: location.chapter, target: { kind: 'offset', value: location.start, flashLength: location.end - location.start } };
  }
  if (location.offset !== undefined) return { chapter: location.chapter, target: { kind: 'offset', value: location.offset } };
  return { chapter: location.chapter, target: { kind: 'progress', value: location.progress } };
}

/** Paginated reader for reflowable books (EPUB, TXT). */
export function ReflowReader({ book, doc, initialLocation }: Props) {
  const services = useServices();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const palette = READER_PALETTES[settings.reader.theme];
  const webRef = useRef<ReaderWebViewHandle>(null);
  const html = useMemo(() => buildReflowReaderHtml(), []);
  const chapterLengths = useMemo(() => doc.chapters.map((c) => c.textLength), [doc]);
  const annotations = useBookAnnotations(book.id);
  const { openNoteEditor, noteEditorElement } = useNoteEditor();
  const session = useReadingSession(book.id);

  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [searchResults, setSearchResults] = useState<InBookResult[]>([]);
  const [searching, setSearching] = useState(false);

  const locationRef = useRef<CurrentLocation | null>(null);
  const highlightsRef = useRef<Highlight[]>(annotations.highlights);
  useEffect(() => {
    highlightsRef.current = annotations.highlights;
  }, [annotations.highlights]);
  const pendingTarget = useRef(targetFor(initialLocation));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const style = useMemo(() => buildReaderStyle(settings.reader, insets), [settings.reader, insets]);
  const styleRef = useRef(style);
  const send = useCallback((command: ReflowCommand) => webRef.current?.send(command), []);

  // Page counts of chapters laid out with the current style (see utils/pagination.ts).
  const measuredPages = useRef(new Map<number, number>());

  useEffect(() => {
    styleRef.current = style;
    // A new font/margin changes every page count: measure again.
    measuredPages.current = new Map();
    send({ type: 'style', style });
  }, [send, style]);

  /** Chapter currently loaded in the WebView. */
  const shownChapter = useRef(-1);

  const loadChapter = useCallback(
    async (chapter: number, target: ChapterTarget) => {
      const index = Math.max(0, Math.min(doc.chapters.length - 1, chapter));
      pendingTarget.current = { chapter: index, target };
      shownChapter.current = index;
      try {
        const chapterHtml = await doc.getChapterHtml(index);
        const marks = highlightsRef.current.map((h) => toMark(h, index)).filter((m): m is HighlightMark => m !== null);
        send({ type: 'load', chapter: index, html: chapterHtml, highlights: marks, target, lang: book.language ?? undefined });
        setSelection(null);
      } catch (error) {
        showAlert('Impossibile aprire il capitolo', toUserMessage(error));
      }
    },
    [doc, send, book.language],
  );

  const onReady = useCallback(() => {
    // Also called after the WebView process is restarted by the OS: restore the last position.
    send({ type: 'style', style: styleRef.current });
    const current = locationRef.current;
    const { chapter, target } = current
      ? { chapter: current.chapter, target: current.startOffset !== null ? ({ kind: 'offset', value: current.startOffset } as const) : ({ kind: 'progress', value: current.page / current.pageCount } as const) }
      : pendingTarget.current;
    void loadChapter(chapter, target);
  }, [loadChapter, send]);

  // ---- position persistence --------------------------------------------------
  const persist = useCallback(
    (loc: CurrentLocation) => {
      const readFraction = (loc.page + 1) / loc.pageCount;
      services.books
        .savePosition(book.id, {
          location: reflowLocation(loc.chapter, loc.page / loc.pageCount, loc.startOffset ?? undefined),
          progress: computeReflowProgress(chapterLengths, loc.chapter, readFraction),
          currentPage: loc.bookPage,
          totalPages: loc.totalPages,
          currentChapter: doc.chapters[loc.chapter]?.title ?? null,
        })
        .catch(() => undefined);
    },
    [services, book.id, chapterLengths, doc],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (locationRef.current) persist(locationRef.current);
      dataEvents.emit('books');
    },
    [persist],
  );

  // ---- messages from the WebView ---------------------------------------------
  const handleHighlightTap = useCallback(
    (highlight: Highlight) => {
      const editNote = () =>
        openNoteEditor({
          title: highlight.note ? 'Modifica nota' : 'Aggiungi nota',
          quote: highlight.text,
          initialText: highlight.note ?? '',
          onSave: async (text) => {
            await services.highlights.update(highlight.id, { note: text });
            dataEvents.emit('annotations');
          },
        });
      const changeColor = () =>
        showAlert('Colore', undefined, [
          ...HIGHLIGHT_COLORS.map((color) => ({
            text: color.name,
            onPress: async () => {
              await services.highlights.update(highlight.id, { color: color.value });
              const mark = toMark({ ...highlight, color: color.value }, locationRef.current?.chapter ?? -1);
              if (mark) send({ type: 'updateHighlight', mark });
              dataEvents.emit('annotations');
            },
          })),
          { text: 'Annulla', style: 'cancel' as const },
        ]);
      showAlert('Evidenziazione', highlight.note ? `📝 ${highlight.note}` : highlight.text.slice(0, 160), [
        { text: highlight.note ? 'Modifica nota' : 'Aggiungi nota', onPress: editNote },
        { text: 'Cambia colore', onPress: changeColor },
        { text: 'Copia testo', onPress: () => void Clipboard.setStringAsync(highlight.text) },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            await services.highlights.delete(highlight.id);
            send({ type: 'removeHighlight', id: highlight.id });
            dataEvents.emit('annotations');
          },
        },
        { text: 'Annulla', style: 'cancel' },
      ]);
    },
    [openNoteEditor, send, services],
  );

  const onMessage = useCallback(
    (raw: string) => {
      const event = parseBridgeMessage<ReflowEvent>(raw);
      if (!event) return;
      switch (event.type) {
        case 'location': {
          const pageCount = Math.max(1, event.pageCount);
          measuredPages.current.set(event.chapter, pageCount);
          const pagination = computeBookPagination(chapterLengths, measuredPages.current, event.chapter, event.page);
          const loc: CurrentLocation = {
            chapter: event.chapter,
            page: event.page,
            pageCount,
            startOffset: event.startOffset,
            endOffset: event.endOffset,
            snippet: event.snippet,
            bookPage: pagination.page,
            totalPages: pagination.totalPages,
            remainingInChapter: pagination.remainingInChapter,
          };
          // Statistics: count only pages read moving forward one at a time (not jumps or going back).
          const previous = locationRef.current;
          if (previous && loc.bookPage === previous.bookPage + 1) session.addPagesRead(1);
          locationRef.current = loc;
          setLocation(loc);
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => persist(loc), SAVE_DELAY_MS);
          break;
        }
        case 'selection':
          setSelection({ chapter: event.chapter, start: event.start, end: event.end, text: event.text });
          break;
        case 'selectionCleared':
          setSelection(null);
          break;
        case 'tap':
          setControlsVisible((visible) => !visible);
          break;
        case 'pageTurn':
          setControlsVisible(false);
          break;
        case 'boundary': {
          const chapter = locationRef.current?.chapter ?? 0;
          if (event.direction === 'next') {
            if (chapter < doc.chapters.length - 1) {
              void loadChapter(chapter + 1, { kind: 'start' });
            } else {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              showAlert('Fine del libro', 'Hai raggiunto la fine. Il libro è stato segnato come completato. 🎉');
            }
          } else if (chapter > 0) {
            void loadChapter(chapter - 1, { kind: 'end' });
          }
          break;
        }
        case 'link': {
          const current = locationRef.current?.chapter ?? 0;
          const resolved = doc.resolveHref(current, event.href);
          if (!resolved) break;
          const target: ChapterTarget = resolved.anchor ? { kind: 'anchor', id: resolved.anchor } : { kind: 'start' };
          if (resolved.chapter === current) send({ type: 'goto', target });
          else void loadChapter(resolved.chapter, target);
          break;
        }
        case 'externalLink':
          if (/^(https?|mailto):/i.test(event.href)) {
            showAlert('Aprire il link?', event.href, [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Apri', onPress: () => void Linking.openURL(event.href) },
            ]);
          }
          break;
        case 'highlightTap': {
          const highlight = highlightsRef.current.find((h) => h.id === event.id);
          if (highlight) handleHighlightTap(highlight);
          break;
        }
        case 'error':
          console.warn('[reader]', event.message);
          break;
        default:
          break;
      }
    },
    [doc, chapterLengths, loadChapter, persist, send, session, handleHighlightTap],
  );

  // ---- navigation & annotations ------------------------------------------------
  const openLocation = useCallback(
    (raw: string) => {
      const parsed = parseLocation(raw);
      if (!parsed) return;
      const { chapter, target } = targetFor(parsed);
      void loadChapter(chapter, target);
    },
    [loadChapter],
  );

  const chapterTitle = location ? (doc.chapters[location.chapter]?.title ?? '') : '';

  const currentBookmark = useMemo(() => {
    if (!location) return undefined;
    return annotations.bookmarks.find((bookmark) => {
      const loc = parseLocation(bookmark.location);
      if (loc?.type !== 'reflow' || loc.chapter !== location.chapter) return false;
      if (loc.offset !== undefined && location.startOffset !== null && location.endOffset !== null) {
        return loc.offset >= location.startOffset && loc.offset <= location.endOffset;
      }
      return Math.floor(loc.progress * location.pageCount + 1e-6) === location.page;
    });
  }, [annotations.bookmarks, location]);

  const toggleBookmark = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    try {
      if (currentBookmark) {
        await services.bookmarks.delete(currentBookmark.id);
      } else {
        await services.bookmarks.create({
          bookId: book.id,
          location: reflowLocation(loc.chapter, loc.page / loc.pageCount, loc.startOffset ?? undefined),
          page: loc.page + 1,
          chapter: doc.chapters[loc.chapter]?.title ?? null,
          text: loc.snippet,
        });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      dataEvents.emit('annotations');
    } catch (error) {
      showAlert('Segnalibro', toUserMessage(error));
    }
  }, [currentBookmark, services, book.id, doc]);

  const createHighlight = useCallback(
    async (color: string, note?: string) => {
      if (!selection) return;
      const highlight = await services.highlights.create({
        bookId: book.id,
        location: reflowRange(selection.chapter, selection.start, selection.end),
        text: selection.text,
        color,
        note,
        chapter: doc.chapters[selection.chapter]?.title ?? null,
        page: locationRef.current ? locationRef.current.page + 1 : null,
      });
      send({ type: 'addHighlight', mark: { id: highlight.id, start: selection.start, end: selection.end, color } });
      setSelection(null);
      dataEvents.emit('annotations');
    },
    [selection, services, book.id, doc, send],
  );

  const addPageNote = useCallback(() => {
    const loc = locationRef.current;
    openNoteEditor({
      title: 'Nota sulla pagina',
      onSave: async (text) => {
        await services.notes.create({
          bookId: book.id,
          text,
          location: loc ? reflowLocation(loc.chapter, loc.page / loc.pageCount, loc.startOffset ?? undefined) : null,
          chapter: loc ? (doc.chapters[loc.chapter]?.title ?? null) : null,
          page: loc ? loc.page + 1 : null,
        });
        dataEvents.emit('annotations');
      },
    });
  }, [openNoteEditor, services, book.id, doc]);

  // ---- search inside the book -----------------------------------------------------
  const searchToken = useRef(0);
  const onSearch = useCallback(
    async (query: string) => {
      const token = ++searchToken.current;
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const results: InBookResult[] = [];
      for (const chapter of doc.chapters) {
        const text = await doc.getChapterText(chapter.index);
        if (token !== searchToken.current) return;
        for (const offset of findAllOccurrences(text, query, 200)) {
          results.push({
            key: `${chapter.index}:${offset}:${query.trim().length}`,
            location: chapter.title,
            snippet: buildSnippet(text, offset, query.trim().length),
          });
        }
        if (results.length >= 300) break;
      }
      setSearchResults(results);
      setSearching(false);
    },
    [doc],
  );

  const onSearchSelect = useCallback(
    (result: InBookResult) => {
      const [chapter, offset, length] = result.key.split(':').map(Number);
      void loadChapter(chapter, { kind: 'offset', value: offset, flashLength: length });
    },
    [loadChapter],
  );

  const tocSource = useMemo(
    () => (doc.toc.length > 0 ? doc.toc : doc.chapters.map((c) => ({ title: c.title, chapterIndex: c.index, depth: 0, anchor: undefined }))),
    [doc],
  );
  const currentChapter = location?.chapter ?? -1;
  const tocEntries = useMemo(() => {
    const activeIndex = tocSource.reduce((found, item, i) => (item.chapterIndex <= currentChapter ? i : found), -1);
    return tocSource.map((item, i) => ({ key: `${i}`, title: item.title, depth: item.depth, active: i === activeIndex }));
  }, [tocSource, currentChapter]);

  const onTocSelect = useCallback(
    (entry: TocEntry) => {
      const item = tocSource[Number(entry.key)];
      if (item) void loadChapter(item.chapterIndex, item.anchor ? { kind: 'anchor', id: item.anchor } : { kind: 'start' });
    },
    [tocSource, loadChapter],
  );

  // ---- read aloud: chapter after chapter, the page follows the voice ----------------
  const speechSource = useMemo<SpeechSource>(
    () => ({
      first: async () => {
        const loc = locationRef.current;
        if (!loc) return null;
        const text = await doc.getChapterText(loc.chapter);
        const start = loc.startOffset ?? 0;
        return { section: loc.chapter, startOffset: start, text: text.slice(start) };
      },
      next: (segment) => nextNonEmptySection(segment.section, doc.chapters.length, (i) => doc.getChapterText(i)),
      follow: (segment, start, end) => {
        if (shownChapter.current === segment.section) {
          send({ type: 'speaking', start, end });
        } else {
          void loadChapter(segment.section, { kind: 'offset', value: start }).then(() => send({ type: 'speaking', start, end }));
        }
      },
      clear: () => send({ type: 'clearSpeaking' }),
    }),
    [doc, loadChapter, send],
  );

  const progress = location
    ? computeReflowProgress(chapterLengths, location.chapter, (location.page + 1) / location.pageCount)
    : book.progress;

  return (
    <ReaderShell
      book={book}
      palette={palette}
      mode="reflow"
      controlsVisible={controlsVisible}
      subtitle={chapterTitle || book.title}
      pageLabel={location ? `Pag. ${location.bookPage} di ${location.totalPages}` : 'Caricamento…'}
      pageDetail={
        location
          ? location.remainingInChapter === 0
            ? 'Ultima pagina del capitolo'
            : `${location.remainingInChapter} ${location.remainingInChapter === 1 ? 'pagina' : 'pagine'} alla fine del capitolo`
          : undefined
      }
      progress={progress}
      onPrev={() => send({ type: 'prev' })}
      onNext={() => send({ type: 'next' })}
      prevLabel="Pagina precedente"
      nextLabel="Pagina successiva"
      isBookmarked={!!currentBookmark}
      onToggleBookmark={toggleBookmark}
      toc={tocEntries}
      onTocSelect={onTocSelect}
      search={{ onSearch, onSelect: onSearchSelect, results: searchResults, searching }}
      annotations={annotations}
      onOpenLocation={openLocation}
      onAddPageNote={addPageNote}
      onEditNote={(note) => showNoteActions(note, services, openNoteEditor)}
      onEditHighlight={handleHighlightTap}
      speechSource={speechSource}
      overlay={
        <>
          {selection ? (
            <SelectionToolbar
              palette={palette}
              raised={controlsVisible}
              onHighlight={(color) => void createHighlight(color).catch((e) => showAlert('Errore', toUserMessage(e)))}
              onCopy={() => {
                void Clipboard.setStringAsync(selection.text);
                send({ type: 'clearSelection' });
                setSelection(null);
              }}
              onNote={() =>
                openNoteEditor({
                  title: 'Aggiungi nota',
                  quote: selection.text,
                  onSave: (text) => createHighlight(HIGHLIGHT_COLORS[0].value, text),
                })
              }
              onDismiss={() => {
                send({ type: 'clearSelection' });
                setSelection(null);
              }}
            />
          ) : null}
          {noteEditorElement}
        </>
      }
    >
      <ReaderWebView ref={webRef} html={html} onMessage={onMessage} onReady={onReady} backgroundColor={palette.background} />
    </ReaderShell>
  );
}
