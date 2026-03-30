import { Fragment, ReportContent, computeWeekKey } from '../../db/schema';
import { Repository } from '../../db/repository';
import { SYSTEM_PROMPT, VISION_SYSTEM_PROMPT, buildUserPrompt, buildVisionUserContent } from './prompts';
import { callHunyuan, ContentPart, TEXT_MODEL, VISION_MODEL, AIError } from './client';
import { Result, Ok, Err } from '../../lib/result';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_PHOTOS_PER_REPORT = 5;

function createFallbackReport(fragments: Fragment[]): ReportContent {
  const days = new Set(fragments.map((f) => {
    const d = new Date(f.created_at);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }));

  // 空 content 时根据媒体类型使用占位文本
  const safeContent = (f: Fragment) => {
    if (f.content.trim()) return f.content.trim();
    if (f.audio_uri) return '[语音]';
    if (f.photo_uri) return '[照片]';
    return '[记录]';
  };

  return {
    version: 1,
    snapshot: {
      title: '安静的一周',
      summary: `这一周你记录了 ${fragments.length} 条碎片，跨越 ${days.size} 天。每一条记录都是你与自己的对话。`,
      mood_palette: ['平静', '日常', '真实'],
    },
    patterns: {
      recurring_themes: [
        {
          theme: '记录本身',
          evidence: [safeContent(fragments[0] ?? { content: '', audio_uri: null, photo_uri: null } as any).slice(0, 50)],
          insight: '你选择记录，这本身就是一种关注自己的方式。',
        },
      ],
    },
    notable_moments: fragments.slice(0, 2).map((f) => ({
      moment: safeContent(f).slice(0, 100),
      why_it_matters: '每一个被记录下来的瞬间，都值得被看见。',
    })),
    growth_trajectory: {
      seeds_planted: ['开始记录的习惯'],
      gentle_observations: '你正在建立一种新的自我对话方式。这需要时间，也值得耐心。',
    },
    gentle_invitation: {
      reflection_question: '在这些碎片中，哪一条最能代表你这一周的状态？',
      micro_experiment: '下周试试在一天结束时，用一句话描述今天最强烈的感受。',
      affirmation: '你的每一条记录，都在编织属于你的故事。',
    },
  };
}

/**
 * Compress a photo and return its base64 data URI.
 * Returns null if compression or reading fails — caller skips the image.
 */
async function compressAndReadBase64(photoUri: string): Promise<string | null> {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

export async function generateWeeklyReport(
  repo: Repository,
  weekKey?: string
): Promise<Result<ReportContent, AIError | { kind: 'no_fragments' }>> {
  const targetWeek = weekKey ?? computeWeekKey(Date.now());
  const fragments = await repo.getFragmentsByWeek(targetWeek);

  if (fragments.length === 0) {
    return Err({ kind: 'no_fragments' as const });
  }

  // Get previous report for context
  let previousSummary: string | undefined;
  const latestReport = await repo.getLatestReport();
  if (latestReport) {
    try {
      const prevContent = JSON.parse(latestReport.content) as ReportContent;
      previousSummary = `**快照**：${prevContent.snapshot.summary}\n**情绪色彩**：${prevContent.snapshot.mood_palette.join('、')}`;
    } catch {}
  }

  const apiKey = await repo.getApiKey();

  // Determine if any fragments have photos
  const photoFragments = fragments
    .filter((f) => f.photo_uri != null)
    .sort((a, b) => b.created_at - a.created_at); // newest first for the 5-limit
  const hasPhotos = photoFragments.length > 0;

  let userContent: string | ContentPart[];
  let model: string;
  let systemPrompt: string;

  if (!hasPhotos) {
    // Text-only path: cheaper model
    userContent = buildUserPrompt(fragments, previousSummary);
    model = TEXT_MODEL;
    systemPrompt = SYSTEM_PROMPT;
  } else {
    // Vision path: compress top-N photos and build multimodal content
    model = VISION_MODEL;
    systemPrompt = VISION_SYSTEM_PROMPT;

    // Only include base64 for up to MAX_PHOTOS_PER_REPORT photos (by newest)
    const photoUrisForVision = photoFragments
      .slice(0, MAX_PHOTOS_PER_REPORT)
      .map((f) => f.photo_uri!);

    // Compress and read base64 for eligible photos
    const base64Map = new Map<string, string>();
    for (const uri of photoUrisForVision) {
      const b64 = await compressAndReadBase64(uri);
      if (b64) base64Map.set(uri, b64);
    }

    userContent = buildVisionUserContent(fragments, base64Map, previousSummary);
  }

  const result = await callHunyuan(apiKey, systemPrompt, userContent, model);

  // no_api_key 直接冒泡，不降级也不存报告，让调用方（UI）处理跳转逻辑
  if (!result.ok && result.error.kind === 'no_api_key') {
    return Err(result.error);
  }

  let reportContent: ReportContent;

  if (result.ok) {
    reportContent = result.value;
  } else {
    console.warn('AI generation failed, using fallback:', result.error);
    reportContent = createFallbackReport(fragments);
  }

  await repo.insertReport(
    targetWeek,
    reportContent,
    fragments.map((f) => f.id),
    result.ok ? model : 'local-fallback'
  );

  return Ok(reportContent);
}
