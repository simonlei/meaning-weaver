---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, typescript, api-design]
---

# `setApiKey('')` 作为隐式删除信号，类型不自文档化

## Problem Statement

`Repository.setApiKey(key: string)` 接口接受空字符串作为"删除"的隐式信号，但类型签名为 `string`，不传达这层语义。调用方（`SettingsScreen.tsx`）通过 `mutate('')` 清除 key，这是一个非直觉的约定。

## Findings

接口定义（`repository.ts:21`）：
```ts
setApiKey(key: string): Promise<void>;
```

调用方（`SettingsScreen.tsx:47`）：
```ts
onPress: () => saveApiKey.mutate(''), // '' 表示清除？类型说明只说 string
```

实现中的隐式约定（两个实现都有）：
```ts
if (!key) {
  // 删除操作
} else {
  // 存储操作
}
```

## Proposed Solutions

### Option A（推荐）：参数改为 `string | null`

```ts
// 接口
setApiKey(key: string | null): Promise<void>;

// 调用方
saveApiKey.mutate(null); // 语义清晰
```

### Option B：添加独立的 `clearApiKey()` 方法

```ts
clearApiKey(): Promise<void>;
```

调用更明确，但接口变大。

## Acceptance Criteria

- [ ] `Repository.setApiKey` 参数类型改为 `string | null`
- [ ] `WebRepository` 和 `SQLiteRepository` 实现更新
- [ ] `SettingsScreen.tsx` 中的 `mutate('')` 改为 `mutate(null)`
- [ ] 所有相关测试更新并通过

## Work Log

- 2026-03-27：代码审查发现，来自 architecture-strategist + kieran-typescript-reviewer
