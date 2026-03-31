import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCreateFragment } from '../hooks/useFragments';
import { useApiKey } from '../hooks/useSettings';
import { describePhoto } from '../services/ai/photoDescriber';
import { usePhotoDescription } from '../hooks/usePhotoDescription';

export function FragmentInput() {
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const {
    dispatch: descDispatch,
    isGenerating: isGeneratingDescription,
    isEditing: isEditingDescription,
    isRegenerating: isRegeneratingWithPrompt,
    description: photoDescription,
    draft: editDescriptionText,
    additionalPrompt: additionalPromptText,
  } = usePhotoDescription();
  const inputRef = useRef<TextInput>(null);
  const createFragment = useCreateFragment();

  const { data: apiKey } = useApiKey();

  const canSend =
    (text.trim().length > 0 || photoUri !== null) &&
    !isGeneratingDescription;

  function aiErrorMessage(error: import('../services/ai/client').AIError): string {
    switch (error.kind) {
      case 'no_api_key':   return 'API Key 未配置，请在设置中填写腾讯云混元密钥。';
      case 'auth':         return `API Key 无效：${error.message}`;
      case 'rate_limit':   return '请求过于频繁，请稍后再试。';
      case 'network':      return `网络错误：${error.message}`;
      case 'invalid_response': return `AI 返回内容异常：${error.raw}`;
    }
  }

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要相册权限', '请在系统设置中允许「意义编织」访问你的相册。', [{ text: '好的' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        descDispatch({ type: 'RESET' });

        // Auto-generate description
        if (apiKey) {
          descDispatch({ type: 'GENERATE_START' });
          try {
            const descResult = await describePhoto(uri, apiKey);
            if (descResult.ok) {
              descDispatch({ type: 'GENERATE_SUCCESS', description: descResult.value });
            } else {
              descDispatch({ type: 'GENERATE_FAILURE' });
              Alert.alert('AI 生成描述失败', aiErrorMessage(descResult.error));
            }
          } catch (e) {
            descDispatch({ type: 'GENERATE_FAILURE' });
            Alert.alert('AI 生成描述失败', e instanceof Error ? e.message : String(e));
          }
        }
      }
    } catch (e) {
      console.warn('Photo picker failed:', e);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!photoUri || !apiKey) return;
    const prompt = additionalPromptText.trim() || undefined;
    descDispatch({ type: 'GENERATE_START' });
    try {
      const descResult = await describePhoto(photoUri, apiKey, prompt);
      if (descResult.ok) {
        descDispatch({ type: 'REGEN_SUCCESS', description: descResult.value });
      } else {
        descDispatch({ type: 'GENERATE_FAILURE' });
        Alert.alert('重新生成失败', aiErrorMessage(descResult.error));
      }
    } catch (e) {
      descDispatch({ type: 'GENERATE_FAILURE' });
      Alert.alert('重新生成失败', e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartEdit = () => {
    descDispatch({ type: 'EDIT_START', currentDescription: photoDescription ?? '' });
  };

  const handleSaveEdit = () => {
    descDispatch({ type: 'EDIT_COMMIT' });
  };

  const handleSend = () => {
    if (!canSend) return;

    createFragment.mutate(
      {
        content: text.trim(),
        photoUri: photoUri ?? undefined,
        photoDescription: photoDescription ?? undefined,
      },
      {
        onSuccess: () => {
          setText('');
          setPhotoUri(null);
          descDispatch({ type: 'RESET' });
          // Keep keyboard open for continuous input
        },
      }
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Photo preview */}
      {photoUri && (
        <View style={styles.photoCard}>
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <TouchableOpacity
              style={styles.removeMedia}
              onPress={() => {
                setPhotoUri(null);
                descDispatch({ type: 'RESET' });
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.removeMediaText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Description area */}
          {isGeneratingDescription && (
            <View style={styles.descriptionLoading}>
              <ActivityIndicator size="small" color="#6B5B4F" />
              <Text style={styles.descriptionLoadingText}>AI 正在理解这张照片...</Text>
            </View>
          )}

          {!isGeneratingDescription && isEditingDescription && (
            <View style={styles.descriptionEditBox}>
              <TextInput
                style={styles.descriptionEditInput}
                value={editDescriptionText}
                onChangeText={(text) => descDispatch({ type: 'DRAFT_CHANGE', draft: text })}
                multiline
                autoFocus
                placeholder="输入对照片的描述..."
                placeholderTextColor="#A0A0A0"
              />
              <TouchableOpacity style={styles.descriptionEditSave} onPress={handleSaveEdit}>
                <Text style={styles.descriptionEditSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isGeneratingDescription && !isEditingDescription && photoDescription && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{photoDescription}</Text>
              <View style={styles.descriptionActions}>
                <TouchableOpacity style={styles.descriptionBtn} onPress={handleStartEdit}>
                  <Text style={styles.descriptionBtnText}>✏️ 编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.descriptionBtn}
                  onPress={() => descDispatch({ type: 'REGEN_TOGGLE' })}
                >
                  <Text style={styles.descriptionBtnText}>🔄 重新生成</Text>
                </TouchableOpacity>
              </View>
              {isRegeneratingWithPrompt && (
                <View style={styles.additionalPromptRow}>
                  <TextInput
                    style={styles.additionalPromptInput}
                    value={additionalPromptText}
                    onChangeText={(text) => descDispatch({ type: 'REGEN_PROMPT_CHANGE', prompt: text })}
                    placeholder={'补充说明（可选，如\u201c这是我的朋友小李\u201d）'}
                    placeholderTextColor="#A0A0A0"
                  />
                  <TouchableOpacity
                    style={styles.additionalPromptBtn}
                    onPress={handleRegenerateDescription}
                  >
                    <Text style={styles.additionalPromptBtnText}>生成</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {!isGeneratingDescription && !isEditingDescription && !photoDescription && (
            <View style={styles.descriptionActions}>
              <TouchableOpacity style={styles.descriptionBtn} onPress={handleStartEdit}>
                <Text style={styles.descriptionBtnText}>✏️ 手动添加描述</Text>
              </TouchableOpacity>
              {apiKey && (
                <TouchableOpacity style={styles.descriptionBtn} onPress={handleRegenerateDescription}>
                  <Text style={styles.descriptionBtnText}>🔄 AI 生成描述</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.container}>
        {/* Photo picker button — native only */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={handlePickPhoto}
            disabled={createFragment.isPending || isGeneratingDescription}
          >
            <Text style={styles.mediaButtonText}>🖼</Text>
          </TouchableOpacity>
        )}

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="记录此刻的想法..."
          placeholderTextColor="#A0A0A0"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {canSend && (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={createFragment.isPending}
          >
            <Text style={styles.sendText}>
              {createFragment.isPending ? '...' : '记录'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  photoCard: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  previewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  descriptionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  descriptionLoadingText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  descriptionBox: {
    marginTop: 8,
    backgroundColor: '#F5F0EB',
    borderRadius: 8,
    padding: 10,
  },
  descriptionText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  descriptionActions: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  descriptionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EDE8E3',
    borderRadius: 12,
  },
  descriptionBtnText: {
    fontSize: 12,
    color: '#6B5B4F',
    fontWeight: '500',
  },
  additionalPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  additionalPromptInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#333',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CCC',
  },
  additionalPromptBtn: {
    backgroundColor: '#6B5B4F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  additionalPromptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionEditBox: {
    marginTop: 8,
    backgroundColor: '#F5F0EB',
    borderRadius: 8,
    padding: 10,
  },
  descriptionEditInput: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  descriptionEditSave: {
    alignSelf: 'flex-end',
    marginTop: 6,
    backgroundColor: '#6B5B4F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  descriptionEditSaveText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  removeMedia: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mediaButton: {
    marginRight: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F5F0EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#6B5B4F',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
