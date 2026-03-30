import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Image,
  Alert,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useCreateFragment } from '../hooks/useFragments';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useAsrCredentials, useApiKey } from '../hooks/useSettings';
import { transcribeAudio } from '../services/asr/asrService';
import { describePhoto } from '../services/ai/photoDescriber';

const MAX_RECORDING_SECONDS = 60;

export function FragmentInput() {
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState<string | null>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescriptionText, setEditDescriptionText] = useState('');
  const [isRegeneratingWithPrompt, setIsRegeneratingWithPrompt] = useState(false);
  const [additionalPromptText, setAdditionalPromptText] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const createFragment = useCreateFragment();

  const { data: asrCreds } = useAsrCredentials();
  const { data: apiKey } = useApiKey();
  const {
    startRecording,
    stopRecording,
    isRecording,
    durationMs,
    permissionStatus,
  } = useVoiceRecorder();

  // Pulse animation for recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const canSend =
    (text.trim().length > 0 || photoUri !== null || audioUri !== null) &&
    !isRecording &&
    !isTranscribing &&
    !isGeneratingDescription;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '需要相册权限',
        '请在系统设置中允许「意义编织」访问你的相册。',
        [{ text: '好的' }]
      );
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
      setPhotoDescription(null);
      setIsEditingDescription(false);
      setAdditionalPromptText('');
      setIsRegeneratingWithPrompt(false);

      // Auto-generate description
      if (apiKey) {
        setIsGeneratingDescription(true);
        try {
          const descResult = await describePhoto(uri, apiKey);
          if (descResult.ok) {
            setPhotoDescription(descResult.value);
          }
          // On failure: silently skip, user can manually add or regenerate
        } finally {
          setIsGeneratingDescription(false);
        }
      }
    }
  };

  const handleRegenerateDescription = async () => {
    if (!photoUri || !apiKey) return;
    setIsRegeneratingWithPrompt(false);
    setIsGeneratingDescription(true);
    try {
      const descResult = await describePhoto(
        photoUri,
        apiKey,
        additionalPromptText.trim() || undefined
      );
      if (descResult.ok) {
        setPhotoDescription(descResult.value);
        setAdditionalPromptText('');
      } else {
        Alert.alert('重新生成失败', '请检查网络或 API Key 后重试。');
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleStartEdit = () => {
    setEditDescriptionText(photoDescription ?? '');
    setIsEditingDescription(true);
  };

  const handleSaveEdit = () => {
    setPhotoDescription(editDescriptionText.trim() || null);
    setIsEditingDescription(false);
  };

  const handleMicPress = async () => {
    if (isRecording) {
      // Stop recording
      const uri = await stopRecording();
      if (!uri) return;

      setAudioDurationMs(durationMs);

      if (!asrCreds) {
        // No credentials — save voice-only fragment
        Alert.alert(
          '未配置语音识别',
          '语音已录制但未配置腾讯云 ASR 凭证，将保存为无文字的语音记录。',
          [
            {
              text: '去设置',
              onPress: () => {
                setAudioUri(uri);
              },
            },
            {
              text: '保存语音',
              onPress: () => setAudioUri(uri),
            },
            {
              text: '丢弃',
              style: 'destructive',
              onPress: () => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
            },
          ]
        );
        return;
      }

      // Transcribe
      setIsTranscribing(true);
      setAudioUri(uri); // Show chip immediately while transcribing

      try {
        const result = await transcribeAudio(uri, asrCreds);
        if (result.ok && result.value.trim()) {
          setText((prev) => {
            if (prev.trim()) return prev.trim() + '\n' + result.value.trim();
            return result.value.trim();
          });
        } else if (!result.ok) {
          const err = result.error;
          let msg = '识别失败，请重试。';
          if (err.kind === 'auth') msg = 'ASR 凭证无效，请在设置中检查 SecretId/SecretKey。';
          else if (err.kind === 'rate_limit') msg = '识别请求过于频繁，请稍后再试。';
          else if (err.kind === 'network') msg = `网络错误：${err.message}`;

          Alert.alert('识别失败', msg, [
            { text: '保存语音无文字', onPress: () => {} /* audioUri already set */ },
            {
              text: '丢弃',
              style: 'destructive',
              onPress: () => {
                FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                setAudioUri(null);
                setAudioDurationMs(0);
              },
            },
          ]);
        }
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      if (permissionStatus === 'denied') {
        Alert.alert(
          '需要麦克风权限',
          '请在系统设置中允许「意义编织」访问麦克风，以便录制语音碎片。',
          [{ text: '好的' }]
        );
        return;
      }
      try {
        await startRecording();
      } catch (e) {
        Alert.alert(
          '录音启动失败',
          e instanceof Error ? e.message : '未知错误，请重试。',
          [{ text: '好的' }]
        );
      }
    }
  };

  const handleRemoveAudio = () => {
    if (audioUri) {
      FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});
    }
    setAudioUri(null);
    setAudioDurationMs(0);
  };

  const handleSend = () => {
    if (!canSend) return;

    createFragment.mutate(
      {
        content: text.trim(),
        photoUri: photoUri ?? undefined,
        photoDescription: photoDescription ?? undefined,
        audioUri: audioUri ?? undefined,
      },
      {
        onSuccess: () => {
          setText('');
          setPhotoUri(null);
          setPhotoDescription(null);
          setIsEditingDescription(false);
          setAdditionalPromptText('');
          setIsRegeneratingWithPrompt(false);
          setAudioUri(null);
          setAudioDurationMs(0);
          // Keep keyboard open for continuous input
        },
      }
    );
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
                setPhotoDescription(null);
                setIsEditingDescription(false);
                setAdditionalPromptText('');
                setIsRegeneratingWithPrompt(false);
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
                onChangeText={setEditDescriptionText}
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
                  onPress={() => setIsRegeneratingWithPrompt((v) => !v)}
                >
                  <Text style={styles.descriptionBtnText}>🔄 重新生成</Text>
                </TouchableOpacity>
              </View>
              {isRegeneratingWithPrompt && (
                <View style={styles.additionalPromptRow}>
                  <TextInput
                    style={styles.additionalPromptInput}
                    value={additionalPromptText}
                    onChangeText={setAdditionalPromptText}
                    placeholder="补充说明（可选，如"这是我的朋友小李"）"
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

      {/* Audio chip preview */}
      {(audioUri || isTranscribing) && (
        <View style={styles.audioChip}>
          <Text style={styles.audioChipIcon}>🎵</Text>
          <Text style={styles.audioChipText}>
            {isTranscribing
              ? '正在识别...'
              : audioDurationMs > 0
                ? formatDuration(audioDurationMs)
                : '语音记录'}
          </Text>
          {!isTranscribing && audioUri && (
            <TouchableOpacity
              onPress={handleRemoveAudio}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.removeMediaText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.container}>
        {/* Photo picker button — native only */}
        {Platform.OS !== 'web' && !isRecording && (
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={handlePickPhoto}
            disabled={createFragment.isPending || isTranscribing || isGeneratingDescription}
          >
            <Text style={styles.mediaButtonText}>🖼</Text>
          </TouchableOpacity>
        )}

        {/* Microphone button — native only */}
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={[
              styles.mediaButton,
              isRecording && styles.mediaButtonRecording,
            ]}
            onPress={handleMicPress}
            disabled={createFragment.isPending || isTranscribing || isGeneratingDescription}
          >
            {isRecording ? (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={styles.mediaButtonText}>⏹</Text>
              </Animated.View>
            ) : (
              <Text style={styles.mediaButtonText}>🎙</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Recording timer */}
        {isRecording && (
          <Text style={styles.recordingTimer}>{formatDuration(durationMs)}</Text>
        )}

        {!isRecording && (
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
        )}

        {isRecording && (
          <View style={styles.recordingHint}>
            <Text style={styles.recordingHintText}>录音中，最长 {MAX_RECORDING_SECONDS} 秒</Text>
          </View>
        )}

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
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#F0EBE5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  audioChipIcon: {
    fontSize: 14,
  },
  audioChipText: {
    fontSize: 13,
    color: '#6B5B4F',
    fontWeight: '500',
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
  mediaButtonRecording: {
    backgroundColor: '#FECACA',
  },
  mediaButtonText: {
    fontSize: 20,
  },
  recordingTimer: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
    marginRight: 8,
    alignSelf: 'center',
    minWidth: 48,
  },
  recordingHint: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  recordingHintText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
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
