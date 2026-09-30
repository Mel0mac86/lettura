import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DARK_COLORS, LIGHT_COLORS, type AppColors } from '@/constants/theme';
import { dataEvents } from '@/services/events';
import { DEFAULT_SETTINGS } from '@/services/settings/defaults';
import type { AppSettings, ReaderPreferences } from '@/types/reader';

import { useServices } from './AppServicesProvider';

interface SettingsContextValue {
  settings: AppSettings;
  colors: AppColors;
  isDark: boolean;
  updateSettings(changes: Partial<Omit<AppSettings, 'reader'>>): void;
  updateReader(changes: Partial<ReaderPreferences>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Loads user preferences and derives the app color scheme (light/dark/system). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const services = useServices();
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    services.settings.load().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS));
  }, [services]);

  const persist = useCallback(
    (next: AppSettings) => {
      setSettings(next);
      services.settings
        .save(next)
        .then(() => dataEvents.emit('settings'))
        .catch(() => undefined);
    },
    [services],
  );

  const updateSettings = useCallback(
    (changes: Partial<Omit<AppSettings, 'reader'>>) => persist({ ...settings, ...changes }),
    [persist, settings],
  );
  const updateReader = useCallback(
    (changes: Partial<ReaderPreferences>) => persist({ ...settings, reader: { ...settings.reader, ...changes } }),
    [persist, settings],
  );

  const isDark = settings.appTheme === 'system' ? systemScheme === 'dark' : settings.appTheme === 'dark';
  const value = useMemo<SettingsContextValue>(
    () => ({ settings, colors: isDark ? DARK_COLORS : LIGHT_COLORS, isDark, updateSettings, updateReader }),
    [settings, isDark, updateSettings, updateReader],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}

/**
 * Colors of the current app theme. Works also outside <SettingsProvider>
 * (e.g. the startup loading screen), falling back to the system scheme.
 */
export function useAppTheme(): { colors: AppColors; isDark: boolean } {
  const value = useContext(SettingsContext);
  const systemScheme = useColorScheme();
  if (value) return { colors: value.colors, isDark: value.isDark };
  const isDark = systemScheme === 'dark';
  return { colors: isDark ? DARK_COLORS : LIGHT_COLORS, isDark };
}
