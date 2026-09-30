import { router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCard } from '@/components/BookCard';
import { CoverImage } from '@/components/CoverImage';
import { ImportOverlay } from '@/components/ImportOverlay';
import { SearchBar } from '@/components/SearchBar';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ThemedText } from '@/components/ui/ThemedText';
import { SPACING } from '@/constants/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useImportBook } from '@/hooks/useImportBook';
import { useServices } from '@/providers/AppServicesProvider';
import { useAppTheme } from '@/providers/SettingsProvider';
import type { Book } from '@/types/models';
import { formatDuration, greetingForHour } from '@/utils/dates';

/** Home / dashboard: greeting, "continua a leggere", stats and recent books. */
export default function HomeScreen() {
  const services = useServices();
  const { colors } = useAppTheme();
  const { pickAndImport, stepLabel } = useImportBook();

  const load = useCallback(async () => {
    const [continueReading, recent, stats] = await Promise.all([
      services.books.listContinueReading(3),
      services.books.list({ sort: 'added', limit: 12 }),
      services.stats.getStats(),
    ]);
    return { continueReading, recent, stats };
  }, [services]);
  const { data, loading, error, reload } = useAsyncData(load, ['books', 'stats']);

  const openBook = (book: Book) => router.push(`/reader/${book.id}`);
  const openDetails = (book: Book) => router.push(`/book/${book.id}`);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { continueReading, recent, stats } = data;
  const [current, ...others] = continueReading;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <ThemedText variant="label" tone="muted">
            My Book Reader
          </ThemedText>
          <ThemedText variant="display">{greetingForHour(new Date().getHours())} 👋</ThemedText>
        </View>

        <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="Cerca libri, testo e note">
          <View pointerEvents="none">
            <SearchBar value="" onChangeText={() => undefined} placeholder="Cerca libri, testo, note…" editable={false} />
          </View>
        </Pressable>

        {stats.totalBooks === 0 ? (
          <EmptyState
            icon="book-outline"
            title="La tua libreria è vuota"
            message="Aggiungi il tuo primo libro EPUB, PDF o TXT. I file restano solo sul tuo dispositivo."
            action={<Button label="Aggiungi libro" icon="add" onPress={pickAndImport} />}
          />
        ) : (
          <>
            {current ? (
              <>
                <SectionHeader title="Continua a leggere" />
                <BookCard book={current} variant="hero" onOpen={openBook} onDetails={openDetails} />
                {others.length > 0 ? (
                  <View style={styles.others}>
                    {others.map((book) => (
                      <BookCard key={book.id} book={book} variant="list" onOpen={openBook} onDetails={openDetails} />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            <SectionHeader title="La tua libreria" actionLabel="Vedi tutti" onAction={() => router.push('/library')} />
            <View style={styles.stats}>
              <StatTile emoji="📖" value={stats.readingBooks} label="in lettura" />
              <StatTile emoji="📚" value={stats.totalBooks} label="libri totali" />
              <StatTile emoji="⭐" value={stats.favoriteBooks} label="preferiti" />
              <StatTile emoji="✅" value={stats.completedBooks} label="completati" />
            </View>

            <SectionHeader title="Statistiche" />
            <View style={styles.stats}>
              <StatTile emoji="📄" value={stats.pagesRead} label="pagine lette" />
              <StatTile emoji="⏱️" value={formatDuration(stats.readingTimeSeconds)} label="tempo di lettura" />
              <StatTile emoji="🔥" value={stats.streakDays} label={stats.streakDays === 1 ? 'giorno di fila' : 'giorni di fila'} />
            </View>

            <SectionHeader title="Aggiunti di recente" />
            <FlatList
              horizontal
              data={recent}
              keyExtractor={(b) => b.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recent}
              renderItem={({ item }) => (
                <Pressable onPress={() => openBook(item)} onLongPress={() => openDetails(item)} accessibilityRole="button" accessibilityLabel={item.title} style={styles.recentItem}>
                  <CoverImage book={item} width={92} />
                  <ThemedText variant="caption" numberOfLines={2} style={styles.recentTitle}>
                    {item.title}
                  </ThemedText>
                </Pressable>
              )}
            />
            <Button label="Aggiungi libro" icon="add" variant="secondary" onPress={pickAndImport} style={styles.add} />
          </>
        )}
      </ScrollView>
      <ImportOverlay label={stepLabel} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  header: { marginBottom: SPACING.lg, marginTop: SPACING.sm, gap: 2 },
  others: { marginTop: SPACING.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  recent: { gap: SPACING.md },
  recentItem: { width: 92 },
  recentTitle: { marginTop: 6 },
  add: { marginTop: SPACING.xl },
});
