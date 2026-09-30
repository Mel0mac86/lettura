import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { PdfReader } from '@/components/reader/PdfReader';
import { ReflowReader } from '@/components/reader/ReflowReader';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useServices } from '@/providers/AppServicesProvider';
import { EpubDocument } from '@/services/epub/epubParser';
import type { ReflowableDocument } from '@/services/reader/ReflowableDocument';
import { TxtDocument } from '@/services/txt/txtDocument';
import type { Book } from '@/types/models';
import type { ReaderLocation } from '@/types/reader';
import { NotFoundError } from '@/utils/errors';
import { parseLocation } from '@/utils/location';
import { decodeText } from '@/utils/text';

interface LoadedBook {
  book: Book;
  doc: ReflowableDocument | null;
  initialLocation: ReaderLocation | null;
}

/**
 * Reader route: /reader/<bookId>?location=<json>
 * Opens the book at `location` (bookmark, search result) or at the saved position.
 */
export default function ReaderScreen() {
  const { id, location } = useLocalSearchParams<{ id: string; location?: string }>();
  const services = useServices();

  const load = useCallback(async (): Promise<LoadedBook> => {
    const book = await services.books.getById(id);
    if (!book) throw new NotFoundError('Libro');
    if (!(await services.storage.exists(book.filePath))) {
      throw new Error('Il file del libro non è più presente sul dispositivo.');
    }
    const initialLocation = parseLocation(location) ?? parseLocation(book.location);
    let doc: ReflowableDocument | null = null;
    if (book.format === 'epub') doc = await EpubDocument.open(await services.storage.readBytes(book.filePath));
    if (book.format === 'txt') doc = new TxtDocument(decodeText(await services.storage.readBytes(book.filePath)));
    return { book, doc, initialLocation };
  }, [id, location, services]);

  // Loaded once per screen instance: no refresh on focus (it would re-open the book).
  const { data, loading, error, reload } = useAsyncData(load, [], { refreshOnFocus: false });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      {error ? (
        <>
          <ErrorState title="Impossibile aprire il libro" message={error} onRetry={reload} />
          <Button label="Torna alla libreria" variant="ghost" onPress={() => router.back()} />
        </>
      ) : loading || !data ? (
        <LoadingState message="Apertura del libro…" />
      ) : data.book.format === 'pdf' ? (
        <PdfReader key={location ?? 'saved'} book={data.book} initialLocation={data.initialLocation} />
      ) : data.doc ? (
        <ReflowReader key={location ?? 'saved'} book={data.book} doc={data.doc} initialLocation={data.initialLocation} />
      ) : null}
    </>
  );
}
