import { Fragment } from '../../db/schema';
import { ContentPart } from './client';

// ===== 图片描述 Prompt =====

export const PHOTO_DESCRIPTION_SYSTEM_PROMPT = `你是一个善于观察的记录者。请用 2-4 句话描述用户发来的照片：
- 描述照片中的主要内容（人物、场景、物品、活动）
- 捕捉照片的情绪氛围或特殊细节
- 语言自然、温暖，像在给朋友描述一个生活瞬间
不要使用"这张照片"开头，直接描述内容即可。只输出描述文字，不要输出其他内容。`;

/**
 * Build the user content for photo description: a text preamble + the image.
 * If additionalPrompt is provided, it is appended as a hint for the model.
 */
export function buildPhotoDescriptionContent(
  base64DataUri: string,
  additionalPrompt?: string
): ContentPart[] {
  const parts: ContentPart[] = [];
  let text = '请描述这张照片。';
  if (additionalPrompt?.trim()) {
    // NOTE: additionalPrompt is user-supplied; cap length to prevent oversized inputs.
    const safeAdditional = additionalPrompt.trim().slice(0, 200);
    text += `\n\n补充说明：${safeAdditional}`;
  }
  parts.push({ type: 'text', text });
  parts.push({ type: 'image_url', image_url: { url: base64DataUri } });
  return parts;
}

// ===== 周报 Prompt =====

export const SYSTEM_PROMPT = `你是一位温暖的叙事治疗师和生活观察者。你的任务是阅读用户一周内记录的生活碎片，并生成一份富有洞察力的周报。

## 核心原则
1. **无条件积极关注**：对每一个碎片都带着好奇和尊重，绝不评判
2. **叙事视角**：帮助用户看到自己是生活故事的作者
3. **模式识别而非诊断**：用「我注意到...」而非「你应该...」
4. **温柔的力量**：语言温暖但不廉价，每句话都有分量

## 关于图片描述
部分碎片会包含「[图片描述：...]」格式的内容，这是用户上传的照片经过 AI 理解后的文字描述。请将这些图片描述作为视觉记录，与文字碎片一同编织进叙事洞察中，感受其中的情绪与氛围。
✅ "这一周，你似乎在安静地重建和外部世界的连接方式。"
✅ "周三那个在公园坐了很久的下午——它可能比你意识到的更重要。"
❌ "你做得很棒！继续加油！"（空洞）
❌ "你应该多运动。"（说教）

## 处理敏感内容
- 如果碎片中提到情绪低落，用承认和陪伴的方式回应，不淡化
- 不做心理诊断，不提供医疗建议

## 输出格式
你必须输出严格符合以下 JSON 结构的内容，不要输出任何其他内容：

{
  "version": 1,
  "snapshot": {
    "title": "一句话概括这一周（10字以内）",
    "summary": "2-3句话描绘这一周的总体画面",
    "mood_palette": ["情绪色彩词1", "情绪色彩词2", "情绪色彩词3"]
  },
  "patterns": {
    "recurring_themes": [
      {
        "theme": "浮现的主题名称",
        "evidence": ["引用碎片中的具体内容"],
        "insight": "关于这个模式的温柔解读"
      }
    ]
  },
  "notable_moments": [
    {
      "moment": "引用或概述一个值得留意的碎片",
      "why_it_matters": "为什么这个瞬间值得留意——一个温柔的洞察"
    }
  ],
  "growth_trajectory": {
    "compared_to_last_week": "与上周对比的观察（如有上周信息）",
    "seeds_planted": ["这周种下的种子/积极信号"],
    "gentle_observations": "一段温柔的、关于成长的观察"
  },
  "gentle_invitation": {
    "reflection_question": "一个发人深省的反思问题",
    "micro_experiment": "下周可以尝试的一个微小实验",
    "affirmation": "一句温暖的肯定"
  }
}`;

function groupByDay(fragments: Fragment[]): Record<string, Fragment[]> {
  const groups: Record<string, Fragment[]> = {};
  for (const f of fragments) {
    const date = new Date(f.created_at);
    const dayKey = `${date.getMonth() + 1}月${date.getDate()}日 周${'日一二三四五六'[date.getDay()]}`;
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(f);
  }
  return groups;
}

export function buildUserPrompt(
  fragments: Fragment[],
  previousReportSummary?: string
): string {
  const sorted = [...fragments].sort((a, b) => a.created_at - b.created_at);
  const byDay = groupByDay(sorted);

  let prompt = `## 本周碎片\n📒 共 ${fragments.length} 条\n\n`;
  for (const [day, dayFragments] of Object.entries(byDay)) {
    prompt += `### ${day}\n`;
    for (const f of dayFragments) {
      if (f.content.trim()) {
        prompt += `- ${f.content}`;
        if (f.photo_description) {
          // NOTE: photo_description may be user-edited; treat as untrusted content.
          // Cap length and strip bracket chars to prevent prompt structure injection.
          const safeDesc = f.photo_description.slice(0, 500).replace(/[\[\]]/g, '');
          prompt += `\n  [图片描述：${safeDesc}]`;
        }
        prompt += '\n';
      } else if (f.photo_description) {
        // Photo-only fragment with a description
        // NOTE: photo_description may be user-edited; treat as untrusted content.
        // Cap length and strip bracket chars to prevent prompt structure injection.
        const safeDesc = f.photo_description.slice(0, 500).replace(/[\[\]]/g, '');
        prompt += `- [图片描述：${safeDesc}]\n`;
      } else if (f.audio_uri) {
        // Voice fragment with no transcription text — include as placeholder
        prompt += `- （语音记录）\n`;
      }
    }
    prompt += '\n';
  }

  if (previousReportSummary) {
    prompt += `\n---\n## 上周摘要\n${previousReportSummary}\n`;
  }

  prompt += `\n---\n请生成本周的生活洞察周报。只输出 JSON，不要输出其他内容。`;
  return prompt;
}
