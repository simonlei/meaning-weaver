import { Fragment } from '../../db/schema';
import { ContentPart } from './client';

export const SYSTEM_PROMPT = `你是一位温暖的叙事治疗师和生活观察者。你的任务是阅读用户一周内记录的生活碎片，并生成一份富有洞察力的周报。

## 核心原则
1. **无条件积极关注**：对每一个碎片都带着好奇和尊重，绝不评判
2. **叙事视角**：帮助用户看到自己是生活故事的作者
3. **模式识别而非诊断**：用「我注意到...」而非「你应该...」
4. **温柔的力量**：语言温暖但不廉价，每句话都有分量

## 语气示范
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

export const VISION_SYSTEM_PROMPT = `你是一位温暖的叙事治疗师和生活观察者。你的任务是阅读用户一周内记录的生活碎片（包含文字和照片），并生成一份富有洞察力的周报。

## 关于照片碎片
这一周的记录中包含一些照片。请用你对图像的感知来理解情绪、场景与氛围——照片中的光线、色调、构图都在述说着什么。将视觉信息与文字碎片一同编织进叙事洞察中。

## 核心原则
1. **无条件积极关注**：对每一个碎片都带着好奇和尊重，绝不评判
2. **叙事视角**：帮助用户看到自己是生活故事的作者
3. **模式识别而非诊断**：用「我注意到...」而非「你应该...」
4. **温柔的力量**：语言温暖但不廉价，每句话都有分量

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
        "evidence": ["引用碎片中的具体内容或图像描述"],
        "insight": "关于这个模式的温柔解读"
      }
    ]
  },
  "notable_moments": [
    {
      "moment": "引用或概述一个值得留意的碎片（文字或图像）",
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
        prompt += `- ${f.content}\n`;
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

/**
 * Build multimodal content parts for the vision model.
 * Fragments with photos in the base64Map get an image_url part.
 * Fragments with photos NOT in the map (over limit or failed) appear as text-only (if content exists).
 * Photo-only fragments (empty content, no image) are skipped entirely.
 */
export function buildVisionUserContent(
  fragments: Fragment[],
  base64Map: Map<string, string>,
  previousReportSummary?: string
): ContentPart[] {
  const sorted = [...fragments].sort((a, b) => a.created_at - b.created_at);
  const byDay = groupByDay(sorted);

  const parts: ContentPart[] = [];

  // Header text
  const photoCount = fragments.filter((f) => f.photo_uri != null).length;
  const headerText = `## 本周碎片\n📒 共 ${fragments.length} 条（含 ${photoCount} 张照片）\n\n`;
  let textBuffer = headerText;

  for (const [day, dayFragments] of Object.entries(byDay)) {
    textBuffer += `### ${day}\n`;
    for (const f of dayFragments) {
      const hasText = f.content.trim().length > 0;
      const base64DataUri = f.photo_uri ? base64Map.get(f.photo_uri) : undefined;

      if (hasText && !base64DataUri) {
        // Text only (no photo, or photo failed / over limit)
        textBuffer += `- ${f.content}\n`;
      } else if (hasText && base64DataUri) {
        // Text + photo: flush text buffer, then text part, then image part
        textBuffer += `- ${f.content}\n`;
        parts.push({ type: 'text', text: textBuffer });
        textBuffer = '';
        parts.push({ type: 'image_url', image_url: { url: base64DataUri } });
      } else if (!hasText && base64DataUri) {
        // Photo only: flush text buffer then image part
        parts.push({ type: 'text', text: textBuffer });
        textBuffer = '';
        parts.push({ type: 'image_url', image_url: { url: base64DataUri } });
      }
      // else: photo-only fragment with failed/over-limit image and no text → skip
    }
    textBuffer += '\n';
  }

  if (previousReportSummary) {
    textBuffer += `\n---\n## 上周摘要\n${previousReportSummary}\n`;
  }

  textBuffer += `\n---\n请生成本周的生活洞察周报。只输出 JSON，不要输出其他内容。`;

  if (textBuffer.trim()) {
    parts.push({ type: 'text', text: textBuffer });
  }

  return parts;
}
