import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAppTheme } from '@/providers/SettingsProvider';
import type { Bookmark, Highlight, Note } from '@/types/models';
import { formatDate } from '@/utils/dates';

type Tab = 'bookmarks' | 'highlights' | 'notes';

interface Props {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
  onOpenLocation: (location: string) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onEditHighlight: (highlight: Highlight) => void;
  onEditNote: (note: Note) => void;
  onAddNote: () => void;
}

/** Bookmarks, highlights and notes of the open book. */
export function BookAnnotationsSheet(props: Props) {
  const { visible, onClose, bookmarks, highlights, notes, onOpenLocation } = props;
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('bookmarks');

  const go = (location: string | null) => {
    if (!location) return;
    onOpenLocation(location);
    onClose();
  };

  const rowStyle = ({ pressed }: { pressed: boolean }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }];

  return (
    <Sheet visible={visible} title="Annotazioni" onClose={onClose} fullHeight>
      <View style={styles.tabs}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bookmarks', label: `Segnalibri (${bookmarks.length})` },
            { value: 'highlights', label: `Evidenz. (${highlights.length})` },
            { value: 'notes', label: `Note (${notes.length})` },
          ]}
        />
      </View>
      {tab === 'bookmarks' ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => b.id}
          ListEmptyComponent={<EmptyState icon="bookmark-outline" title="Nessun segnalibro" message="Tocca 🔖 in alto per salvare la pagina corrente." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => go(item.location)} style={rowStyle} accessibilityRole="button">
              <View style={styles.flex}>
                <ThemedText variant="caption" tone="primary" weight="600">
                  {[item.chapter, item.page ? `pag. ${item.page}` : null].filter(Boolean).join(' · ')}
                </ThemedText>
                {item.text ? (
                  <ThemedText variant="caption" numberOfLines={2}>
                    {item.text}
                  </ThemedText>
                ) : null}
                <ThemedText variant="caption" tone="muted">
                  {formatDate(item.createdAt)}
                </ThemedText>
              </View>
              <Pressable onPress={() => props.onDeleteBookmark(item)} hitSlop={10} accessibilityLabel="Elimina segnalibro" accessibilityRole="button">
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : null}
      {tab === 'highlights' ? (
        <FlatList
          data={highlights}
          keyExtractor={(h) => h.id}
          ListEmptyComponent={<EmptyState icon="color-wand-outline" title="Nessuna evidenziazione" message="Seleziona del testo per evidenziarlo." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => go(item.location)} onLongPress={() => props.onEditHighlight(item)} style={rowStyle} accessibilityRole="button">
              <View style={[styles.colorBar, { backgroundColor: item.color }]} />
              <View style={styles.flex}>
                <ThemedText variant="caption" numberOfLines={3}>
                  {item.text}
                </ThemedText>
                {item.note ? (
                  <ThemedText variant="caption" tone="secondary" numberOfLines={2}>
                    📝 {item.note}
                  </ThemedText>
                ) : null}
                <ThemedText variant="caption" tone="muted">
                  {[item.chapter, formatDate(item.createdAt)].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <Pressable onPress={() => props.onEditHighlight(item)} hitSlop={10} accessibilityLabel="Modifica evidenziazione" accessibilityRole="button">
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : null}
      {tab === 'notes' ? (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          ListHeaderComponent={
            <Pressable onPress={props.onAddNote} style={rowStyle} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <ThemedText tone="primary" weight="600">
                Nuova nota su questa pagina
              </ThemedText>
            </Pressable>
          }
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nessuna nota" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => go(item.location)} onLongPress={() => props.onEditNote(item)} style={rowStyle} accessibilityRole="button">
              <View style={styles.flex}>
                {item.quote ? (
                  <ThemedText variant="caption" tone="secondary" numberOfLines={2} style={styles.quote}>
                    “{item.quote}”
                  </ThemedText>
                ) : null}
                <ThemedText variant="caption" numberOfLines={4}>
                  {item.text}
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {[item.chapter, item.page ? `pag. ${item.page}` : null, formatDate(item.updatedAt)].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <Pressable onPress={() => props.onEditNote(item)} hitSlop={10} accessibilityLabel="Modifica nota" accessibilityRole="button">
                <Ionicons name="create-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  tabs: { marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  colorBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  quote: { fontStyle: 'italic' },
});
