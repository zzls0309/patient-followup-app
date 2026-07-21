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
import { LinearGradient } from 'expo-linear-gradient';
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

const STEP_COLORS: Record<string, string> = {
  treatment_1: '#059669',
  treatment_2: '#0EA5E9',
  treatment_3: '#8B5CF6',
  photo: '#F59E0B',
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
    const stepColor = STEP_COLORS[item.step_type] || '#059669';

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() =>
          router.push(`/patient-detail`, { patientId: item.patient_id })
        }
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.patientRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: isOverdue ? '#FEE2E2' : '#E8F5E9' },
              ]}
            >
              <FontAwesome6
                name={isOverdue ? 'triangle-exclamation' : 'bell'}
                size={18}
                color={isOverdue ? '#DC2626' : '#059669'}
              />
            </View>
            <View style={styles.reminderInfo}>
              <Text style={styles.patientName}>{item.patient_name}</Text>
              <View style={[styles.stepBadge, { backgroundColor: stepColor + '18' }]}>
                <Text style={[styles.stepLabel, { color: stepColor }]}>
                  {STEP_LABELS[item.step_type] || `步骤${item.step_number}`}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.dayBadge,
              {
                backgroundColor: isOverdue
                  ? '#FEE2E2'
                  : isToday
                    ? '#FEF3C7'
                    : '#E8F5E9',
              },
            ]}
          >
            <Text
              style={[
                styles.dayText,
                {
                  color: isOverdue
                    ? '#DC2626'
                    : isToday
                      ? '#D97706'
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

        <View style={styles.cardFooter}>
          <View style={styles.dateRow}>
            <FontAwesome6 name="calendar" size={13} color="#94A3B8" />
            <Text style={styles.dateText}>
              {new Date(item.scheduled_date).toLocaleDateString('zh-CN')}
            </Text>
          </View>
          {item.patient_phone ? (
            <View style={styles.phoneRow}>
              <FontAwesome6 name="phone" size={13} color="#94A3B8" />
              <Text style={styles.phoneText}>{item.patient_phone}</Text>
            </View>
          ) : null}
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
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerTitle}>随访提醒</Text>
        <Text style={styles.headerSubtitle}>
          {reminders.length > 0
            ? `${reminders.length} 项待办提醒`
            : '暂无待办提醒'}
        </Text>
      </LinearGradient>

      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome6 name="bell" size={16} color="#059669" />
            </View>
            <View>
              <Text style={styles.settingLabel}>通知提醒</Text>
              <Text style={styles.settingDesc}>提前2天开始提醒</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ true: '#059669', false: '#CBD5E1' }}
            thumbColor="#FFFFFF"
          />
        </View>
        {notificationsEnabled && (
          <View style={styles.settingDivider}>
            <TouchableOpacity style={styles.settingRow} onPress={handleTimeChange}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
                  <FontAwesome6 name="clock" size={16} color="#D97706" />
                </View>
                <Text style={styles.settingLabel}>提醒时间</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeText}>{reminderTime}</Text>
                <FontAwesome6 name="chevron-right" size={12} color="#94A3B8" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingRow, { marginTop: 8 }]}
              onPress={handleTestNotification}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#EDE9FE' }]}>
                  <FontAwesome6 name="paper-plane" size={14} color="#8B5CF6" />
                </View>
                <Text style={styles.settingLabel}>发送测试通知</Text>
              </View>
              <View style={styles.testBtn}>
                <Text style={styles.testBtnText}>发送</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={[...overdueReminders, ...upcomingReminders]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReminderItem}
        contentContainerStyle={[
          styles.listContent,
          reminders.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
        ListHeaderComponent={
          overdueReminders.length > 0 ? (
            <Text style={styles.sectionTitle}>
              <FontAwesome6 name="triangle-exclamation" size={14} color="#DC2626" /> 已逾期
            </Text>
          ) : upcomingReminders.length > 0 ? (
            <Text style={styles.sectionTitle}>
              <FontAwesome6 name="calendar-check" size={14} color="#059669" /> 即将到来
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="calendar-check" size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>暂无待办提醒</Text>
            <Text style={styles.emptyDesc}>所有随诊安排都在掌控中</Text>
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
  headerGradient: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  settingsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  settingDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  testBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    gap: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
