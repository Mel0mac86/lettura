import { Pressable, StyleSheet } from 'react-native';

import { RADIUS } from '@/constants/theme';
import { useAppTheme } from '@/providers/SettingsProvider';

import { ThemedText } from './ThemedText';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function Chip({ label, selected, onPress, onLongPress }: Props) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText variant="caption" weight="600" style={{ color: selected ? colors.onPrimary : colors.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1 },
});
