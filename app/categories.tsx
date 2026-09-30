import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme } from '@/providers/SettingsProvider';
import { dataEvents } from '@/services/events';
import type { CategoryWithCount } from '@/types/models';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';

/** Create, rename and delete custom categories (e.g. 📚 Trading, 🤖 AI, 🎓 Studio). */
export default function CategoriesScreen() {
  const services = useServices();
  const { colors } = useAppTheme();
  const [icon, setIcon] = useState('📚');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);

  const load = useCallback(() => services.categories.list(), [services]);
  const { data, loading, error, reload } = useAsyncData(load, ['categories', 'books']);

  const reset = () => {
    setEditing(null);
    setName('');
    setIcon('📚');
  };

  const save = async () => {
    try {
      if (editing) await services.categories.rename(editing.id, name, icon);
      else await services.categories.create(name, icon);
      reset();
      dataEvents.emit('categories');
    } catch (e) {
      showAlert('Categoria', toUserMessage(e));
    }
  };

  const remove = (category: CategoryWithCount) =>
    showAlert('Eliminare la categoria?', `“${category.name}” verrà rimossa. I libri non verranno eliminati.`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await services.categories.delete(category.id);
          dataEvents.emit('categories', 'books');
        },
      },
    ]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(c) => c.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="subtitle">{editing ? 'Modifica categoria' : 'Nuova categoria'}</ThemedText>
          <View style={styles.formRow}>
            <View style={styles.iconField}>
              <TextField label="Icona" value={icon} onChangeText={(t) => setIcon(Array.from(t).slice(-2).join(''))} maxLength={4} style={styles.iconInput} />
            </View>
            <View style={styles.flex}>
              <TextField label="Nome" value={name} onChangeText={setName} placeholder="Es. Intelligenza Artificiale" onSubmitEditing={save} returnKeyType="done" />
            </View>
          </View>
          <View style={styles.formRow}>
            {editing ? <Button label="Annulla" variant="secondary" onPress={reset} style={styles.flex} /> : null}
            <Button label={editing ? 'Salva' : 'Crea categoria'} icon="checkmark" onPress={save} disabled={!name.trim()} style={styles.flex} />
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="pricetags-outline" title="Nessuna categoria" message="Crea categorie per organizzare la tua libreria." />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            setEditing(item);
            setName(item.name);
            setIcon(item.icon ?? '📚');
          }}
          accessibilityRole="button"
          accessibilityHint="Modifica la categoria"
          style={[styles.row, { borderColor: colors.border }]}
        >
          <ThemedText style={styles.emoji}>{item.icon ?? '🏷️'}</ThemedText>
          <View style={styles.flex}>
            <ThemedText weight="600">{item.name}</ThemedText>
            <ThemedText variant="caption" tone="secondary">
              {item.bookCount === 1 ? '1 libro' : `${item.bookCount} libri`}
            </ThemedText>
          </View>
          <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Elimina ${item.name}`}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  form: { padding: SPACING.md, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: SPACING.md, marginBottom: SPACING.lg },
  formRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' },
  iconField: { width: 70 },
  iconInput: { textAlign: 'center', fontSize: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 24 },
});
