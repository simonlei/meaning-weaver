---
status: complete
priority: p1
issue_id: "011"
tags: [code-review, performance, storage, photo-feature]
---

# ImageManipulator 压缩临时文件从不删除（存储泄漏）

## Problem Statement

`compressAndReadBase64()` 每次调用 `ImageManipulator.manipulateAsync()` 都会在缓存目录写入一个新的压缩 JPEG 文件（`compressed.uri`）。base64 读取完成后，该临时文件从未被删除，在设备磁盘上无限积累。

每次生成包含 5 张照片的周报，会累积 5 个约 200–500 KB 的孤儿文件。长期使用后将在低存储设备上引发应用不稳定。

## Findings

**File:** `src/services/ai/reportGenerator.ts`, lines 58–69

```ts
const compressed = await ImageManipulator.manipulateAsync(
  photoUri,
  [{ resize: { width: 1280 } }],
  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
);
const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
  encoding: FileSystem.EncodingType.Base64,
});
return `data:image/jpeg;base64,${base64}`;
// ← compressed.uri 是新临时文件，从未被删除
```

## Proposed Solutions

### Option A: `finally` 块内删除（推荐）

```ts
async function compressAndReadBase64(photoUri: string): Promise<string | null> {
  let compressedUri: string | null = null;
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    compressedUri = compressed.uri;
    const base64 = await FileSystem.readAsStringAsync(compressedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.warn('compressAndReadBase64 failed:', e);
    return null;
  } finally {
    if (compressedUri) {
      await FileSystem.deleteAsync(compressedUri, { idempotent: true }).catch(() => {});
    }
  }
}
```

**Pros:** 保证清理，即使 readAsStringAsync 抛出异常也能执行
**Cons:** 无
**Effort:** Small
**Risk:** Low

### Option B: 压缩后立即删除

```ts
const base64 = await FileSystem.readAsStringAsync(compressed.uri, { ... });
await FileSystem.deleteAsync(compressed.uri, { idempotent: true });
return `data:image/jpeg;base64,${base64}`;
```

**Pros:** 更简单
**Cons:** 若 deleteAsync 失败会抛出（虽然 idempotent 减少概率）
**Effort:** Small
**Risk:** Very Low

## Recommended Action

采用 Option A（`finally` 块）。

## Technical Details

- **Affected file:** `src/services/ai/reportGenerator.ts`
- **Function:** `compressAndReadBase64`
- **Test:** 在 `reportGenerator.test.ts` 中 assert `FileSystem.deleteAsync` 在压缩后被调用

## Acceptance Criteria

- [ ] `compressAndReadBase64` 在读取 base64 后删除压缩临时文件
- [ ] 即使 `readAsStringAsync` 抛出异常，临时文件也会被清理
- [ ] 单测验证 `FileSystem.deleteAsync` 被调用（传入 compressed.uri）

## Work Log

- 2026-03-27: 由 performance-oracle + architecture-strategist review agents 发现
