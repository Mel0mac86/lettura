import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/ErrorState';
import { READER_PALETTES } from '@/constants/theme';
import { useBookAnnotations } from '@/hooks/useBookAnnotations';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useReadingSession } from '@/hooks/useReadingSession';
import { useServices } from '@/providers/AppServicesProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { dataEvents } from '@/services/events';
import { buildPdfViewerHtml, type PdfCommand, type PdfEvent, type PdfStyle } from '@/services/pdf/pdfViewerHtml';
import { parseBridgeMessage } from '@/services/reader/bridge';
import { pdfPageFilter, READER_INFO_LINE } from '@/services/reader/style';
import { coverFilePath } from '@/services/storage/FileStorage';
import type { Book } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import { dataUrlToBytes } from '@/utils/base64';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';
import { parseLocation, pdfLocation } from '@/utils/location';
import { computePageProgress } from '@/utils/progress';
import { titleFromFileName } from '@/utils/text';

import type { InBookResult } from './InBookSearchSheet';
import { showNoteActions } from './noteActions';
import { ReaderShell } from './ReaderShell';
import { ReaderWebView, type ReaderWebViewHandle } from './ReaderWebView';

interface Props {
  book: Book;
  initialLocation: ReaderLocation | null;
}

/** Size of each base64 chunk sent to the WebView. */
const CHUNK_SIZE = 512 * 1024;
const SAVE_DELAY_MS = 700;
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** PDF reader: pdf.js running offline inside a WebView. */
export function PdfReader({ book, initialLocation }: Props) {
  const services = useServices();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const palette = READER_PALETTES[settings.reader.theme];
  const webRef = useRef<ReaderWebViewHandle>(null);
  const html = useMemo(() => buildPdfViewerHtml(), []);
  const annotations = useBookAnnotations(book.id);
  const { openNoteEditor, noteEditorElement } = useNoteEditor();
  const session = useReadingSession(book.id);

  const [page, setPage] = useState(initialLocation?.type === 'pdf' ? initialLocation.page : 1);
  const [numPages, setNumPages] = useState(book.totalPages ?? 0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<InBookResult[]>([]);
  const [searching, setSearching] = useState(false);

  const pageRef = useRef(page);
  const numPagesRef = useRef(numPages);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opened = useRef(false);

  const style = useMemo<PdfStyle>(
    () => ({
      background: palette.isDark ? '#1A1A1A' : settings.reader.theme === 'sepia' ? '#D9CDB4' : '#525659',
      pageFilter: pdfPageFilter(settings.reader.theme),
      insetTop: insets.top + READER_INFO_LINE,
      insetBottom: insets.bottom + READER_INFO_LINE,
    }),
    [palette.isDark, settings.reader.theme, insets.top, insets.bottom],
  );
  const styleRef = useRef(style);

  const send = useCallback((command: PdfCommand) => webRef.current?.send(command), []);

  useEffect(() => {
    styleRef.current = style;
    send({ type: 'style', style });
  }, [send, style]);

  const onReady = useCallback(async () => {
    try {
      const base64 = await services.storage.readBase64(book.filePath);
      for (let i = 0; i < base64.length; i += CHUNK_SIZE) send({ type: 'chunk', data: base64.slice(i, i + CHUNK_SIZE) });
      send({ type: 'open', page: pageRef.current, zoom: zoomRef.current, style: styleRef.current });
    } catch (e) {
      setError(`Impossibile leggere il file del libro. ${toUserMessage(e)}`);
    }
  }, [services, book.filePath, send]);

  const persist = useCallback(
    (current: number) => {
      services.books
        .savePosition(book.id, {
          location: pdfLocation(current),
          progress: computePageProgress(current, numPagesRef.current || current),
          currentPage: current,
          currentChapter: null,
        })
        .catch(() => undefined);
    },
    [services, book.id],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (opened.current) persist(pageRef.current);
      dataEvents.emit('books');
    },
    [persist],
  );

  /** First open: complete metadata, generate the cover and index the text for search. */
  const onOpened = useCallback(
    async (event: Extract<PdfEvent, { type: 'opened' }>) => {
      try {
        await services.books.updateTotals(book.id, { totalPages: event.numPages });
        const hasFallbackTitle = book.title === titleFromFileName(book.originalFileName);
        if ((event.title && hasFallbackTitle) || (event.author && !book.author)) {
          await services.books.updateMetadata(book.id, {
            ...(event.title && hasFallbackTitle ? { title: event.title } : {}),
            ...(event.author && !book.author ? { author: event.author } : {}),
          });
        }
      } catch {
        // metadata enrichment is best-effort
      }
      if (!book.cover) send({ type: 'thumbnail' });
      if (!book.isIndexed) send({ type: 'extractText' });
    },
    [services, book, send],
  );

  const onMessage = useCallback(
    (raw: string) => {
      const event = parseBridgeMessage<PdfEvent>(raw);
      if (!event) return;
      switch (event.type) {
        case 'opened':
          opened.current = true;
          numPagesRef.current = event.numPages;
          setNumPages(event.numPages);
          void onOpened(event);
          break;
        case 'page':
          // Statistics: count pages reached moving forward one at a time.
          if (opened.current && event.page === pageRef.current + 1) session.addPagesRead(1);
          pageRef.current = event.page;
          setPage(event.page);
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => persist(event.page), SAVE_DELAY_MS);
          break;
        case 'tap':
          setControlsVisible((v) => !v);
          break;
        case 'searchResults':
          setSearching(!event.done);
          setSearchResults(
            event.results.map((r, i) => ({ key: `${r.page}:${i}`, location: `Pagina ${r.page}`, snippet: r.snippet })),
          );
          break;
        case 'text':
          void services.search
            .upsertSections(
              book.id,
              event.pages.map((p) => ({ index: p.page - 1, page: p.page, title: `Pagina ${p.page}`, text: p.text })),
            )
            .then(() => (event.done ? services.books.setIndexed(book.id, true) : undefined))
            .catch(() => undefined);
          break;
        case 'thumbnail': {
          const path = coverFilePath(book.id, 'jpg');
          void services.storage
            .writeBytes(path, dataUrlToBytes(event.dataUrl))
            .then(() => services.books.setCover(book.id, path))
            .then(() => dataEvents.emit('books'))
            .catch(() => undefined);
          break;
        }
        case 'error':
          if (event.code === 'password') setError('Questo PDF è protetto da password e non può essere aperto.');
          else if (event.code === 'invalid') setError(`Il PDF non può essere aperto: è danneggiato o non valido. (${event.message})`);
          else console.warn('[pdf]', event.message);
          break;
        default:
          break;
      }
    },
    [onOpened, persist, services, book.id, session],
  );

  const currentBookmark = useMemo(
    () =>
      annotations.bookmarks.find((b) => {
        const loc = parseLocation(b.location);
        return loc?.type === 'pdf' && loc.page === page;
      }),
    [annotations.bookmarks, page],
  );

  const toggleBookmark = useCallback(async () => {
    try {
      if (currentBookmark) await services.bookmarks.delete(currentBookmark.id);
      else {
        const text = await services.search.getSectionText(book.id, pageRef.current - 1);
        await services.bookmarks.create({
          bookId: book.id,
          location: pdfLocation(pageRef.current),
          page: pageRef.current,
          text: text ? text.slice(0, 200) : null,
        });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      dataEvents.emit('annotations');
    } catch (e) {
      showAlert('Segnalibro', toUserMessage(e));
    }
  }, [currentBookmark, services, book.id]);

  const changeZoom = (direction: 1 | -1) => {
    const index = ZOOM_STEPS.findIndex((z) => z >= zoom);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (index === -1 ? 1 : index) + direction))];
    setZoom(next);
    send({ type: 'zoom', zoom: next });
  };

  if (error) {
    return <ErrorState title="Impossibile aprire il PDF" message={error} />;
  }

  return (
    <ReaderShell
      book={book}
      palette={palette}
      mode="pdf"
      controlsVisible={controlsVisible}
      subtitle={numPages ? `Pagina ${page} di ${numPages}` : book.title}
      pageLabel={numPages ? `Pag. ${page} di ${numPages}` : 'Caricamento…'}
      progress={computePageProgress(page, numPages)}
      onPrev={() => send({ type: 'prev' })}
      onNext={() => send({ type: 'next' })}
      prevLabel="Pagina precedente"
      nextLabel="Pagina successiva"
      isBookmarked={!!currentBookmark}
      onToggleBookmark={toggleBookmark}
      toc={null}
      search={{
        onSearch: (query) => {
          if (query.trim().length < 2) {
            setSearchResults([]);
            return;
          }
          setSearching(true);
          send({ type: 'search', query });
        },
        onSelect: (result) => send({ type: 'goto', page: Number(result.key.split(':')[0]) }),
        results: searchResults,
        searching,
      }}
      annotations={annotations}
      onOpenLocation={(raw) => {
        const loc = parseLocation(raw);
        if (loc?.type === 'pdf') send({ type: 'goto', page: loc.page });
      }}
      onAddPageNote={() =>
        openNoteEditor({
          title: `Nota a pagina ${pageRef.current}`,
          onSave: async (text) => {
            await services.notes.create({ bookId: book.id, text, location: pdfLocation(pageRef.current), page: pageRef.current });
            dataEvents.emit('annotations');
          },
        })
      }
      onEditNote={(note) => showNoteActions(note, services, openNoteEditor)}
      onEditHighlight={() => undefined}
      getSpeechText={() => services.search.getSectionText(book.id, pageRef.current - 1)}
      bottomExtra={
        <View style={styles.zoomRow}>
          <ZoomButton label="−" onPress={() => changeZoom(-1)} color={palette.text} a11y="Riduci zoom" />
          <Text style={[styles.zoomValue, { color: palette.text }]}>{Math.round(zoom * 100)}%</Text>
          <ZoomButton label="+" onPress={() => changeZoom(1)} color={palette.text} a11y="Aumenta zoom" />
        </View>
      }
      overlay={noteEditorElement}
    >
      <ReaderWebView ref={webRef} html={html} onMessage={onMessage} onReady={onReady} backgroundColor={style.background} allowZoom />
    </ReaderShell>
  );
}

function ZoomButton({ label, onPress, color, a11y }: { label: string; onPress: () => void; color: string; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8} style={styles.zoomButton}>
      <Text style={[styles.zoomLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 6 },
  zoomButton: { paddingHorizontal: 14, paddingVertical: 2 },
  zoomLabel: { fontSize: 24, fontWeight: '500' },
  zoomValue: { fontSize: 13, minWidth: 48, textAlign: 'center' },
});
