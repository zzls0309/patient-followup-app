import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1`;

export default function AddPatientScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [notes, setNotes] = useState('');
  const [firstTreatmentDate, setFirstTreatmentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入患者姓名');
      return;
    }
    if (!firstTreatmentDate) {
      Alert.alert('提示', '请选择第一次治疗日期');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          gender,
          age: age ? parseInt(age) : 0,
          notes: notes.trim(),
          firstTreatmentDate,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '创建失败');
      }

      Alert.alert('成功', '患者添加成功，已自动创建4次随访计划', [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('错误', err instanceof Error ? err.message : '添加失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

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
          <Text style={styles.headerTitle}>添加患者</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>基本信息</Text>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>姓名 *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="请输入患者姓名"
              placeholderTextColor="#CBD5E1"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.fieldCard, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.fieldLabel}>性别</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="男/女"
                placeholderTextColor="#CBD5E1"
                value={gender}
                onChangeText={setGender}
              />
            </View>
            <View style={[styles.fieldCard, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.fieldLabel}>年龄</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="岁"
                placeholderTextColor="#CBD5E1"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>联系电话</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="请输入手机号"
              placeholderTextColor="#CBD5E1"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.sectionDivider}>
            <FontAwesome6 name="calendar-plus" size={18} color="#059669" />
            <Text style={styles.sectionTitle}>随访计划</Text>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>第一次治疗日期 *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={`YYYY-MM-DD，例如：${getTomorrowDate()}`}
              placeholderTextColor="#CBD5E1"
              value={firstTreatmentDate}
              onChangeText={setFirstTreatmentDate}
            />
          </View>

          <View style={styles.hintCard}>
            <FontAwesome6 name="circle-info" size={16} color="#059669" />
            <Text style={styles.hintText}>
              系统将根据第一次治疗日期，自动推算后续3次随访日期（每次间隔28天）
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>备注</Text>

          <View style={[styles.fieldCard, { minHeight: 100 }]}>
            <TextInput
              style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="病情备注（可选）"
              placeholderTextColor="#CBD5E1"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          >
            {submitting ? (
              <Text style={styles.submitBtnText}>创建中...</Text>
            ) : (
              <>
                <FontAwesome6 name="check" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>确认添加</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  fieldInput: {
    fontSize: 16,
    color: '#1E293B',
    padding: 0,
    fontWeight: '500',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  hintText: {
    fontSize: 13,
    color: '#059669',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
