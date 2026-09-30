import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAppTheme } from '@/providers/SettingsProvider';

interface Props {
  visible: boolean;
  title?: string;
  quote?: string | null;
  /** Initial text. Remount the component (`key`) to edit another note. */
  initialText?: string;
  onSave: (text: string) => void | Promise<void>;
  onClose: () => void;
}

/** Modal to write or edit a personal note, optionally attached to a quoted passage. */
export function NoteEditor({ visible, title = 'Nota', quote, initialText = '', onSave, onClose }: Props) {
  const { colors } = useAppTheme();
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(text.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.body}>
        {quote ? (
          <View style={[styles.quote, { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
            <ThemedText variant="caption" tone="secondary" numberOfLines={6} style={styles.quoteText}>
              “{quote}”
            </ThemedText>
          </View>
        ) : null}
        <TextField
          value={text}
          onChangeText={setText}
          placeholder="Scrivi la tua nota…"
          multiline
          autoFocus
          accessibilityLabel="Testo della nota"
        />
        <Button label="Salva nota" icon="checkmark" onPress={save} loading={saving} disabled={!text.trim()} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 8 },
  quote: { borderLeftWidth: 3, padding: 10, borderRadius: 6 },
  quoteText: { fontStyle: 'italic' },
});
