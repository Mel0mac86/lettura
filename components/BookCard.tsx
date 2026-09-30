import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { RADIUS, SPACING } from '@/constants/theme';
import { useAppTheme } from '@/providers/SettingsProvider';
import type { Book } from '@/types/models';
import { formatRelativeDate } from '@/utils/dates';
import { formatPercent } from '@/utils/progress';

import { CoverImage } from './CoverImage';
import { ProgressBar } from './ProgressBar';
import { Button } from './ui/Button';
import { ThemedText } from './ui/ThemedText';

interface Props {
  book: Book;
  variant: 'grid' | 'list' | 'hero';
  width?: number;
  onOpen: (book: Book) => void;
  onDetails?: (book: Book) => void;
}

function statusLabel(book: Book): string {
  if (book.status === 'completed') return 'Completato';
  if (book.status === 'reading') return formatPercent(book.progress);
  return 'Non iniziato';
}

/** A book in the library: grid tile, list row or "continue reading" hero card. */
export function BookCard({ book, variant, width = 110, onOpen, onDetails }: Props) {
  const { colors } = useAppTheme();
  const a11y = `${book.title}${book.author ? `, di ${book.author}` : ''}, ${statusLabel(book)}`;

  if (variant === 'grid') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint="Apre il libro. Tieni premuto per i dettagli."
        onPress={() => onOpen(book)}
        onLongPress={() => onDetails?.(book)}
        style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
      >
        <View>
          <CoverImage book={book} width={width} />
          {book.isFavorite ? (
            <Ionicons name="star" size={16} color="#F5C518" style={styles.favoriteBadge} />
          ) : null}
        </View>
        <ThemedText numberOfLines={2} weight="600" style={styles.gridTitle}>
          {book.title}
        </ThemedText>
        <ThemedText variant="caption" tone="secondary" numberOfLines={1}>
          {book.author ?? 'Autore sconosciuto'}
        </ThemedText>
        {book.status === 'reading' ? (
          <View style={styles.gridProgress}>
            <ProgressBar progress={book.progress} height={4} showLabel />
          </View>
        ) : (
          <ThemedText variant="caption" tone="muted">
            {statusLabel(book)}
          </ThemedText>
        )}
      </Pressable>
    );
  }

  const coverWidth = variant === 'hero' ? 84 : 56;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => (variant === 'hero' ? onOpen(book) : (onDetails ?? onOpen)(book))}
      onLongPress={() => onDetails?.(book)}
      style={({ pressed }) => [
        styles.row,
        variant === 'hero' && { backgroundColor: colors.surface, borderColor: colors.border, ...styles.hero },
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <CoverImage book={book} width={coverWidth} />
      <View style={styles.rowBody}>
        <ThemedText variant={variant === 'hero' ? 'subtitle' : 'body'} weight="600" numberOfLines={2}>
          {book.title}
        </ThemedText>
        <ThemedText variant="caption" tone="secondary" numberOfLines={1}>
          {book.author ?? 'Autore sconosciuto'}
        </ThemedText>
        <View style={styles.rowProgress}>
          <ProgressBar progress={book.progress} showLabel />
        </View>
        <View style={styles.rowFooter}>
          <ThemedText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {book.lastReadAt ? `Letto: ${formatRelativeDate(book.lastReadAt).toLowerCase()}` : statusLabel(book)}
            {book.isFavorite ? '  ★' : ''}
          </ThemedText>
          <Button
            label={book.status === 'not_started' ? 'Leggi' : 'Continua'}
            icon="book-outline"
            compact
            onPress={() => onOpen(book)}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gridTitle: { marginTop: 8, fontSize: 14, lineHeight: 18 },
  gridProgress: { marginTop: 4 },
  favoriteBadge: { position: 'absolute', top: 4, right: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  row: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.sm },
  hero: { padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  rowBody: { flex: 1, gap: 3 },
  rowProgress: { marginTop: 6 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
