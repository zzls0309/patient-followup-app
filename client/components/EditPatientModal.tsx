import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

interface EditPatientModalProps {
  visible: boolean;
  patient: {
    id: number;
    name: string;
    phone: string;
    gender: string;
    age: number;
    notes: string;
    first_treatment_date: string | null;
  };
  onSave: (data: {
    name: string;
    phone: string;
    gender: string;
    age: number;
    notes: string;
    firstTreatmentDate?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function EditPatientModal({
  visible,
  patient,
  onSave,
  onClose,
}: EditPatientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [notes, setNotes] = useState('');
  const [firstTreatmentDate, setFirstTreatmentDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(patient.name || '');
      setPhone(patient.phone || '');
      setGender(patient.gender || '');
      setAge(patient.age ? String(patient.age) : '');
      setNotes(patient.notes || '');
      setFirstTreatmentDate(patient.first_treatment_date || '');
    }
  }, [visible, patient]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('错误', '姓名不能为空');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        gender: gender.trim(),
        age: age ? parseInt(age) : 0,
        notes: notes.trim(),
        ...(firstTreatmentDate ? { firstTreatmentDate } : {}),
      });
      onClose();
    } catch (err) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.overlay}>
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <FontAwesome6 name="user-pen" size={22} color="#059669" />
                </View>
                <Text style={styles.title}>编辑患者信息</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <FontAwesome6 name="xmark" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* 姓名 */}
                <View style={styles.field}>
                  <Text style={styles.label}>姓名 *</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="请输入姓名"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* 性别 */}
                <View style={styles.field}>
                  <Text style={styles.label}>性别</Text>
                  <View style={styles.genderRow}>
                    {['男', '女'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderBtn,
                          gender === g && styles.genderBtnActive,
                        ]}
                        onPress={() => setGender(g)}
                      >
                        <Text
                          style={[
                            styles.genderText,
                            gender === g && styles.genderTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 电话 */}
                <View style={styles.field}>
                  <Text style={styles.label}>电话</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="请输入电话号码"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* 年龄 */}
                <View style={styles.field}>
                  <Text style={styles.label}>年龄</Text>
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="请输入年龄"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                  />
                </View>

                {/* 首次治疗日期 - 仅当没有治疗日期时显示 */}
                {!patient.first_treatment_date && (
                  <View style={styles.field}>
                    <Text style={styles.label}>首次治疗日期</Text>
                    <TextInput
                      style={styles.input}
                      value={firstTreatmentDate}
                      onChangeText={setFirstTreatmentDate}
                      placeholder="格式：YYYY-MM-DD（如 2026-07-23）"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.hint}>
                      填写后将自动生成随诊计划
                    </Text>
                  </View>
                )}

                {/* 备注 */}
                <View style={styles.field}>
                  <Text style={styles.label}>备注</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="请输入备注信息"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Text style={styles.saveText}>保存中...</Text>
                  ) : (
                    <Text style={styles.saveText}>保存</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  } as const,
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 40,
  } as const,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  } as const,
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 12,
    flex: 1,
  } as const,
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  } as const,
  field: {
    marginBottom: 16,
  } as const,
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  } as const,
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  } as const,
  textArea: {
    height: 80,
    paddingTop: 12,
  } as const,
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  } as const,
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  } as const,
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  } as const,
  genderBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#059669',
  } as const,
  genderText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  } as const,
  genderTextActive: {
    color: '#059669',
    fontWeight: '600',
  } as const,
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  } as const,
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  } as const,
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  } as const,
  saveBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  } as const,
  saveBtnDisabled: {
    opacity: 0.6,
  } as const,
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  } as const,
};
