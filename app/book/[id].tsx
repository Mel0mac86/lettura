import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { LoadingState } from '@/components/ui/LoadingState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme } from '@/providers/SettingsProvider';
import { formatLabel } from '@/services/books/formats';
import { dataEvents } from '@/services/events';
import type { Book, CategoryWithCount, ReadingStatus } from '@/types/models';
import { formatDate, formatRelativeDate } from '@/utils/dates';
import { showAlert } from '@/utils/dialogs';
import { NotFoundError, toUserMessage } from '@/utils/errors';

interface Form {
  title: string;
  author: string;
  language: string;
  publisher: string;
  description: string;
  tags: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LoadedData {
  book: Book;
  categories: CategoryWithCount[];
  selected: Set<string>;
  tags: string[];
}

function formFrom({ book, tags }: LoadedData): Form {
  return {
    title: book.title,
    author: book.author ?? '',
    language: book.language ?? '',
    publisher: book.publisher ?? '',
    description: book.description ?? '',
    tags: tags.join(', '),
  };
}

/** Book details: metadata editing, status, favorites, categories, tags and deletion. */
export default function BookDetailsScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const services = useServices();

  const load = useCallback(async (): Promise<LoadedData> => {
    const book = await services.books.getById(id);
    if (!book) throw new NotFoundError('Libro');
    const [categories, bookCategories, tags] = await Promise.all([
      services.categories.list(),
      services.categories.listForBook(id),
      services.books.getTags(id),
    ]);
    return { book, categories, selected: new Set(bookCategories.map((c) => c.id)), tags };
  }, [services, id]);
  const { data, loading, error, reload } = useAsyncData(load, ['books', 'categories']);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return <BookDetails key={data.book.id} data={data} startEditing={edit === '1'} />;
}

function BookDetails({ data, startEditing }: { data: LoadedData; startEditing: boolean }) {
  const services = useServices();
  const { colors } = useAppTheme();
  const [editing, setEditing] = useState(startEditing);
  const [form, setForm] = useState<Form>(() => formFrom(data));
  const [saving, setSaving] = useState(false);
  const { book, categories, selected } = data;

  const run = async (task: () => Promise<unknown>, ...topics: Parameters<typeof dataEvents.emit>) => {
    try {
      await task();
      dataEvents.emit(...topics);
    } catch (e) {
      showAlert('Errore', toUserMessage(e));
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      showAlert('Titolo mancante', 'Inserisci un titolo per il libro.');
      return;
    }
    setSaving(true);
    await run(async () => {
      await services.books.updateMetadata(book.id, {
        title: form.title,
        author: form.author,
        language: form.language,
        publisher: form.publisher,
        description: form.description,
      });
      await services.books.setTags(book.id, form.tags.split(','));
      setEditing(false);
    }, 'books');
    setSaving(false);
  };

  const toggleCategory = (categoryId: string) => {
    const next = new Set(selected);
    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);
    void run(() => services.categories.setBookCategories(book.id, Array.from(next)), 'books', 'categories');
  };

  const confirmDelete = () =>
    showAlert('Eliminare il libro?', `“${book.title}” verrà rimosso dal dispositivo insieme a segnalibri, note ed evidenziazioni.`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await services.importer.deleteBook(book);
            router.back();
          }, 'books', 'annotations', 'stats', 'categories'),
      },
    ]);

  const set = (key: keyof Form) => (value: string) => setForm({ ...form, [key]: value });
  const details = [
    `${formatLabel(book.format)} · ${formatSize(book.fileSize)}`,
    book.totalPages ? `${book.totalPages} pagine` : null,
    book.totalChapters ? `${book.totalChapters} capitoli` : null,
    book.language ? `Lingua: ${book.language}` : null,
  ].filter(Boolean);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: editing ? 'Modifica dati' : 'Scheda libro',
          headerRight: () => (
            <IconButton
              icon={book.isFavorite ? 'star' : 'star-outline'}
              color={book.isFavorite ? '#F5C518' : colors.text}
              onPress={() => void run(() => services.books.setFavorite(book.id, !book.isFavorite), 'books', 'stats')}
              accessibilityLabel={book.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            />
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <CoverImage book={book} width={120} />
          <View style={styles.topInfo}>
            <ThemedText variant="title" numberOfLines={4}>
              {book.title}
            </ThemedText>
            <ThemedText tone="secondary">{book.author ?? 'Autore sconosciuto'}</ThemedText>
            {details.map((d) => (
              <ThemedText key={d} variant="caption" tone="muted">
                {d}
              </ThemedText>
            ))}
            <ThemedText variant="caption" tone="muted">
              Aggiunto il {formatDate(book.createdAt)} · Ultima lettura: {formatRelativeDate(book.lastReadAt).toLowerCase()}
            </ThemedText>
          </View>
        </View>

        <View style={styles.progress}>
          <ProgressBar progress={book.progress} showLabel />
        </View>
        <Button
          label={book.status === 'not_started' ? 'Inizia a leggere' : book.status === 'completed' ? 'Rileggi' : 'Continua a leggere'}
          icon="book"
          onPress={() => router.push(`/reader/${book.id}`)}
        />

        <ThemedText variant="label" tone="secondary" style={styles.section}>
          Stato di lettura
        </ThemedText>
        <SegmentedControl<ReadingStatus>
          value={book.status}
          onChange={(status) => void run(() => services.books.setStatus(book.id, status), 'books', 'stats')}
          options={[
            { value: 'not_started', label: 'Non iniziato' },
            { value: 'reading', label: 'In lettura' },
            { value: 'completed', label: 'Completato' },
          ]}
        />

        <ThemedText variant="label" tone="secondary" style={styles.section}>
          Categorie
        </ThemedText>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip key={c.id} label={`${c.icon ?? '🏷️'} ${c.name}`} selected={selected.has(c.id)} onPress={() => toggleCategory(c.id)} />
          ))}
          <Chip label="＋ Nuova" onPress={() => router.push('/categories')} />
        </View>

        <View style={styles.sectionRow}>
          <ThemedText variant="label" tone="secondary">
            Dati del libro
          </ThemedText>
          {!editing ? <Button label="Modifica" icon="create-outline" variant="ghost" compact onPress={() => setEditing(true)} /> : null}
        </View>
        {editing ? (
          <View style={styles.form}>
            {!book.author ? (
              <ThemedText variant="caption" tone="secondary">
                Alcuni dati non erano presenti nel file: completali qui.
              </ThemedText>
            ) : null}
            <TextField label="Titolo" value={form.title} onChangeText={set('title')} />
            <TextField label="Autore" value={form.author} onChangeText={set('author')} placeholder="Nome dell’autore" />
            <TextField label="Lingua" value={form.language} onChangeText={set('language')} placeholder="it, en, …" autoCapitalize="none" />
            <TextField label="Editore" value={form.publisher} onChangeText={set('publisher')} />
            <TextField label="Tag (separati da virgola)" value={form.tags} onChangeText={set('tags')} placeholder="saggio, da rileggere" autoCapitalize="none" />
            <TextField label="Descrizione" value={form.description} onChangeText={set('description')} multiline />
            <View style={styles.formButtons}>
              <Button
                label="Annulla"
                variant="secondary"
                onPress={() => {
                  setForm(formFrom(data));
                  setEditing(false);
                }}
                style={styles.flex}
              />
              <Button label="Salva" icon="checkmark" onPress={save} loading={saving} style={styles.flex} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {data.tags.length ? (
              <ThemedText variant="caption" tone="secondary">
                {data.tags.map((t) => `#${t}`).join('  ')}
              </ThemedText>
            ) : null}
            {book.publisher ? <ThemedText variant="caption">Editore: {book.publisher}</ThemedText> : null}
            {book.description ? <ThemedText tone="secondary">{book.description}</ThemedText> : null}
            <ThemedText variant="caption" tone="muted">
              File originale: {book.originalFileName}
            </ThemedText>
          </View>
        )}

        <Button label="Elimina libro" icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.delete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 64 },
  top: { flexDirection: 'row', gap: SPACING.lg },
  topInfo: { flex: 1, gap: 4 },
  progress: { marginVertical: SPACING.lg },
  section: { marginTop: SPACING.xl, marginBottom: SPACING.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, marginBottom: SPACING.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  form: { gap: SPACING.md },
  formButtons: { flexDirection: 'row', gap: SPACING.sm },
  delete: { marginTop: SPACING.xxl },
});
