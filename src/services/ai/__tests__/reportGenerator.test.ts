/**
 * Tests for reportGenerator:
 * - 统一使用文本模型（视觉路径已移除）
 * - photo_description 注入 buildUserPrompt
 * - fallback 保护
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

const VALID_REPORT_CONTENT = {
  version: 1 as const,
  snapshot: { title: '测试', summary: '摘要', mood_palette: ['平静'] },
  patterns: { recurring_themes: [{ theme: '主题', evidence: ['e'], insight: 'i' }] },
  notable_moments: [{ moment: '瞬间', why_it_matters: '原因' }],
  growth_trajectory: { seeds_planted: ['种子'], gentle_observations: '观察' },
  gentle_invitation: { reflection_question: '?', micro_experiment: '实验', affirmation: '✓' },
};

function makeTextFragment(id: string, content: string, createdAt = Date.now()): Fragment {
  return { id, content, created_at: createdAt, week_key: '2026-W13', photo_uri: null, photo_description: null, audio_uri: null };
}

function makePhotoFragment(id: string, photoUri: string, content = '', photoDescription?: string, createdAt = Date.now()): Fragment {
  return { id, content, created_at: createdAt, week_key: '2026-W13', photo_uri: photoUri, photo_description: photoDescription ?? null, audio_uri: null };
}

function makeRepo(fragments: Fragment[], apiKey = 'real-key') {
  return {
    getFragmentsByWeek: jest.fn().mockResolvedValue(fragments),
    getLatestReport: jest.fn().mockResolvedValue(null),
    getApiKey: jest.fn().mockResolvedValue(apiKey),
    insertReport: jest.fn().mockResolvedValue({}),
  } as any;
}

describe('reportGenerator — 统一使用文本模型', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
  });

  it('无照片碎片时使用 hunyuan-turbos-latest', async () => {
    const fragments = [makeTextFragment('f1', '纯文字碎片')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(mockCallHunyuan).toHaveBeenCalledTimes(1);
    const [, , , model] = mockCallHunyuan.mock.calls[0];
    expect(model).toBe('hunyuan-turbos-latest');
  });

  it('有照片碎片（无描述）时也使用 hunyuan-turbos-latest', async () => {
    const fragments = [
      makeTextFragment('f1', '文字'),
      makePhotoFragment('f2', 'file:///photo.jpg'),
    ];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , , model] = mockCallHunyuan.mock.calls[0];
    expect(model).toBe('hunyuan-turbos-latest');
  });

  it('有照片碎片（含描述）时也使用 hunyuan-turbos-latest', async () => {
    const fragments = [
      makePhotoFragment('f1', 'file:///photo.jpg', '', '午后的咖啡馆，阳光斜射'),
    ];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , , model] = mockCallHunyuan.mock.calls[0];
    expect(model).toBe('hunyuan-turbos-latest');
  });

  it('model_version 存储为 hunyuan-turbos-latest', async () => {
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

  it('有照片描述的碎片，model_version 仍为 hunyuan-turbos-latest', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///p.jpg', '', '一只小猫在窗台上打盹')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(repo.insertReport).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'hunyuan-turbos-latest'
    );
  });
});

describe('reportGenerator — photo_description 注入 Prompt', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
  });

  it('有 photo_description 的碎片，userContent 为字符串（不是数组）', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///photo.jpg', '今天很开心', '午后阳光斜射在咖啡馆')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , userContent] = mockCallHunyuan.mock.calls[0];
    expect(typeof userContent).toBe('string');
  });

  it('userContent 包含 [图片描述：...] 格式', async () => {
    const description = '一只橘猫在窗台上打盹，阳光暖暖的';
    const fragments = [makePhotoFragment('f1', 'file:///photo.jpg', '', description)];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , userContent] = mockCallHunyuan.mock.calls[0];
    expect(userContent as string).toContain(`[图片描述：${description}]`);
  });

  it('无 photo_description 的图片碎片不出现 [图片描述：] 标记', async () => {
    const fragments = [makePhotoFragment('f2', 'file:///photo2.jpg', '这是一张没有描述的照片')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    const [, , userContent] = mockCallHunyuan.mock.calls[0];
    expect(userContent as string).not.toContain('[图片描述：');
  });

  it('不调用 ImageManipulator（视觉路径已移除）', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    ImageManipulator.manipulateAsync.mockClear();

    const fragments = [makePhotoFragment('f1', 'file:///photo.jpg', '', '测试描述')];
    const repo = makeRepo(fragments);

    await generateWeeklyReport(repo);

    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });
});

describe('reportGenerator — 照片文件读取失败降级', () => {
  beforeEach(() => {
    mockCallHunyuan.mockReset();
    mockCallHunyuan.mockResolvedValue(Ok(VALID_REPORT_CONTENT));
  });

  it('周报正常生成（不崩溃），即使图片无描述', async () => {
    const fragments = [makePhotoFragment('f1', 'file:///gone.jpg', '文字')];
    const repo = makeRepo(fragments);

    await expect(generateWeeklyReport(repo)).resolves.toBeDefined();
    expect(repo.insertReport).toHaveBeenCalled();
  });
});

describe('reportGenerator — createFallbackReport 空 content 保护', () => {
  it('照片专用碎片（content=""）降级时 notable_moments 显示占位文本而非空字符串', async () => {
    mockCallHunyuan.mockReset();

    // AI 失败，触发 fallback
    mockCallHunyuan.mockResolvedValue(Err({ kind: 'network', message: 'timeout' }));

    const fragments = [makePhotoFragment('f1', 'file:///p.jpg', '', '美丽的一天')];
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
