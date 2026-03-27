---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, data-integrity, bug]
---

# model_version 字段存储的是错误的模型名称

## Problem Statement

每次成功调用 AI 生成周报后，存储的 `model_version` 字段值为 `'claude-sonnet-4'`，但实际调用的模型是 `'hunyuan-turbos-latest'`（`client.ts` 中的 `MODEL` 常量）。这是错误数据，会误导所有依赖 `model_version` 进行版本追踪或展示的代码。

## Findings

`reportGenerator.ts:83`：

```ts
result.ok ? 'claude-sonnet-4' : 'local-fallback'
//           ^^^^^^^^^^^^^^ 硬编码的错误模型名
```

`client.ts:17`：

```ts
const MODEL = 'hunyuan-turbos-latest'; // 实际使用的模型
```

## Proposed Solutions

### Option A（推荐）：从 `client.ts` 导出 `MODEL` 常量

```ts
// client.ts
export const MODEL = 'hunyuan-turbos-latest';

// reportGenerator.ts
import { callClaude, MODEL, AIError } from './client';
// ...
model_version: result.ok ? MODEL : 'local-fallback'
```

### Option B：callClaude 返回所用模型名

修改 `callClaude` 在成功结果中包含 `model` 字段，但这会改动 `Result` 类型，成本较高。

## Acceptance Criteria

- [ ] 成功生成的周报，其 `model_version` 字段存储实际模型名（当前为 `'hunyuan-turbos-latest'`）
- [ ] `MODEL` 常量从 `client.ts` 导出，`reportGenerator.ts` 引用而非硬编码

## Work Log

- 2026-03-27：代码审查发现，来自 code-simplicity-reviewer
