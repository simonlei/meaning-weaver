/**
 * ASR (Automatic Speech Recognition) service.
 * Calls the local proxy server /api/transcribe which handles
 * TC3-HMAC-SHA256 signing and forwarding to Tencent Cloud SentenceRecognition.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { Result, Ok, Err } from '../../lib/result';
import { AIError } from '../ai/client';

export type AsrCredentials = {
  secretId: string;
  secretKey: string;
};

function getAsrProxyUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/api/transcribe`;
  }
  // On native (Android/iOS), use the proxy server IP.
  // During Expo Go / dev, this is the same dev machine.
  // In production builds, a real backend URL should be used.
  return 'http://localhost:3001/api/transcribe';
}

/**
 * Transcribe an audio file using Tencent Cloud ASR via the proxy server.
 *
 * @param localUri - Local file URI from expo-audio (e.g. file:///data/.../recording.m4a)
 * @param credentials - ASR SecretId + SecretKey (forwarded to proxy)
 * @returns Result<string, AIError> with the transcribed text
 */
export async function transcribeAudio(
  localUri: string,
  credentials: AsrCredentials
): Promise<Result<string, AIError>> {
  try {
    const audioFile = new File(localUri);

    // Check file exists
    if (!audioFile.exists) {
      return Err({ kind: 'network', message: '音频文件不存在' });
    }

    // Read audio file as base64
    const base64Audio = await audioFile.base64();

    const ASR_URL = getAsrProxyUrl();

    const response = await fetch(ASR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward credentials to proxy; proxy handles signing server-side
        'X-ASR-Secret-Id': credentials.secretId,
        'X-ASR-Secret-Key': credentials.secretKey,
      },
      body: JSON.stringify({
        audio: base64Audio,
        format: 'm4a',
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return Err({ kind: 'auth', message: 'ASR 凭证无效，请检查腾讯云 SecretId/SecretKey' });
    }

    if (response.status === 429) {
      return Err({ kind: 'rate_limit', retryAfterMs: 60000 });
    }

    if (!response.ok) {
      return Err({ kind: 'network', message: `HTTP ${response.status}` });
    }

    const data = await response.json();

    if (data.error) {
      return Err({ kind: 'invalid_response', raw: data.error });
    }

    const text: string = data.text ?? '';
    return Ok(text);
  } catch (err) {
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : '网络请求失败',
    });
  }
}
