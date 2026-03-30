---
status: complete
priority: p0
issue_id: "022"
tags: [code-review, database, migrations, sqlite, data-integrity]
dependencies: []
---

# Migration steps not atomic — app permanently crash-loops if killed mid-migration

## Problem Statement

Every migration in `repository.ts` (v2–v5) is two separate `execAsync` calls with no transaction:

```typescript
// Migration v5 (lines 375–378 in repository.ts)
await db.execAsync('ALTER TABLE fragments ADD COLUMN photo_description TEXT');
await db.execAsync('PRAGMA user_version = 5');
```

If the app is killed (OOM kill, force-quit, power-off) between these two lines, the next launch:
1. Reads `PRAGMA user_version = 4`
2. Enters the `currentVersion < 5` guard
3. Runs `ALTER TABLE fragments ADD COLUMN photo_description TEXT` again
4. SQLite throws: **"table fragments already has column named photo_description"**
5. The migration throws, the database fails to open, and the app crash-loops on every subsequent launch

This is a data-loss / permanent breakage bug. It affects v2, v3, v4, and v5.

## Findings

- **TypeScript reviewer**: "If the ALTER TABLE succeeds but the process is killed before PRAGMA user_version = 5, the next launch will attempt ALTER TABLE again and crash (SQLite error: duplicate column name)."
- **Architecture reviewer**: "This is a latent data-loss bug… The result is a permanently broken migration — the app will crash on every subsequent launch."
- All 4 multi-step migrations (v2, v3, v4, v5) in `repository.ts` share this pattern.

## Proposed Solutions

### Option A — Wrap in transaction (Recommended)
```typescript
await db.withTransactionAsync(async () => {
  await db.execAsync('ALTER TABLE fragments ADD COLUMN photo_description TEXT');
  await db.execAsync('PRAGMA user_version = 5');
});
```
SQLite allows `PRAGMA user_version` inside transactions. This makes the schema change and version update atomic.

**Pros:** Simple, self-contained, fixes all four migrations in one pattern.
**Cons:** Need to verify `expo-sqlite`'s `withTransactionAsync` works correctly across all supported platforms.
**Effort:** Small | **Risk:** Low

### Option B — Column-existence guard before ALTER
```typescript
if (currentVersion < 5) {
  const col = await db.getFirstAsync(
    "SELECT * FROM pragma_table_info('fragments') WHERE name = 'photo_description'"
  );
  if (!col) {
    await db.execAsync('ALTER TABLE fragments ADD COLUMN photo_description TEXT');
  }
  await db.execAsync('PRAGMA user_version = 5');
}
```
**Pros:** Does not require transaction support; idempotent by design.
**Cons:** More verbose; must be applied to each migration individually; still not atomic between the guard check and the version update.
**Effort:** Small | **Risk:** Low

### Option C — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
SQLite 3.37+ supports this syntax. However, expo-sqlite bundles its own SQLite version which may predate 3.37.
**Pros:** Cleanest SQL.
**Cons:** Version dependency unknown; risky to assume.
**Effort:** Small | **Risk:** Medium (version uncertainty)

## Recommended Action

Option A (transaction wrap) applied to all four multi-step migrations (v2, v3, v4, v5).

## Technical Details

- **Affected file:** `src/db/repository.ts` — `runMigrations()` function
- **All affected migrations:** v2 (~line 355), v3 (~line 360), v4 (~line 366), v5 (~line 374)
- **Linked PR branch:** `feat/photo-description-pipeline`

## Acceptance Criteria

- [ ] All migration steps (v2–v5) are wrapped in transactions or have column-existence guards
- [ ] Running `runMigrations` twice on the same DB does not throw
- [ ] Existing tests in `repository.photo.test.ts` and `repository.settings.test.ts` still pass
- [ ] New test: simulate interrupted migration (column present, version stale) — verify recovery

## Work Log

- 2026-03-30: Finding raised by Architecture reviewer (P0) and TypeScript reviewer (🔴 High). Todo created during code review of `feat/photo-description-pipeline`.
