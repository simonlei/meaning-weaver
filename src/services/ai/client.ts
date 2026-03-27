import { ReportContent, ReportContentSchema } from '../../db/schema';
import { Result, Ok, Err } from '../../lib/result';

// 腾讯云混元大模型（OpenAI 兼容接口）
// Web 端通过本地代理转发（解决 CORS），原生端直连
import { Platform } from 'react-native';

const HUNYUAN_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';

function getApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/v1/chat/completions`;
  }
  return HUNYUAN_URL;
}

const MODEL = 'hunyuan-turbos-latest'; // 调试可改为 'hunyuan-lite'（免费）

export type AIError =
  | { kind: 'network'; message: string }
  | { kind: 'rate_limit'; retryAfterMs: number }
  | { kind: 'auth'; message: string }
  | { kind: 'invalid_response'; raw: string }
  | { kind: 'no_api_key' };

export async function callHunyuan(
  apiKey: string | null,
  systemPrompt: string,
  userPrompt: string
): Promise<Result<ReportContent, AIError>> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return Err({ kind: 'no_api_key' });
  }

  const API_URL = getApiUrl();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
    const text = data.choices?.[0]?.message?.content ?? '';

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
  } catch (err) {
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
