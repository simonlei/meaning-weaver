import { Fragment, ReportContent, computeWeekKey } from '../../db/schema';
import { Repository } from '../../db/repository';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { callClaude, AIError } from './client';
import { Result, Ok, Err } from '../../lib/result';

function createFallbackReport(fragments: Fragment[]): ReportContent {
  const days = new Set(fragments.map((f) => {
    const d = new Date(f.created_at);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }));

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
          evidence: [fragments[0]?.content.slice(0, 50) ?? ''],
          insight: '你选择记录，这本身就是一种关注自己的方式。',
        },
      ],
    },
    notable_moments: fragments.slice(0, 2).map((f) => ({
      moment: f.content.slice(0, 100),
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

  const userPrompt = buildUserPrompt(fragments, previousSummary);
  const apiKey = await repo.getApiKey();
  const result = await callClaude(apiKey, SYSTEM_PROMPT, userPrompt);

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
    result.ok ? 'claude-sonnet-4' : 'local-fallback'
  );

  return Ok(reportContent);
}
