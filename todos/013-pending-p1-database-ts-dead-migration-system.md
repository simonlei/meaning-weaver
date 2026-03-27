---
status: pending
priority: p1
issue_id: "013"
tags: [code-review, architecture, database, migration, photo-feature]
---

# `database.ts` 是死代码但会损坏 `user_version`（定时炸弹）

## Problem Statement

项目中存在两套独立的 SQLite 迁移系统针对同一数据库文件：
- `src/db/database.ts`（老系统，停留在 v1，不再被任何组件使用）
- `src/db/repository.ts` → `runMigrations()`（活跃系统，当前 v3）

`database.ts` 虽然是死代码，但如果任何开发者误将 `getDatabase()` 接入（测试、新页面、重构），会发生：
1. 读取 `user_version = 3`（由 `runMigrations` 写入）
2. `MIGRATIONS.length = 1 < 3`，运行 0 条迁移
3. 写入 `PRAGMA user_version = 1`，**静默将 schema version 降级**
4. 下次 app 启动，`runMigrations` 认为 v2/v3 迁移未跑，尝试 `ALTER TABLE` 已存在的列 → 报错或数据错乱

## Findings

**File:** `src/db/database.ts` — legacy migration array with `MIGRATIONS.length = 1`
**File:** `src/db/repository.ts:runMigrations()` — live system at v3

两套系统使用同一个 `PRAGMA user_version` 作为版本标记，任何一方写入都会覆盖另一方的状态。

## Proposed Solutions

### Option A: 删除 `database.ts` 和 `seedData.ts`（推荐）

确认 `getDatabase()` 和 `getDatabase` 在整个项目中没有被任何活跃代码引用后，直接删除文件。

```bash
grep -r "getDatabase\|database\.ts" src/ --include="*.ts" --include="*.tsx"
```

若只在 `database.ts` 自身中被引用，直接删除。

**Pros:** 彻底消除风险，减少代码量
**Cons:** 需确认无隐藏引用
**Effort:** Small
**Risk:** Low（删除前先 grep 确认）

### Option B: 添加 `@deprecated` 注释和保护逻辑

在 `getDatabase` 上添加 `@deprecated`，并在内部抛出错误防止意外使用：

```ts
/** @deprecated Use getRepository() instead. DO NOT call this function. */
export async function getDatabase(): Promise<SQLiteDatabase> {
  throw new Error('getDatabase() is deprecated. Use getRepository() instead.');
}
```

**Pros:** 不删文件，更保守
**Cons:** 文件依然存在，仍有混淆成本，不如删除彻底
**Effort:** Trivial
**Risk:** Very Low

## Recommended Action

Option A：先 grep 确认无活跃引用，再删除 `database.ts` 和 `seedData.ts`。

## Technical Details

- **Affected files:** `src/db/database.ts`, `src/db/seedData.ts`（若存在）
- **Dependent files to check:** 搜索全项目 `getDatabase`

## Acceptance Criteria

- [ ] `src/db/database.ts` 删除（或已加 `@deprecated` + 抛出错误保护）
- [ ] 全项目 `grep getDatabase` 无活跃引用
- [ ] 现有测试全部通过

## Work Log

- 2026-03-27: 由 architecture-strategist + security-sentinel review agents 发现
