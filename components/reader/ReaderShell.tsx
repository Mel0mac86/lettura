import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReaderBottomBar, ReaderTopBar, type ReaderAction, type ReaderChromePalette } from '@/components/ReaderControls';
import type { BookAnnotations } from '@/hooks/useBookAnnotations';
import { useTts } from '@/hooks/useTts';
import { useServices } from '@/providers/AppServicesProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { dataEvents } from '@/services/events';
import type { Book, Highlight, Note } from '@/types/models';
import { showAlert } from '@/utils/dialogs';
import { resolveSpeechLanguage } from '@/utils/language';
import { toUserMessage } from '@/utils/errors';

import { BookAnnotationsSheet } from './BookAnnotationsSheet';
import { InBookSearchSheet, type InBookResult } from './InBookSearchSheet';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { TocSheet, type TocEntry } from './TocSheet';
import { TtsPlayer } from './TtsPlayer';

type SheetName = 'toc' | 'search' | 'settings' | 'annotations';

export interface ReaderShellProps {
  book: Book;
  palette: ReaderChromePalette;
  mode: 'reflow' | 'pdf';
  controlsVisible: boolean;
  subtitle: string;
  pageLabel: string;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  toc: TocEntry[] | null;
  onTocSelect?: (entry: TocEntry) => void;
  search: {
    onSearch: (query: string) => void;
    onSelect: (result: InBookResult) => void;
    results: InBookResult[];
    searching: boolean;
  };
  annotations: BookAnnotations;
  onOpenLocation: (location: string) => void;
  onAddPageNote: () => void;
  onEditNote: (note: Note) => void;
  onEditHighlight: (highlight: Highlight) => void;
  /** Text to read aloud, starting from the current position. */
  getSpeechText: () => Promise<string | null>;
  bottomExtra?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}

/** Layout shared by every reader: content, header/footer, sheets and TTS player. */
export function ReaderShell(props: ReaderShellProps) {
  const { book, palette, controlsVisible, annotations } = props;
  const services = useServices();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const tts = useTts();
  const { settings, updateSpeech } = useSettings();

  const startTts = async () => {
    setTtsOpen(true);
    const text = await props.getSpeechText();
    if (text?.trim()) tts.start(text, resolveSpeechLanguage(book.language, text));
    else showAlert('Lettura ad alta voce', 'Non c’è testo da leggere in questa posizione.');
  };

  const actions: ReaderAction[] = [
    ...(props.toc ? [{ icon: 'list' as const, label: 'Indice', onPress: () => setSheet('toc') }] : []),
    { icon: 'search', label: 'Cerca nel libro', onPress: () => setSheet('search') },
    {
      icon: props.isBookmarked ? 'bookmark' : 'bookmark-outline',
      label: props.isBookmarked ? 'Rimuovi segnalibro' : 'Aggiungi segnalibro',
      onPress: props.onToggleBookmark,
      active: props.isBookmarked,
    },
    { icon: 'albums-outline', label: 'Segnalibri, evidenziazioni e note', onPress: () => setSheet('annotations') },
    { icon: 'volume-high-outline', label: 'Leggi ad alta voce', onPress: startTts, active: ttsOpen },
    { icon: 'text', label: 'Aspetto', onPress: () => setSheet('settings') },
  ];

  const deleteBookmark = (id: string) =>
    services.bookmarks
      .delete(id)
      .then(() => dataEvents.emit('annotations'))
      .catch((e) => showAlert('Errore', toUserMessage(e)));

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar hidden={!controlsVisible} style={palette.isDark ? 'light' : 'dark'} animated />
      {props.children}
      {props.overlay}
      <ReaderTopBar
        visible={controlsVisible}
        title={book.title}
        subtitle={props.subtitle}
        palette={palette}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        actions={actions}
      />
      <ReaderBottomBar
        visible={controlsVisible || ttsOpen}
        palette={palette}
        pageLabel={props.pageLabel}
        progress={props.progress}
        onPrev={props.onPrev}
        onNext={props.onNext}
        prevLabel={props.prevLabel}
        nextLabel={props.nextLabel}
      >
        {ttsOpen ? (
          <TtsPlayer
            state={tts.state}
            palette={palette}
            onPlay={() => (tts.state === 'idle' ? startTts() : tts.play())}
            onPause={tts.pause}
            onStop={tts.stop}
            onSeek={tts.seek}
            rate={settings.speech.rate}
            onChangeRate={(rate) => updateSpeech({ rate })}
            onClose={() => {
              tts.stop();
              setTtsOpen(false);
            }}
          />
        ) : null}
        {props.bottomExtra}
      </ReaderBottomBar>

      {props.toc ? <TocSheet visible={sheet === 'toc'} entries={props.toc} onSelect={(e) => props.onTocSelect?.(e)} onClose={() => setSheet(null)} /> : null}
      <InBookSearchSheet
        visible={sheet === 'search'}
        onClose={() => setSheet(null)}
        onSearch={props.search.onSearch}
        onSelect={props.search.onSelect}
        results={props.search.results}
        searching={props.search.searching}
      />
      <ReaderSettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} mode={props.mode} />
      <BookAnnotationsSheet
        visible={sheet === 'annotations'}
        onClose={() => setSheet(null)}
        bookmarks={annotations.bookmarks}
        highlights={annotations.highlights}
        notes={annotations.notes}
        onOpenLocation={props.onOpenLocation}
        onDeleteBookmark={(b) => deleteBookmark(b.id)}
        onEditHighlight={(h) => {
          setSheet(null);
          props.onEditHighlight(h);
        }}
        onEditNote={(n) => {
          setSheet(null);
          props.onEditNote(n);
        }}
        onAddNote={() => {
          setSheet(null);
          props.onAddPageNote();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
