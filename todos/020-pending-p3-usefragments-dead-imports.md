---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, cleanup, photo-feature]
---

# `useFragments.ts` 中存在未使用的 `Platform` 和 `FileSystem` 导入

## Problem Statement

`src/hooks/useFragments.ts` 在本次 PR 中新增了两行导入，但文件内没有任何地方使用它们：

```ts
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
```

这些 dead import 会：
1. 触发 ESLint `no-unused-vars` 警告
2. 误导读者认为 hook 与文件系统有关

## Proposed Solutions

直接删除两行 import。

## Acceptance Criteria

- [ ] `useFragments.ts` 中无未使用的 import
- [ ] `npm test` 通过，无 lint 警告

## Work Log

- 2026-03-27: 由 code-simplicity-reviewer review agent 发现
