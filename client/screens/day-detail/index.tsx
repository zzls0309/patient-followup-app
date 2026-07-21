import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

const STEP_SHORT: Record<string, string> = {
  treatment_1: '首次治疗',
  treatment_2: '二次治疗',
  treatment_3: '三次治疗',
  photo: '拍照随访',
};

const STEP_COLORS: Record<string, string> = {
  treatment_1: '#059669',
  treatment_2: '#0EA5E9',
  treatment_3: '#8B5CF6',
  photo: '#F59E0B',
};

interface DayPatient {
  patient_id: number;
  patient_name: string;
  phone: string;
  step_type: string;
  step_label: string;
  scheduled_date: string;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${year}年${parseInt(month)}月${parseInt(day)}日`;
}

export default function DayDetailScreen() {
  const { date } = useSafeSearchParams<{ date: string }>();
  const [patients, setPatients] = useState<DayPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchDayPatients = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/calendar/day?date=${date}`
      );
      const data = await response.json();
      setPatients(data);
    } catch (err) {
      console.error('Failed to fetch day patients:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      fetchDayPatients();
    }, [fetchDayPatients])
  );

  const renderPatient = ({ item }: { item: DayPatient }) => {
    const stepColor = STEP_COLORS[item.step_type] || '#059669';
    const stepLabel = STEP_SHORT[item.step_type] || item.step_label;

    return (
      <TouchableOpacity
        style={styles.patientCard}
        activeOpacity={0.7}
        onPress={() => router.push('/patient-detail', { patientId: item.patient_id })}
      >
        <View style={styles.patientInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.patientName}>{item.patient_name}</Text>
            <View style={[styles.stepBadge, { backgroundColor: stepColor }]}>
              <Text style={styles.stepBadgeText}>{stepLabel}</Text>
            </View>
          </View>
          {item.phone ? (
            <View style={styles.phoneRow}>
              <FontAwesome6 name="phone" size={12} color="#94A3B8" />
              <Text style={styles.phoneText}>{item.phone}</Text>
            </View>
          ) : null}
        </View>
        <FontAwesome6 name="chevron-right" size={14} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeAreaEdges={['left', 'right']}>
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{date ? formatDate(date) : ''}</Text>
            <Text style={styles.headerSubtitle}>
              {loading ? '加载中...' : `共 ${patients.length} 位患者需要随诊`}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : patients.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome6 name="calendar-check" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>当日无随诊安排</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => `${item.patient_id}-${item.step_type}`}
          renderItem={renderPatient}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  patientInfo: {
    flex: 1,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
