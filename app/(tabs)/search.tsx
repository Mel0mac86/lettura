import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCard } from '@/components/BookCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ThemedText } from '@/components/ui/ThemedText';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme } from '@/providers/SettingsProvider';
import { MIN_QUERY_LENGTH, type ContentHit, type GlobalSearchResults } from '@/services/search/SearchService';
import type { Book } from '@/types/models';
import { pdfLocation, reflowRange, serializeLocation } from '@/utils/location';

type Row =
  | { kind: 'book'; key: string; book: Book }
  | { kind: 'content'; key: string; hit: ContentHit }
  | { kind: 'annotation'; key: string; title: string; text: string; subtitle: string; bookId: string; location: string | null };

function openAt(bookId: string, location: string | null) {
  router.push({ pathname: '/reader/[id]', params: location ? { id: bookId, location } : { id: bookId } });
}

function contentLocation(hit: ContentHit): string {
  return serializeLocation(
    hit.bookFormat === 'pdf' && hit.page
      ? pdfLocation(hit.page)
      : reflowRange(hit.sectionIndex, hit.offset, hit.offset + hit.length),
  );
}

function toSections(results: GlobalSearchResults) {
  const sections: { title: string; data: Row[] }[] = [];
  if (results.books.length) sections.push({ title: `Libri (${results.books.length})`, data: results.books.map((book) => ({ kind: 'book', key: `b-${book.id}`, book })) });
  if (results.content.length)
    sections.push({ title: `Nel testo (${results.content.length})`, data: results.content.map((hit, i) => ({ kind: 'content', key: `c-${i}`, hit })) });
  if (results.notes.length)
    sections.push({
      title: `Note (${results.notes.length})`,
      data: results.notes.map((n) => ({ kind: 'annotation', key: `n-${n.id}`, title: n.bookTitle, text: n.text, subtitle: n.quote ? `“${n.quote}”` : '', bookId: n.bookId, location: n.location })),
    });
  if (results.highlights.length)
    sections.push({
      title: `Evidenziazioni (${results.highlights.length})`,
      data: results.highlights.map((h) => ({ kind: 'annotation', key: `h-${h.id}`, title: h.bookTitle, text: h.text, subtitle: h.note ? `📝 ${h.note}` : '', bookId: h.bookId, location: h.location })),
    });
  return sections;
}

/** Global search: titles, authors, full text, notes and highlights. */
export default function SearchScreen() {
  const services = useServices();
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);

  const load = useCallback(() => services.search.search(debounced), [services, debounced]);
  const { data, loading, error, reload } = useAsyncData(load, ['books', 'annotations']);
  const tooShort = debounced.trim().length < MIN_QUERY_LENGTH;
  const sections = data && !tooShort ? toSections(data) : [];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <ThemedText variant="display">Cerca</ThemedText>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Titolo, autore, testo, note…" />
      </View>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={loading && !tooShort ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
          ListEmptyComponent={
            tooShort ? (
              <EmptyState icon="search-outline" title="Cerca nella tua libreria" message="Trova libri per titolo o autore, frasi nel testo, note ed evidenziazioni." />
            ) : !loading ? (
              <EmptyState icon="sad-outline" title="Nessun risultato" message={`Nessun risultato per “${debounced.trim()}”.`} />
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <ThemedText variant="label" tone="secondary" style={styles.sectionHeader}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item }) => {
            if (item.kind === 'book') {
              return <BookCard book={item.book} variant="list" onOpen={(b) => openAt(b.id, null)} onDetails={(b) => router.push(`/book/${b.id}`)} />;
            }
            const title = item.kind === 'content' ? item.hit.bookTitle : item.title;
            const subtitle =
              item.kind === 'content'
                ? [item.hit.sectionTitle, item.hit.matchesInSection > 1 ? `${item.hit.matchesInSection} occorrenze` : null].filter(Boolean).join(' · ')
                : item.subtitle;
            const text = item.kind === 'content' ? item.hit.snippet : item.text;
            return (
              <Pressable
                onPress={() => (item.kind === 'content' ? openAt(item.hit.bookId, contentLocation(item.hit)) : openAt(item.bookId, item.location))}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
              >
                <ThemedText variant="caption" tone="primary" weight="600" numberOfLines={1}>
                  {title}
                </ThemedText>
                <ThemedText numberOfLines={3}>{text}</ThemedText>
                {subtitle ? (
                  <ThemedText variant="caption" tone="muted" numberOfLines={2}>
                    {subtitle}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: SPACING.lg, paddingBottom: SPACING.sm, gap: SPACING.md },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 48 },
  spinner: { marginVertical: 12 },
  sectionHeader: { marginTop: SPACING.lg, marginBottom: SPACING.sm },
  row: { padding: SPACING.md, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: SPACING.sm, gap: 3 },
});
