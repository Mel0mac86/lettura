import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useServices } from '@/providers/AppServicesProvider';
import type { Book } from '@/types/models';

import { ThemedText } from './ui/ThemedText';

const PLACEHOLDER_COLORS = ['#2F5D8A', '#8B5A2B', '#3D7D5B', '#7A4A8C', '#A0463C', '#44636F', '#8A7431'];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover' | 'format' | 'updatedAt'>;
  width: number;
}

/** Book cover (2:3). Falls back to a generated cover with title and author. */
export function CoverImage({ book, width }: Props) {
  const { storage } = useServices();
  const height = Math.round(width * 1.5);
  const style = { width, height, borderRadius: Math.max(4, width / 22) };
  if (book.cover) {
    return (
      <Image
        source={{ uri: storage.toUri(book.cover), cacheKey: `${book.cover}-${book.updatedAt}` }}
        style={[style, styles.image]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  const small = width < 80;
  return (
    <View style={[style, styles.placeholder, { backgroundColor: colorFor(book.id) }]} accessible={false}>
      <ThemedText
        numberOfLines={small ? 3 : 5}
        style={[styles.title, { fontSize: small ? 9 : Math.min(18, width / 7) }]}
      >
        {book.title}
      </ThemedText>
      {!small && book.author ? (
        <ThemedText numberOfLines={2} style={[styles.author, { fontSize: Math.min(12, width / 11) }]}>
          {book.author}
        </ThemedText>
      ) : null}
      <ThemedText style={styles.format}>{book.format.toUpperCase()}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#ddd' },
  placeholder: { padding: 8, justifyContent: 'center', overflow: 'hidden' },
  title: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  author: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6 },
  format: { position: 'absolute', bottom: 4, right: 6, fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
});
