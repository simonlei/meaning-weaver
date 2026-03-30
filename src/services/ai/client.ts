import { ReportContent, ReportContentSchema } from '../../db/schema';
import { Result, Ok, Err } from '../../lib/result';
import { Platform } from 'react-native';

// 腾讯云混元大模型（OpenAI 兼容接口）
// Web 端通过本地代理转发（解决 CORS），原生端直连

const HUNYUAN_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';

function getApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/v1/chat/completions`;
  }
  return HUNYUAN_URL;
}

export const TEXT_MODEL = 'hunyuan-turbos-latest';         // 文字专用，调试可改为 'hunyuan-lite'（免费）
export const VISION_MODEL = 'hunyuan-vision-1.5-instruct'; // 有照片碎片时使用

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AIError =
  | { kind: 'network'; message: string }
  | { kind: 'rate_limit'; retryAfterMs: number }
  | { kind: 'auth'; message: string }
  | { kind: 'invalid_response'; raw: string }
  | { kind: 'no_api_key' };

// ---------------------------------------------------------------------------
// Internal: shared fetch helper
// Executes the Hunyuan API request with a 30-second AbortController timeout.
// Returns the raw text content from the response, or an AIError.
// Both callHunyuan and callHunyuanText delegate to this helper.
// ---------------------------------------------------------------------------
async function hunyuanFetch(
  apiKey: string,
  systemPrompt: string,
  userContent: string | ContentPart[],
  model: string,
  maxTokens: number,
): Promise<Result<string, AIError>> {
  const url = getApiUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
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
    // OpenAI 兼容格式
    const text: string = data.choices?.[0]?.message?.content ?? '';
    return Ok(text);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return Err({ kind: 'network', message: '请求超时，请检查网络连接' });
    }
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callHunyuan(
  apiKey: string | null,
  systemPrompt: string,
  userContent: string | ContentPart[],
  model: string = TEXT_MODEL,
): Promise<Result<ReportContent, AIError>> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return Err({ kind: 'no_api_key' });
  }

  const rawResult = await hunyuanFetch(apiKey, systemPrompt, userContent, model, 4096);
  if (!rawResult.ok) {
    return Err(rawResult.error);
  }

  const text = rawResult.value;

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const validated = ReportContentSchema.parse(parsed);
    return Ok(validated);
  } catch {
    return Err({ kind: 'invalid_response', raw: text.slice(0, 500) });
  }
}

export async function callHunyuanText(
  apiKey: string | null,
  systemPrompt: string,
  userContent: string | ContentPart[],
  model: string = TEXT_MODEL,
  maxTokens: number = 4096,
): Promise<Result<string, AIError>> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return Err({ kind: 'no_api_key' });
  }

  const rawResult = await hunyuanFetch(apiKey, systemPrompt, userContent, model, maxTokens);
  if (!rawResult.ok) {
    return Err(rawResult.error);
  }

  const text = rawResult.value;
  if (!text.trim()) {
    return Err({ kind: 'invalid_response', raw: '(empty)' });
  }

  return Ok(text.trim());
}
