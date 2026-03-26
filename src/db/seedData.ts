import * as SQLite from 'expo-sqlite';
import { computeWeekKey, ReportContent } from './schema';

const SEED_CHECK_KEY = '__seed_done__';

/** Seed example data on first launch so users see the product immediately */
export async function seedIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  // Check if we already seeded
  const count = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM fragments'
  );
  if (count && count.c > 0) return;

  const now = Date.now();
  const DAY = 86400000;
  const weekKey = computeWeekKey(now);

  // 3 example fragments spread across the week
  const fragments = [
    {
      id: 'seed-001',
      content: '今天在咖啡馆坐了一下午，看着窗外的人来人往。突然意识到自己很久没有这样"什么都不做"了。',
      created_at: now - 3 * DAY,
      week_key: weekKey,
    },
    {
      id: 'seed-002',
      content: '和老朋友打了个电话，聊了快一个小时。挂了电话之后心里暖暖的，但也有点感慨——这样的对话越来越少了。',
      created_at: now - 2 * DAY,
      week_key: weekKey,
    },
    {
      id: 'seed-003',
      content: '在公司楼下散步的时候看到一棵树发了新芽，拍了一张照片。春天真的来了。',
      created_at: now - 1 * DAY,
      week_key: weekKey,
    },
  ];

  // Insert fragments
  for (const f of fragments) {
    await db.runAsync(
      'INSERT OR IGNORE INTO fragments (id, content, created_at, week_key) VALUES (?, ?, ?, ?)',
      [f.id, f.content, f.created_at, f.week_key]
    );
  }

  // Insert a sample report
  const sampleReport: ReportContent = {
    version: 1,
    snapshot: {
      title: '重新呼吸的一周',
      summary:
        '这一周你在不经意间给自己创造了几个"停下来"的瞬间。咖啡馆的下午、老朋友的电话、路边的新芽——它们看似随意，却都指向同一件事：你正在重新学会感受生活中那些微小的温度。',
      mood_palette: ['平静', '怀旧', '萌芽'],
    },
    patterns: {
      recurring_themes: [
        {
          theme: '对"慢"的渴望',
          evidence: [
            '在咖啡馆"什么都不做"',
            '和老朋友打了快一个小时的电话',
          ],
          insight:
            '我注意到你这周有好几次主动让自己慢下来。这不是偷懒，而是你的内心在说——我需要空间。',
        },
        {
          theme: '人与人的连接',
          evidence: ['和老朋友打了个电话', '心里暖暖的，但也有点感慨'],
          insight:
            '那通电话带来的温暖和感慨并存，说明你对真实连接的需求比你以为的更强烈。',
        },
      ],
    },
    notable_moments: [
      {
        moment: '在咖啡馆坐了一下午，"什么都不做"',
        why_it_matters:
          '在一个崇尚效率的世界里，你给了自己一个下午的留白。这种勇气比你想象的更珍贵。',
      },
      {
        moment: '看到一棵树发了新芽，拍了照片',
        why_it_matters:
          '你选择停下脚步、注意到、记录下来——这说明你正在重新打开感知生活细节的能力。',
      },
    ],
    growth_trajectory: {
      seeds_planted: ['留白的习惯', '对真实连接的觉察', '对自然的敏感'],
      gentle_observations:
        '你可能还没有意识到，但这一周你做了一件很重要的事——你开始允许自己不那么"有用"。这是一种深层的自我接纳。',
    },
    gentle_invitation: {
      reflection_question:
        '在这一周里，有没有哪个瞬间让你觉得"啊，这才是我想要的生活的样子"？',
      micro_experiment:
        '下周试试：选一个工作日的午餐时间，不看手机，只是安静地吃饭，感受食物的味道。',
      affirmation:
        '你正在编织的这些碎片，终将成为一幅只属于你的图景。不急，慢慢来。',
    },
  };

  await db.runAsync(
    `INSERT OR IGNORE INTO reports (id, week_key, content, fragment_ids, model_version, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'seed-report-001',
      weekKey,
      JSON.stringify(sampleReport),
      JSON.stringify(fragments.map((f) => f.id)),
      'sample',
      now,
    ]
  );
}
