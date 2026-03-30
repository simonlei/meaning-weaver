import { Result, Ok, Err } from '../../lib/result';
import { AIError, callHunyuan, VISION_MODEL } from './client';
import { PHOTO_DESCRIPTION_SYSTEM_PROMPT, buildPhotoDescriptionContent } from './prompts';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress a photo and return its base64 data URI.
 * Returns null if compression or reading fails.
 */
export async function compressAndReadBase64(photoUri: string): Promise<string | null> {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Describe a photo using the vision model.
 * Returns a natural language description string (2-4 sentences).
 *
 * @param photoUri - Local file URI of the photo
 * @param apiKey - Hunyuan API key
 * @param additionalPrompt - Optional user-provided hint (e.g. "这是我的朋友小李")
 */
export async function describePhoto(
  photoUri: string,
  apiKey: string | null,
  additionalPrompt?: string
): Promise<Result<string, AIError>> {
  const base64DataUri = await compressAndReadBase64(photoUri);
  if (!base64DataUri) {
    return Err({ kind: 'network', message: '图片压缩失败，无法读取文件' });
  }

  const userContent = buildPhotoDescriptionContent(base64DataUri, additionalPrompt);

  // callHunyuan normally parses ReportContent JSON; here we need raw text.
  // We call the raw fetch directly to get a plain string response.
  const result = await callHunyuanRaw(apiKey, PHOTO_DESCRIPTION_SYSTEM_PROMPT, userContent);
  return result;
}

// ---------------------------------------------------------------------------
// Internal: raw Hunyuan call that returns plain text (not parsed JSON)
// ---------------------------------------------------------------------------
import { ContentPart } from './client';
import { Platform } from 'react-native';

const HUNYUAN_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';

function getApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/v1/chat/completions`;
  }
  return HUNYUAN_URL;
}

async function callHunyuanRaw(
  apiKey: string | null,
  systemPrompt: string,
  userContent: string | ContentPart[]
): Promise<Result<string, AIError>> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return Err({ kind: 'no_api_key' });
  }

  try {
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 512,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (response.status === 429) {
      return Err({ kind: 'rate_limit', retryAfterMs: 60000 });
    }
    if (response.status === 401 || response.status === 403) {
      return Err({ kind: 'auth', message: 'API Key 无效，请检查腾讯云混元密钥' });
    }
    if (!response.ok) {
      return Err({ kind: 'network', message: `HTTP ${response.status}` });
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';

    if (!text.trim()) {
      return Err({ kind: 'invalid_response', raw: '(empty)' });
    }

    return Ok(text.trim());
  } catch (err) {
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
