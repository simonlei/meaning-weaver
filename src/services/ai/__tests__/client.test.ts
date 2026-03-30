/**
 * TDD: callHunyuan — model 参数 + multimodal content 数组
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { callHunyuan, callHunyuanText } from '../client';

const VALID_RESPONSE_JSON = JSON.stringify({
  version: 1,
  snapshot: { title: '测试周', summary: '这是摘要', mood_palette: ['平静'] },
  patterns: { recurring_themes: [{ theme: '主题', evidence: ['证据'], insight: '洞察' }] },
  notable_moments: [{ moment: '瞬间', why_it_matters: '原因' }],
  growth_trajectory: { seeds_planted: ['种子'], gentle_observations: '观察' },
  gentle_invitation: { reflection_question: '问题', micro_experiment: '实验', affirmation: '肯定' },
});

describe('callHunyuan — API Key 验证（回归）', () => {
  it('apiKey 为 null 时返回 no_api_key 错误', async () => {
    const result = await callHunyuan(null, 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no_api_key');
  });

  it('apiKey 为空字符串时返回 no_api_key 错误', async () => {
    const result = await callHunyuan('', 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no_api_key');
  });

  it('apiKey 以 YOUR_ 开头时返回 no_api_key 错误', async () => {
    const result = await callHunyuan('YOUR_KEY', 'system prompt', 'user prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no_api_key');
  });

  it('401 响应返回 auth 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false }) as any;
    const result = await callHunyuan('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('auth');
  });

  it('429 响应返回 rate_limit 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 429, ok: false }) as any;
    const result = await callHunyuan('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('rate_limit');
  });

  it('有效 key 时 Authorization header 包含该 key', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_RESPONSE_JSON } }] }),
    }) as any;
    global.fetch = mockFetch;
    await callHunyuan('my-actual-key', 'system', 'user');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer my-actual-key');
  });
});

describe('callHunyuan — model 参数', () => {
  it('不传 model 时使用 hunyuan-turbos-latest', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_RESPONSE_JSON } }] }),
    }) as any;
    global.fetch = mockFetch;

    await callHunyuan('my-key', 'system', 'user');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('hunyuan-turbos-latest');
  });

  it('传入 model 时使用指定 model', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_RESPONSE_JSON } }] }),
    }) as any;
    global.fetch = mockFetch;

    await callHunyuan('my-key', 'system', 'user', 'hunyuan-vision-1.5-instruct');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('hunyuan-vision-1.5-instruct');
  });
});

describe('callHunyuan — multimodal content 数组', () => {
  it('userContent 为字符串时，messages[1].content 为字符串', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_RESPONSE_JSON } }] }),
    }) as any;
    global.fetch = mockFetch;

    await callHunyuan('my-key', 'system', 'plain text user prompt');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(typeof body.messages[1].content).toBe('string');
    expect(body.messages[1].content).toBe('plain text user prompt');
  });

  it('userContent 为 ContentPart 数组时，messages[1].content 为数组', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_RESPONSE_JSON } }] }),
    }) as any;
    global.fetch = mockFetch;

    const contentParts = [
      { type: 'text' as const, text: '这是文字部分' },
      { type: 'image_url' as const, image_url: { url: 'data:image/jpeg;base64,abc123' } },
    ];

    await callHunyuan('my-key', 'system', contentParts, 'hunyuan-vision-1.5-instruct');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(Array.isArray(body.messages[1].content)).toBe(true);
    expect(body.messages[1].content).toHaveLength(2);
    expect(body.messages[1].content[0]).toEqual({ type: 'text', text: '这是文字部分' });
    expect(body.messages[1].content[1].type).toBe('image_url');
  });
});

describe('callHunyuanText', () => {
  it('apiKey 为 null 时返回 no_api_key 错误', async () => {
    const result = await callHunyuanText(null, 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no_api_key');
  });

  it('apiKey 以 YOUR_ 开头时返回 no_api_key 错误', async () => {
    const result = await callHunyuanText('YOUR_KEY', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no_api_key');
  });

  it('429 响应返回 rate_limit 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 429, ok: false }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('rate_limit');
  });

  it('401 响应返回 auth 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('auth');
  });

  it('403 响应返回 auth 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 403, ok: false }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('auth');
  });

  it('500 响应返回 network 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 500, ok: false }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network');
      expect((result.error as { kind: 'network'; message: string }).message).toBe('HTTP 500');
    }
  });

  it('空响应内容返回 invalid_response 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response');
      expect((result.error as { kind: 'invalid_response'; raw: string }).raw).toBe('(empty)');
    }
  });

  it('有效响应返回 Ok 并包含原始文本', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  这是一段图片描述  ' } }] }),
    }) as any;
    const result = await callHunyuanText('real-key', 'system', 'user');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('这是一段图片描述');
  });
});
