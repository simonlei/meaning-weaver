---
title: "feat: 用户自定义 Hunyuan API Key 配置项"
type: feat
status: completed
date: 2026-03-27
---

# feat: 用户自定义 Hunyuan API Key 配置项

## Overview

为 Meaning Weaver 新增一个设置页面，允许用户在应用内输入并持久化保存自己的腾讯云混元 API Key，替代现有的环境变量方案。采用 TDD 方式开发，测试先行。

## Problem Statement

当前 API Key 读取方式是模块顶层的构建时常量：

```ts
// src/services/ai/client.ts
const API_KEY = process.env.EXPO_PUBLIC_HUNYUAN_API_KEY || 'YOUR_HUNYUAN_API_KEY';
```

这带来两个问题：
1. **普通用户无法配置**：需要重新编译才能改变 key，终端用户无法自助设置
2. **无法动态变更**：模块加载时就固定，运行时读取新 key 必须重启应用

## Proposed Solution

1. **新增 `settings` 存储层**：在 `Repository` 接口和两个实现（`SQLiteRepository` / `WebRepository`）中添加 `getApiKey()` / `setApiKey()` 方法
2. **新增 `useSettings` hook**：封装 TanStack Query 的读写，与现有 `useFragments` 风格一致
3. **修改 `callClaude`**：改为接收 `apiKey` 参数，而非读顶层常量，使其成为纯函数便于测试
4. **新增 Settings Tab**：`app/(tabs)/settings.tsx` + 注册到 `_layout.tsx`
5. **错误引导**：`ReportList` 中 `no_api_key` 错误时引导用户跳转到设置页

全程 **TDD**：每个模块先写测试，再写实现，测试通过后才进入下一模块。

## Technical Approach

### 测试框架搭建（前置）

项目当前无测试基础设施。需先安装并配置：

```json
// package.json 新增 devDependencies
"jest": "^29",
"jest-expo": "^55",
"@testing-library/react-native": "^12",
"@testing-library/jest-native": "^5"
```

`jest.config.js`：

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    'expo-sqlite': '<rootDir>/__mocks__/expo-sqlite.js',
  },
};
```

### TDD 实现顺序

#### 阶段一：Repository 层（最底层，无 UI 依赖）

**先写测试 `src/db/__tests__/repository.settings.test.ts`：**

```ts
describe('WebRepository - API Key', () => {
  it('初始状态返回 null', async () => {
    const repo = new WebRepository();
    expect(await repo.getApiKey()).toBeNull();
  });

  it('保存后能读回', async () => {
    const repo = new WebRepository();
    await repo.setApiKey('test-key-123');
    expect(await repo.getApiKey()).toBe('test-key-123');
  });

  it('保存空字符串等同清空', async () => {
    const repo = new WebRepository();
    await repo.setApiKey('some-key');
    await repo.setApiKey('');
    expect(await repo.getApiKey()).toBeNull();
  });
});

describe('SQLiteRepository - API Key', () => {
  // 使用内存 SQLite mock 测试相同用例
});
```

**再写实现**：

`src/db/repository.ts` — `Repository` 接口新增：
```ts
getApiKey(): Promise<string | null>;
setApiKey(key: string): Promise<void>;
```

`WebRepository` 实现（localStorage）：
```ts
async getApiKey(): Promise<string | null> {
  const raw = localStorage.getItem('mw_api_key');
  return raw || null;
}
async setApiKey(key: string): Promise<void> {
  if (!key) {
    localStorage.removeItem('mw_api_key');
  } else {
    localStorage.setItem('mw_api_key', key);
  }
}
```

`SQLiteRepository` 实现（新增 `settings` 表，user_version migration 升至 2）：
```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

```ts
async getApiKey(): Promise<string | null> {
  const row = await this.db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', ['api_key']
  );
  return row?.value ?? null;
}
async setApiKey(key: string): Promise<void> {
  if (!key) {
    await this.db.runAsync('DELETE FROM settings WHERE key = ?', ['api_key']);
  } else {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['api_key', key]
    );
  }
}
```

---

#### 阶段二：AI Client 层（纯函数，易测试）

**先写测试 `src/services/ai/__tests__/client.test.ts`：**

```ts
describe('callClaude', () => {
  it('apiKey 为 null 时返回 no_api_key 错误', async () => {
    const result = await callClaude(null, 'system', 'user');
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('no_api_key');
  });

  it('apiKey 为占位符时返回 no_api_key 错误', async () => {
    const result = await callClaude('YOUR_HUNYUAN_API_KEY', 'system', 'user');
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('no_api_key');
  });

  it('401 响应返回 auth 错误', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 401, ok: false });
    const result = await callClaude('real-key', 'system', 'user');
    expect(result.error.kind).toBe('auth');
  });
});
```

**再写实现**：

修改 `src/services/ai/client.ts` — `callClaude` 签名改为接收 apiKey 参数：

```ts
// 删除顶层 const API_KEY = ...
export async function callClaude(
  apiKey: string | null,
  systemPrompt: string,
  userPrompt: string
): Promise<Result<ReportContent, AIError>> {
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    return Err({ kind: 'no_api_key' });
  }
  // ... 其余逻辑不变，将 API_KEY 替换为 apiKey 参数
}
```

---

#### 阶段三：`useSettings` Hook

**先写测试 `src/hooks/__tests__/useSettings.test.ts`（使用 `renderHook` + mock repo）：**

```ts
it('初始 apiKey 为 null', async () => {
  const { result } = renderHook(() => useApiKey(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeNull();
});

it('saveApiKey mutation 调用 repo.setApiKey', async () => {
  const mockRepo = { getApiKey: jest.fn().mockResolvedValue(null), setApiKey: jest.fn() };
  // ...
  act(() => result.current.saveApiKey.mutate('new-key'));
  expect(mockRepo.setApiKey).toHaveBeenCalledWith('new-key');
});
```

**再写实现 `src/hooks/useSettings.ts`：**

```ts
export function useApiKey() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: ['settings', 'apiKey'],
    queryFn: () => repo!.getApiKey(),
    enabled: !!repo,
  });
}

export function useSaveApiKey() {
  const { repo } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => repo!.setApiKey(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'apiKey'] }),
  });
}
```

---

#### 阶段四：修改 `reportGenerator.ts`

`generateWeeklyReport` 改为从 repo 读取 apiKey，再传给 `callClaude`：

```ts
const apiKey = await repo.getApiKey();
const result = await callClaude(apiKey, SYSTEM_PROMPT, userPrompt);
```

---

#### 阶段五：Settings UI 屏幕

**先写测试 `src/features/settings/__tests__/SettingsScreen.test.tsx`：**

```ts
it('显示已保存的 key（脱敏）', async () => {
  mockUseApiKey.mockReturnValue({ data: 'sk-abc123456789' });
  render(<SettingsScreen />);
  expect(screen.getByText(/sk-abc\*{6}/)).toBeTruthy();
});

it('输入并点击保存后调用 mutation', async () => {
  render(<SettingsScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('输入混元 API Key'), 'new-key');
  fireEvent.press(screen.getByText('保存'));
  expect(mockSaveApiKey).toHaveBeenCalledWith('new-key');
});

it('点击清除按钮调用 setApiKey 空字符串', async () => {
  render(<SettingsScreen />);
  fireEvent.press(screen.getByText('清除'));
  expect(mockSaveApiKey).toHaveBeenCalledWith('');
});
```

**再写实现 `app/(tabs)/settings.tsx`（或 `src/features/settings/SettingsScreen.tsx`）：**

UI 元素（沿用项目色彩规范 `#6B5B4F` / `#FAF7F4`）：
- 说明文字（如何获取 API Key 的链接）
- TextInput（`secureTextEntry` 遮蔽输入，`placeholder='输入腾讯云混元 API Key'`）
- 已保存 key 的脱敏展示（前 6 位 + `***`）
- 「保存」按钮 / 「清除」按钮
- 保存成功的简短提示

---

#### 阶段六：注册 Tab + 错误引导

修改 `app/(tabs)/_layout.tsx` 注册第三个 Tab：
```tsx
<Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: ... }} />
```

修改 `src/features/report/ReportList.tsx` 中的 `no_api_key` 处理：
```tsx
// 原来：window.alert('周报已生成（使用了本地模板）')
// 改为：
router.push('/(tabs)/settings');
```

## Acceptance Criteria

### Repository 层
- [x] `WebRepository.getApiKey()` 初始返回 `null`
- [x] `WebRepository.setApiKey(key)` 保存后 `getApiKey()` 返回该 key
- [x] `WebRepository.setApiKey('')` 等同清空
- [x] `SQLiteRepository` 同上三条，通过内存 mock 测试
- [x] SQLite migration `user_version` 从 1 升至 2，`settings` 表正确创建

### AI Client 层
- [x] `callClaude(null, ...)` 返回 `{ kind: 'no_api_key' }`
- [x] `callClaude('YOUR_HUNYUAN_API_KEY', ...)` 返回 `{ kind: 'no_api_key' }`
- [x] 传入有效 key 时正常发起请求（mock fetch 验证 Authorization header 包含该 key）

### Hook 层
- [x] `useApiKey()` 返回 repo 中存储的 key
- [x] `useSaveApiKey().mutate(key)` 调用 `repo.setApiKey(key)` 并使缓存失效

### Settings UI
- [x] 渲染时展示脱敏的已保存 key（若有）
- [x] 输入新 key + 点击「保存」 → `mutation` 被调用
- [x] 点击「清除」 → `setApiKey('')` 被调用
- [x] TextInput 使用 `secureTextEntry` 遮蔽输入

### 集成行为
- [x] 无 key 时生成周报 → 弹出/跳转至设置页
- [x] 设置 key 后再生成周报 → 使用该 key 调用 API（无 `no_api_key` 降级）
- [x] Settings Tab 显示在底部导航栏（⚙️ 图标）

### TDD 流程
- [x] **每个模块的测试先于实现提交**（commit 历史可验证）
- [x] 所有测试 `npm test` 全部通过，无跳过

## Dependencies & Risks

| 依赖 | 说明 |
|------|------|
| `jest-expo` ~55 | 需与 Expo 55 版本对齐 |
| `@testing-library/react-native` | 需安装 peer deps |
| `expo-sqlite` mock | 需手写 `__mocks__/expo-sqlite.js` |

| 风险 | 缓解 |
|------|------|
| `client.ts` 签名变更影响调用方 | `reportGenerator.ts` 是唯一调用处，同步修改 |
| SQLite migration 升版 | 先写测试覆盖 migration 逻辑，且用 `IF NOT EXISTS` 保证幂等 |
| 安全性：key 明文存 localStorage/SQLite | 当前阶段可接受（个人使用）；后续可升级 SecureStore |

## File Checklist

```
新增：
  package.json                                (添加 jest 相关 devDependencies)
  jest.config.js
  __mocks__/expo-sqlite.js
  src/db/__tests__/repository.settings.test.ts
  src/services/ai/__tests__/client.test.ts
  src/hooks/__tests__/useSettings.test.ts
  src/features/settings/__tests__/SettingsScreen.test.tsx
  src/hooks/useSettings.ts
  app/(tabs)/settings.tsx

修改：
  src/db/repository.ts                        (接口 + 两个实现类)
  src/services/ai/client.ts                   (callClaude 改为接收 apiKey 参数)
  src/services/ai/reportGenerator.ts          (从 repo 读 key 传给 callClaude)
  src/features/report/ReportList.tsx          (no_api_key 引导到设置页)
  app/(tabs)/_layout.tsx                      (注册 settings tab)
```

## Sources & References

- 现有 Repository 模式：`src/db/repository.ts`
- 现有 Hook 模式：`src/hooks/useFragments.ts`
- AI Client 当前实现：`src/services/ai/client.ts:8-11`
- Tab 导航结构：`app/(tabs)/_layout.tsx`
- 项目色彩规范：`app/(tabs)/_layout.tsx`（`#6B5B4F` 主色系）
- MVP 计划中 Settings 导航预留：`docs/plans/2026-03-26-001-feat-meaning-weaver-mvp-plan.md`
