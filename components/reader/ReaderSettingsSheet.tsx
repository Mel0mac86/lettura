import { ReaderPreferenceControls } from '@/components/ReaderPreferenceControls';
import { Sheet } from '@/components/ui/Sheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** PDF only supports the theme (page tint): typography controls are hidden. */
  mode: 'reflow' | 'pdf';
}

/** "Aa" sheet of the reader. Changes are applied live. */
export function ReaderSettingsSheet({ visible, onClose, mode }: Props) {
  return (
    <Sheet visible={visible} title="Aspetto" onClose={onClose}>
      <ReaderPreferenceControls typography={mode === 'reflow'} />
    </Sheet>
  );
}
