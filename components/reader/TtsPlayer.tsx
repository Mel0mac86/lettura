import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReaderChromePalette } from '@/components/ReaderControls';
import type { TtsState } from '@/services/tts/TextToSpeech';

interface Props {
  state: TtsState;
  /** The voice is preparing the audio (first use of the natural voice can take a few seconds). */
  buffering?: boolean;
  palette: ReaderChromePalette;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
  rate: number;
  onChangeRate: (rate: number) => void;
}

const RATES = [0.8, 1, 1.2, 1.5, 1.8];

/** "🔊 Leggi ad alta voce" controls: ⏪ -15s, ▶/⏸, ⏹, ⏩ +15s. */
export function TtsPlayer({ state, buffering, palette, onPlay, onPause, onStop, onSeek, onClose, rate, onChangeRate }: Props) {
  const color = palette.text;
  const button = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, size = 26) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.button}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.secondaryText + '44' }]}>
      <Text style={[styles.label, { color: palette.secondaryText }]}>
        {buffering && state === 'playing' ? '⏳ Preparo la voce…' : '🔊 Leggi ad alta voce'}
      </Text>
      <View style={styles.row}>
        {button('play-back', 'Indietro di 15 secondi', () => onSeek(-15))}
        {state === 'playing' ? button('pause-circle', 'Pausa', onPause, 44) : button('play-circle', 'Riproduci', onPlay, 44)}
        {button('stop-circle-outline', 'Stop', onStop)}
        {button('play-forward', 'Avanti di 15 secondi', () => onSeek(15))}
        <Pressable
          onPress={() => onChangeRate(RATES.find((r) => r > rate + 0.01) ?? RATES[0])}
          accessibilityRole="button"
          accessibilityLabel={`Velocità ${rate.toFixed(1)}, tocca per cambiare`}
          hitSlop={6}
          style={[styles.rate, { borderColor: palette.secondaryText }]}
        >
          <Text style={[styles.rateLabel, { color }]}>{rate.toFixed(1)}×</Text>
        </Pressable>
        {button('close', 'Chiudi lettura ad alta voce', onClose, 22)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  label: { fontSize: 11, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  button: { padding: 4 },
  rate: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  rateLabel: { fontSize: 13, fontWeight: '600' },
});
