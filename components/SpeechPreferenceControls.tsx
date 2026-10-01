import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { NaturalVoiceSection } from '@/components/NaturalVoiceSection';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ThemedText } from '@/components/ui/ThemedText';
import { useVoices } from '@/hooks/useVoices';
import { useAppTheme, useSettings } from '@/providers/SettingsProvider';
import { SPEECH_RATE_LIMITS } from '@/services/settings/defaults';
import { previewVoice } from '@/services/tts/expoSpeechEngine';
import { voicesForLanguage, type VoiceInfo } from '@/services/tts/voices';

const LANGUAGES = [
  { tag: 'it-IT', label: '🇮🇹 Italiano' },
  { tag: 'en-US', label: '🇬🇧 English' },
  { tag: 'fr-FR', label: '🇫🇷 Français' },
  { tag: 'es-ES', label: '🇪🇸 Español' },
  { tag: 'de-DE', label: '🇩🇪 Deutsch' },
];

/**
 * "Lettura ad alta voce" settings: speed and voice, with a ▶ button to try
 * each voice. The chosen voice is used for books in its language; books in
 * other languages automatically get the best voice for their language.
 */
export function SpeechPreferenceControls() {
  const { settings, updateSpeech } = useSettings();
  const { colors } = useAppTheme();
  const voices = useVoices();
  const [language, setLanguage] = useState('it-IT');
  const { rate, voice } = settings.speech;

  const setRate = (direction: 1 | -1) => {
    const next = Math.min(SPEECH_RATE_LIMITS.max, Math.max(SPEECH_RATE_LIMITS.min, rate + direction * SPEECH_RATE_LIMITS.step));
    updateSpeech({ rate: Number(next.toFixed(1)) });
  };

  const list = voices ? voicesForLanguage(voices, language) : [];

  const row = (item: VoiceInfo | null) => {
    const selected = item ? voice === item.identifier : voice === null;
    return (
      <Pressable
        key={item?.identifier ?? 'auto'}
        onPress={() => updateSpeech({ voice: item?.identifier ?? null })}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={[styles.voice, { borderColor: colors.border }]}
      >
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
        <View style={styles.flex}>
          <ThemedText weight={selected ? '700' : '400'}>{item ? item.name : 'Automatica (consigliata)'}</ThemedText>
          <ThemedText variant="caption" tone="secondary">
            {item ? `${item.language}${item.enhanced ? ' · ⭐ qualità migliorata' : ''}` : 'Sceglie la voce migliore per la lingua del libro'}
          </ThemedText>
        </View>
        {item ? <IconButton icon="play-circle-outline" onPress={() => previewVoice(item, rate)} accessibilityLabel={`Prova la voce ${item.name}`} /> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <NaturalVoiceSection />
      <View style={styles.rateRow}>
        <ThemedText style={styles.flex}>Velocità</ThemedText>
        <IconButton icon="remove-circle-outline" onPress={() => setRate(-1)} disabled={rate <= SPEECH_RATE_LIMITS.min} accessibilityLabel="Più lenta" />
        <ThemedText weight="600" style={styles.value}>
          {rate.toFixed(1)}×
        </ThemedText>
        <IconButton icon="add-circle-outline" onPress={() => setRate(1)} disabled={rate >= SPEECH_RATE_LIMITS.max} accessibilityLabel="Più veloce" />
      </View>

      <ThemedText variant="caption" tone="secondary" style={styles.section}>
        Voce
      </ThemedText>
      <View style={styles.chips}>
        {LANGUAGES.map((l) => (
          <Chip key={l.tag} label={l.label} selected={language === l.tag} onPress={() => setLanguage(l.tag)} />
        ))}
      </View>
      {row(null)}
      {voices === null ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : list.length === 0 ? (
        <ThemedText variant="caption" tone="secondary" style={styles.hint}>
          Nessuna voce installata per questa lingua.
        </ThemedText>
      ) : (
        list.map(row)
      )}
      <ThemedText variant="caption" tone="muted" style={styles.hint}>
        💡 Per voci più naturali scaricale sull’iPhone: apri Impostazioni, scrivi “Voci” nella ricerca in alto, scegli la lingua e scarica una voce “Migliorata” o “Premium”. Poi riapri questa app.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rateRow: { flexDirection: 'row', alignItems: 'center' },
  value: { minWidth: 56, textAlign: 'center' },
  section: { marginTop: 10, marginBottom: 8, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  loading: { marginVertical: 12 },
  hint: { marginTop: 10 },
});
