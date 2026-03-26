import { ReportContent, ReportContentSchema } from '../../db/schema';
import { Result, Ok, Err } from '../../lib/result';

// 腾讯云混元大模型（OpenAI 兼容接口）
// 获取 API Key: https://console.cloud.tencent.com/hunyuan → API 密钥管理
const API_KEY = 'YOUR_HUNYUAN_API_KEY';
const API_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
const MODEL = 'hunyuan-turbos-latest'; // 调试可改为 'hunyuan-lite'（免费）

export type AIError =
  | { kind: 'network'; message: string }
  | { kind: 'rate_limit'; retryAfterMs: number }
  | { kind: 'auth'; message: string }
  | { kind: 'invalid_response'; raw: string }
  | { kind: 'no_api_key' };

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<Result<ReportContent, AIError>> {
  if (API_KEY === 'YOUR_HUNYUAN_API_KEY') {
    return Err({ kind: 'no_api_key' });
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
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
