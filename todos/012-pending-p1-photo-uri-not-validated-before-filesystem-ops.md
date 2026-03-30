---
status: complete
priority: p1
issue_id: "012"
tags: [code-review, security, photo-feature]
---

# `photo_uri` 在传给 FileSystem API 前未做路径验证

## Problem Statement

`photo_uri` 从数据库读取后直接传给 `FileSystem.deleteAsync()` 和 `ImageManipulator.manipulateAsync()`，没有任何验证该 URI 是否在 app 沙盒目录内。

理论上若 SQLite 数据库被篡改（root 设备或未来出现写入漏洞），恶意 `photo_uri` 可以：
1. 删除任意 app 可访问的文件（如 SQLite 数据库本身）
2. 将任意文件内容以 base64 形式发送到腾讯混元 API（信息外泄）

## Findings

**File:** `src/db/repository.ts`, lines 188–189

```ts
await FileSystem.deleteAsync(row.photo_uri, { idempotent: true });
```

**File:** `src/services/ai/reportGenerator.ts`, lines 58–61

```ts
const compressed = await ImageManipulator.manipulateAsync(photoUri, ...);
const base64 = await FileSystem.readAsStringAsync(compressed.uri, ...);
```

## Proposed Solutions

### Option A: 沙盒前缀验证（推荐）

```ts
function isSafePhotoUri(uri: string): boolean {
  const docDir = FileSystem.documentDirectory ?? '';
  const cacheDir = FileSystem.cacheDirectory ?? '';
  return (
    uri.startsWith('file://') &&
    (uri.startsWith(docDir) || uri.startsWith(cacheDir))
  );
}

// 在 deleteAsync / manipulateAsync 之前调用
if (!isSafePhotoUri(photoUri)) {
  console.warn('Rejected unsafe photo_uri:', photoUri);
  return;
}
```

**Pros:** 防止路径遍历攻击，轻量
**Cons:** `FileSystem.documentDirectory` 在某些环境可能为 null（需 fallback）
**Effort:** Small
**Risk:** Low

### Option B: 仅校验 `file://` scheme

```ts
if (!uri.startsWith('file://')) return;
```

**Pros:** 极简
**Cons:** 不够严格，file:// 内仍可包含路径遍历
**Effort:** Trivial
**Risk:** Medium（比无验证好，但不完整）

## Recommended Action

Option A，提取 `isSafePhotoUri` 工具函数，在 `repository.ts` 和 `reportGenerator.ts` 两处都调用。

## Technical Details

- **Affected files:** `src/db/repository.ts`, `src/services/ai/reportGenerator.ts`
- **Test:** 增加 test case：`photo_uri = 'file:///etc/passwd'` 时 `deleteAsync` 不被调用

## Acceptance Criteria

- [ ] `deleteFragment` 在调用 `FileSystem.deleteAsync` 前验证 URI 在沙盒内
- [ ] `compressAndReadBase64` 在调用 `manipulateAsync` 前验证 URI 在沙盒内
- [ ] 非法 URI 打印 warn 日志并提前返回，不崩溃

## Work Log

- 2026-03-27: 由 security-sentinel review agent 发现
