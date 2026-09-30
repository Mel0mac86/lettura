import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '@/providers/AppServicesProvider';
import { SettingsProvider, useSettings } from '@/providers/SettingsProvider';

function ThemedNavigation() {
  const { colors, isDark } = useSettings();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: colors.primary }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reader/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="book/[id]" options={{ title: 'Scheda libro' }} />
        <Stack.Screen name="categories" options={{ title: 'Categorie' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppServicesProvider>
          <SettingsProvider>
            <ThemedNavigation />
          </SettingsProvider>
        </AppServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
