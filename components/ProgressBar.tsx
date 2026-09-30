import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/providers/SettingsProvider';
import { clamp01 } from '@/utils/location';
import { formatPercent } from '@/utils/progress';

import { ThemedText } from './ui/ThemedText';

interface Props {
  progress: number;
  showLabel?: boolean;
  height?: number;
}

export function ProgressBar({ progress, showLabel = false, height = 6 }: Props) {
  const { colors } = useAppTheme();
  const value = clamp01(progress);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.progressTrack }]}>
        <View
          testID="progress-fill"
          style={{ width: `${value * 100}%`, height, borderRadius: height / 2, backgroundColor: colors.primary }}
        />
      </View>
      {showLabel ? (
        <ThemedText variant="caption" tone="secondary" weight="600" style={styles.label}>
          {formatPercent(value)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, overflow: 'hidden' },
  label: { minWidth: 38, textAlign: 'right' },
});
