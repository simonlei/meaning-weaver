---
status: complete
priority: p1
issue_id: "003"
tags: [code-review, naming, architecture]
---

# `callClaude` 函数名具有误导性——实际调用的是混元 API

## Problem Statement

`src/services/ai/client.ts` 中的主函数名为 `callClaude`，但它调用的是腾讯云混元大模型（`api.hunyuan.cloud.tencent.com`），与 Anthropic 的 Claude 毫无关系。这会在代码审查、文档和新开发者理解时产生严重的认知混乱。

## Findings

```ts
// client.ts
const HUNYUAN_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';

export async function callClaude( // ← 名字和实现完全不匹配
  apiKey: string | null,
  ...
```

调用方（`reportGenerator.ts:68`）：

```ts
const result = await callClaude(apiKey, SYSTEM_PROMPT, userPrompt);
```

## Proposed Solutions

### Option A（推荐）：重命名为 `callHunyuan`

全局替换 `callClaude` → `callHunyuan`，影响：
- `src/services/ai/client.ts`（定义处）
- `src/services/ai/reportGenerator.ts`（唯一调用方）
- `src/services/ai/__tests__/client.test.ts`（测试引用）

### Option B：通用名 `callAI`

若将来可能换模型，使用 `callAI` 更稳定，但不如 `callHunyuan` 明确当前实现。

## Acceptance Criteria

- [ ] `callClaude` 被重命名为 `callHunyuan`（或 `callAI`）
- [ ] 所有引用（实现 + 调用方 + 测试）同步更新
- [ ] 重命名后所有测试仍通过

## Work Log

- 2026-03-27：代码审查发现，来自 code-simplicity-reviewer
