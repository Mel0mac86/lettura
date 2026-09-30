import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/SettingsProvider';

import { ThemedText } from './ThemedText';

export function LoadingState({ message }: { message?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <ThemedText tone="secondary" style={styles.message}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { marginTop: 12, textAlign: 'center' },
});
