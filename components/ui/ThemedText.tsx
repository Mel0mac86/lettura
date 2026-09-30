import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/providers/SettingsProvider';

export type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';
export type TextTone = 'default' | 'secondary' | 'muted' | 'primary' | 'danger' | 'inverse';

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: '400' | '500' | '600' | '700';
}

export function ThemedText({ variant = 'body', tone = 'default', weight, style, ...rest }: Props) {
  const { colors } = useAppTheme();
  const color = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    danger: colors.danger,
    inverse: colors.onPrimary,
  }[tone];
  return <Text style={[styles[variant], { color }, weight ? { fontWeight: weight } : null, style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});
