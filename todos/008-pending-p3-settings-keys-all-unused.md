---
status: complete
priority: p3
issue_id: "008"
tags: [code-review, cleanup, yagni]
---

# `settingsKeys.all` 已定义但从未被使用

## Problem Statement

`useSettings.ts` 中定义了 `settingsKeys.all`，遵循 React Query 键工厂模式，但当前只有一个 settings 查询（`apiKey`），`all` 从未在任何 `invalidateQueries` 调用中使用。

## Findings

```ts
// useSettings.ts
export const settingsKeys = {
  all: ['settings'] as const,        // ← 定义了但从未被引用
  apiKey: () => ['settings', 'apiKey'] as const,
};
```

## Proposed Solutions

### Option A（推荐）：保留，但添加注释说明用途

```ts
export const settingsKeys = {
  // 用于将来批量 invalidate 所有 settings 查询（如添加 theme/language 等设置）
  all: ['settings'] as const,
  apiKey: () => ['settings', 'apiKey'] as const,
};
```

### Option B：删除，等真正需要时再加

遵循 YAGNI 原则：目前只有一个查询，键工厂本身已是轻度过度设计。

## Acceptance Criteria

- [ ] `settingsKeys.all` 要么有使用它的代码，要么有注释说明预期用途，要么被删除

## Work Log

- 2026-03-27：代码审查发现，来自 code-simplicity-reviewer
