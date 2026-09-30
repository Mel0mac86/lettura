import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { ThemedText } from '@/components/ui/ThemedText';
import { FONT_OPTIONS, RADIUS, READER_PALETTES } from '@/constants/theme';
import { useAppTheme, useSettings } from '@/providers/SettingsProvider';
import { READER_LIMITS } from '@/services/settings/defaults';
import type { ReaderFontFamily, ReaderPreferences, ReaderThemeName } from '@/types/reader';

type NumericKey = keyof typeof READER_LIMITS;

const STEPPERS: { key: NumericKey; label: string; format: (v: number) => string }[] = [
  { key: 'fontSize', label: 'Dimensione carattere', format: (v) => `${v}px` },
  { key: 'lineHeight', label: 'Spaziatura righe', format: (v) => v.toFixed(1) },
  { key: 'margin', label: 'Margini', format: (v) => `${v}px` },
  { key: 'maxTextWidth', label: 'Larghezza testo', format: (v) => `${v}px` },
];

/**
 * Reading preferences: theme (Light/Sepia/Dark/Night), font, size, spacing,
 * margins, text width and justification. Used by the reader "Aa" sheet and by
 * the Settings screen. `typography=false` shows only the theme (PDF).
 */
export function ReaderPreferenceControls({ typography = true }: { typography?: boolean }) {
  const { settings, updateReader } = useSettings();
  const { colors } = useAppTheme();
  const prefs = settings.reader;

  const step = (key: NumericKey, direction: 1 | -1) => {
    const limits = READER_LIMITS[key];
    const next = Math.min(limits.max, Math.max(limits.min, prefs[key] + direction * limits.step));
    updateReader({ [key]: Number(next.toFixed(1)) } as Partial<ReaderPreferences>);
  };

  return (
    <View>
      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Tema di lettura
      </ThemedText>
      <View style={styles.themes}>
        {(Object.keys(READER_PALETTES) as ReaderThemeName[]).map((name) => {
          const palette = READER_PALETTES[name];
          const selected = prefs.theme === name;
          return (
            <Pressable
              key={name}
              onPress={() => updateReader({ theme: name })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Tema ${palette.label}`}
              style={[
                styles.theme,
                { backgroundColor: palette.background, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 },
              ]}
            >
              <Text style={[styles.themeSample, { color: palette.text }]}>Aa</Text>
              <Text style={[styles.themeLabel, { color: palette.text }]}>{palette.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {typography ? (
        <>
          <ThemedText variant="label" tone="secondary" style={styles.section}>
            Carattere
          </ThemedText>
          <View style={styles.fonts}>
            {(Object.keys(FONT_OPTIONS) as ReaderFontFamily[]).map((font) => {
              const selected = prefs.fontFamily === font;
              return (
                <Pressable
                  key={font}
                  onPress={() => updateReader({ fontFamily: font })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.font,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface },
                  ]}
                >
                  <ThemedText weight={selected ? '700' : '400'}>{FONT_OPTIONS[font].label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          {STEPPERS.map(({ key, label, format }) => (
            <View style={styles.row} key={key}>
              <ThemedText style={styles.rowLabel}>{label}</ThemedText>
              <IconButton
                icon="remove-circle-outline"
                onPress={() => step(key, -1)}
                disabled={prefs[key] <= READER_LIMITS[key].min}
                accessibilityLabel={`Riduci ${label.toLowerCase()}`}
              />
              <ThemedText weight="600" style={styles.value}>
                {format(prefs[key])}
              </ThemedText>
              <IconButton
                icon="add-circle-outline"
                onPress={() => step(key, 1)}
                disabled={prefs[key] >= READER_LIMITS[key].max}
                accessibilityLabel={`Aumenta ${label.toLowerCase()}`}
              />
            </View>
          ))}
          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>Giustifica testo</ThemedText>
            <Switch value={prefs.justify} onValueChange={(justify) => updateReader({ justify })} accessibilityLabel="Giustifica testo" />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12, marginBottom: 8 },
  themes: { flexDirection: 'row', gap: 8 },
  theme: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.md },
  themeSample: { fontSize: 20, fontFamily: 'Georgia' },
  themeLabel: { fontSize: 11, marginTop: 2 },
  fonts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  font: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rowLabel: { flex: 1 },
  value: { minWidth: 56, textAlign: 'center' },
});
