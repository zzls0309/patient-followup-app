import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  getReminderTime,
  setReminderTime,
  registerForPushNotifications,
  sendImmediateNotification,
} from '@/utils/notifications';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL + '/api/v1';

const STEP_LABELS: Record<string, string> = {
  treatment_1: '第一次治疗',
  treatment_2: '第二次治疗',
  treatment_3: '第三次治疗',
  photo: '拍照随访',
};

interface Reminder {
  id: number;
  patient_id: number;
  step_number: number;
  step_type: string;
  scheduled_date: string;
  completed_date: string | null;
  patient_name: string;
  patient_phone: string;
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotifEnabled] = useState(true);
  const [reminderTime, setRemTime] = useState('08:00');
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchReminders = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：GET /api/v1/patients/reminders/upcoming
       * 无参数（返回2天内到期和已逾期的步骤）
       */
      const response = await fetch(`${API_BASE}/patients/reminders/upcoming`);
      const data = await response.json();
      setReminders(data);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [fetchReminders])
  );

  useEffect(() => {
    (async () => {
      const enabled = await getNotificationsEnabled();
      setNotifEnabled(enabled);
      const time = await getReminderTime();
      setRemTime(time);
    })();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders();
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await registerForPushNotifications();
      if (!granted) {
        Alert.alert('权限不足', '请在系统设置中允许通知权限');
        return;
      }
    }
    await setNotificationsEnabled(value);
    setNotifEnabled(value);
  };

  const handleTimeChange = () => {
    const times = ['07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '18:00', '20:00'];
    Alert.alert(
      '选择提醒时间',
      '请选择每日提醒时间（北京时间）',
      times.map(t => ({
        text: t,
        onPress: async () => {
          await setReminderTime(t);
          setRemTime(t);
        },
      }))
    );
  };

  const handleTestNotification = async () => {
    await sendImmediateNotification('随访提醒测试', '通知功能正常工作！');
  };

  const overdueReminders = reminders.filter((r) => getDaysUntil(r.scheduled_date) < 0);
  const upcomingReminders = reminders.filter((r) => getDaysUntil(r.scheduled_date) >= 0);

  const renderReminderItem = ({ item }: { item: Reminder }) => {
    const daysUntil = getDaysUntil(item.scheduled_date);
    const isOverdue = daysUntil < 0;
    const isToday = daysUntil === 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          router.push(`/patient-detail`, { patientId: item.patient_id })
        }
        style={styles.cardOuter}
      >
        <View style={styles.cardInner}>
          <View style={styles.reminderHeader}>
            <View style={styles.patientRow}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isOverdue
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(5,150,105,0.12)',
                  },
                ]}
              >
                <FontAwesome6
                  name={isOverdue ? 'triangle-exclamation' : 'bell'}
                  size={18}
                  color={isOverdue ? '#EF4444' : '#059669'}
                />
              </View>
              <View style={styles.reminderInfo}>
                <Text style={styles.patientName}>{item.patient_name}</Text>
                <Text style={styles.stepLabel}>
                  {STEP_LABELS[item.step_type] || `步骤${item.step_number}`}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.dayBadge,
                {
                  backgroundColor: isOverdue
                    ? 'rgba(239,68,68,0.10)'
                    : isToday
                      ? 'rgba(245,158,11,0.10)'
                      : 'rgba(5,150,105,0.10)',
                },
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  {
                    color: isOverdue
                      ? '#EF4444'
                      : isToday
                        ? '#F59E0B'
                        : '#059669',
                  },
                ]}
              >
                {isOverdue
                  ? `逾期${Math.abs(daysUntil)}天`
                  : isToday
                    ? '今天'
                    : `${daysUntil}天后`}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.reminderFooter}>
            <View style={styles.dateInfo}>
              <FontAwesome6 name="calendar" size={12} color="#636E72" />
              <Text style={styles.dateText}>{item.scheduled_date}</Text>
            </View>
            <Text style={styles.actionHint}>点击查看详情</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={['left', 'right']}>
      <FlatList
        data={[...overdueReminders, ...upcomingReminders]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReminderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={[
          styles.listContent,
          reminders.length === 0 && styles.emptyContainer,
        ]}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
              <Text style={styles.headerTitle}>随访提醒</Text>
              <Text style={styles.headerSubtitle}>
                提前2天提醒 · 共 {reminders.length} 条待办
              </Text>
            </View>

            {/* Notification Settings */}
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: 'rgba(5,150,105,0.12)' }]}>
                    <FontAwesome6 name="bell" size={14} color="#059669" />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>通知提醒</Text>
                    <Text style={styles.settingDesc}>每日 {reminderTime} 检查并提醒</Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: '#DFE6E9', true: '#B2DFDB' }}
                  thumbColor={notificationsEnabled ? '#059669' : '#B2BEC3'}
                />
              </View>

              {notificationsEnabled && (
                <>
                  <TouchableOpacity style={styles.settingRow} onPress={handleTimeChange}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                        <FontAwesome6 name="clock" size={14} color="#F97316" />
                      </View>
                      <View>
                        <Text style={styles.settingTitle}>提醒时间</Text>
                        <Text style={styles.settingDesc}>北京时间 {reminderTime}</Text>
                      </View>
                    </View>
                    <FontAwesome6 name="chevron-right" size={14} color="#B2BEC3" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingRow} onPress={handleTestNotification}>
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIcon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                        <FontAwesome6 name="paper-plane" size={14} color="#6366F1" />
                      </View>
                      <Text style={styles.settingTitle}>发送测试通知</Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={14} color="#B2BEC3" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {overdueReminders.length > 0 && (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.sectionTitle}>
                  已逾期 ({overdueReminders.length})
                </Text>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          upcomingReminders.length > 0 ? (
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <View style={[styles.sectionDot, { backgroundColor: '#059669' }]} />
              <Text style={styles.sectionTitle}>
                即将到来 ({upcomingReminders.length})
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="circle-check" size={40} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>暂无待办随访</Text>
            <Text style={styles.emptyDesc}>所有随访任务均已安排或完成</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#F0F0F3',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D3436',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  settingDesc: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D3436',
  },
  cardOuter: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#F0F0F3',
    padding: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfo: {
    gap: 2,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  stepLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F3',
    marginVertical: 12,
  },
  reminderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#636E72',
  },
  actionHint: {
    fontSize: 12,
    color: '#B2BEC3',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(5,150,105,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
});
