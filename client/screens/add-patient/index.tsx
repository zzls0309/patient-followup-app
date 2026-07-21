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
      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：POST /api/v1/patients
       * Body 参数：name: string, phone: string, gender: string, age: number, notes: string, firstTreatmentDate: string (YYYY-MM-DD)
       */
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={20} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加患者</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>基本信息</Text>

          <View style={styles.fieldOuter}>
            <View style={styles.fieldInner}>
              <Text style={styles.fieldLabel}>姓名 *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="请输入患者姓名"
                placeholderTextColor="#B2BEC3"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.fieldOuter, { flex: 1, marginRight: 8 }]}>
              <View style={styles.fieldInner}>
                <Text style={styles.fieldLabel}>性别</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="男/女"
                  placeholderTextColor="#B2BEC3"
                  value={gender}
                  onChangeText={setGender}
                />
              </View>
            </View>
            <View style={[styles.fieldOuter, { flex: 1, marginLeft: 8 }]}>
              <View style={styles.fieldInner}>
                <Text style={styles.fieldLabel}>年龄</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="岁"
                  placeholderTextColor="#B2BEC3"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.fieldOuter}>
            <View style={styles.fieldInner}>
              <Text style={styles.fieldLabel}>联系电话</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="请输入手机号"
                placeholderTextColor="#B2BEC3"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>随访计划</Text>

          <View style={styles.fieldOuter}>
            <View style={styles.fieldInner}>
              <Text style={styles.fieldLabel}>第一次治疗日期 *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={`YYYY-MM-DD，例如：${getTomorrowDate()}`}
                placeholderTextColor="#B2BEC3"
                value={firstTreatmentDate}
                onChangeText={setFirstTreatmentDate}
              />
            </View>
          </View>

          <View style={styles.hintCard}>
            <FontAwesome6 name="circle-info" size={16} color="#059669" />
            <Text style={styles.hintText}>
              系统将根据第一次治疗日期，自动推算后续3次随访日期（每次间隔28天）
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>备注</Text>

          <View style={styles.fieldOuter}>
            <View style={[styles.fieldInner, { minHeight: 100 }]}>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="病情备注（可选）"
                placeholderTextColor="#B2BEC3"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? '创建中...' : '确认添加'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#F0F0F3',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E8EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  rowContainer: {
    flexDirection: 'row',
  },
  fieldOuter: {
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    borderRadius: 16,
    marginBottom: 12,
  },
  fieldInner: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: 15,
    color: '#2D3436',
    padding: 0,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(5,150,105,0.08)',
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
  },
  submitBtn: {
    backgroundColor: '#059669',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
