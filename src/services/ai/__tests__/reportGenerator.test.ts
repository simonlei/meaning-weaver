/**
 * TDD: reportGenerator — 模型选择、5张图限制、fallback保护、文件读取失败降级
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('expo-image-manipulator');
jest.mock('expo-file-system');

// Mock callHunyuan to capture calls
const mockCallHunyuan = jest.fn();
jest.mock('../client', () => ({
  __esModule: true,
  callHunyuan: (...args: any[]) => mockCallHunyuan(...args),
  TEXT_MODEL: 'hunyuan-turbos-latest',
  VISION_MODEL: 'hunyuan-vision-1.5-instruct',
}));

import { generateWeeklyReport } from '../reportGenerator';
import { Fragment } from '../../../db/schema';
import { Ok, Err } from '../../../lib/result';

// Access mocked modules through require after imports
const ImageManipulator = require('expo-image-manipulator');
const FileSystem = require('expo-file-system');

const VALID_REPORT_CONTENT = {
  version: 1 as const,
  snapshot: { title: '测试', summary: '摘要', mood_palette: ['平静'] },
  patterns: { recurring_themes: [{ theme: '主题', evidence: ['e'], insight: 'i' }] },
  notable_moments: [{ moment: '瞬间', why_it_matters: '原因' }],
  growth_trajectory: { seeds_planted: ['种子'], gentle_observations: '观察' },
  gentle_invitation: { reflection_question: '?', micro_experiment: '实验', affirmation: '✓' },
};

function makeTextFragment(id: string, content: string, createdAt = Date.now()): Fragment {
  return { id, content, created_at: createdAt, week_key: '2026-W13', photo_uri: null };
}

function makePhotoFragment(id: string, photoUri: string, content = '', createdAt = Date.now()): Fragment {
  return { id, content, created_at: createdAt, week_key: '2026-W13', photo_uri: photoUri };
}

function makeRepo(fragments: Fragment[], apiKey = 'real-key') {
  return {
    getFragmentsByWeek: jest.fn().mockResolvedValue(fragments),
    getLatestReport: jest.fn().mockResolvedValue(null),
    getApiKey: jest.fn().mockResolvedValue(apiKey),
    insertReport: jest.fn().mockResolvedValue({}),
  } as any;
}

describe('reportGenerator — 模型选择', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: 'file:///mock/compressed.jpg' });
    FileSystem.readAsStringAsync.mockResolvedValue('base64mockdata');
  });

  it('无照片碎片时使用 hunyuan-turbos-latest', async () => {
    const fragments = [makeTextFragment('f1', '纯文字碎片')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(mockCallHunyuan).toHaveBeenCalledTimes(1);
    const [, , , model] = mockCallHunyuan.mock.calls[0];
    expect(model).toBe('hunyuan-turbos-latest');
  });

  it('有照片碎片时使用 hunyuan-vision-1.5-instruct', async () => {
    const fragments = [
      makeTextFragment('f1', '文字'),
      makePhotoFragment('f2', 'file:///photo.jpg'),
    ];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , , model] = mockCallHunyuan.mock.calls[0];
    expect(model).toBe('hunyuan-vision-1.5-instruct');
  });

  it('model_version 按实际使用模型存储（无照片）', async () => {
    const fragments = [makeTextFragment('f1', '纯文字')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(repo.insertReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'hunyuan-turbos-latest'
    );
  });

  it('model_version 按实际使用模型存储（有照片）', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///p.jpg')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(repo.insertReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'hunyuan-vision-1.5-instruct'
    );
  });
});

describe('reportGenerator — 照片压缩与 base64 传递', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
    ImageManipulator.manipulateAsync.mockClear();
    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: 'file:///mock/compressed.jpg' });
    FileSystem.readAsStringAsync.mockClear();
    FileSystem.readAsStringAsync.mockResolvedValue('base64mockdata');
  });

  it('有照片时调用 manipulateAsync 压缩图片', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///orig.jpg')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///orig.jpg',
      expect.arrayContaining([expect.objectContaining({ resize: expect.anything() })]),
      expect.objectContaining({ format: 'jpeg' })
    );
  });

  it('有照片时调用 readAsStringAsync 读取 base64', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///orig.jpg')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file:///mock/compressed.jpg',
      expect.objectContaining({ encoding: 'base64' })
    );
  });

  it('callHunyuan 收到包含 image_url 的 content 数组', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///orig.jpg', '今天很开心')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , userContent] = mockCallHunyuan.mock.calls[0];
    expect(Array.isArray(userContent)).toBe(true);
    const imagePart = (userContent as any[]).find((p: any) => p.type === 'image_url');
    expect(imagePart).toBeDefined();
    expect(imagePart.image_url.url).toContain('data:image/jpeg;base64,');
  });
});

describe('reportGenerator — 5张照片上限', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
    ImageManipulator.manipulateAsync.mockClear();
    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: 'file:///mock/compressed.jpg' });
    FileSystem.readAsStringAsync.mockClear();
    FileSystem.readAsStringAsync.mockResolvedValue('base64mockdata');
  });

  it('超过5张时只压缩前5张图片', async () => {
    const fragments = Array.from({ length: 8 }, (_, i) =>
      makePhotoFragment(`f${i}`, `file:///p${i}.jpg`, '', i * 1000)
    );
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    // 应该只有5次 manipulateAsync 调用（最新5张）
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(5);
  });

  it('超过5张时 content 数组中 image_url 部件不超过5个', async () => {
    const fragments = Array.from({ length: 6 }, (_, i) =>
      makePhotoFragment(`f${i}`, `file:///p${i}.jpg`, `内容${i}`, i * 1000)
    );
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , userContent] = mockCallHunyuan.mock.calls[0];
    if (Array.isArray(userContent)) {
      const imageParts = (userContent as any[]).filter((p: any) => p.type === 'image_url');
      expect(imageParts.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('reportGenerator — 照片文件读取失败降级', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
    ImageManipulator.manipulateAsync.mockClear();
    FileSystem.readAsStringAsync.mockClear();
  });

  it('readAsStringAsync 失败时周报仍然生成（不崩溃）', async () => {
    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: 'file:///mock/compressed.jpg' });
    FileSystem.readAsStringAsync.mockRejectedValueOnce(new Error('File not found'));
    const fragments = [makePhotoFragment('f1', 'file:///gone.jpg', '文字')];
    const repo = makeRepo(fragments);

    await expect(generateWeeklyReport(repo)).resolves.toBeDefined();
    expect(repo.insertReport).toHaveBeenCalled();
  });

  it('manipulateAsync 失败时跳过该图片，周报仍然生成', async () => {
    ImageManipulator.manipulateAsync.mockRejectedValueOnce(new Error('Manipulate failed'));
    const fragments = [makePhotoFragment('f1', 'file:///bad.jpg')];
    const repo = makeRepo(fragments);

    await expect(generateWeeklyReport(repo)).resolves.toBeDefined();
  });
});

describe('reportGenerator — createFallbackReport 空 content 保护', () => {
  it('照片专用碎片（content=""）降级时 notable_moments 显示占位文本而非空字符串', async () => {
    mockCallHunyuan.mockReset();
    ImageManipulator.manipulateAsync.mockClear();
    FileSystem.readAsStringAsync.mockClear();

    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: 'file:///mock/compressed.jpg' });
    FileSystem.readAsStringAsync.mockResolvedValue('base64mockdata');

    // AI 失败，触发 fallback
    mockCallHunyuan.mockResolvedValue(Err({ kind: 'network', message: 'timeout' }));

    const fragments = [makePhotoFragment('f1', 'file:///p.jpg', '')];
    const repo = makeRepo(fragments);

    const result = await generateWeeklyReport(repo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // notable_moments 的 moment 字段不应为空字符串
      result.value.notable_moments.forEach(m => {
        expect(m.moment.trim().length).toBeGreaterThan(0);
      });
      // evidence 不应为空字符串
      result.value.patterns.recurring_themes.forEach(t => {
        t.evidence.forEach(e => expect(e.trim().length).toBeGreaterThan(0));
      });
    }
  });
});
