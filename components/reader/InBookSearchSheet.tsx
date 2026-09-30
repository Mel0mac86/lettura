import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAppTheme } from '@/providers/SettingsProvider';

export interface InBookResult {
  key: string;
  location: string;
  snippet: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Runs the search; results can also be pushed later through `results`. */
  onSearch: (query: string) => void;
  onSelect: (result: InBookResult) => void;
  results: InBookResult[];
  searching: boolean;
}

/** Full-text search inside the open book. */
export function InBookSearchSheet({ visible, onClose, onSearch, onSelect, results, searching }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 350);

  useEffect(() => {
    if (visible) onSearch(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, visible]);

  return (
    <Sheet visible={visible} title="Cerca nel libro" onClose={onClose} fullHeight>
      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Cerca una parola o una frase…" autoFocus />
      </View>
      {searching ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
      <FlatList
        data={results}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          results.length > 0 ? (
            <ThemedText variant="caption" tone="muted" style={styles.count}>
              {results.length} risultati
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          !searching && debounced.trim().length >= 2 ? (
            <EmptyState icon="search-outline" title="Nessun risultato" message={`Nessuna occorrenza di “${debounced.trim()}”.`} />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item);
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <ThemedText variant="caption" tone="primary" weight="600">
              {item.location}
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={3}>
              {item.snippet}
            </ThemedText>
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { marginVertical: 8 },
  spinner: { marginVertical: 8 },
  count: { marginBottom: 4 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
});
