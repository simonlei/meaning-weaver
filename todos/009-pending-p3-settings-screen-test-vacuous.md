---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, testing, quality]
---

# `SettingsScreen.test.ts` 的 save/clear 交互测试是自我验证的空测试

## Problem Statement

`SettingsScreen.test.ts` 中的 `saveKey logic` 测试块直接调用了 mock 函数，然后断言 mock 函数被调用——测试的是测试本身，而不是组件行为。这些测试的存在给人"已覆盖交互逻辑"的错误印象。

## Findings

```ts
// SettingsScreen.test.ts:91-95
it('输入非空 key 后调用 mutate(key)', () => {
  const key = 'new-api-key-value';
  if (key.trim()) {
    mockMutate(key.trim()); // ← 测试自己调用 mock
  }
  expect(mockMutate).toHaveBeenCalledWith('new-api-key-value'); // ← 当然成立
});
```

另外，`maskApiKey` 逻辑在测试文件内被重新定义（第38行），然后又测试从模块导入的版本（第72行），同一函数两份定义。

## Proposed Solutions

### Option A（推荐）：将交互测试提升为 `@testing-library/react-native` 集成测试

```ts
import { render, fireEvent } from '@testing-library/react-native';
// ...
it('点击保存后调用 mutate(key)', () => {
  const { getByPlaceholderText, getByText } = render(<SettingsScreen />);
  fireEvent.changeText(getByPlaceholderText('输入混元 API Key'), 'my-key');
  fireEvent.press(getByText('保存'));
  expect(mockMutate).toHaveBeenCalledWith('my-key');
});
```

### Option B：删除无效的交互测试，保留 `maskApiKey` 纯函数测试（已有效）

至少清理掉伪造的测试，避免误导。

## Acceptance Criteria

- [ ] `saveKey logic` 和 `clearKey` 相关测试真正测试组件行为（通过 RNTL 渲染 + 事件触发）
- [ ] 测试文件中不再有本地重新定义的 `maskApiKey`；直接从模块导入

## Work Log

- 2026-03-27：代码审查发现，来自 architecture-strategist + kieran-typescript-reviewer
