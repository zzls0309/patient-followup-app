import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
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

export default function PatientDetailScreen() {
  const { patientId } = useSafeSearchParams<{ patientId: number }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handleMarkComplete = async (step: FollowupStep) => {
    const today = new Date().toISOString().split('T')[0];
    const plannedDate = step.scheduled_date;
    const isOnTime = today === plannedDate;
    const message = isOnTime
      ? `确认完成「${STEP_CONFIG[step.step_type]?.label || '此步骤'}」？\n完成日期：${today}`
      : `完成日期（${today}）与计划日期（${plannedDate}）不同，后续随诊日期将自动调整。\n\n确认完成？`;

    Alert.alert(
      '确认完成',
      message,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认完成',
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE}/patients/${patientId}/steps/${step.id}`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ completed_date: today }),
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
          },
        },
      ]
    );
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
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
    fontSize: 22,
    fontWeight: '800',
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
