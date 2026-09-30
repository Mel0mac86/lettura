import { FlatList, StyleSheet, useWindowDimensions, View, type ListRenderItem } from 'react-native';

import { SPACING } from '@/constants/theme';
import type { Book } from '@/types/models';
import type { LibraryViewMode } from '@/types/reader';

import { BookCard } from './BookCard';

interface Props {
  books: Book[];
  mode: LibraryViewMode;
  onOpen: (book: Book) => void;
  onDetails: (book: Book) => void;
  header?: React.ReactElement;
  empty?: React.ReactElement;
}

const H_PADDING = SPACING.lg;
const GAP = SPACING.lg;

/** Library list in grid or list mode. The number of columns adapts to the screen width. */
export function BookGrid({ books, mode, onOpen, onDetails, header, empty }: Props) {
  const { width } = useWindowDimensions();
  const columns = mode === 'grid' ? Math.max(2, Math.min(6, Math.floor((width - H_PADDING * 2 + GAP) / (96 + GAP)))) : 1;
  const itemWidth = (width - H_PADDING * 2 - GAP * (columns - 1)) / columns;

  const renderItem: ListRenderItem<Book> = ({ item }) =>
    mode === 'grid' ? (
      <BookCard book={item} variant="grid" width={itemWidth} onOpen={onOpen} onDetails={onDetails} />
    ) : (
      <BookCard book={item} variant="list" onOpen={onOpen} onDetails={onDetails} />
    );

  return (
    <FlatList
      key={`${mode}-${columns}`}
      data={books}
      keyExtractor={(book) => book.id}
      renderItem={renderItem}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ height: mode === 'grid' ? SPACING.xl : SPACING.xs }} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PADDING, paddingBottom: 120 },
});
