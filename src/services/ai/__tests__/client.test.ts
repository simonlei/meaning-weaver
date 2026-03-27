/**
 * TDD: callClaude - API Key 参数化
 *
 * 红阶段：callClaude 目前不接受 apiKey 参数，测试应失败。
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { callClaude } from '../client';

describe('callClaude - API Key 验证', () => {
  it('apiKey 为 null 时返回 no_api_key 错误', async () => {
    const result = await callClaude(null, 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no_api_key');
    }
  });

  it('apiKey 为空字符串时返回 no_api_key 错误', async () => {
    const result = await callClaude('', 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no_api_key');
    }
  });

  it('apiKey 为占位符 YOUR_HUNYUAN_API_KEY 时返回 no_api_key 错误', async () => {
    const result = await callClaude('YOUR_HUNYUAN_API_KEY', 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no_api_key');
    }
  });

  it('apiKey 以 YOUR_ 开头时返回 no_api_key 错误', async () => {
    const result = await callClaude('YOUR_OTHER_KEY', 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no_api_key');
    }
  });

  it('401 响应返回 auth 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
    }) as any;
    const result = await callClaude('real-valid-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth');
    }
  });

  it('429 响应返回 rate_limit 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
    }) as any;
    const result = await callClaude('real-valid-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limit');
    }
  });

  it('有效 key 时 fetch 被调用，Authorization header 包含该 key', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"version":1,"snapshot":{"title":"t","summary":"s","mood_palette":["a"]},"patterns":{"recurring_themes":[{"theme":"t","evidence":["e"],"insight":"i"}]},"notable_moments":[{"moment":"m","why_it_matters":"w"}],"growth_trajectory":{"seeds_planted":["s"],"gentle_observations":"g"},"gentle_invitation":{"reflection_question":"q","micro_experiment":"e","affirmation":"a"}}' } }],
      }),
    }) as any;
    global.fetch = mockFetch;

    await callClaude('my-actual-key', 'system', 'user');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers['Authorization']).toBe('Bearer my-actual-key');
  });
});
