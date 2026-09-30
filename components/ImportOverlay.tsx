import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { RADIUS } from '@/constants/theme';
import { useAppTheme } from '@/providers/SettingsProvider';

import { ThemedText } from './ui/ThemedText';

/** Blocking progress indicator shown while a book is being imported. */
export function ImportOverlay({ label }: { label: string | null }) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={label !== null} transparent animationType="fade">
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText weight="600">Importazione in corso</ThemedText>
          <ThemedText variant="caption" tone="secondary">
            {label}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 24, borderRadius: RADIUS.lg, alignItems: 'center', gap: 10, minWidth: 240 },
});
