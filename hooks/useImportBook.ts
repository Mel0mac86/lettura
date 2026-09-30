import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {} from 'react-native';

import { useServices } from '@/providers/AppServicesProvider';
import type { ImportStep } from '@/services/books/BookImporter';
import { PICKER_MIME_TYPES } from '@/services/books/formats';
import { dataEvents } from '@/services/events';
import { showAlert } from '@/utils/dialogs';
import { DuplicateBookError, toUserMessage } from '@/utils/errors';

export const IMPORT_STEP_LABELS: Record<ImportStep, string> = {
  reading: 'Lettura del file…',
  detecting: 'Verifica del formato…',
  extracting: 'Estrazione dei metadati…',
  saving: 'Salvataggio nella libreria…',
  indexing: 'Indicizzazione per la ricerca…',
  done: 'Fatto!',
};

/** "+ Aggiungi libro": opens the system file picker and imports the chosen files. */
export function useImportBook() {
  const { importer } = useServices();
  const [step, setStep] = useState<ImportStep | null>(null);

  const pickAndImport = useCallback(async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: PICKER_MIME_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });
    } catch (error) {
      showAlert('Impossibile aprire i file', toUserMessage(error));
      return;
    }
    if (result.canceled || result.assets.length === 0) return;

    const imported: { id: string; needsReview: boolean }[] = [];
    const failures: string[] = [];
    for (const asset of result.assets) {
      try {
        const { book, needsMetadataReview } = await importer.importBook(
          { sourceUri: asset.uri, fileName: asset.name, mimeType: asset.mimeType },
          setStep,
        );
        imported.push({ id: book.id, needsReview: needsMetadataReview });
      } catch (error) {
        if (error instanceof DuplicateBookError && result.assets.length === 1) {
          setStep(null);
          showAlert('Libro già presente', error.message, [
            { text: 'OK', style: 'cancel' },
            { text: 'Apri scheda', onPress: () => router.push(`/book/${error.existingBookId}`) },
          ]);
          return;
        }
        failures.push(`• ${asset.name}: ${toUserMessage(error)}`);
      }
    }
    setStep(null);
    if (imported.length > 0) dataEvents.emit('books', 'stats');

    if (failures.length > 0) {
      showAlert(
        imported.length > 0 ? `Importati ${imported.length} libri, ${failures.length} con errori` : 'Importazione non riuscita',
        failures.join('\n'),
      );
    } else if (imported.length === 1) {
      const [only] = imported;
      // Missing metadata: let the user complete title/author right away.
      if (only.needsReview) router.push({ pathname: '/book/[id]', params: { id: only.id, edit: '1' } });
    } else if (imported.length > 1) {
      showAlert('Importazione completata', `${imported.length} libri aggiunti alla libreria.`);
    }
  }, [importer]);

  return { pickAndImport, importing: step !== null, step, stepLabel: step ? IMPORT_STEP_LABELS[step] : null };
}
