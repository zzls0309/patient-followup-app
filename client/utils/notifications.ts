import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'push_token';
const PUSH_TOKEN_REGISTERED_KEY = 'push_token_registered';
const REMINDER_ENABLED_KEY = 'reminder_enabled';
const REMINDER_TIME_KEY = 'reminder_time';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

// 配置通知处理器 - 控制应用在前台时的通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 注册推送令牌到后端服务器
async function registerTokenWithBackend(token: string): Promise<void> {
  if (!EXPO_PUBLIC_BACKEND_BASE_URL) {
    console.log('Backend URL not configured, skipping token registration');
    return;
  }

  try {
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });

    if (response.ok) {
      await AsyncStorage.setItem(PUSH_TOKEN_REGISTERED_KEY, 'true');
      console.log('Push token registered with backend');
    } else {
      console.error('Failed to register push token:', await response.text());
    }
  } catch (error) {
    console.error('Error registering push token with backend:', error);
  }
}

// 请求推送通知权限并注册令牌
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // 检查权限
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 如果未授权，请求权限
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  // 获取推送令牌
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = tokenData.data;
    console.log('Expo Push token:', token);
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    // 如果获取 Expo push token 失败，尝试获取设备 push token
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      token = deviceToken.data;
      console.log('Device push token:', token);
    } catch (e) {
      console.error('Error getting device push token:', e);
    }
  }

  // Android 需要设置通知渠道
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '随访提醒',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    });
  }

  // 保存令牌并注册到后端
  if (token) {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await registerTokenWithBackend(token);
  }

  return token;
}

// 初始化推送通知（应用启动时调用）
export async function initPushNotifications(): Promise<string | null> {
  // 检查是否已注册过令牌
  const registered = await AsyncStorage.getItem(PUSH_TOKEN_REGISTERED_KEY);
  const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

  if (registered && savedToken) {
    // 已注册过，更新后端活跃时间
    await registerTokenWithBackend(savedToken);
    return savedToken;
  }

  // 未注册过，请求权限并注册
  return await registerForPushNotifications();
}

// 获取保存的推送令牌
export async function getPushToken(): Promise<string | null> {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

// 安排本地通知 - 每天在指定时间发送（备用，当后端推送不可用时）
export async function scheduleDailyReminder(hour: number, minute: number): Promise<string | null> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '随访提醒',
      body: '您有待处理的随诊任务，请打开应用查看。',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: 'daily' as any,
      hour,
      minute,
    },
  });

  console.log('Scheduled daily reminder at', `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`, 'with ID:', notificationId);
  return notificationId;
}

// 取消所有计划的通知
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('All scheduled notifications cancelled');
}

// 发送即时通知（用于测试）
export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}

// 获取通知是否开启
export async function getNotificationsEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
  return enabled === 'true';
}

// 设置通知开关
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, enabled.toString());

  const token = await getPushToken();

  // 同步设置到后端
  if (token && EXPO_PUBLIC_BACKEND_BASE_URL) {
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/push/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, enabled }),
      });
    } catch (error) {
      console.error('Error updating push settings:', error);
    }
  }

  if (enabled) {
    const time = await AsyncStorage.getItem(REMINDER_TIME_KEY) || '09:00';
    const [hour, minute] = time.split(':').map(Number);
    await scheduleDailyReminder(hour, minute);
  } else {
    await cancelAllNotifications();
  }
}

// 获取提醒时间
export async function getReminderTime(): Promise<string> {
  const time = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  return time || '09:00';
}

// 设置提醒时间
export async function setReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);

  const token = await getPushToken();
  const [hour, minute] = time.split(':').map(Number);

  // 同步设置到后端
  if (token && EXPO_PUBLIC_BACKEND_BASE_URL) {
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/push/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, enabled: true, hour, minute }),
      });
    } catch (error) {
      console.error('Error updating push settings:', error);
    }
  }

  // 同时设置本地通知作为备用
  const enabled = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
  if (enabled === 'true') {
    await scheduleDailyReminder(hour, minute);
  }
}

// 触发后端检查并发送提醒（用于测试）
export async function triggerBackendReminder(): Promise<void> {
  if (!EXPO_PUBLIC_BACKEND_BASE_URL) return;

  try {
    await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/push/check-and-remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error triggering backend reminder:', error);
  }
}

// 发送测试推送通知（用于测试）
export async function sendTestPushNotification(): Promise<void> {
  if (!EXPO_PUBLIC_BACKEND_BASE_URL) return;

  try {
    await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/push/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending test push notification:', error);
  }
}

// ============ 应用内提醒相关函数 ============

const LAST_CHECKED_DATE_KEY = 'last_checked_date';

// 获取北京时间的日期字符串
function getTodayDateStr(): string {
  const now = new Date();
  const bjOffset = 8 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjTime = new Date(utc + bjOffset * 60000);
  return bjTime.toISOString().split('T')[0];
}

// 判断是否应该显示提醒（每天只显示一次）
export async function shouldShowReminder(): Promise<boolean> {
  const lastChecked = await AsyncStorage.getItem(LAST_CHECKED_DATE_KEY);
  const today = getTodayDateStr();
  return lastChecked !== today;
}

// 标记今天已检查过提醒
export async function markTodayChecked(): Promise<void> {
  const today = getTodayDateStr();
  await AsyncStorage.setItem(LAST_CHECKED_DATE_KEY, today);
}

// 获取提醒摘要（用于测试显示）
export async function getReminderSummary(): Promise<string> {
  const enabled = await getNotificationsEnabled();
  const time = await getReminderTime();
  const token = await getPushToken();

  return [
    `提醒开关: ${enabled ? '已开启' : '已关闭'}`,
    `提醒时间: ${time}`,
    `推送令牌: ${token ? '已注册' : '未注册'}`,
    `令牌类型: ${token?.startsWith('ExponentPushToken') ? 'Expo Push Token' : token ? 'Device Token' : '无'}`,
  ].join('\n');
}

// 设置通知点击处理（深度链接）
export function setupNotificationNavigation(navigate: (url: string) => void): () => void {
  // Web 平台不支持原生通知
  if (Platform.OS === 'web') {
    return () => {};
  }

  // 处理应用在前台时点击通知
  const subscriptionForeground = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.url) {
      navigate(data.url as string);
    }
  });

  // 处理应用在后台/关闭时点击通知
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data;
      if (data?.url) {
        navigate(data.url as string);
      }
    }
  }).catch(() => {
    // 忽略错误（可能在某些平台上不可用）
  });

  return () => {
    subscriptionForeground.remove();
  };
}
