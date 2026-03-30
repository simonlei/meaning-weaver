---
status: complete
priority: p1
issue_id: "015"
tags: [code-review, type-safety, photo-feature]
---

# `schema.ts` 中 `photo_uri` 使用 `.nullable().optional()` 导致类型过宽

## Problem Statement

`FragmentSchema` 中 `photo_uri` 定义为 `.nullable().optional()`，推导类型为 `string | null | undefined`。但整个代码库的所有写入路径都使用 `photoUri ?? null`，字段始终存在（只有 `null` 或 `string`，不会是 `undefined`）。

过宽的类型导致：
1. 下游所有 `photo_uri` 的 guard 比实际需要宽（`!= null` 同时排 null 和 undefined）
2. 增加了一个永远不会出现的状态，误导读代码的人
3. 与数据库列语义（`TEXT NULL`，值始终存在或 NULL）不符

## Findings

**File:** `src/db/schema.ts`, line 8

```ts
photo_uri: z.string().nullable().optional(),
// 推导类型: string | null | undefined  ← .optional() 多余
```

所有写入路径：

```ts
// repository.ts:63 — WebRepository
photo_uri: photoUri ?? null,

// repository.ts:154 — SQLiteRepository
photo_uri: photoUri ?? null,
```

## Proposed Solutions

### Option A: 移除 `.optional()`（推荐）

```ts
photo_uri: z.string().nullable(),
// 推导类型: string | null  ← 与实际语义完全匹配
```

**Pros:** 类型精确，代码更清晰，与 DB schema 语义一致
**Cons:** 无
**Effort:** Trivial
**Risk:** None（下游 guard 如 `!= null`、`!!` 依然有效）

## Recommended Action

Option A。同时移除 `repository.ts:158` 中冗余的 `?? null`：

```ts
// Before
[fragment.content, fragment.photo_uri ?? null, fragment.week_key, fragment.id]
// After
[fragment.content, fragment.photo_uri, fragment.week_key, fragment.id]
```

## Technical Details

- **Affected file:** `src/db/schema.ts`
- **Related:** `src/db/repository.ts:158` 冗余 `?? null`

## Acceptance Criteria

- [ ] `photo_uri` 类型为 `string | null`（不含 `undefined`）
- [ ] `repository.ts:158` 冗余 `?? null` 已移除
- [ ] 所有测试通过

## Work Log

- 2026-03-27: 由 kieran-typescript-reviewer review agent 发现
