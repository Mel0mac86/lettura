import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Cross-platform replacement for `Alert.alert`.
 * On iOS/Android it uses the native alert. On web (where react-native-web's
 * Alert is a no-op) it falls back to the browser dialogs:
 * - no/one button → `window.alert`
 * - one action + cancel → `window.confirm`
 * - several actions → `window.prompt` with a numbered list.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  if (actions.length === 0) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  if (actions.length === 1) {
    if (window.confirm(text)) actions[0].onPress?.();
    else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    return;
  }
  const list = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  const answer = window.prompt(`${text}\n\n${list}\n\nScrivi il numero dell'azione:`);
  const index = answer ? parseInt(answer, 10) - 1 : -1;
  if (index >= 0 && index < actions.length) actions[index].onPress?.();
}
