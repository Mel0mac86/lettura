import { StyleSheet, View } from 'react-native';

import { RADIUS } from '@/constants/theme';
import { useAppTheme } from '@/providers/SettingsProvider';

import { ThemedText } from './ui/ThemedText';

interface Props {
  emoji: string;
  value: string | number;
  label: string;
}

export function StatTile({ emoji, value, label }: Props) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText variant="title">{value}</ThemedText>
      <ThemedText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: RADIUS.md, borderWidth: 1, gap: 2 },
  emoji: { fontSize: 18 },
});
