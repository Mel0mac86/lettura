import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReaderChromePalette } from '@/components/ReaderControls';
import { HIGHLIGHT_COLORS } from '@/services/annotations/types';

interface Props {
  palette: ReaderChromePalette;
  onHighlight: (color: string) => void;
  onCopy: () => void;
  onNote: () => void;
  onDismiss: () => void;
  /** True when the reader bottom bar is visible: the toolbar is shown above it. */
  raised?: boolean;
}

/** Actions for the selected text: highlight (with color), copy, add note. */
export function SelectionToolbar({ palette, onHighlight, onCopy, onNote, onDismiss, raised }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.toolbar,
        { bottom: insets.bottom + (raised ? 150 : 44), backgroundColor: palette.isDark ? '#2A2A2C' : '#FFFFFF', borderColor: palette.secondaryText + '44' },
      ]}
      accessibilityLabel="Azioni sul testo selezionato"
    >
      <View style={styles.colors}>
        {HIGHLIGHT_COLORS.map((color) => (
          <Pressable
            key={color.value}
            onPress={() => onHighlight(color.value)}
            accessibilityRole="button"
            accessibilityLabel={`Evidenzia in ${color.name.toLowerCase()}`}
            style={[styles.swatch, { backgroundColor: color.value }]}
          />
        ))}
      </View>
      <View style={[styles.divider, { backgroundColor: palette.secondaryText + '44' }]} />
      <Action icon="copy-outline" label="Copia" onPress={onCopy} palette={palette} />
      <Action icon="create-outline" label="Nota" onPress={onNote} palette={palette} />
      <Action icon="close" label="Chiudi" onPress={onDismiss} palette={palette} />
    </View>
  );
}

function Action({ icon, label, onPress, palette }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; palette: ReaderChromePalette }) {
  const color = palette.isDark ? '#EEE' : '#222';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.action} hitSlop={4}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  colors: { flexDirection: 'row', gap: 8 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  divider: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 4 },
  action: { alignItems: 'center', paddingHorizontal: 6 },
  actionLabel: { fontSize: 10, marginTop: 2 },
});
