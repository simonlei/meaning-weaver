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
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 50000 });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('AAAABASE64AUDIO==');
  });

  it('returns Ok with transcribed text on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: '今天天气真好啊' }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('今天天气真好啊');
    }
  });

  it('sends base64 audio and credentials in request body/headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: '测试内容' }),
    } as any);

    await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/transcribe'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-ASR-Secret-Id': MOCK_CREDENTIALS.secretId,
          'X-ASR-Secret-Key': MOCK_CREDENTIALS.secretKey,
        }),
        body: expect.stringContaining('AAAABASE64AUDIO=='),
      })
    );
  });

  it('returns Err with auth kind on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
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
      json: async () => ({ error: 'Forbidden' }),
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
      json: async () => ({ error: 'Rate limited' }),
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
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

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
      json: async () => ({ text: '' }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('');
    }
  });

  it('returns Err with invalid_response when server returns error field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: 'ASR internal error' }),
    } as any);

    const result = await transcribeAudio(MOCK_URI, MOCK_CREDENTIALS);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response');
    }
  });
});
