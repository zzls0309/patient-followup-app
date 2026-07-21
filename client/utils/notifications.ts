import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_TIME_KEY = '@reminder_time';
const NOTIFICATIONS_ENABLED_KEY = '@notifications_enabled';
const LAST_CHECK_DATE_KEY = '@last_check_date';

// 获取提醒时间（北京时间 HH:mm）
export async function getReminderTime(): Promise<string> {
  const time = await AsyncStorage.getItem(REMINDER_TIME_KEY);
  return time || '09:00';
}

// 设置提醒时间
export async function setReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIME_KEY, time);
}

// 获取通知开关
export async function getNotificationsEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return enabled !== 'false';
}

// 设置通知开关
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
}

// 获取上次检查日期
export async function getLastCheckDate(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
}

// 设置上次检查日期
export async function setLastCheckDate(date: string): Promise<void> {
  await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, date);
}

// 获取当前北京时间
export function getBeijingNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000);
}

// 格式化日期为 YYYY-MM-DD
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 检查是否应该显示提醒
export async function shouldShowReminder(): Promise<boolean> {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return false;

  const now = getBeijingNow();
  const today = formatDate(now);
  const lastCheck = await getLastCheckDate();

  // 如果今天已经检查过，不再提醒
  if (lastCheck === today) return false;

  // 检查当前时间是否已过提醒时间
  const reminderTime = await getReminderTime();
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reminderMinutes = hours * 60 + minutes;

  return currentMinutes >= reminderMinutes;
}

// 标记今天已检查
export async function markTodayChecked(): Promise<void> {
  const now = getBeijingNow();
  await setLastCheckDate(formatDate(now));
}

// 获取提醒摘要文本
export function getReminderSummary(upcomingCount: number, overdueCount: number): string {
  if (overdueCount > 0 && upcomingCount > 0) {
    return `您有 ${overdueCount} 个已逾期和 ${upcomingCount} 个即将到来的随诊提醒`;
  } else if (overdueCount > 0) {
    return `您有 ${overdueCount} 个已逾期的随诊需要处理`;
  } else if (upcomingCount > 0) {
    return `您有 ${upcomingCount} 个随诊即将到期`;
  }
  return '今日无随诊提醒';
}
