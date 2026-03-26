---
title: "feat: Meaning Weaver MVP — AI-Powered Life Insight Journal"
type: feat
status: active
date: 2026-03-26
origin: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md
deepened: 2026-03-26
---

# ✨ Meaning Weaver MVP — AI 驱动的生活洞察工具

## Enhancement Summary

**Deepened on:** 2026-03-26
**Research agents used:** Architecture Strategist, Security Sentinel, Performance Oracle, TypeScript Reviewer, Code Simplicity Reviewer, Expo Best Practices Researcher, Claude API Prompt Researcher

### Key Improvements
1. **大幅精简 MVP 范围** — 从 15 个功能砍到 4 个核心功能，聚焦验证唯一假设："AI 能否从日常碎片中生成有意义的洞察？"
2. **补充完整的 TypeScript 类型系统** — Zod schema + 判别联合类型 + Result 错误处理模式
3. **SQLite 性能架构** — WAL 模式、预计算 `week_key` 索引、FlashList 虚拟列表
4. **Claude API 结构化输出** — `zodOutputFormat` + 完整 prompt 模板 + 4 层降级策略
5. **安全审计补充** — API Key 代理架构、SQLCipher 密钥派生、EXIF 剥离、OS 级泄露防护

### Critical Decision: MVP 范围重新定义

> ⚠️ **Simplicity Review 核心结论**：原计划 4 周 15 个功能，对独立开发者过于激进。
> 重新定义 MVP 为**只验证核心假设的最小集合**，其余功能移至 v2。

| 原计划 | MVP 保留 | 理由 |
|--------|---------|------|
| 文字输入 | ✅ 保留 | 核心 |
| 语音录制 + Whisper | ❌ → v2 | 手机键盘自带语音输入，零代码可用 |
| 照片 + Vision | ❌ → v2 | 增加 2 个 API 集成，不影响核心假设验证 |
| AI 周报生成 | ✅ 保留 | **这就是产品** |
| PII 脱敏 | ❌ → v2 | 初期只有自己用，无合规需求 |
| 生物认证 | ❌ → v2 | 手机本身有锁屏 |
| 加密备份 | ❌ → v2 | 手机本身有 iCloud/Google 备份 |
| 数据导入 | ❌ → v2 | 用示例数据解决冷启动 |
| 离线队列 | ❌ → 简单提示 | Toast + 手动重试即可 |
| NativeWind | ❌ → StyleSheet | 零配置，MVP 不需要精美 UI |

---

（see brainstorm: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md）

## Overview

构建一个移动端 App：用户通过文字随手记录生活碎片，AI 每周从碎片中提炼主题、模式和自我洞察，生成一份"生活线索报告"。

**一句话定位：** 不是日记 App，是一面帮你看见自己的镜子。

**核心假设：** AI 能从用户的日常文字碎片中生成有意义的、令人惊喜的自我洞察。

## Problem Statement / Motivation

碎片化生活导致人们丧失对自我的连贯认知。现有工具（日记 App、冥想 App、情绪追踪器）要么只做存储不做洞察，要么脱离真实生活场景，要么需要用户有强烈的写作习惯。

心理学研究表明，人通过"讲述自己的故事"建立连贯自我（McAdams 叙事身份理论），但碎片化的数字生活打断了这一过程。我们需要一个工具，将散落的生活碎片编织成有意义的叙事。

## Proposed Solution

### 核心体验流程（MVP）

```
用户随手记录文字碎片
        ↓
   碎片累积数天
        ↓
点击"生成周报" → Claude API
        ↓
  阅读 AI 洞察，浏览历史
```

### 技术架构（MVP 精简版）

```
┌──────────────────────────────────────────┐
│          React Native (Expo)              │
│                                           │
│  ┌──────────┐  ┌──────────┐              │
│  │ Fragment  │  │  Report  │              │
│  │  Input    │  │  Viewer  │              │
│  └────┬─────┘  └────┬─────┘              │
│       │              │                    │
│  ┌────┴──────────────┴──────────────┐    │
│  │       expo-sqlite (local)         │    │
│  └──────────────┬───────────────────┘    │
│                 │                         │
│  ┌──────────────┴───────────────────┐    │
│  │      Claude API (报告生成)        │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Technical Approach

### 技术栈选型（MVP）

| 层 | 选择 | 理由 |
|----|------|------|
| 框架 | **React Native (Expo)** | 单人开发效率最高，Expo EAS 一键构建发布 |
| 语言 | **TypeScript** | 类型安全，生态最大 |
| 本地存储 | **expo-sqlite** | 结构化数据，WAL 模式高性能 |
| AI 分析 | **Claude API** | 共情语气最佳，中文质量优秀，支持结构化输出 |
| 导航 | **expo-router** | 文件系统路由，简洁 |
| UI | **StyleSheet** | 零配置，MVP 够用 |
| 列表 | **@shopify/flash-list** | 虚拟化滚动，碎片多时不卡 |

### Research Insights: 技术选型补充

**为何 MVP 不用 NativeWind：**
- NativeWind v4 必须配合 Tailwind CSS v3（不兼容 v4.x），有 babel/metro 配置开销
- Expo 组件不支持 `className`，需 `View` 包裹，增加调试复杂度
- MVP 阶段视觉打磨不是重点，StyleSheet 零配置即可

**为何 MVP 不用 Whisper/Vision：**
- iOS/Android 键盘内置语音输入，用户说话后直接变成文字碎片，零代码零成本
- 减少 API 集成从 3 个到 1 个，降低 2/3 的集成复杂度
- 核心假设验证不依赖输入方式——文字足够

---

### 数据模型

#### Research Insights: 极简 schema + 类型安全

```sql
-- MVP 只需两张表
CREATE TABLE fragments (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,  -- unix timestamp（整数比较远快于字符串）
  week_key TEXT NOT NULL         -- '2026-W13' 预计算，加速周报查询
);

-- 周报表（fragment_ids 用 JSON 数组，省掉关联表）
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL UNIQUE, -- '2026-W13'
  content TEXT NOT NULL,          -- JSON: 结构化周报内容
  fragment_ids TEXT NOT NULL,     -- JSON array: ["uuid1","uuid2",...]
  model_version TEXT,
  generated_at INTEGER NOT NULL
);

-- 索引：覆盖两个热路径
CREATE INDEX idx_fragments_created ON fragments(created_at DESC);
CREATE INDEX idx_fragments_week ON fragments(week_key);
```

#### Research Insights: 为什么这样设计

| 决策 | 原因 | 来源 |
|------|------|------|
| `created_at` 用 INTEGER | 整数比较远快于 ISO 字符串比较 | Performance Oracle |
| `week_key` 预计算 | 避免每次查询做日期运算，week_key 精确匹配 = index seek，比 BETWEEN 快 10-50x | Performance Oracle |
| 去掉 junction table | MVP 不需要反向查询（"哪些报告包含这个碎片"），JSON 数组够用 | Simplicity Review |
| 去掉 `type`, `metadata`, `timezone` | MVP 只有文字碎片，不需要多态。简化到极致 | Simplicity Review |

#### TypeScript 类型定义（Zod）

```typescript
// src/db/schema.ts
import { z } from 'zod';

export const FragmentSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  created_at: z.number().int().positive(),
  week_key: z.string().regex(/^\d{4}-W\d{2}$/),
});
export type Fragment = z.infer<typeof FragmentSchema>;

// 周报 5 段式结构
export const ReportContentSchema = z.object({
  version: z.literal(1),
  snapshot: z.object({
    title: z.string(),
    summary: z.string(),
    mood_palette: z.array(z.string()),
  }),
  patterns: z.object({
    recurring_themes: z.array(z.object({
      theme: z.string(),
      evidence: z.array(z.string()),
      insight: z.string(),
    })),
  }),
  notable_moments: z.array(z.object({
    moment: z.string(),
    source_fragment_id: z.string(),
    why_it_matters: z.string(),
  })).min(2).max(5),
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
```

#### Research Insights: Zod hydration layer

```typescript
// src/db/hydrate.ts — SQLite row → typed object 的安全转换
export function hydrateFragment(row: Record<string, unknown>): Fragment {
  return FragmentSchema.parse(row);
}

export function hydrateFragments(rows: Record<string, unknown>[]) {
  const ok: Fragment[] = [];
  const errors: { index: number; error: unknown }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const result = FragmentSchema.safeParse(rows[i]);
    if (result.success) ok.push(result.data);
    else errors.push({ index: i, error: result.error });
  }
  return { ok, errors };
}
```

---

### AI 周报结构（5 段式）

基于叙事疗法与积极心理学研究设计：

| 板块 | 内容 | 心理学依据 |
|------|------|-----------|
| 🗓 **本周快照** | 一句话概括 + 情绪色彩词 | 具象化回忆锚点 |
| 🔄 **浮现的模式** | 重复出现的主题 + 具体引用 + 温柔解读 | 叙事疗法"外化"技术 |
| 💡 **值得留意的瞬间** | 2-3 个有深意的碎片 + 开放式反思问题 | 反思性写作研究 |
| 📈 **成长轨迹** | 与前几周对比（如有）+ 种下的种子 | 自我决定理论 |
| 🌱 **一个温柔的邀请** | 反思问题 + 小实验建议 + 肯定 | 动机式晤谈法 |

#### Research Insights: 完整 Prompt 模板

**System Prompt（温暖叙事治疗师）**：

```typescript
const SYSTEM_PROMPT = `你是一位温暖的叙事治疗师和生活观察者。你的任务是阅读用户一周内记录的生活碎片，并生成一份富有洞察力的周报。

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
- 不做心理诊断，不提供医疗建议`;
```

**User Prompt 构建**：

```typescript
function buildUserPrompt(
  fragments: Fragment[],
  previousReport?: ReportContent
): string {
  const sorted = [...fragments].sort((a, b) => a.created_at - b.created_at);
  const byDay = groupByDay(sorted);

  let prompt = `## 本周碎片\n📝 共 ${fragments.length} 条\n\n`;
  for (const [day, dayFragments] of Object.entries(byDay)) {
    prompt += `### ${day}\n`;
    for (const f of dayFragments) {
      prompt += `[${f.id.slice(0, 8)}] ${f.content}\n\n`;
    }
  }

  if (previousReport) {
    prompt += `\n---\n## 上周摘要\n`;
    prompt += `**快照**：${previousReport.snapshot.summary}\n`;
    prompt += `**情绪色彩**：${previousReport.snapshot.mood_palette.join('、')}\n`;
    prompt += `**核心模式**：${previousReport.patterns.recurring_themes.map(t => t.theme).join('、')}\n`;
  }

  return prompt + `\n---\n请生成本周的生活洞察周报。`;
}
```

**结构化输出（zodOutputFormat）**：

```typescript
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const message = await client.messages.parse({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userPrompt }],
  output_config: { format: zodOutputFormat(ReportContentSchema) },
});

if (message.parsed_output) {
  return message.parsed_output; // 已经是 ReportContent 类型
}
```

#### Research Insights: 成本预估

| 用户类型 | 每周碎片 | 输入 tokens | 输出 tokens | 每次成本 | 月成本 |
|---------|---------|-----------|------------|---------|-------|
| 轻度 | ~10 条 | ~5,000 | ~2,000 | ~$0.02 | ~$0.08 |
| 中度 | ~25 条 | ~10,000 | ~2,500 | ~$0.04 | ~$0.15 |
| 重度 | ~50 条 | ~20,000 | ~3,000 | ~$0.07 | ~$0.28 |

**优化手段**：Prompt Caching（系统提示词缓存）可再降 50%+。

#### Research Insights: 4 层降级策略

```
Sonnet（完整体验）
  ↓ 失败
Haiku（降级但仍有 AI 洞察，成本 1/12）
  ↓ 失败
缓存的上次报告
  ↓ 无缓存
本地模板（纯统计：碎片数、最活跃的一天、随机精选瞬间）
```

---

### 错误处理模式

#### Research Insights: Result 类型 + 判别联合

```typescript
// src/lib/result.ts
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// src/services/ai/client.ts
export type AIError =
  | { kind: 'network'; message: string; retryable: true }
  | { kind: 'rate_limit'; retryAfterMs: number; retryable: true }
  | { kind: 'auth'; message: string; retryable: false }
  | { kind: 'invalid_response'; raw: string; retryable: false };

// 使用时编译器强制穷尽处理
const result = await generateReport(fragments);
if (!result.ok) {
  switch (result.error.kind) {
    case 'network':    showToast('网络不可用，请稍后重试'); break;
    case 'rate_limit': showToast(`请求过于频繁，${result.error.retryAfterMs/1000}秒后重试`); break;
    case 'auth':       navigateTo('Settings'); break;
    case 'invalid_response': showToast('生成失败，请重试'); break;
    // TypeScript 会在遗漏 case 时报错
  }
}
```

---

### 状态管理

#### Research Insights: TanStack Query + SQLite

```typescript
// src/hooks/useFragments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const fragmentKeys = {
  all: ['fragments'] as const,
  list: () => ['fragments', 'list'] as const,
  week: (weekKey: string) => ['fragments', 'week', weekKey] as const,
};

export function useFragments() {
  const db = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.list(),
    queryFn: () => getRecentFragments(db, 50),
  });
}

export function useCreateFragment() {
  const db = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => insertFragment(db, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: fragmentKeys.all }),
  });
}
```

**为什么不用 Zustand**：TanStack Query 已经处理了缓存、失效、乐观更新。MVP 中唯一需要的全局状态就是 SQLite 数据，不需要额外的状态管理库。

---

### 性能架构

#### Research Insights: 关键优化清单

```typescript
// 1. 初始化时开启 WAL 模式 — 读写不互锁
db.execAsync('PRAGMA journal_mode = WAL');
db.execAsync('PRAGMA synchronous = NORMAL');

// 2. 乐观 UI — 碎片输入 0ms 感知延迟
const saveFragment = async (fragment: Fragment) => {
  dispatch({ type: 'ADD_FRAGMENT', payload: fragment }); // 立即显示
  queueMicrotask(async () => {
    try {
      await db.runAsync('INSERT INTO fragments ...', [...]);
    } catch (e) {
      dispatch({ type: 'REMOVE_FRAGMENT', payload: fragment.id }); // 失败回滚
    }
  });
};

// 3. FlashList — 碎片列表虚拟化滚动
<FlashList
  data={fragments}
  renderItem={renderFragment}
  estimatedItemSize={80}
  keyExtractor={(item) => item.id}
/>

// 4. 分页加载 — 不一次性加载所有碎片
const loadPage = (beforeTimestamp: number, limit = 30) =>
  db.getAllAsync(
    'SELECT * FROM fragments WHERE created_at < ? ORDER BY created_at DESC LIMIT ?',
    [beforeTimestamp, limit]
  );
```

---

### 隐私与安全方案

#### Research Insights: 安全审计发现

> ⚠️ **Security Sentinel 核心发现**：MVP 阶段最关键的安全决策是 **API Key 不能存在客户端**。

**MVP 安全方案（分层实施）**：

| 优先级 | 措施 | MVP 做 | 说明 |
|--------|------|--------|------|
| P0 | API Key 代理 | ✅ | **不在客户端存储 Claude API Key**。搭建简单代理服务器（Cloudflare Worker / Vercel Serverless），客户端调用你的 API，代理转发到 Claude |
| P0 | TLS 传输 | ✅ | HTTPS（默认） |
| P1 | SQLCipher 加密 | ❌ v2 | MVP 阶段只有自己用，手机锁屏即可 |
| P1 | 生物认证 | ❌ v2 | 同上 |
| P1 | PII 脱敏 | ❌ v2 | 自己的数据，不需要对自己脱敏 |
| P2 | EXIF 剥离 | ❌ v2 | MVP 无照片功能 |
| P2 | 加密备份 | ❌ v2 | 手机本身有备份 |

**API 代理服务器（最小实现）**：

```typescript
// Cloudflare Worker — 10 行代码
export default {
  async fetch(request: Request) {
    const body = await request.json();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,  // 存在服务端
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    return response;
  },
};
```

#### Research Insights: v2 安全清单（公开发布前必做）

<details>
<summary>展开 v2 安全清单</summary>

1. **SQLCipher 密钥派生**：生成随机 256-bit 密钥 → 存入 Secure Enclave/StrongBox → 生物认证解锁
2. **PII 三层脱敏**：正则 → NER 模型 → 用户确认 UI
3. **OS 级泄露防护**：FLAG_SECURE(Android)、blur overlay on background(iOS)、禁用键盘学习
4. **EXIF 剥离**：所有照片入库前剥离 GPS/设备信息
5. **语音文件生命周期**：转写完成后安全删除原始音频
6. **Session 超时**：N 分钟无操作自动锁定
7. **Prompt 注入防护**：碎片内容转义后再嵌入 prompt

</details>

---

## Implementation Phases（精简版）

### Phase 1: 核心闭环（Week 1-2）

**目标**：能记录文字碎片 + 生成 AI 周报。**这就是整个 MVP。**

**任务清单**：

- [ ] 初始化 Expo 项目，配置 TypeScript
  - `npx create-expo-app meaning-weaver --template`
  - 安装依赖：`expo-sqlite`, `expo-router`, `@shopify/flash-list`, `@tanstack/react-query`, `zod`
- [ ] 搭建导航结构（expo-router）
  - `app/(tabs)/_layout.tsx` — 两个 tab: 碎片 / 周报
  - `app/(tabs)/index.tsx` — 碎片输入 + 时间线
  - `app/(tabs)/reports.tsx` — 周报列表
- [ ] 实现本地数据库
  - `src/db/database.ts` — SQLite 初始化 + WAL 模式 + 迁移
  - `src/db/schema.ts` — Zod 类型定义
  - `src/db/queries/fragments.ts` — 碎片 CRUD
  - `src/db/queries/reports.ts` — 周报 CRUD
- [ ] 实现碎片输入与展示
  - `src/components/FragmentInput.tsx` — 文本框 + 发送按钮（极简）
  - `src/components/FragmentList.tsx` — FlashList 时间线
- [ ] 搭建 API 代理
  - Cloudflare Worker / Vercel Serverless — 转发请求到 Claude API
- [ ] 实现 AI 周报生成
  - `src/services/ai/client.ts` — 调用代理 API
  - `src/services/ai/prompts.ts` — System prompt + User prompt 模板
  - `src/services/ai/reportGenerator.ts` — 碎片聚合 → API 调用 → Zod 解析 → 存储
  - 触发方式：手动按钮（"生成本周报告"）
  - 降级：API 失败时显示本地统计模板
- [ ] 实现周报展示
  - `src/features/report/ReportView.tsx` — 渲染 5 段式周报
  - `src/features/report/ReportList.tsx` — 历史周报列表
- [ ] 冷启动
  - 预置 3 条示例碎片 + 1 份示例周报，让用户立即看到产品形态

**交付物**：能记录文字碎片 + 生成 AI 周报的可运行 App

### Phase 2: 每日使用 + Prompt 迭代（Week 3）

**目标**：用真实数据验证核心假设。

**任务清单**：

- [ ] 每天用自己记录碎片，积累真实数据
- [ ] 生成第一份基于真实数据的周报
- [ ] 根据实际效果迭代 prompt（**这是最关键的一周**）
  - AI 的洞察是否令人惊喜？
  - 语气是否温暖不说教？
  - 5 段式结构是否合理？
  - 碎片数量对质量的影响？
- [ ] 修复使用中发现的 bug
- [ ] 补充基础体验
  - 碎片删除功能
  - 周报重新生成功能
  - 基本的空状态 UI

**交付物**：经过真实数据验证的 AI 周报质量

### Phase 3: 打磨（Week 4）

**目标**：基于 Week 3 发现的问题做针对性改进。

**任务清单**（根据 Week 3 实际情况调整）：

- [ ] Prompt 最终调优
- [ ] UI 基本打磨（间距、字体、颜色）
- [ ] 性能优化（如需要）
- [ ] Buffer：处理前几周遗留的问题

**交付物**：一个自己每天想用的 App

---

## 文件结构

```
meaning-weaver/
├── app/
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx          # 碎片输入 + 时间线
│       └── reports.tsx        # 周报列表 + 详情
├── src/
│   ├── db/
│   │   ├── database.ts        # SQLite 初始化
│   │   ├── schema.ts          # Zod 类型
│   │   ├── hydrate.ts         # row → typed object
│   │   └── queries/
│   │       ├── fragments.ts
│   │       └── reports.ts
│   ├── services/
│   │   └── ai/
│   │       ├── client.ts      # API 调用
│   │       ├── prompts.ts     # prompt 模板
│   │       └── reportGenerator.ts
│   ├── components/
│   │   ├── FragmentInput.tsx
│   │   └── FragmentList.tsx
│   ├── features/
│   │   └── report/
│   │       ├── ReportView.tsx
│   │       └── ReportList.tsx
│   ├── hooks/
│   │   ├── useDatabase.ts
│   │   └── useFragments.ts
│   └── lib/
│       └── result.ts          # Result<T,E> 类型
├── api-proxy/                  # Cloudflare Worker
│   └── index.ts
└── package.json
```

---

## Acceptance Criteria（MVP）

### 功能要求

- [ ] 用户可输入文字碎片并保存到本地
- [ ] 碎片按时间线展示，支持滚动浏览
- [ ] 用户可手动触发 AI 周报生成
- [ ] 周报按 5 段式结构展示
- [ ] 历史周报列表可浏览
- [ ] 周报支持引用上周报告做趋势对比

### 非功能要求

- [ ] 碎片输入到保存 < 1 秒（乐观 UI）
- [ ] 周报生成 < 30 秒
- [ ] App 大小 < 50MB

### 设计原则（from brainstorm）

- [ ] **反效率**：无打卡、无 streak、无催促
- [ ] **不评判**：AI 语气温暖，使用"我注意到"而非"你应该"
- [ ] **极低摩擦**：打开即可记录，无需分类或打标签

---

## Success Metrics

| 指标 | 目标 | 衡量方式 |
|------|------|---------|
| 自己是否每天想用 | 连续 2 周日均 > 3 条碎片 | 本地数据 |
| 周报洞察质量 | 每份周报至少 1 个"没想到"的发现 | 主观评价 |
| 周报是否令人期待 | 周日是否主动点击生成 | 行为观察 |

---

## Dependencies & Risks

| 风险 | 影响 | 缓解策略 |
|------|------|---------|
| Claude API 价格变动 | 成本不可控 | 抽象 AI 层 + 降级到 Haiku/DeepSeek |
| AI 洞察质量不稳定 | 产品无价值 | Week 3 专门用于 prompt 迭代 |
| 洞察内容重复 | 失去新鲜感 | 引入跨周对比、上周摘要作为上下文 |
| API Key 泄露 | 被盗用 | 代理服务器，Key 不存客户端 |
| Expo SDK 兼容性 | 构建失败 | 锁定 SDK 版本，EAS Build |

---

## Future Considerations: v2 Roadmap

基于 MVP 验证结果，按优先级逐步加入：

| 优先级 | 功能 | 触发条件 |
|--------|------|---------|
| v2-P0 | 语音输入（expo-av + Whisper） | 确认核心假设成立 |
| v2-P0 | 照片输入（expo-image-picker + Vision） | 同上 |
| v2-P1 | SQLCipher 加密 + 生物认证 | 准备发布给其他用户 |
| v2-P1 | PII 脱敏（正则 + NER + 用户确认） | 同上 |
| v2-P1 | 加密备份导出/导入 | 同上 |
| v2-P2 | 微信聊天记录导入 | 用户反馈需求 |
| v2-P2 | 月报/季报 | 积累足够历史数据 |
| v2-P2 | 多种叙事形式（诗歌、隐喻、图表） | 留存下降时 |
| v3 | 本地 AI 模型 | 端侧模型能力足够 |
| v3 | 家庭口述史模式 | 产品方向拓展 |

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md](../brainstorms/2026-03-26-meaning-weaver-brainstorm.md)
  - Key decisions carried forward: 碎片输入 + 周报输出、本地优先隐私策略、反效率设计哲学

### Review Agents Applied

- **Architecture Strategist** — repository 层设计、feature vs service 边界、状态管理策略
- **Security Sentinel** — API Key 代理架构、SQLCipher 密钥派生、EXIF/OS 级泄露防护、PII 三层脱敏
- **Performance Oracle** — WAL 模式、week_key 索引、FlashList、乐观 UI、启动优化
- **TypeScript Reviewer** — Zod schema、Result 类型、判别联合、TanStack Query 模式
- **Code Simplicity Reviewer** — MVP 范围重新定义（15 功能 → 4 功能）
- **Expo Best Practices** — expo-av 配置、SQLCipher 原生支持、NativeWind 注意事项、EAS Build 费用
- **Claude API Prompt Researcher** — zodOutputFormat 结构化输出、prompt 模板、成本估算、降级策略

### Psychology References

- McAdams 叙事身份理论 — 人通过叙事建立连贯自我
- Flavell 元认知理论 — 自我觉察是心理健康核心能力
- 叙事疗法"外化"技术 — 将问题与人分离

### Technical References

- [Claude API Structured Outputs](https://docs.anthropic.com/en/docs/build-with-claude/structured-output)
- [Anthropic SDK TypeScript Helpers](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [FlashList](https://shopify.github.io/flash-list/)
- [TanStack Query for React Native](https://tanstack.com/query/latest)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
