import { FlatList, Pressable, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAppTheme } from '@/providers/SettingsProvider';

export interface TocEntry {
  key: string;
  title: string;
  depth: number;
  active: boolean;
}

interface Props {
  visible: boolean;
  entries: TocEntry[];
  onSelect: (entry: TocEntry) => void;
  onClose: () => void;
}

export function TocSheet({ visible, entries, onSelect, onClose }: Props) {
  const { colors } = useAppTheme();
  const activeIndex = Math.max(0, entries.findIndex((e) => e.active));
  return (
    <Sheet visible={visible} title="Indice" onClose={onClose} fullHeight>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.key}
        initialScrollIndex={entries.length > 0 && activeIndex < entries.length ? activeIndex : undefined}
        getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
        ListEmptyComponent={<EmptyState icon="list-outline" title="Indice non disponibile" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item);
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              { paddingLeft: 8 + item.depth * 18, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              item.active && { backgroundColor: colors.primarySoft },
            ]}
          >
            <ThemedText numberOfLines={1} weight={item.active ? '700' : '400'} tone={item.active ? 'primary' : 'default'}>
              {item.title}
            </ThemedText>
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { height: 48, justifyContent: 'center', paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 6 },
});
