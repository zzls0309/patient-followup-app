import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { initPushNotifications } from '@/utils/notifications';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

export default function RootLayout() {
  // 初始化推送通知
  useEffect(() => {
    initPushNotifications().catch(console.error);
  }, []);

  return (
    <Provider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: "" }} />
        <Stack.Screen name="add-patient" options={{ title: "" }} />
        <Stack.Screen name="patient-detail" options={{ title: "" }} />
        <Stack.Screen name="import-patients" options={{ title: "" }} />
        <Stack.Screen name="day-detail" options={{ title: "" }} />
        <Stack.Screen name="all-patients" options={{ title: "" }} />
      </Stack>
      <Toast />
    </Provider>
  );
}
