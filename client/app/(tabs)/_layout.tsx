import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useCSSVariable } from 'uniwind';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    '--color-background',
    '--color-muted',
    '--color-accent',
    '--color-border',
  ]) as string[];

  let tabBarStyle: Record<string, unknown> = {
    backgroundColor: background,
    borderTopWidth: 1,
    borderTopColor: border,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '患者',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="users" size={18} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '日历',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="calendar-days" size={18} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: '提醒',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="bell" size={18} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
