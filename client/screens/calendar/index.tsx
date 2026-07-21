import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const STEP_COLORS: Record<string, string> = {
  treatment_1: '#059669',
  treatment_2: '#0891b2',
  treatment_3: '#7c3aed',
  photo: '#ea580c',
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

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：GET /api/v1/patients/calendar
       * Query 参数：year: number, month: number
       */
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/calendar?year=${year}&month=${month}`);
      const data = await res.json();
      setCalendarData(data);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchCalendar]));

  const goToPrev = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNext = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const todayStr = `${bjNow.getFullYear()}-${String(bjNow.getMonth() + 1).padStart(2, '0')}-${String(bjNow.getDate()).padStart(2, '0')}`;

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <Screen>
      <View className="flex-1 bg-[#F8FAFC]">
        {/* Header */}
        <View className="px-5 pt-14 pb-4 bg-white">
          <Text className="text-[28px] font-bold text-[#1E293B]">随访日历</Text>
          <Text className="text-[14px] text-[#64748B] mt-1">查看当月及下月随诊安排</Text>
        </View>

        {/* Month Navigation */}
        <View className="flex-row items-center justify-between px-5 py-4 bg-white">
          <TouchableOpacity onPress={goToPrev} className="w-10 h-10 items-center justify-center rounded-full bg-[#F0FDF4]">
            <Text className="text-[#059669] text-[18px] font-bold">‹</Text>
          </TouchableOpacity>
          <Text className="text-[18px] font-semibold text-[#1E293B]">
            {currentYear}年{currentMonth}月
          </Text>
          <TouchableOpacity onPress={goToNext} className="w-10 h-10 items-center justify-center rounded-full bg-[#F0FDF4]">
            <Text className="text-[#059669] text-[18px] font-bold">›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View className="flex-row px-3 pt-3 pb-1 bg-white">
          {WEEKDAYS.map(d => (
            <View key={d} className="flex-1 items-center">
              <Text className="text-[12px] font-medium text-[#94A3B8]">{d}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#059669" />
          </View>
        ) : (
          <ScrollView className="flex-1 px-3 pb-4">
            {/* Calendar Grid */}
            <View className="bg-white rounded-[20px] p-2 mt-2" style={{ shadowColor: '#059669', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
              {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIdx) => (
                <View key={weekIdx} className="flex-row">
                  {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
                    if (day === null || day === undefined) {
                      return <View key={`e-${dayIdx}`} className="flex-1 h-[72px]" />;
                    }
                    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const items = calendarData[dateStr] || [];
                    const isToday = dateStr === todayStr;

                    return (
                      <TouchableOpacity
                        key={day}
                        className={`flex-1 h-[72px] items-center pt-1 ${isToday ? 'bg-[#F0FDF4] rounded-[12px]' : ''}`}
                        onPress={() => {
                          if (items.length > 0) {
                            router.push('/patient-detail', { id: items[0].patient_id });
                          }
                        }}
                      >
                        <Text className={`text-[14px] ${isToday ? 'font-bold text-[#059669]' : 'text-[#334155]'}`}>
                          {day}
                        </Text>
                        {items.length > 0 && (
                          <View className="mt-0.5 gap-[2px] items-center">
                            {items.slice(0, 2).map((item, idx) => (
                              <View
                                key={idx}
                                className="px-[3px] rounded-[3px]"
                                style={{ backgroundColor: (STEP_COLORS[item.step_type] || '#059669') + '20' }}
                              >
                                <Text
                                  className="text-[8px] font-medium leading-[12px]"
                                  style={{ color: STEP_COLORS[item.step_type] || '#059669' }}
                                >
                                  {item.step_label}
                                </Text>
                              </View>
                            ))}
                            {items.length > 2 && (
                              <Text className="text-[8px] text-[#94A3B8]">+{items.length - 2}</Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Legend */}
            <View className="flex-row flex-wrap gap-3 mt-4 px-2">
              {Object.entries(STEP_COLORS).map(([type, color]) => {
                const labels: Record<string, string> = {
                  treatment_1: '首次治疗', treatment_2: '二次治疗', treatment_3: '三次治疗', photo: '拍照随访',
                };
                return (
                  <View key={type} className="flex-row items-center gap-1">
                    <View className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: color + '30' }}>
                      <Text className="text-[7px] text-center leading-[12px]" style={{ color }}>{labels[type][0]}</Text>
                    </View>
                    <Text className="text-[11px] text-[#64748B]">{labels[type]}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
