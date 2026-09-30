import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemedText } from '@/components/ui/ThemedText';
import { showNoteActions } from '@/components/reader/noteActions';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme } from '@/providers/SettingsProvider';
import { dataEvents } from '@/services/events';
import { formatDate } from '@/utils/dates';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';

type Tab = 'bookmarks' | 'highlights' | 'notes';

interface Item {
  id: string;
  kind: Tab;
  bookId: string;
  bookTitle: string;
  location: string | null;
  meta: string;
  text: string | null;
  secondary: string | null;
  color?: string;
  date: string;
}

function openAt(bookId: string, location: string | null) {
  router.push({ pathname: '/reader/[id]', params: location ? { id: bookId, location } : { id: bookId } });
}

/** "I miei segnalibri": bookmarks, highlights and notes of every book. */
export default function AnnotationsScreen() {
  const services = useServices();
  const { colors } = useAppTheme();
  const { openNoteEditor, noteEditorElement } = useNoteEditor();
  const [tab, setTab] = useState<Tab>('bookmarks');

  const load = useCallback(async () => {
    const [bookmarks, highlights, notes] = await Promise.all([
      services.bookmarks.listAll(),
      services.highlights.listAll(),
      services.notes.listAll(),
    ]);
    return { bookmarks, highlights, notes };
  }, [services]);
  const { data, loading, error, reload } = useAsyncData(load, ['annotations', 'books']);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const items: Record<Tab, Item[]> = {
    bookmarks: data.bookmarks.map((b) => ({
      id: b.id,
      kind: 'bookmarks',
      bookId: b.bookId,
      bookTitle: b.bookTitle,
      location: b.location,
      meta: [b.chapter, b.page ? `pagina ${b.page}` : null].filter(Boolean).join(' · '),
      text: b.text,
      secondary: null,
      date: b.createdAt,
    })),
    highlights: data.highlights.map((h) => ({
      id: h.id,
      kind: 'highlights',
      bookId: h.bookId,
      bookTitle: h.bookTitle,
      location: h.location,
      meta: [h.chapter, h.page ? `pagina ${h.page}` : null].filter(Boolean).join(' · '),
      text: h.text,
      secondary: h.note ? `📝 ${h.note}` : null,
      color: h.color,
      date: h.createdAt,
    })),
    notes: data.notes.map((n) => ({
      id: n.id,
      kind: 'notes',
      bookId: n.bookId,
      bookTitle: n.bookTitle,
      location: n.location,
      meta: [n.chapter, n.page ? `pagina ${n.page}` : null].filter(Boolean).join(' · '),
      text: n.text,
      secondary: n.quote ? `“${n.quote}”` : null,
      date: n.updatedAt,
    })),
  };

  const remove = (item: Item) => {
    const label = { bookmarks: 'il segnalibro', highlights: "l'evidenziazione", notes: 'la nota' }[item.kind];
    showAlert('Eliminare?', `Vuoi eliminare ${label}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.kind === 'bookmarks') await services.bookmarks.delete(item.id);
            if (item.kind === 'highlights') await services.highlights.delete(item.id);
            if (item.kind === 'notes') await services.notes.delete(item.id);
            dataEvents.emit('annotations');
          } catch (e) {
            showAlert('Errore', toUserMessage(e));
          }
        },
      },
    ]);
  };

  const onLongPress = (item: Item) => {
    if (item.kind === 'notes') {
      const note = data.notes.find((n) => n.id === item.id);
      if (note) showNoteActions(note, services, openNoteEditor);
    } else {
      remove(item);
    }
  };

  const emptyState = {
    bookmarks: <EmptyState icon="bookmark-outline" title="Nessun segnalibro" message="Mentre leggi, tocca 🔖 per salvare la pagina." />,
    highlights: <EmptyState icon="color-wand-outline" title="Nessuna evidenziazione" message="Seleziona un passaggio nel lettore e scegli un colore." />,
    notes: <EmptyState icon="document-text-outline" title="Nessuna nota" message="Seleziona del testo e tocca “Nota”, oppure aggiungi una nota alla pagina." />,
  }[tab];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bookmarks', label: `🔖 Segnalibri` },
            { value: 'highlights', label: `🖍️ Evidenziazioni` },
            { value: 'notes', label: `📝 Note` },
          ]}
        />
      </View>
      <FlatList
        data={items[tab]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openAt(item.bookId, item.location)}
            onLongPress={() => onLongPress(item)}
            accessibilityRole="button"
            accessibilityHint="Apre il libro in questo punto. Tieni premuto per altre azioni."
            style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            {item.color ? <View style={[styles.colorBar, { backgroundColor: item.color }]} /> : null}
            <View style={styles.flex}>
              <ThemedText variant="caption" tone="primary" weight="700" numberOfLines={1}>
                {item.bookTitle}
              </ThemedText>
              {item.meta ? (
                <ThemedText variant="caption" tone="secondary" numberOfLines={1}>
                  {item.meta}
                </ThemedText>
              ) : null}
              {item.text ? <ThemedText numberOfLines={4}>{item.text}</ThemedText> : null}
              {item.secondary ? (
                <ThemedText variant="caption" tone="secondary" numberOfLines={3} style={styles.secondary}>
                  {item.secondary}
                </ThemedText>
              ) : null}
              <ThemedText variant="caption" tone="muted">
                {formatDate(item.date)}
              </ThemedText>
            </View>
            <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Elimina">
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}
      />
      {noteEditorElement}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  tabs: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  list: { padding: SPACING.lg, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: SPACING.sm },
  colorBar: { width: 4, borderRadius: 2 },
  secondary: { fontStyle: 'italic' },
});
