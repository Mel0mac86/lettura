import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { READER_PALETTES } from '@/constants/theme';

export type ReaderChromePalette = (typeof READER_PALETTES)[keyof typeof READER_PALETTES];

export interface ReaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}

interface BarButtonProps extends ReaderAction {
  palette: ReaderChromePalette;
}

function BarButton({ icon, label, onPress, active, palette }: BarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={6}
      style={({ pressed }) => [styles.barButton, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={23} color={active ? palette.accent : palette.text} />
    </Pressable>
  );
}

interface TopBarProps {
  visible: boolean;
  title: string;
  subtitle: string;
  palette: ReaderChromePalette;
  onBack: () => void;
  actions: ReaderAction[];
}

/** Reader header: back button, book title and actions (TOC, search, bookmark, …). */
export function ReaderTopBar({ visible, title, subtitle, palette, onBack, actions }: TopBarProps) {
  const insets = useSafeAreaInsets();
  if (!visible) {
    return (
      <View pointerEvents="none" style={[styles.infoTop, { paddingTop: insets.top + 6 }]}>
        <Text numberOfLines={1} style={[styles.infoText, { color: palette.secondaryText }]}>
          {subtitle}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: palette.background, borderColor: palette.secondaryText + '33' }]}>
      <View style={styles.topRow}>
        <BarButton icon="chevron-back" label="Torna alla libreria" onPress={onBack} palette={palette} />
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: palette.secondaryText }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <BarButton key={action.label} {...action} palette={palette} />
        ))}
      </View>
    </View>
  );
}

interface BottomBarProps {
  visible: boolean;
  palette: ReaderChromePalette;
  /** e.g. "Pag. 3 di 12" */
  pageLabel: string;
  /** Extra line under the page number, e.g. "3 pagine alla fine del capitolo". */
  pageDetail?: string;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  children?: ReactNode;
}

/** Reader footer: progress, page indicator and navigation buttons. */
export function ReaderBottomBar({ visible, palette, pageLabel, pageDetail, progress, onPrev, onNext, prevLabel, nextLabel, children }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const percent = `${Math.floor(Math.min(1, Math.max(0, progress)) * 100)}%` as const;
  if (!visible) {
    return (
      <View pointerEvents="none" style={[styles.infoBottom, { paddingBottom: insets.bottom + 6 }]}>
        <Text style={[styles.infoText, { color: palette.secondaryText }]}>{pageLabel}</Text>
        <Text style={[styles.infoText, { color: palette.secondaryText }]}>{percent}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8, backgroundColor: palette.background, borderColor: palette.secondaryText + '33' }]}>
      {children}
      <View style={[styles.track, { backgroundColor: palette.secondaryText + '40' }]}>
        <View style={[styles.fill, { width: percent, backgroundColor: palette.accent }]} />
      </View>
      <View style={styles.bottomRow}>
        <BarButton icon="chevron-back-circle-outline" label={prevLabel} onPress={onPrev} palette={palette} />
        <View style={styles.bottomCenter}>
          <Text style={[styles.pageLabel, { color: palette.text }]}>{pageLabel}</Text>
          <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
            {percent} letto{pageDetail ? ` · ${pageDetail}` : ''}
          </Text>
        </View>
        <BarButton icon="chevron-forward-circle-outline" label={nextLabel} onPress={onNext} palette={palette} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoTop: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 40 },
  infoBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  infoText: { fontSize: 12 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  titleWrap: { flex: 1, paddingRight: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 },
  barButton: { padding: 8 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 12 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginHorizontal: 8 },
  fill: { height: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  bottomCenter: { flex: 1, alignItems: 'center' },
  pageLabel: { fontSize: 14, fontWeight: '600' },
});
