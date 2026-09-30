import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/SettingsProvider';

import { Button } from './Button';
import { ThemedText } from './ThemedText';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Qualcosa è andato storto', message, onRetry }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
      <ThemedText variant="subtitle" style={styles.text}>
        {title}
      </ThemedText>
      <ThemedText tone="secondary" style={styles.text}>
        {message}
      </ThemedText>
      {onRetry ? <Button label="Riprova" icon="refresh" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  text: { textAlign: 'center' },
});
