---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, security, privacy, logging]
---

# 生产代码中存在 console.log 泄露用户隐私内容

## Problem Statement

两处 `console.log` 在生产环境下持续输出用户的私人日记内容和 AI 分析结果，将来如果接入 Sentry/Crashlytics 等日志平台，这些内容将被上传至第三方服务。

## Findings

**最严重 — `ReportList.tsx:75`（完整 ReportContent 内容）**

```ts
console.log('[Report] Generation result:', result);
// result.value 包含用户的 notable_moments、growth_trajectory、情绪分析等全部内容
```

**中等 — `client.ts:68`（AI 原始响应的前 500 字符）**

```ts
console.log('[AI] Raw response:', JSON.stringify(data).slice(0, 500));
// 包含 AI 基于用户日记片段生成的内容
```

**低 — `reportGenerator.ts:75`（错误详情，可能含 invalid_response raw text）**

```ts
console.warn('AI generation failed, using fallback:', result.error);
// result.error 在 invalid_response 时含有 raw: text.slice(0, 500)
```

## Proposed Solutions

### Option A（推荐）：用 `__DEV__` 门控所有调试日志

```ts
// React Native 中 __DEV__ 在开发构建时为 true，发布包中为 false
if (__DEV__) {
  console.log('[Report] Generation result:', result);
}
```

### Option B：直接删除 / 降级为仅输出非敏感字段

```ts
// ReportList.tsx
console.log('[Report] Generation ok:', result.ok);

// client.ts
// 完全删除，response 状态已由 status 分支覆盖
```

## Acceptance Criteria

- [ ] `ReportList.tsx` 中的 `console.log('[Report] Generation result:', result)` 被移除或用 `__DEV__` 门控
- [ ] `client.ts` 中的 `console.log('[AI] Raw response:', ...)` 被移除或用 `__DEV__` 门控
- [ ] 生产包（`expo build`）中不再有含用户私人内容的日志输出

## Work Log

- 2026-03-27：代码审查发现，来自 security-sentinel
