import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookGrid } from '@/components/BookGrid';
import { ImportOverlay } from '@/components/ImportOverlay';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { ThemedText } from '@/components/ui/ThemedText';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useImportBook } from '@/hooks/useImportBook';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme, useSettings } from '@/providers/SettingsProvider';
import type { BookFilter, BookSort } from '@/services/books/BookRepository';
import type { Book } from '@/types/models';
import { showAlert } from '@/utils/dialogs';

const FILTERS: { value: BookFilter; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'reading', label: '📖 In lettura' },
  { value: 'not_started', label: 'Non iniziati' },
  { value: 'completed', label: '✅ Completati' },
  { value: 'favorites', label: '⭐ Preferiti' },
];

const SORTS: { value: BookSort; label: string }[] = [
  { value: 'recent', label: 'Letti di recente' },
  { value: 'added', label: 'Aggiunti di recente' },
  { value: 'title', label: 'Titolo' },
  { value: 'author', label: 'Autore' },
  { value: 'progress', label: 'Avanzamento' },
];

/** "I miei libri": the whole library with search, filters, categories, sorting and grid/list view. */
export default function LibraryScreen() {
  const services = useServices();
  const { colors } = useAppTheme();
  const { settings, updateSettings } = useSettings();
  const { pickAndImport, stepLabel } = useImportBook();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BookFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<BookSort>('recent');
  const debouncedQuery = useDebouncedValue(query, 200);

  const load = useCallback(async () => {
    const [books, categories] = await Promise.all([
      services.books.list({ filter, sort, categoryId, query: debouncedQuery }),
      services.categories.list(),
    ]);
    return { books, categories };
  }, [services, filter, sort, categoryId, debouncedQuery]);
  const { data, loading, error, reload } = useAsyncData(load, ['books', 'categories']);

  const chooseSort = () => {
    const labels = SORTS.map((s) => (s.value === sort ? `✓ ${s.label}` : s.label));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...labels, 'Annulla'], cancelButtonIndex: labels.length, title: 'Ordina per' }, (i) => {
        if (i < SORTS.length) setSort(SORTS[i].value);
      });
    } else {
      showAlert('Ordina per', undefined, [
        ...SORTS.map((s, i) => ({ text: labels[i], onPress: () => setSort(s.value) })),
        { text: 'Annulla', style: 'cancel' as const },
      ]);
    }
  };

  const openBook = (book: Book) => router.push(`/reader/${book.id}`);
  const openDetails = (book: Book) => router.push(`/book/${book.id}`);
  const isFiltered = filter !== 'all' || !!categoryId || !!debouncedQuery;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <ThemedText variant="display" style={styles.flex}>
          I miei libri
        </ThemedText>
        <IconButton icon="swap-vertical" onPress={chooseSort} accessibilityLabel="Ordina" />
        <IconButton
          icon={settings.libraryView === 'grid' ? 'list' : 'grid-outline'}
          onPress={() => updateSettings({ libraryView: settings.libraryView === 'grid' ? 'list' : 'grid' })}
          accessibilityLabel={settings.libraryView === 'grid' ? 'Visualizza come lista' : 'Visualizza come griglia'}
        />
      </View>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Cerca per titolo, autore o tag…" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value && !categoryId} onPress={() => { setFilter(f.value); setCategoryId(null); }} />
        ))}
        {(data?.categories ?? []).map((c) => (
          <Chip
            key={c.id}
            label={`${c.icon ?? '🏷️'} ${c.name}`}
            selected={categoryId === c.id}
            onPress={() => {
              setCategoryId(categoryId === c.id ? null : c.id);
              setFilter('all');
            }}
          />
        ))}
        <Chip label="＋ Categoria" onPress={() => router.push('/categories')} />
      </ScrollView>
      <Button label="Aggiungi libro" icon="add" onPress={pickAndImport} />
    </View>
  );

  let content;
  if (loading && !data) content = <LoadingState />;
  else if (error && !data) content = <ErrorState message={error} onRetry={reload} />;
  else
    content = (
      <BookGrid
        books={data?.books ?? []}
        mode={settings.libraryView}
        onOpen={openBook}
        onDetails={openDetails}
        header={header}
        empty={
          isFiltered ? (
            <EmptyState icon="funnel-outline" title="Nessun libro trovato" message="Prova a cambiare filtro o ricerca." />
          ) : (
            <EmptyState icon="library-outline" title="Nessun libro" message="Tocca “Aggiungi libro” per importare EPUB, PDF o TXT dal tuo dispositivo." />
          )
        }
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      {content}
      <ImportOverlay label={stepLabel} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  chips: { gap: SPACING.sm, paddingVertical: 2 },
});
