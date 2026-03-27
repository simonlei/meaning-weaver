---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, quality, ai, photo-feature]
---

# `reportGenerator.ts:90` 中空的 `catch {}` 静默吞掉 JSON 解析错误

## Problem Statement

解析上一份周报内容时，catch 块完全为空，JSON 解析失败会静默发生，`previousSummary` 为空但用户无任何提示。

## Findings

**File:** `src/services/ai/reportGenerator.ts`, lines 87–92

```ts
try {
  const prevContent = JSON.parse(latestReport.content) as ReportContent;
  previousSummary = `上周摘要：${prevContent.summary}`;
} catch {}   // ← 完全静默，没有任何日志
```

## Proposed Solutions

```ts
} catch (e) {
  console.warn('[generateWeeklyReport] Could not parse previous report:', e);
}
```

## Acceptance Criteria

- [ ] catch 块包含至少一行 `console.warn` 日志

## Work Log

- 2026-03-27: 由 kieran-typescript-reviewer review agent 发现
