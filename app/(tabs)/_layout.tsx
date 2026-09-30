import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useAppTheme } from '@/providers/SettingsProvider';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="library" options={{ title: 'Libreria', headerShown: false, tabBarIcon: icon('library-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Cerca', headerShown: false, tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="bookmarks" options={{ title: 'Annotazioni', tabBarIcon: icon('bookmarks-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Impostazioni', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
