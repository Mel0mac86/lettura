import { useCallback, useState } from 'react';
import {} from 'react-native';

import { NoteEditor } from '@/components/reader/NoteEditor';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';

interface NoteEditorConfig {
  title?: string;
  quote?: string | null;
  initialText?: string;
  onSave: (text: string) => Promise<void>;
}

/** Imperative helper around <NoteEditor>: `openNoteEditor({...})` + render `noteEditorElement`. */
export function useNoteEditor() {
  const [config, setConfig] = useState<NoteEditorConfig | null>(null);
  // Incremented on every open so the editor remounts with fresh initial text.
  const [session, setSession] = useState(0);

  const openNoteEditor = useCallback((next: NoteEditorConfig) => {
    setSession((n) => n + 1);
    setConfig(next);
  }, []);
  const close = useCallback(() => setConfig(null), []);

  const noteEditorElement = (
    <NoteEditor
      key={session}
      visible={config !== null}
      title={config?.title}
      quote={config?.quote}
      initialText={config?.initialText}
      onClose={close}
      onSave={async (text) => {
        if (!config) return;
        try {
          await config.onSave(text);
          close();
        } catch (error) {
          showAlert('Impossibile salvare la nota', toUserMessage(error));
        }
      }}
    />
  );

  return { openNoteEditor, noteEditorElement };
}
