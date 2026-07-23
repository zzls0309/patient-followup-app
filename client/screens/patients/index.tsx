import React, { useState, useCallback, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { getNotificationsEnabled, shouldShowReminder, markTodayChecked } from '@/utils/notifications';

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1`;

interface Patient {
  id: number;
  name: string;
  phone: string;
  gender: string;
  age: number;
  notes: string;
  first_treatment_date: string | null;
  second_treatment_date: string | null;
  third_treatment_date: string | null;
  photo_date: string | null;
  completed_steps: string;
  total_steps: string;
  next_step_date: string | null;
  created_at: string;
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusInfo(daysUntil: number | null, hasAnyDate: boolean = false) {
  if (daysUntil === null) {
    // 如果没有任何治疗日期，显示"未开始治疗"
    if (!hasAnyDate) return { label: '未开始治疗', color: '#6B7280', bg: '#F3F4F6' };
    return { label: '已完成', color: '#059669', bg: '#E8F5E9' };
  }
  if (daysUntil < 0) return { label: `逾期${Math.abs(daysUntil)}天`, color: '#DC2626', bg: '#FEE2E2' };
  if (daysUntil === 0) return { label: '今天', color: '#D97706', bg: '#FEF3C7' };
  if (daysUntil <= 3) return { label: `${daysUntil}天后`, color: '#D97706', bg: '#FEF3C7' };
  return { label: `${daysUntil}天后`, color: '#059669', bg: '#E8F5E9' };
}

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [showReminder, setShowReminder] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/patients`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setPatients(data);
      } else {
        console.error('API returned non-array:', data);
        setPatients([]);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const checkReminders = useCallback(async () => {
    const enabled = await getNotificationsEnabled();
    if (!enabled) return;

    const shouldShow = await shouldShowReminder();
    if (!shouldShow) return;

    try {
      const response = await fetch(`${API_BASE}/patients/reminders/upcoming`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setReminderCount(data.length);
        setShowReminder(true);
        await markTodayChecked();
      }
    } catch (err) {
      console.error('Failed to check reminders:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
      checkReminders();
    }, [fetchPatients, checkReminders])
  );

  // Filter patients: overdue within 7 days OR upcoming within 7 days
  const upcomingPatients = useMemo(() => {
    return patients.filter((p) => {
      const days = getDaysUntil(p.next_step_date);
      if (days === null) return false;
      // Show: overdue up to 7 days (days >= -7) OR upcoming within 7 days (days <= 7)
      return days >= -7 && days <= 7;
    }).sort((a, b) => {
      // Sort by days until: overdue first, then today, then upcoming
      const daysA = getDaysUntil(a.next_step_date) ?? 999;
      const daysB = getDaysUntil(b.next_step_date) ?? 999;
      return daysA - daysB;
    });
  }, [patients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const renderPatientCard = ({ item }: { item: Patient }) => {
    const completed = parseInt(item.completed_steps);
    const total = parseInt(item.total_steps);
    const progress = total > 0 ? completed / total : 0;
    const daysUntil = getDaysUntil(item.next_step_date);
    // 判断是否有任何治疗日期
    const hasAnyDate = item.first_treatment_date || item.second_treatment_date || item.third_treatment_date || item.photo_date;
    const status = getStatusInfo(daysUntil, !!hasAnyDate);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push(`/patient-detail`, { patientId: item.id })}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.patientInfo}>
            <View style={styles.avatarContainer}>
              <FontAwesome6 name="user" size={16} color="#059669" />
            </View>
            <View style={styles.nameSection}>
              <Text style={styles.patientName}>{item.name}</Text>
              {item.phone ? (
                <View style={styles.phoneRow}>
                  <FontAwesome6 name="phone" size={11} color="#94A3B8" />
                  <Text style={styles.patientPhone}>{item.phone}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>随访进度</Text>
            <Text style={styles.progressCount}>{completed}/{total}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(progress * 100, 2)}%` },
                progress >= 1 ? styles.progressBarComplete : null,
              ]}
            />
          </View>
        </View>

        {item.next_step_date && daysUntil !== null && completed < total ? (
          <View style={styles.nextStepRow}>
            <View style={styles.nextStepIconWrap}>
              <FontAwesome6 name="calendar-days" size={13} color="#64748B" />
            </View>
            <Text style={styles.nextStepText}>
              下次随访：{new Date(item.next_step_date).toLocaleDateString('zh-CN')}
            </Text>
          </View>
        ) : completed >= total ? (
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIconWrap, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome6 name="circle-check" size={13} color="#059669" />
            </View>
            <Text style={[styles.nextStepText, { color: '#059669', fontWeight: '600' }]}>
              全部随访已完成
            </Text>
          </View>
        ) : null}
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
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>本周随诊</Text>
            <Text style={styles.headerSubtitle}>
              {upcomingPatients.length} 位患者待随诊
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push('/import-patients')}
            >
              <FontAwesome6 name="file-import" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnPrimary]}
              onPress={() => router.push('/add-patient')}
            >
              <FontAwesome6 name="plus" size={18} color="#059669" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {showReminder && reminderCount > 0 && (
        <TouchableOpacity
          style={styles.reminderBanner}
          activeOpacity={0.8}
          onPress={() => {
            setShowReminder(false);
            router.navigate('/(tabs)/reminders');
          }}
        >
          <View style={styles.reminderBannerLeft}>
            <View style={styles.reminderBannerIcon}>
              <FontAwesome6 name="bell" size={16} color="#D97706" />
            </View>
            <Text style={styles.reminderBannerText}>
              {reminderCount} 个随诊提醒待处理
            </Text>
          </View>
          <View style={styles.reminderBannerRight}>
            <Text style={styles.reminderBannerAction}>查看</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#D97706" />
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={upcomingPatients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPatientCard}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          upcomingPatients.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
        ListFooterComponent={<View style={{ height: 20 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="calendar-check" size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>本周暂无随诊</Text>
            <Text style={styles.emptyDesc}>点击下方按钮查看全部患者</Text>
          </View>
        }
      />

      {/* Bottom button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.allPatientsBtn}
          onPress={() => router.push('/all-patients')}
        >
          <FontAwesome6 name="users" size={16} color="#059669" />
          <Text style={styles.allPatientsBtnText}>全部患者</Text>
          <Text style={styles.allPatientsCount}>({patients.length})</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnPrimary: {
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    marginLeft: 10,
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  patientPhone: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  progressBarBg: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: '#10B981',
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextStepIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94A3B8',
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.15)',
  },
  reminderBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(217,119,6,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  reminderBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderBannerAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  allPatientsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.15)',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    alignSelf: 'center',
  },
  allPatientsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  allPatientsCount: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 4,
  },
});
