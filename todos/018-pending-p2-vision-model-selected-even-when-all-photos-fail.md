---
status: complete
priority: p2
issue_id: "018"
tags: [code-review, correctness, ai, photo-feature]
---

# 所有照片压缩失败时仍使用 vision 模型和 vision 提示词（语义不匹配）

## Problem Statement

模型选择基于 `fragments` 中 `photo_uri != null` 的数量（在压缩前决定）。若所有 5 张照片的 `compressAndReadBase64` 都失败，`base64Map` 为空，但 `VISION_MODEL` 和 `VISION_SYSTEM_PROMPT` 仍被使用——系统提示告诉模型"本周记录包含照片"，实际上请求中没有任何图片。

这会：
1. 让用户付出 vision 模型的 token 价格（约 3× 文本模型）
2. 可能导致模型基于"照片碎片"系统提示产生幻觉描述

## Findings

**File:** `src/services/ai/reportGenerator.ts`, lines 97–130

```ts
const hasPhotos = photoFragments.length > 0;  // ← 压缩前决定
// ...
// 压缩循环：所有失败时 base64Map 仍为空
for (const uri of photoUrisForVision) {
  const b64 = await compressAndReadBase64(uri);
  if (b64) base64Map.set(uri, b64);
}
// ...
if (hasPhotos) {  // ← base64Map 可能为空，但仍选 vision 路径
  systemPrompt = VISION_SYSTEM_PROMPT;
  model = VISION_MODEL;
  userContent = buildVisionUserContent(fragments, base64Map, previousSummary);
}
```

## Proposed Solutions

### Option A: 压缩后基于 `base64Map.size` 重新判断（推荐）

```ts
// 压缩循环之后
const actuallyHasPhotos = base64Map.size > 0;

if (actuallyHasPhotos) {
  systemPrompt = VISION_SYSTEM_PROMPT;
  model = VISION_MODEL;
  userContent = buildVisionUserContent(fragments, base64Map, previousSummary);
} else {
  // 所有压缩失败，回退到纯文本路径
  systemPrompt = SYSTEM_PROMPT;
  model = TEXT_MODEL;
  userContent = buildUserPrompt(fragments, previousSummary);
}
```

**Pros:** 模型选择与实际请求内容一致，避免错误计费和幻觉
**Cons:** 无
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] 当所有照片压缩失败时，使用文本模型和文本提示词
- [ ] 新增单测：mock `compressAndReadBase64` 全部返回 null，验证使用 `TEXT_MODEL`

## Work Log

- 2026-03-27: 由 architecture-strategist review agent 发现
