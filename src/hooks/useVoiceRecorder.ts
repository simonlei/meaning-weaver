/**
 * useVoiceRecorder - hooks for voice recording with expo-audio.
 *
 * Uses a custom 16kHz mono preset for optimal Tencent Cloud ASR accuracy.
 * Records to documentDirectory/audio/ for persistent local storage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/** Custom recording options optimised for Tencent ASR (16k_zh engine) */
const ASR_RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 16000,       // 16kHz – matches EngSerViceType: 16k_zh
  numberOfChannels: 1,     // Mono – sufficient for voice, halves file size
  bitRate: 32000,          // 32kbps mono voice quality
  isMeteringEnabled: true, // Enable real-time VU meter for UI feedback
  android: {
    outputFormat: 'mpeg4' as const,
    audioEncoder: 'aac' as const,
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16 as const,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/** Maximum recording duration in milliseconds (Tencent SentenceRecognition limit) */
const MAX_DURATION_MS = 60_000;

export type RecordingPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type UseVoiceRecorderReturn = {
  /** Start a new recording. Returns false if permission was denied. */
  startRecording: () => Promise<boolean>;
  /** Stop recording and return the local file URI (or null on error). */
  stopRecording: () => Promise<string | null>;
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Recording duration in milliseconds */
  durationMs: number;
  /** Audio metering value in dBFS (useful for pulse animation, -160 to 0) */
  metering: number | undefined;
  /** Current microphone permission status */
  permissionStatus: RecordingPermissionStatus;
};

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const recorder = useAudioRecorder(ASR_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [permissionStatus, setPermissionStatus] = useState<RecordingPermissionStatus>('undetermined');
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    // Request permission
    const { granted } = await requestRecordingPermissionsAsync();
    setPermissionStatus(granted ? 'granted' : 'denied');
    if (!granted) return false;

    // Configure audio session for recording
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });

    // Ensure audio directory exists
    const audioDir = FileSystem.documentDirectory + 'audio/';
    const dirInfo = await FileSystem.getInfoAsync(audioDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    }

    await recorder.prepareToRecordAsync();
    recorder.record();

    if (!recorder.isRecording) {
      throw new Error('录音启动失败：recorder.record() 调用后仍未进入录音状态');
    }

    // Auto-stop at 60s (Tencent ASR hard limit)
    autoStopTimer.current = setTimeout(() => {
      if (recorder.isRecording) {
        recorder.stop();
      }
    }, MAX_DURATION_MS);

    return true;
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }

    try {
      await recorder.stop();
      const uri = recorder.uri;
      return uri ?? null;
    } catch {
      return null;
    }
  }, [recorder]);

  return {
    startRecording,
    stopRecording,
    isRecording: recorderState.isRecording,
    durationMs: recorderState.durationMillis ?? 0,
    metering: recorderState.metering,
    permissionStatus,
  };
}
