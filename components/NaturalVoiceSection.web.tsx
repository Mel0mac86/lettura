import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/Button';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAppTheme, useSettings } from '@/providers/SettingsProvider';
import {
  downloadNaturalVoice,
  isNaturalVoiceDownloaded,
  isNaturalVoiceSupported,
  NATURAL_VOICE,
  removeNaturalVoice,
  synthesizeNaturalVoice,
} from '@/services/tts/piperClient';
import { showAlert } from '@/utils/dialogs';
import { toUserMessage } from '@/utils/errors';

type Status = 'checking' | 'missing' | 'downloading' | 'ready' | 'unsupported';

/** "🎙️ Voce naturale italiana": download, enable, try and remove the Piper voice. */
export function NaturalVoiceSection() {
  const { settings, updateSpeech } = useSettings();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<Status>(() => (isNaturalVoiceSupported() ? 'checking' : 'unsupported'));
  const [progress, setProgress] = useState(0);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isNaturalVoiceSupported()) return;
    isNaturalVoiceDownloaded()
      .then((ok) => setStatus(ok ? 'ready' : 'missing'))
      .catch(() => setStatus('missing'));
  }, []);

  const download = async () => {
    setStatus('downloading');
    setProgress(0);
    try {
      await downloadNaturalVoice(setProgress);
      setStatus('ready');
      updateSpeech({ naturalVoice: true });
    } catch (error) {
      setStatus('missing');
      showAlert('Download non riuscito', `${toUserMessage(error)}\nControlla la connessione e riprova.`);
    }
  };

  const test = async () => {
    setTesting(true);
    // Created in the tap handler so iPhone allows playback.
    const audio = new Audio();
    void audio.play().catch(() => undefined);
    try {
      const wav = await synthesizeNaturalVoice(
        'Ciao! Sono Paola, la voce naturale che leggerà i tuoi libri, anche senza connessione.',
        settings.speech.rate,
      );
      audio.src = URL.createObjectURL(wav);
      await audio.play();
    } catch (error) {
      showAlert('Prova non riuscita', toUserMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const remove = () =>
    showAlert('Eliminare la voce naturale?', 'Libererai circa 90 MB. Potrai riscaricarla quando vuoi.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await removeNaturalVoice().catch(() => undefined);
          updateSpeech({ naturalVoice: false });
          setStatus('missing');
        },
      },
    ]);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.primarySoft }]}>
      <ThemedText weight="700">🎙️ Voce naturale italiana ({NATURAL_VOICE.name})</ThemedText>
      <ThemedText variant="caption" tone="secondary">
        Voce neurale molto più umana delle voci del browser. Gratuita, funziona sul telefono anche offline: il testo dei
        libri non viene inviato a nessuno. Usata per i libri in italiano.
      </ThemedText>

      {status === 'checking' ? <ThemedText variant="caption">Controllo…</ThemedText> : null}
      {status === 'unsupported' ? (
        <ThemedText variant="caption" tone="danger">
          Questo browser non supporta la voce naturale.
        </ThemedText>
      ) : null}
      {status === 'missing' ? (
        <Button label={`Scarica voce (circa ${NATURAL_VOICE.approxDownloadMb} MB)`} icon="cloud-download-outline" onPress={download} />
      ) : null}
      {status === 'downloading' ? (
        <View style={styles.progress}>
          <ThemedText variant="caption">Download in corso… tieni l’app aperta.</ThemedText>
          <ProgressBar progress={progress} showLabel />
        </View>
      ) : null}
      {status === 'ready' ? (
        <>
          <View style={styles.row}>
            <ThemedText style={styles.flex}>Usa la voce naturale</ThemedText>
            <Switch
              value={settings.speech.naturalVoice}
              onValueChange={(naturalVoice) => updateSpeech({ naturalVoice })}
              accessibilityLabel="Usa la voce naturale"
            />
          </View>
          <View style={styles.row}>
            <Button label="Prova" icon="play" variant="secondary" compact loading={testing} onPress={test} />
            <Button label="Elimina" icon="trash-outline" variant="ghost" compact onPress={remove} />
          </View>
          <ThemedText variant="caption" tone="muted">
            La prima frase può richiedere qualche secondo: le successive vengono preparate mentre ascolti.
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progress: { gap: 6 },
});
