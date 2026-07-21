import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1`;

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
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchReminders = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：GET /api/v1/patients/reminders/upcoming
       * 无参数
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders();
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

          <View style={styles.dateRow}>
            <FontAwesome6 name="calendar-days" size={13} color="#636E72" />
            <Text style={styles.dateText}>
              {new Date(item.scheduled_date).toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })}
            </Text>
            {item.patient_phone ? (
              <>
                <View style={styles.divider} />
                <FontAwesome6 name="phone" size={12} color="#636E72" />
                <Text style={styles.dateText}>{item.patient_phone}</Text>
              </>
            ) : null}
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>随访提醒</Text>
        <Text style={styles.headerSubtitle}>
          {reminders.length > 0
            ? `${reminders.length} 项待处理`
            : '暂无待办'}
        </Text>
      </View>

      <FlatList
        data={[...overdueReminders, ...upcomingReminders]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReminderItem}
        contentContainerStyle={styles.listContent}
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
              <FontAwesome6 name="circle-check" size={40} color="#00B894" />
            </View>
            <Text style={styles.emptyTitle}>暂无待办提醒</Text>
            <Text style={styles.emptyDesc}>所有患者的随访都在计划中</Text>
          </View>
        }
        ListHeaderComponent={
          overdueReminders.length > 0 ? (
            <View style={styles.sectionHeader}>
              <FontAwesome6 name="triangle-exclamation" size={14} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                已逾期 ({overdueReminders.length})
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          upcomingReminders.length > 0 && overdueReminders.length > 0 ? (
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <FontAwesome6 name="clock" size={14} color="#059669" />
              <Text style={[styles.sectionTitle, { color: '#059669' }]}>
                即将到来 ({upcomingReminders.length})
              </Text>
            </View>
          ) : upcomingReminders.length > 0 && overdueReminders.length === 0 ? (
            <View style={styles.sectionHeader}>
              <FontAwesome6 name="clock" size={14} color="#059669" />
              <Text style={[styles.sectionTitle, { color: '#059669' }]}>
                即将到来 ({upcomingReminders.length})
              </Text>
            </View>
          ) : null
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
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardOuter: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  cardInner: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    color: '#2D3436',
  },
  stepLabel: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 2,
  },
  dayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#636E72',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: '#D1D9E6',
    marginHorizontal: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,184,148,0.10)',
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
  },
});
