import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_ENABLED_KEY = 'reminder_enabled';
const REMINDER_TIME_KEY = 'reminder_time';
const LAST_REMINDER_DATE_KEY = 'last_reminder_date';

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

// 请求推送通知权限
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // 检查权限
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 如果未授权，请求权限
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  // 获取推送令牌
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id',
    });
    token = tokenData.data;
    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
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
      name: '默认',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    });
  }

  return token;
}

// 安排本地通知 - 每天在指定时间发送
export async function scheduleDailyReminder(hour: number, minute: number): Promise<string | null> {
  // 取消所有现有通知
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
    trigger: null, // 立即发送
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
  
  if (enabled) {
    // 开启提醒时，安排每日通知
    const time = await AsyncStorage.getItem(REMINDER_TIME_KEY) || '09:00';
    const [hour, minute] = time.split(':').map(Number);
    await scheduleDailyReminder(hour, minute);
  } else {
    // 关闭提醒时，取消所有通知
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
  
  // 如果提醒已开启，重新安排通知
  const enabled = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
  if (enabled === 'true') {
    const [hour, minute] = time.split(':').map(Number);
    await scheduleDailyReminder(hour, minute);
  }
}

// 获取提醒设置
export async function getReminderSettings(): Promise<{ enabled: boolean; time: string }> {
  const enabled = await getNotificationsEnabled();
  const time = await getReminderTime();
  return { enabled, time };
}

// 获取提醒摘要（用于显示）
export async function getReminderSummary(): Promise<string> {
  const settings = await getReminderSettings();
  if (!settings.enabled) {
    return '提醒已关闭';
  }
  return `每天 ${settings.time} 提醒`;
}

// 检查是否应该显示应用内提醒（备用机制）
export async function shouldShowReminder(): Promise<boolean> {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return false;

  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = `${beijingTime.getUTCFullYear()}-${String(beijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingTime.getUTCDate()).padStart(2, '0')}`;

  const lastReminderDate = await AsyncStorage.getItem(LAST_REMINDER_DATE_KEY);
  if (lastReminderDate === todayStr) return false;

  const time = await getReminderTime();
  const [reminderHour, reminderMinute] = time.split(':').map(Number);
  const currentHour = beijingTime.getUTCHours();
  const currentMinute = beijingTime.getUTCMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const reminderTotalMinutes = reminderHour * 60 + reminderMinute;

  return currentTotalMinutes >= reminderTotalMinutes;
}

// 标记今天已提醒
export async function markTodayChecked(): Promise<void> {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = `${beijingTime.getUTCFullYear()}-${String(beijingTime.getUTCMonth() + 1).padStart(2, '0')}-${String(beijingTime.getUTCDate()).padStart(2, '0')}`;
  await AsyncStorage.setItem(LAST_REMINDER_DATE_KEY, todayStr);
}
