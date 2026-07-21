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

const STEP_LABELS: Record<string, string> = {
  treatment_1: '第一次治疗',
  treatment_2: '第二次治疗',
  treatment_3: '第三次治疗',
  photo: '拍照随访',
};

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusInfo(daysUntil: number | null) {
  if (daysUntil === null) return { label: '已完成', color: '#00B894', bg: 'rgba(0,184,148,0.10)' };
  if (daysUntil < 0) return { label: `逾期${Math.abs(daysUntil)}天`, color: '#EF4444', bg: 'rgba(239,68,68,0.10)' };
  if (daysUntil === 0) return { label: '今天', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' };
  if (daysUntil <= 3) return { label: `${daysUntil}天后`, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' };
  return { label: `${daysUntil}天后`, color: '#059669', bg: 'rgba(5,150,105,0.10)' };
}

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [fetchPatients])
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
        activeOpacity={0.7}
        onPress={() => router.push(`/patient-detail`, { patientId: item.id })}
        style={styles.cardOuter}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.patientInfo}>
              <View style={styles.avatarContainer}>
                <FontAwesome6
                  name="user"
                  size={20}
                  color="#059669"
                />
              </View>
              <View style={styles.nameSection}>
                <Text style={styles.patientName}>{item.name}</Text>
                {item.phone ? (
                  <Text style={styles.patientPhone}>{item.phone}</Text>
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
                  { width: `${progress * 100}%` },
                  progress >= 1 ? styles.progressBarComplete : null,
                ]}
              />
            </View>
          </View>

          {item.next_step_date && daysUntil !== null && completed < total ? (
            <View style={styles.nextStepRow}>
              <FontAwesome6 name="calendar-days" size={14} color="#636E72" />
              <Text style={styles.nextStepText}>
                下次随访：{new Date(item.next_step_date).toLocaleDateString('zh-CN')}
              </Text>
            </View>
          ) : completed >= total ? (
            <View style={styles.nextStepRow}>
              <FontAwesome6 name="circle-check" size={14} color="#00B894" />
              <Text style={[styles.nextStepText, { color: '#00B894' }]}>
                全部随访已完成
              </Text>
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>患者管理</Text>
        <Text style={styles.headerSubtitle}>
          共 {patients.length} 位患者
        </Text>
      </View>

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
              <FontAwesome6 name="user-plus" size={40} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>暂无患者</Text>
            <Text style={styles.emptyDesc}>点击下方按钮添加第一位患者</Text>
          </View>
        }
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/add-patient')}
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
      >
        <FontAwesome6 name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOuter: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  cardInner: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5,150,105,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    marginLeft: 12,
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3436',
  },
  patientPhone: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#636E72',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E8E8EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: '#00B894',
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextStepText: {
    fontSize: 13,
    color: '#636E72',
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
    backgroundColor: 'rgba(5,150,105,0.10)',
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
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
