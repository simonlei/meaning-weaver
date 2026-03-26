import { ReportContent, ReportContentSchema } from '../../db/schema';
import { Result, Ok, Err } from '../../lib/result';

// MVP: hardcoded API key (replace with your own)
// TODO: Move to proxy server before any public release
const CLAUDE_API_KEY = 'YOUR_API_KEY_HERE';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

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
  if (CLAUDE_API_KEY === 'YOUR_API_KEY_HERE') {
    return Err({ kind: 'no_api_key' });
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return Err({
        kind: 'rate_limit',
        retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 60000,
      });
    }

    if (response.status === 401 || response.status === 403) {
      return Err({ kind: 'auth', message: 'Invalid API key' });
    }

    if (!response.ok) {
      return Err({ kind: 'network', message: `HTTP ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

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
