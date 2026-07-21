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

  let tabBarStyle = {
    backgroundColor: '#F0F0F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 0,
    paddingTop: 12,
    paddingBottom: insets.bottom + 8,
    height: 'auto' as unknown as number,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto' as unknown as number,
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#B2BEC3',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '患者',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="users" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: '提醒',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="bell" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
