/**
 * Tests for asrService.ts
 * Verifies correct fetch calls, error handling, and Result<> wrapping.
 */

import { transcribeAudio } from '../src/services/asr/asrService';

const FileSystem = require('expo-file-system');

const MOCK_CREDENTIALS = {
  secretId: 'AKID_MOCK_SECRET_ID',
  secretKey: 'mock-secret-key-123',
};

const MOCK_URI = 'file:///mock/documents/audio/recording.m4a';

describe('transcribeAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: file exists, base64 read succeeds
    FileSystem.__mockFileExists.mockReturnValue(true);
    FileSystem.__mockFileBase64.mockResolvedValue('AAAABASE64AUDIO==');
  });

  it('returns Ok with transcribed text on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Response: { Result: '今天天气真好啊' } }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('今天天气真好啊');
    }
  });

  it('calls Tencent ASR API directly with signed headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Response: { Result: '测试内容' } }),
    } as any);

    await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://asr.tencentcloudapi.com',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json; charset=utf-8',
          'Host': 'asr.tencentcloudapi.com',
          'X-TC-Action': 'SentenceRecognition',
          'X-TC-Version': '2019-06-14',
          'Authorization': expect.stringContaining('TC3-HMAC-SHA256'),
        }),
        body: expect.stringContaining('AAAABASE64AUDIO=='),
      })
    );
  });

  it('returns Err with auth kind on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth');
    }
  });

  it('returns Err with auth kind on 403', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth');
    }
  });

  it('returns Err with rate_limit kind on 429', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limit');
    }
  });

  it('returns Err with network kind on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network is unreachable'));

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network');
      if (result.error.kind === 'network') {
        expect(result.error.message).toContain('Network is unreachable');
      }
    }
  });

  it('returns Err with network kind when audio file does not exist', async () => {
    FileSystem.__mockFileExists.mockReturnValue(false);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network');
    }
    // Should not have called fetch at all
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns Ok with empty string when API returns empty text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Response: { Result: '' } }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('');
    }
  });

  it('returns Err with auth kind on Tencent AuthFailure response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Response: { Error: { Code: 'AuthFailure.InvalidSecretId', Message: 'Invalid SecretId' } },
      }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('auth');
    }
  });

  it('returns Err with rate_limit kind on Tencent RequestLimitExceeded response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Response: { Error: { Code: 'RequestLimitExceeded', Message: 'Too many requests' } },
      }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limit');
    }
  });

  it('returns Err with invalid_response on Tencent API error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Response: { Error: { Code: 'InternalError', Message: 'ASR internal error' } },
      }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response');
    }
  });
});
