import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReaderChromePalette } from '@/components/ReaderControls';
import type { TtsState } from '@/services/tts/TextToSpeech';

interface Props {
  state: TtsState;
  palette: ReaderChromePalette;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

/** "🔊 Leggi ad alta voce" controls: ⏪ -15s, ▶/⏸, ⏹, ⏩ +15s. */
export function TtsPlayer({ state, palette, onPlay, onPause, onStop, onSeek, onClose }: Props) {
  const color = palette.text;
  const button = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, size = 26) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.button}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.secondaryText + '44' }]}>
      <Text style={[styles.label, { color: palette.secondaryText }]}>🔊 Leggi ad alta voce</Text>
      <View style={styles.row}>
        {button('play-back', 'Indietro di 15 secondi', () => onSeek(-15))}
        {state === 'playing' ? button('pause-circle', 'Pausa', onPause, 44) : button('play-circle', 'Riproduci', onPlay, 44)}
        {button('stop-circle-outline', 'Stop', onStop)}
        {button('play-forward', 'Avanti di 15 secondi', () => onSeek(15))}
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
});
