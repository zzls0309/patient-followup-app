import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_TIME_KEY = '@reminder_time';
const NOTIFICATIONS_ENABLED_KEY = '@notifications_enabled';

// 设置通知处理器（前台也显示通知）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as Notifications.NotificationBehavior),
});

// 初始化通知权限
export async function registerForPushNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('followup-reminders', {
      name: '随访提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    });
  }

  return true;
}

// 取消所有已调度的通知
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// 调度每日检查通知
export async function scheduleDailyReminder(): Promise<void> {
  await cancelAllNotifications();

  const enabled = await getNotificationsEnabled();
  if (!enabled) return;

  const reminderTime = await getReminderTime();
  const [hours, minutes] = reminderTime.split(':').map(Number);

  // 计算距离下次提醒的毫秒数
  const now = new Date();
  const bjNow = getBJNow();
  const target = new Date(bjNow);
  target.setHours(hours, minutes, 0, 0);

  // 如果今天的时间已过，设置为明天
  if (target.getTime() <= bjNow.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTrigger = target.getTime() - bjNow.getTime();

  // 使用 seconds 触发器
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '随访提醒',
      body: '请检查今日待办随访任务',
      sound: true,
      data: { type: 'daily-check' },
    },
    trigger: {
      seconds: Math.floor(msUntilTrigger / 1000),
      repeats: false,
    } as Notifications.NotificationTriggerInput,
  });
}

// 获取北京时间当前时间
function getBJNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 60 * 60000);
}

// 获取提醒时间（北京时间 HH:mm）
export async function getReminderTime(): Promise<string> {
  const time = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  return time || '08:00';
}

// 设置提醒时间
export async function setReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
  await scheduleDailyReminder();
}

// 获取通知是否启用
export async function getNotificationsEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return enabled !== 'false';
}

// 设置通知是否启用
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    await scheduleDailyReminder();
  } else {
    await cancelAllNotifications();
  }
}

// 发送即时通知（用于测试）
export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}

// 初始化通知系统
export async function initNotifications(): Promise<void> {
  const granted = await registerForPushNotifications();
  if (granted) {
    await scheduleDailyReminder();
  }
}
