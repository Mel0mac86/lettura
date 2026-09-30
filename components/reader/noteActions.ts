import {} from 'react-native';

import type { AppServices } from '@/services/container';
import { dataEvents } from '@/services/events';
import type { Note } from '@/types/models';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';

type OpenNoteEditor = (config: { title?: string; quote?: string | null; initialText?: string; onSave: (text: string) => Promise<void> }) => void;

/** Edit / delete actions for an existing note (shared by all readers and the annotations screen). */
export function showNoteActions(note: Note, services: AppServices, openNoteEditor: OpenNoteEditor): void {
  showAlert('Nota', note.text.length > 140 ? `${note.text.slice(0, 140)}…` : note.text, [
    {
      text: 'Modifica',
      onPress: () =>
        openNoteEditor({
          title: 'Modifica nota',
          quote: note.quote,
          initialText: note.text,
          onSave: async (text) => {
            await services.notes.update(note.id, text);
            dataEvents.emit('annotations');
          },
        }),
    },
    {
      text: 'Elimina',
      style: 'destructive',
      onPress: () =>
        services.notes
          .delete(note.id)
          .then(() => dataEvents.emit('annotations'))
          .catch((e) => showAlert('Errore', toUserMessage(e))),
    },
    { text: 'Annulla', style: 'cancel' },
  ]);
}
