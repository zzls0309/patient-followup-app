import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1`;

const STEP_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  treatment_1: { label: '第一次治疗', icon: 'syringe', color: '#059669' },
  treatment_2: { label: '第二次治疗', icon: 'syringe', color: '#0EA5E9' },
  treatment_3: { label: '第三次治疗', icon: 'syringe', color: '#8B5CF6' },
  photo: { label: '拍照随访', icon: 'camera', color: '#F59E0B' },
};

interface FollowupStep {
  id: number;
  patient_id: number;
  step_number: number;
  step_type: string;
  scheduled_date: string;
  completed_date: string | null;
  notes: string;
}

interface PatientDetail {
  id: number;
  name: string;
  phone: string;
  gender: string;
  age: number;
  notes: string;
  steps: FollowupStep[];
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 滚动列组件 - 使用 snapToInterval，正确的居中方案
function ScrollColumn({
  items,
  initialIndex,
  onSelect,
  itemHeight,
}: {
  items: number[];
  initialIndex: number;
  onSelect: (value: number) => void;
  itemHeight: number;
}) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const initializedRef = useRef(false);

  const visibleCount = 5;
  const visibleHeight = itemHeight * visibleCount;
  // 选中项在中间，所以顶部需要填充 (visibleCount - 1) / 2 * itemHeight
  const paddingVertical = itemHeight * Math.floor(visibleCount / 2);

  // 只在首次挂载时滚动到初始位置
  useEffect(() => {
    if (!initializedRef.current && initialIndex >= 0) {
      initializedRef.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ 
          offset: initialIndex * itemHeight, 
          animated: false 
        });
      }, 100);
    }
  }, []);

  // 滚动结束时计算当前选中的索引
  const handleMomentumScrollEnd = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(Math.round(offsetY / itemHeight), items.length - 1));
    setCurrentIndex(index);
    onSelect(items[index]);
  };

  const renderItem = useCallback(({ item, index }: { item: number; index: number }) => {
    const distance = Math.abs(index - currentIndex);
    const opacity = Math.max(0.3, 1 - distance * 0.3);
    const scale = Math.max(0.8, 1 - distance * 0.1);
    const isSelected = index === currentIndex;
    return (
      <View 
        style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center', width: '100%' }}
      >
        <Text style={{
          fontSize: 24 * scale,
          opacity,
          fontWeight: isSelected ? '700' : '400',
          color: isSelected ? '#059669' : '#64748B',
        }}>
          {String(item).padStart(2, '0')}
        </Text>
      </View>
    );
  }, [currentIndex, itemHeight]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  }), [itemHeight]);

  return (
    <View style={{ height: visibleHeight, width: '100%' }}>
      {/* 选中高亮条 - 在中间位置 */}
      <View style={{
        position: 'absolute',
        top: paddingVertical,
        left: 0,
        right: 0,
        height: itemHeight,
        backgroundColor: 'rgba(5, 150, 105, 0.08)',
        borderRadius: 10,
        zIndex: 0,
      }} />
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => String(item)}
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{ 
          paddingTop: paddingVertical,
          paddingBottom: paddingVertical,
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        bounces={false}
        overScrollMode="never"
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        removeClippedSubviews={false}
      />
    </View>
  );
}

// 日期选择器弹窗
function DatePickerModal({
  visible,
  initialDate,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initialDate: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const ITEM_HEIGHT = 44;
  const getToday = () => new Date();

  const [year, setYear] = useState(() => getToday().getFullYear());
  const [month, setMonth] = useState(() => getToday().getMonth() + 1);
  const [day, setDay] = useState(() => getToday().getDate());

  // 每次弹窗打开时，重新获取当前日期
  useEffect(() => {
    if (visible) {
      const now = getToday();
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
      setDay(now.getDate());
    }
  }, [visible]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const years = Array.from({ length: 10 }, (_, i) => getToday().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleYearChange = (v: number) => setYear(v);
  const handleMonthChange = (v: number) => {
    setMonth(v);
    const maxDay = new Date(year, v, 0).getDate();
    if (day > maxDay) setDay(maxDay);
  };
  const handleDayChange = (v: number) => setDay(v);

  const handleConfirm = () => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onConfirm(dateStr);
  };

  const yearIndex = years.indexOf(year);
  const monthIndex = months.indexOf(month);
  const dayIndex = days.indexOf(day);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={dpStyles.overlay}>
        <View style={dpStyles.container}>
          <View style={dpStyles.header}>
            <Text style={dpStyles.title}>选择完成日期</Text>
            <Text style={dpStyles.subtitle}>滚动选择年、月、日</Text>
          </View>
          <View style={dpStyles.columnsWrapper}>
            <View style={dpStyles.column}>
              <Text style={dpStyles.columnLabel}>年</Text>
              <ScrollColumn items={years} initialIndex={yearIndex >= 0 ? yearIndex : 0} onSelect={handleYearChange} itemHeight={ITEM_HEIGHT} />
            </View>
            <View style={dpStyles.column}>
              <Text style={dpStyles.columnLabel}>月</Text>
              <ScrollColumn items={months} initialIndex={monthIndex >= 0 ? monthIndex : 0} onSelect={handleMonthChange} itemHeight={ITEM_HEIGHT} />
            </View>
            <View style={dpStyles.column}>
              <Text style={dpStyles.columnLabel}>日</Text>
              <ScrollColumn items={days} initialIndex={dayIndex >= 0 ? dayIndex : 0} onSelect={handleDayChange} itemHeight={ITEM_HEIGHT} />
            </View>
          </View>
          <View style={dpStyles.footer}>
            <TouchableOpacity style={dpStyles.cancelBtn} onPress={onCancel}>
              <Text style={dpStyles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dpStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={dpStyles.confirmText}>确认完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  columnsWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 16,
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
  columnLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default function PatientDetailScreen() {
  const { patientId } = useSafeSearchParams<{ patientId: number }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [pendingStep, setPendingStep] = useState<FollowupStep | null>(null);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const fetchPatient = useCallback(async () => {
    if (!patientId) return;
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}`);
      if (!response.ok) throw new Error('获取失败');
      const data = await response.json();
      setPatient(data);
    } catch (err) {
      console.error('Failed to fetch patient:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      fetchPatient();
    }, [fetchPatient])
  );

  const handleMarkComplete = (step: FollowupStep) => {
    setPendingStep(step);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = async (selectedDate: string) => {
    if (!pendingStep || !patientId) return;
    setDatePickerVisible(false);

    const plannedDate = pendingStep.scheduled_date;
    const isOnTime = selectedDate === plannedDate;

    try {
      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：PUT /api/v1/patients/:patientId/steps/:stepId
       * Body 参数：completed_date: string (YYYY-MM-DD)
       */
      const response = await fetch(
        `${API_BASE}/patients/${patientId}/steps/${pendingStep.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed_date: selectedDate }),
        }
      );
      if (!response.ok) throw new Error('更新失败');
      const data = await response.json();
      if (data.allSteps) {
        setPatient(prev => prev ? { ...prev, steps: data.allSteps } : prev);
      }
      if (!isOnTime) {
        Alert.alert('已调整', '后续随诊日期已根据实际完成日期自动调整');
      }
    } catch (err) {
      Alert.alert('错误', '操作失败，请重试');
    }
    setPendingStep(null);
  };

  const handleResetStep = async (step: FollowupStep) => {
    Alert.alert('重置步骤', `确认重置「${STEP_CONFIG[step.step_type]?.label}」为未完成？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认重置',
        onPress: async () => {
          try {
            const response = await fetch(
              `${API_BASE}/patients/${patientId}/steps/${step.id}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed_date: null }),
              }
            );
            if (!response.ok) throw new Error('更新失败');
            fetchPatient();
          } catch (err) {
            Alert.alert('错误', '操作失败，请重试');
          }
        },
      },
    ]);
  };

  const handleDeletePatient = () => {
    Alert.alert('删除患者', `确认删除患者「${patient?.name}」？此操作不可恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE}/patients/${patientId}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('删除失败');
            router.back();
          } catch (err) {
            Alert.alert('错误', '删除失败，请重试');
          }
        },
      },
    ]);
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

  if (!patient) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>患者信息加载失败</Text>
        </View>
      </Screen>
    );
  }

  const completedCount = patient.steps.filter((s) => s.completed_date).length;
  const totalCount = patient.steps.length;
  const allDone = completedCount >= totalCount;

  return (
    <Screen safeAreaEdges={['left', 'right']}>
      <LinearGradient
        colors={['#059669', '#10B981', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <FontAwesome6 name="chevron-left" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>随访详情</Text>
          <TouchableOpacity onPress={handleDeletePatient} style={styles.headerBtn}>
            <FontAwesome6 name="trash" size={16} color="#FCA5A5" />
          </TouchableOpacity>
        </View>

        <View style={styles.patientSummary}>
          <View style={styles.avatarLarge}>
            <FontAwesome6 name="user" size={28} color="#fff" />
          </View>
          <View style={styles.patientMeta}>
            <Text style={styles.patientName}>{patient.name}</Text>
            <View style={styles.metaRow}>
              {patient.gender ? <Text style={styles.metaText}>{patient.gender}</Text> : null}
              {patient.age ? <Text style={styles.metaText}>{patient.age}岁</Text> : null}
              {patient.phone ? <Text style={styles.metaText}>{patient.phone}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{completedCount}</Text>
            <Text style={styles.progressLabel}>已完成</Text>
          </View>
          <View style={styles.progressDivider} />
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{totalCount - completedCount}</Text>
            <Text style={styles.progressLabel}>待完成</Text>
          </View>
          <View style={styles.progressDivider} />
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{totalCount}</Text>
            <Text style={styles.progressLabel}>总计</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {patient.notes ? (
          <View style={styles.notesCard}>
            <FontAwesome6 name="note-sticky" size={14} color="#64748B" />
            <Text style={styles.notesText}>{patient.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>随访时间线</Text>

        {patient.steps.map((step, index) => {
          const config = STEP_CONFIG[step.step_type] || {
            label: `步骤${step.step_number}`,
            icon: 'circle',
            color: '#64748B',
          };
          const isCompleted = !!step.completed_date;
          const daysUntil = getDaysUntil(step.scheduled_date);
          const isOverdue = !isCompleted && daysUntil < 0;
          const isToday = !isCompleted && daysUntil === 0;
          const isLast = index === patient.steps.length - 1;

          return (
            <View key={step.id} style={styles.timelineItem}>
              {!isLast && (
                <View
                  style={[
                    styles.timelineLine,
                    isCompleted && { backgroundColor: '#10B981' },
                  ]}
                />
              )}

              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: isCompleted
                      ? '#10B981'
                      : isOverdue
                        ? '#EF4444'
                        : isToday
                          ? '#F59E0B'
                          : config.color,
                  },
                ]}
              >
                <FontAwesome6
                  name={isCompleted ? 'check' : (config.icon as any)}
                  size={14}
                  color="#FFFFFF"
                />
              </View>

              <View style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepLabel}>{config.label}</Text>
                  {isCompleted ? (
                    <View style={styles.completedBadge}>
                      <FontAwesome6 name="circle-check" size={12} color="#10B981" />
                      <Text style={styles.completedText}>已完成</Text>
                    </View>
                  ) : isOverdue ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.statusText, { color: '#DC2626' }]}>
                        逾期{Math.abs(daysUntil)}天
                      </Text>
                    </View>
                  ) : isToday ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.statusText, { color: '#D97706' }]}>今天</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.statusText, { color: '#059669' }]}>
                        {daysUntil}天后
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.dateRow}>
                  <FontAwesome6 name="calendar" size={12} color="#94A3B8" />
                  <Text style={styles.dateText}>
                    计划：{new Date(step.scheduled_date).toLocaleDateString('zh-CN')}
                  </Text>
                </View>

                {isCompleted && step.completed_date && (
                  <View style={styles.dateRow}>
                    <FontAwesome6 name="circle-check" size={12} color="#10B981" />
                    <Text style={[styles.dateText, { color: '#10B981' }]}>
                      完成：{new Date(step.completed_date).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                )}

                {!isCompleted ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleMarkComplete(step)}
                    style={styles.completeBtn}
                  >
                    <FontAwesome6 name="check" size={14} color="#059669" />
                    <Text style={styles.completeBtnText}>标记完成</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleResetStep(step)}
                    style={styles.resetBtn}
                  >
                    <FontAwesome6 name="rotate-left" size={12} color="#94A3B8" />
                    <Text style={styles.resetBtnText}>重置</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal
        visible={datePickerVisible}
        initialDate={new Date().toISOString().split('T')[0]}
        onConfirm={handleDateConfirm}
        onCancel={() => {
          setDatePickerVisible(false);
          setPendingStep(null);
        }}
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
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  headerGradient: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  patientSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientMeta: {
    marginLeft: 16,
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
    fontWeight: '500',
  },
  progressDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notesText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
    minHeight: 100,
  },
  timelineLine: {
    position: 'absolute',
    left: 17,
    top: 36,
    width: 2,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  timelineDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepCard: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.06)',
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  completeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
