---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, typescript, type-safety]
---

# 多处不安全的 `JSON.parse(...) as Type` 强制类型转换

## Problem Statement

代码中存在多处 `JSON.parse(...) as SomeType` 断言，这是对编译器的"谎言"——TypeScript 相信你，但运行时若数据结构不符会静默崩溃或产生意外行为。涉及存储用户私人日记和 AI 报告的场景，数据损坏风险更高。

## Findings

**`reportGenerator.ts:61`（最危险）**

```ts
const prevContent = JSON.parse(latestReport.content) as ReportContent;
//                                                    ^^^^^^^^^^^^^^^^^
// 老版本 schema 的数据会静默通过，访问不存在字段时 undefined 链路错误
```

**`ReportList.tsx:32,109`（UI 渲染中）**

```ts
content = JSON.parse(report.content); // 虽有 try/catch，但 parse 成功也可能是错误类型
```

`ReportContentSchema`（Zod）已在 `client.ts` 中定义，可直接用于验证。

## Proposed Solutions

### Option A（推荐）：使用 Zod `safeParse` 验证后再访问

```ts
// reportGenerator.ts
const parsed = ReportContentSchema.safeParse(JSON.parse(latestReport.content));
if (parsed.success) {
  const prevContent = parsed.data;
  previousSummary = `**快照**：${prevContent.snapshot.summary}...`;
}
// 失败时 previousSummary 保持 undefined，合理降级
```

### Option B：至少添加 `try/catch` + `instanceof` 检查（最低要求）

已有 try/catch 的地方，确保捕获了类型检查失败。

## Acceptance Criteria

- [ ] `reportGenerator.ts` 中的 `JSON.parse(...) as ReportContent` 替换为 `ReportContentSchema.safeParse()`
- [ ] 不存在裸 `JSON.parse(...) as XxxType` 强制断言（`any` 接收再检查可接受）

## Work Log

- 2026-03-27：代码审查发现，来自 kieran-typescript-reviewer
