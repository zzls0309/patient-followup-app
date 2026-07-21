import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const STEP_COLORS: Record<string, string> = {
  treatment_1: '#059669',
  treatment_2: '#0EA5E9',
  treatment_3: '#8B5CF6',
  photo: '#F59E0B',
};

const STEP_SHORT: Record<string, string> = {
  treatment_1: '首次',
  treatment_2: '二次',
  treatment_3: '三次',
  photo: '拍照',
};

interface CalendarItem {
  patient_name: string;
  step_label: string;
  step_type: string;
  patient_id: number;
}

function getBJNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 60 * 60000);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export default function CalendarScreen() {
  const bjNow = getBJNow();
  const [currentYear, setCurrentYear] = useState(bjNow.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(bjNow.getMonth() + 1);
  const [calendarData, setCalendarData] = useState<Record<string, CalendarItem[]>>({});
  const [loading, setLoading] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/calendar?year=${year}&month=${month}`
      );
      const data = await response.json();
      setCalendarData(data);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCalendar(currentYear, currentMonth);
    }, [currentYear, currentMonth, fetchCalendar])
  );

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(bjNow.getFullYear());
    setCurrentMonth(bjNow.getMonth() + 1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const todayBJ = getBJNow();
  const isCurrentMonth = todayBJ.getFullYear() === currentYear && todayBJ.getMonth() + 1 === currentMonth;
  const todayDate = isCurrentMonth ? todayBJ.getDate() : -1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleDayPress = (day: number) => {
    const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const items = calendarData[dateKey] || [];
    if (items.length > 0) {
      router.push('/day-detail', { date: dateKey, count: items.length });
    }
  };

  return (
    <Screen safeAreaEdges={['left', 'right']}>
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerTitle}>随访日历</Text>
        <Text style={styles.headerSubtitle}>查看每月随诊安排</Text>
      </LinearGradient>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
          <FontAwesome6 name="chevron-left" size={16} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday}>
          <Text style={styles.monthLabel}>{currentYear}年{currentMonth}月</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
          <FontAwesome6 name="chevron-right" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((wd) => (
              <View key={wd} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, wd === '日' && styles.weekdaySun]}>{wd}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((day, idx) => {
              const dateKey = day ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const items = dateKey ? calendarData[dateKey] || [] : [];
              const isToday = day === todayDate;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dayCell, isToday && styles.todayCell, items.length > 0 && styles.hasEventCell]}
                  disabled={!day || items.length === 0}
                  activeOpacity={0.6}
                  onPress={() => day && handleDayPress(day)}
                >
                  {day ? (
                    <>
                      <View style={[styles.dayNumberWrap, isToday && styles.todayNumberWrap]}>
                        <Text style={[styles.dayText, isToday && styles.todayText]}>
                          {day}
                        </Text>
                      </View>
                      {items.length > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>{items.length}人</Text>
                        </View>
                      )}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legendSection}>
            <Text style={styles.legendTitle}>步骤图例</Text>
            <View style={styles.legendRow}>
              {Object.entries(STEP_COLORS).map(([type, color]) => (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendLabel}>{STEP_SHORT[type]}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 120,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  weekdaySun: {
    color: '#EF4444',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 72,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  todayCell: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legendSection: {
    marginTop: 20,
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
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  hasEventCell: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  dayNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  todayNumberWrap: {
    backgroundColor: '#059669',
  },
});
