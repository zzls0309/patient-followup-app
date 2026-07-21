import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
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

function getStatusInfo(daysUntil: number | null) {
  if (daysUntil === null) return { label: '已完成', color: '#059669', bg: '#E8F5E9' };
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
      setPatients(data);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
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
      if (data.length > 0) {
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const renderPatientCard = ({ item }: { item: Patient }) => {
    const completed = parseInt(item.completed_steps);
    const total = parseInt(item.total_steps);
    const progress = total > 0 ? completed / total : 0;
    const daysUntil = getDaysUntil(item.next_step_date);
    const status = getStatusInfo(daysUntil);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push(`/patient-detail`, { patientId: item.id })}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.patientInfo}>
            <View style={styles.avatarContainer}>
              <FontAwesome6 name="user" size={22} color="#059669" />
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
            <Text style={styles.headerTitle}>患者管理</Text>
            <Text style={styles.headerSubtitle}>
              共 {patients.length} 位患者
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
        data={patients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPatientCard}
        contentContainerStyle={[
          styles.listContent,
          patients.length === 0 && styles.emptyContainer,
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
              <FontAwesome6 name="user-plus" size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>暂无患者</Text>
            <Text style={styles.emptyDesc}>点击右上角 + 添加第一位患者</Text>
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
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnPrimary: {
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    marginLeft: 14,
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  patientPhone: {
    fontSize: 13,
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressSection: {
    marginBottom: 14,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: '#10B981',
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextStepIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepText: {
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reminderBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  reminderBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reminderBannerAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
  },
});
