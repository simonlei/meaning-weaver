import { z } from 'zod';

export const FragmentSchema = z.object({
  id: z.string(),
  content: z.string(),
  created_at: z.number(),
  week_key: z.string(),
  photo_uri: z.string().nullable().optional(),
  audio_uri: z.string().nullable().optional(),
});
export type Fragment = z.infer<typeof FragmentSchema>;

export const ReportContentSchema = z.object({
  version: z.literal(1),
  snapshot: z.object({
    title: z.string(),
    summary: z.string(),
    mood_palette: z.array(z.string()),
  }),
  patterns: z.object({
    recurring_themes: z.array(
      z.object({
        theme: z.string(),
        evidence: z.array(z.string()),
        insight: z.string(),
      })
    ),
  }),
  notable_moments: z.array(
    z.object({
      moment: z.string(),
      why_it_matters: z.string(),
    })
  ),
  growth_trajectory: z.object({
    compared_to_last_week: z.string().optional(),
    seeds_planted: z.array(z.string()),
    gentle_observations: z.string(),
  }),
  gentle_invitation: z.object({
    reflection_question: z.string(),
    micro_experiment: z.string(),
    affirmation: z.string(),
  }),
});
export type ReportContent = z.infer<typeof ReportContentSchema>;

export const ReportSchema = z.object({
  id: z.string(),
  week_key: z.string(),
  content: z.string(), // JSON stringified ReportContent
  fragment_ids: z.string(), // JSON stringified string[]
  model_version: z.string().nullable(),
  generated_at: z.number(),
});
export type Report = z.infer<typeof ReportSchema>;

// Alias used by other modules
export type WeeklyReport = {
  id: string;
  week_key: string;
  content: ReportContent;
  fragment_ids: string[];
  generated_at: number;
};

/** Compute ISO week key like '2026-W13' from a unix timestamp (ms) */
export function computeWeekKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  // ISO week calculation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Alias for backward compatibility
export const getWeekKey = computeWeekKey;
