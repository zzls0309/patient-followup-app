import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { createFormDataFile } from '@/utils';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function ImportPatientsScreen() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const router = useSafeRouter();

  const handlePickFile = async () => {
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (pickResult.canceled || !pickResult.assets[0]) return;

      const file = pickResult.assets[0];
      setImporting(true);
      setResult(null);

      const formData = new FormData();
      const formFile = await createFormDataFile(file.uri, file.name, file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      formData.append('file', formFile as unknown as Blob);

      /**
       * 服务端文件：server/src/routes/patients.ts
       * 接口：POST /api/v1/patients/import
       * Body 参数：file: FormData (xlsx/xls/csv)
       */
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/patients/import`, {
        method: 'POST',
        body: formData,
      });
      const data: ImportResult = await res.json();
      setResult(data);

      if (data.success > 0) {
        Alert.alert('导入成功', `成功导入 ${data.success} 名患者${data.failed > 0 ? `，${data.failed} 条失败` : ''}`);
      } else if (data.failed > 0) {
        Alert.alert('导入失败', `全部 ${data.failed} 条记录导入失败`);
      }
    } catch (err) {
      console.error('Import error:', err);
      Alert.alert('错误', '导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1 bg-[#F8FAFC]">
        {/* Header */}
        <View className="px-5 pt-14 pb-4 bg-white flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-[#F0FDF4] mr-3">
            <Text className="text-[#059669] text-[18px] font-bold">‹</Text>
          </TouchableOpacity>
          <Text className="text-[22px] font-bold text-[#1E293B]">导入患者数据</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-5">
          {/* Instructions Card */}
          <View className="bg-white rounded-[20px] p-5 mb-5" style={{ shadowColor: '#059669', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <Text className="text-[16px] font-bold text-[#1E293B] mb-3">Excel 模板格式</Text>
            <Text className="text-[13px] text-[#64748B] leading-[20px] mb-4">
              请准备一个 Excel 文件（.xlsx 或 .xls），表头需包含以下列：
            </Text>

            <View className="bg-[#F8FAFC] rounded-[12px] p-4 gap-2">
              {[
                { field: '姓名', required: true, example: '张三' },
                { field: '首次治疗日期', required: true, example: '2025.06.01' },
                { field: '电话', required: false, example: '13800138000' },
                { field: '性别', required: false, example: '女' },
                { field: '年龄', required: false, example: '35' },
                { field: '备注', required: false, example: '过敏性鼻炎' },
              ].map(col => (
                <View key={col.field} className="flex-row items-center justify-between py-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[13px] font-medium text-[#334155]">{col.field}</Text>
                    {col.required && <Text className="text-[11px] text-[#EF4444]">必填</Text>}
                  </View>
                  <Text className="text-[12px] text-[#94A3B8]">{col.example}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Import Button */}
          <TouchableOpacity
            onPress={handlePickFile}
            disabled={importing}
            className="bg-[#059669] rounded-[16px] py-4 items-center mb-5"
            style={{ shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[16px] font-semibold text-white">选择 Excel 文件导入</Text>
            )}
          </TouchableOpacity>

          {/* Results */}
          {result && (
            <View className="bg-white rounded-[20px] p-5 mb-5" style={{ shadowColor: '#059669', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
              <Text className="text-[16px] font-bold text-[#1E293B] mb-3">导入结果</Text>
              <View className="flex-row gap-4 mb-3">
                <View className="flex-1 bg-[#F0FDF4] rounded-[12px] p-3 items-center">
                  <Text className="text-[24px] font-bold text-[#059669]">{result.success}</Text>
                  <Text className="text-[12px] text-[#64748B]">成功</Text>
                </View>
                <View className="flex-1 bg-[#FEF2F2] rounded-[12px] p-3 items-center">
                  <Text className="text-[24px] font-bold text-[#EF4444]">{result.failed}</Text>
                  <Text className="text-[12px] text-[#64748B]">失败</Text>
                </View>
              </View>

              {result.errors.length > 0 && (
                <View className="mt-2">
                  <Text className="text-[13px] font-medium text-[#EF4444] mb-2">错误详情：</Text>
                  {result.errors.map((err, idx) => (
                    <Text key={idx} className="text-[12px] text-[#64748B] leading-[18px]">• {err}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
