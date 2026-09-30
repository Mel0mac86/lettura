import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { RADIUS } from '@/constants/theme';
import { useAppTheme } from '@/providers/SettingsProvider';

import { ThemedText } from './ThemedText';

interface Props extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, multiline, ...rest }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText variant="caption" tone="secondary" weight="600">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
});
