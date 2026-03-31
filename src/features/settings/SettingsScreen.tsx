import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useApiKey, useSaveApiKey } from '../../hooks/useSettings';
import Constants from 'expo-constants';

export function maskApiKey(key: string): string {
  if (key.length <= 6) return '***';
  return key.slice(0, 6) + '***';
}

export function SettingsScreen() {
  const { data: savedKey, isLoading } = useApiKey();
  const saveApiKey = useSaveApiKey();
  const [inputKey, setInputKey] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }
    saveApiKey.mutate(trimmed, {
      onSuccess: () => {
        setInputKey('');
        setShowSaved(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowSaved(false), 2000);
      },
    });
  };

  const handleClear = () => {
    Alert.alert('确认清除', '确定要清除已保存的 API Key 吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => saveApiKey.mutate(null),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 标题说明 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>混元 API Key</Text>
        <Text style={styles.sectionDesc}>
          配置腾讯云混元大模型的 API Key，用于生成 AI 周报洞察。
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://console.cloud.tencent.com/hunyuan')}
        >
          <Text style={styles.link}>→ 前往腾讯云控制台获取 API Key</Text>
        </TouchableOpacity>
      </View>

      {/* 当前已保存的 key */}
      <View style={styles.section}>
        <Text style={styles.label}>当前已保存的 Key</Text>
        {isLoading ? (
          <ActivityIndicator color="#6B5B4F" style={{ marginTop: 8 }} />
        ) : savedKey ? (
          <View style={styles.savedKeyRow}>
            <Text style={styles.savedKeyText}>{maskApiKey(savedKey)}</Text>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>清除</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noKeyText}>尚未配置</Text>
        )}
      </View>

      {/* 输入新 key */}
      <View style={styles.section}>
        <Text style={styles.label}>输入新的 API Key</Text>
        <TextInput
          style={styles.input}
          value={inputKey}
          onChangeText={setInputKey}
          placeholder="输入混元 API Key"
          placeholderTextColor="#BBB"
          secureTextEntry={true}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.saveButton,
            saveApiKey.isPending && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saveApiKey.isPending}
        >
          {saveApiKey.isPending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {showSaved ? '✓ 已保存' : '保存'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 安全提示 */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          🔒 API Key 仅保存在本设备本地，不会上传到任何服务器。
        </Text>
      </View>

      {/* 版本信息 */}
      <View style={[styles.section, { alignItems: 'center' }]}>
        <Text style={styles.sectionDesc}>
          当前版本：v{Constants.expoConfig?.version ?? '未知'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  link: {
    fontSize: 13,
    color: '#6B5B4F',
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedKeyText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  noKeyText: {
    fontSize: 14,
    color: '#BBB',
    fontStyle: 'italic',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  clearButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F5F0EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  saveButton: {
    backgroundColor: '#6B5B4F',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  notice: {
    backgroundColor: '#F0EBE5',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
});
