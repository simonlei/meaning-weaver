---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, performance, photo-feature, ai]
---

# 照片压缩串行执行，应改为 `Promise.all` 并发

## Problem Statement

`generateWeeklyReport` 中最多 5 张照片的压缩逐个 `await`，总耗时为所有操作之和（每张 300–800ms manipulate + 50–150ms readAsStringAsync = 最坏约 5 秒），且在 API 调用开始前用户无任何反馈。

## Findings

**File:** `src/services/ai/reportGenerator.ts`, lines 122–125

```ts
for (const uri of photoUrisForVision) {
  const b64 = await compressAndReadBase64(uri);  // 串行：等上一张完成才处理下一张
  if (b64) base64Map.set(uri, b64);
}
```

## Proposed Solutions

### Option A: `Promise.all` 并发（推荐）

```ts
const entries = await Promise.all(
  photoUrisForVision.map(async (uri) => {
    const b64 = await compressAndReadBase64(uri);
    return b64 ? ([uri, b64] as [string, string]) : null;
  })
);
const base64Map = new Map(entries.filter((e): e is [string, string] => e !== null));
```

**Pros:** 最坏情况下从 ~5s 降到 ~1s，5 张图并发处理
**Cons:** 同时占用内存略高（5 个解码操作并行），但量级在可接受范围内
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A。同时在 `reportGenerator.test.ts` 中验证 5 张图片时 `manipulateAsync` 被调用了 5 次（已有测试）但实际 wall time 对比可通过 mock timer 验证顺序无依赖。

## Acceptance Criteria

- [ ] 压缩逻辑改为 `Promise.all` 并发
- [ ] 所有现有 reportGenerator 测试通过

## Work Log

- 2026-03-27: 由 performance-oracle + code-simplicity-reviewer review agents 发现
