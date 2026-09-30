import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReaderPreferenceControls } from '@/components/ReaderPreferenceControls';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemedText } from '@/components/ui/ThemedText';
import { READER_PALETTES, RADIUS, SPACING } from '@/constants/theme';
import { useAppTheme, useSettings } from '@/providers/SettingsProvider';
import { isCloudConfigured } from '@/services/sync/config';
import type { AppThemePreference } from '@/types/reader';

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { colors } = useAppTheme();
  const prefs = settings.reader;
  const palette = READER_PALETTES[prefs.theme];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Aspetto dell’app
      </ThemedText>
      <SegmentedControl<AppThemePreference>
        value={settings.appTheme}
        onChange={(appTheme) => updateSettings({ appTheme })}
        options={[
          { value: 'system', label: 'Sistema' },
          { value: 'light', label: '☀️ Chiaro' },
          { value: 'dark', label: '🌙 Scuro' },
        ]}
      />

      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Modalità di lettura
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ReaderPreferenceControls />
      </View>

      <View style={[styles.preview, { backgroundColor: palette.background, borderColor: colors.border }]} accessibilityLabel="Anteprima del testo">
        <Text style={{ color: palette.secondaryText, fontSize: 11, marginBottom: 6 }}>CAPITOLO 5</Text>
        <Text
          style={{
            color: palette.text,
            fontSize: prefs.fontSize * 0.85,
            lineHeight: prefs.fontSize * 0.85 * prefs.lineHeight,
            fontFamily: prefs.fontFamily === 'mono' ? 'Courier' : prefs.fontFamily === 'sans' ? undefined : 'Georgia',
          }}
        >
          Piccoli cambiamenti fanno una grande differenza. Questo è un esempio di come apparirà il testo nel lettore.
        </Text>
      </View>

      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Libreria
      </ThemedText>
      <SegmentedControl
        value={settings.libraryView}
        onChange={(libraryView) => updateSettings({ libraryView })}
        options={[
          { value: 'grid', label: 'Griglia' },
          { value: 'list', label: 'Lista' },
        ]}
      />
      <Pressable onPress={() => router.push('/categories')} style={[styles.link, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="button">
        <ThemedText style={styles.flex}>🏷️ Gestisci categorie</ThemedText>
        <ThemedText tone="muted">›</ThemedText>
      </Pressable>

      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Account e sincronizzazione
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText weight="600">☁️ Backup e sincronizzazione cloud</ThemedText>
        <ThemedText variant="caption" tone="secondary">
          {isCloudConfigured()
            ? 'Configurazione Supabase rilevata. La sincronizzazione sarà disponibile nella versione 2.'
            : 'In arrivo nella versione 2. Oggi tutti i libri e i dati restano solo su questo dispositivo.'}
        </ThemedText>
      </View>

      <ThemedText variant="label" tone="secondary" style={styles.section}>
        Privacy
      </ThemedText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="caption" tone="secondary">
          🔒 I tuoi libri, le note e le evidenziazioni sono salvati solo nello spazio privato dell’app su questo dispositivo. Nessun file viene inviato a server esterni. My Book Reader non apre libri protetti da DRM.
        </ThemedText>
      </View>

      <ThemedText variant="caption" tone="muted" style={styles.version}>
        My Book Reader v{Constants.expoConfig?.version ?? '1.0.0'}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 64 },
  section: { marginTop: SPACING.xl, marginBottom: SPACING.sm },
  card: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: SPACING.md, marginTop: SPACING.md, gap: 6 },
  preview: { marginTop: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  link: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, marginTop: SPACING.md },
  version: { textAlign: 'center', marginTop: SPACING.xl },
});
