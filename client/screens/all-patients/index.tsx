import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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

function getStatusInfo(daysUntil: number | null, completedSteps: number = 0) {
  if (daysUntil === null) {
    if (completedSteps === 0) {
      return { label: '未开始治疗', color: '#6B7280', bg: '#F3F4F6' };
    }
    return { label: '已完成', color: '#059669', bg: '#E8F5E9' };
  }
  if (daysUntil < 0) return { label: `逾期${Math.abs(daysUntil)}天`, color: '#DC2626', bg: '#FEE2E2' };
  if (daysUntil === 0) return { label: '今天', color: '#D97706', bg: '#FEF3C7' };
  if (daysUntil <= 3) return { label: `${daysUntil}天后`, color: '#D97706', bg: '#FEF3C7' };
  return { label: `${daysUntil}天后`, color: '#059669', bg: '#E8F5E9' };
}

export default function AllPatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
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

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase().trim();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.phone.includes(query) ||
        p.notes.toLowerCase().includes(query)
    );
  }, [patients, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((p) => p.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${selectedIds.size} 位患者吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const response = await fetch(`${API_BASE}/patients/batch-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
              });
              if (!response.ok) throw new Error('删除失败');
              setSelectMode(false);
              setSelectedIds(new Set());
              fetchPatients();
            } catch (err) {
              console.error('Batch delete failed:', err);
              Alert.alert('错误', '删除失败，请重试');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderPatientCard = ({ item }: { item: Patient }) => {
    const completed = parseInt(item.completed_steps);
    const total = parseInt(item.total_steps);
    const progress = total > 0 ? completed / total : 0;
    const daysUntil = getDaysUntil(item.next_step_date);
    const status = getStatusInfo(daysUntil, completed);
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          if (selectMode) {
            toggleSelect(item.id);
          } else {
            router.push(`/patient-detail`, { patientId: item.id });
          }
        }}
        style={[styles.card, selectMode && isSelected && styles.cardSelected]}
      >
        <View style={styles.cardHeader}>
          {selectMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <FontAwesome6 name="check" size={12} color="#fff" />}
            </View>
          )}
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
        ) : completed >= total && total > 0 ? (
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIconWrap, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome6 name="circle-check" size={13} color="#059669" />
            </View>
            <Text style={[styles.nextStepText, { color: '#059669', fontWeight: '600' }]}>
              全部随访已完成
            </Text>
          </View>
        ) : completed === 0 && total === 0 ? (
          <View style={styles.nextStepRow}>
            <View style={[styles.nextStepIconWrap, { backgroundColor: '#F3F4F6' }]}>
              <FontAwesome6 name="clock" size={13} color="#9CA3AF" />
            </View>
            <Text style={[styles.nextStepText, { color: '#9CA3AF' }]}>
              未开始治疗
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle}>全部患者</Text>
            <Text style={styles.headerSubtitle}>
              {selectMode ? `已选择 ${selectedIds.size} 位` : `共 ${patients.length} 位患者`}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleSelectMode} style={styles.selectBtn}>
            <FontAwesome6
              name={selectMode ? 'xmark' : 'circle-check'}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <FontAwesome6 name="magnifying-glass" size={14} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索姓名、电话或备注"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome6 name="xmark" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPatientCard}
        contentContainerStyle={[
          styles.listContent,
          filteredPatients.length === 0 && styles.emptyContainer,
          selectMode && { paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
        ListHeaderComponent={
          selectMode && filteredPatients.length > 0 ? (
            <TouchableOpacity style={styles.selectAllRow} onPress={selectAll}>
              <View style={[styles.checkbox, selectedIds.size === filteredPatients.length && styles.checkboxSelected]}>
                {selectedIds.size === filteredPatients.length && <FontAwesome6 name="check" size={12} color="#fff" />}
              </View>
              <Text style={styles.selectAllText}>全选</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="search" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>未找到匹配的患者</Text>
            <Text style={styles.emptyDesc}>请尝试其他搜索关键词</Text>
          </View>
        }
      />

      {/* Bottom action bar for delete */}
      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bottomActionText}>
            已选择 {selectedIds.size} 位患者
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
            onPress={handleBatchDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome6 name="trash" size={16} color="#fff" />
                <Text style={styles.deleteBtnText}>删除</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleSection: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchContainer: {
    marginTop: 4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
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
    backgroundColor: '#F1F5F9',
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
  // Selection mode styles
  cardSelected: {
    borderWidth: 2,
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#DC2626',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
