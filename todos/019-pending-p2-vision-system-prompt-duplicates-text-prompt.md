---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, quality, prompts, photo-feature]
---

# `VISION_SYSTEM_PROMPT` 复制了 95% 的提示词内容，重复维护成本高

## Problem Statement

`prompts.ts` 中 `VISION_SYSTEM_PROMPT` 与 `SYSTEM_PROMPT` 共享：完整的 `## 核心原则`、`## 处理敏感内容`、以及 35 行 JSON schema（`## 输出格式`）。两者完全重复，任何改动都需要在两处同步，极易出现漂移。

同时，`VISION_SYSTEM_PROMPT` 静默丢失了 `SYSTEM_PROMPT` 中的 `## 语气示范` 章节（含 ✅/❌ 语气对比示例），是否有意为之不明确。

## Findings

**File:** `src/services/ai/prompts.ts`

- `SYSTEM_PROMPT`（约 70 行）包含：开场 + 核心原则 + 语气示范 + 处理敏感内容 + 输出格式
- `VISION_SYSTEM_PROMPT`（约 80 行）包含：开场 + **关于照片碎片**（新增） + 核心原则 + 处理敏感内容 + 输出格式（**无语气示范**）

## Proposed Solutions

### Option A: 提取共享常量（推荐）

```ts
const SHARED_PRINCIPLES = `## 核心原则\n...`;
const SHARED_SENSITIVE = `## 处理敏感内容\n...`;
const SHARED_OUTPUT_FORMAT = `## 输出格式\n...`;
const TONE_EXAMPLES = `## 语气示范\n...`;  // 提取出来可在两处复用

export const SYSTEM_PROMPT = `
你是一位...（文字版）

${SHARED_PRINCIPLES}

${TONE_EXAMPLES}

${SHARED_SENSITIVE}

${SHARED_OUTPUT_FORMAT}
`.trim();

export const VISION_SYSTEM_PROMPT = `
你是一位...（视觉版）

## 关于照片碎片
...

${SHARED_PRINCIPLES}

${TONE_EXAMPLES}

${SHARED_SENSITIVE}

${SHARED_OUTPUT_FORMAT}
`.trim();
```

**Pros:** 单点维护，无重复，`TONE_EXAMPLES` 自动保持同步
**Cons:** 字符串拼接略降低可读性（可用注释补偿）
**Effort:** Small
**Risk:** Low（逻辑不变，只是重组字符串）

## Acceptance Criteria

- [ ] 核心原则、处理敏感内容、输出格式只定义一次
- [ ] 明确决定语气示范是否也包含在视觉提示中（建议包含）
- [ ] 现有 prompt 相关测试通过

## Work Log

- 2026-03-27: 由 code-simplicity-reviewer review agent 发现
