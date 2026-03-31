/**
 * ASR (Automatic Speech Recognition) service.
 * Directly calls Tencent Cloud SentenceRecognition API with
 * TC3-HMAC-SHA256 signing (via @noble/hashes, no proxy needed).
 */
import { File } from 'expo-file-system';
import { Result, Ok, Err } from '../../lib/result';
import { AIError } from '../ai/client';
import { buildTencentSignedRequest } from './sign';

export type AsrCredentials = {
  secretId: string;
  secretKey: string;
};

/**
 * Estimate the raw byte length of a base64-encoded string
 * (without needing Node.js Buffer).
 */
function base64ByteLength(base64: string): number {
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Transcribe an audio file using Tencent Cloud ASR (direct HTTPS call).
 *
 * @param localUri - Local file URI from expo-audio (e.g. file:///data/.../recording.m4a)
 * @param credentials - ASR SecretId + SecretKey
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

    // Tencent SentenceRecognition payload
    const payload = {
      EngSerViceType: '16k_zh',   // Mandarin 16kHz engine
      SourceType: 1,               // 1 = base64 inline
      VoiceFormat: 'm4a',
      Data: base64Audio,
      DataLen: base64ByteLength(base64Audio),
      FilterPunc: 0,               // Keep punctuation
      ConvertNumMode: 1,           // Smart number conversion
    };

    const { url, headers } = buildTencentSignedRequest(
      credentials.secretId,
      credentials.secretKey,
      'asr',
      'SentenceRecognition',
      '2019-06-14',
      payload,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return Err({ kind: 'auth', message: 'ASR 凭证无效，请检查腾讯云 SecretId/SecretKey' });
      }
      if (response.status === 429) {
        return Err({ kind: 'rate_limit', retryAfterMs: 60000 });
      }
      return Err({ kind: 'network', message: `HTTP ${response.status}` });
    }

    const data = await response.json();

    // Tencent wraps all errors in Response.Error
    if (data.Response?.Error) {
      const { Code, Message } = data.Response.Error;
      if (Code === 'AuthFailure' || Code.startsWith('AuthFailure.')) {
        return Err({ kind: 'auth', message: `认证失败: ${Message}` });
      }
      if (Code === 'RequestLimitExceeded') {
        return Err({ kind: 'rate_limit', retryAfterMs: 60000 });
      }
      return Err({ kind: 'invalid_response', raw: `${Code}: ${Message}` });
    }

    const text: string = data.Response?.Result ?? '';
    return Ok(text);
  } catch (err) {
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : '网络请求失败',
    });
  }
}
