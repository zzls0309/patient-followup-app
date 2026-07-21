import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Modal,
  ScrollView,
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
  shouldShowReminder,
  markTodayChecked,
  getReminderSummary,
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

function TimePickerColumn({
  values,
  initialValue,
  onSelect,
  label,
}: {
  values: number[];
  initialValue: number;
  onSelect: (v: number) => void;
  label: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const itemHeight = 44;
  const [currentIndex, setCurrentIndex] = useState(values.indexOf(initialValue));
  const initializedRef = useRef(false);

  // 只在首次挂载时滚动到初始位置
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const initialIdx = values.indexOf(initialValue);
      if (initialIdx >= 0) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: initialIdx * itemHeight, animated: false });
        }, 100);
      }
    }
  }, []); // 空依赖，只执行一次

  // 滚动停止时自动保存
  const handleMomentumScrollEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(Math.round(y / itemHeight), values.length - 1));
    setCurrentIndex(index);
    onSelect(values[index]);
  };

  return (
    <View style={tpStyles.column}>
      <Text style={tpStyles.columnLabel}>{label}</Text>
      <ScrollView
        ref={scrollRef}
        style={tpStyles.scrollView}
        contentContainerStyle={tpStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="center"
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        bounces={false}
        overScrollMode="never"
      >
        {values.map((v, index) => {
          const isSelected = index === currentIndex;
          return (
            <TouchableOpacity
              key={v}
              style={[tpStyles.item, isSelected && tpStyles.itemSelected]}
              activeOpacity={0.6}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
                setCurrentIndex(index);
                onSelect(v);
              }}
            >
              <Text
                style={[
                  tpStyles.itemText,
                  isSelected && tpStyles.itemTextSelected,
                ]}
              >
                {String(v).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const tpStyles = StyleSheet.create({
  column: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  scrollView: {
    height: 220,
  },
  scrollContent: {
    paddingVertical: 88,
  },
  item: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  itemSelected: {
    backgroundColor: '#E8F5E9',
  },
  itemText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#CBD5E1',
  },
  itemTextSelected: {
    color: '#059669',
    fontWeight: '700',
  },
});

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
    await setNotificationsEnabled(value);
    setNotifEnabled(value);
    if (value) {
      Alert.alert(
        '应用内提醒已开启',
        '当您打开应用时，如果有即将到期的随诊，会在首页显示提醒横幅。'
      );
    }
  };

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);

  const handleTimeChange = async () => {
    const [h, m] = reminderTime.split(':').map(Number);
    setPickerHour(h);
    setPickerMinute(m);
    setShowTimePicker(true);
  };

  const handleConfirmTime = async () => {
    const timeStr = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    await setReminderTime(timeStr);
    setRemTime(timeStr);
    setShowTimePicker(false);
  };

  const handleTestNotification = async () => {
    const summary = await getReminderSummary(overdueReminders.length, upcomingReminders.length);
    Alert.alert('随访提醒测试', summary + '\n\n应用内提醒功能正常！');
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

      <FlatList
        data={[...overdueReminders, ...upcomingReminders]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReminderItem}
        ListHeaderComponent={
          <View>
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
            {overdueReminders.length > 0 ? (
              <Text style={styles.sectionTitle}>
                <FontAwesome6 name="triangle-exclamation" size={14} color="#DC2626" /> 已逾期
              </Text>
            ) : upcomingReminders.length > 0 ? (
              <Text style={styles.sectionTitle}>
                <FontAwesome6 name="calendar-check" size={14} color="#059669" /> 即将到来
              </Text>
            ) : null}
          </View>
        }
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

      {/* 自定义时间选择器 */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowTimePicker(false)}
          />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerCancel}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>选择提醒时间</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerConfirm}>完成</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerBody}>
              <TimePickerColumn
                values={Array.from({ length: 24 }, (_, i) => i)}
                initialValue={pickerHour}
                onSelect={(v) => {
                  setPickerHour(v);
                  // 滚动停止时自动保存
                  const timeStr = `${String(v).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
                  setReminderTime(timeStr);
                  setRemTime(timeStr);
                }}
                label="时"
              />
              <Text style={styles.pickerColon}>:</Text>
              <TimePickerColumn
                values={Array.from({ length: 60 }, (_, i) => i)}
                initialValue={pickerMinute}
                onSelect={(v) => {
                  setPickerMinute(v);
                  // 滚动停止时自动保存
                  const timeStr = `${String(pickerHour).padStart(2, '0')}:${String(v).padStart(2, '0')}`;
                  setReminderTime(timeStr);
                  setRemTime(timeStr);
                }}
                label="分"
              />
            </View>
            <Text style={styles.pickerHint}>北京时间（UTC+8）</Text>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerCancel: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerConfirm: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '700',
  },
  pickerBody: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  pickerColon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 24,
  },
  pickerHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
});
