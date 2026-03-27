---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, react, memory-leak]
---

# `SettingsScreen` 的 setTimeout 未在组件卸载时清理

## Problem Statement

`handleSave` 成功后设置了 2 秒的 `setTimeout` 来隐藏"已保存"提示，但该 timer 未被清理。若用户在 2 秒内离开设置页，`setShowSaved(false)` 将在已卸载的组件上调用，触发 React 18 strict mode 警告。

## Findings

```ts
// SettingsScreen.tsx:36
setTimeout(() => setShowSaved(false), 2000); // ← 返回值未存储，无法取消
```

## Proposed Solutions

### Option A（推荐）：使用 `useRef` 存储 timer ID，在 `useEffect` cleanup 中取消

```ts
const timerRef = useRef<ReturnType<typeof setTimeout>>();

// handleSave 中
clearTimeout(timerRef.current);
timerRef.current = setTimeout(() => setShowSaved(false), 2000);

// 组件卸载时清理
useEffect(() => () => clearTimeout(timerRef.current), []);
```

`ReturnType<typeof setTimeout>` 解决 Node.js vs 浏览器类型差异问题。

## Acceptance Criteria

- [ ] `setTimeout` 返回值被存储在 ref 中
- [ ] 组件卸载时通过 `useEffect` cleanup 取消 timer
- [ ] React 18 strict mode 下不再产生"更新已卸载组件状态"警告

## Work Log

- 2026-03-27：代码审查发现，来自 kieran-typescript-reviewer
