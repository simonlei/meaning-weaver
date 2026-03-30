---
status: pending
priority: p1
issue_id: "024"
tags: [code-review, architecture, dead-code, database, migrations]
dependencies: []
---

# Orphaned `database.ts` with v1-only migrations will corrupt DB if imported

## Problem Statement

`src/db/database.ts` exports a `getDatabase()` function with its own migration array that only contains **v1** (initial schema). The live code path uses `repository.ts`'s `runMigrations()` (v1–v5), but `database.ts` is never imported by any component or screen — it is silently dead.

The danger is not what it does now, but what a future developer will do:
- They find `database.ts`, assume it's the authoritative DB initialization, import it
- They get a database at version 1, missing settings, photo_uri, audio_uri, and photo_description columns
- App crashes at runtime on any feature added since v1

Additionally, `database.ts` uses a different migration style (batch array) vs `repository.ts`'s guard-per-version approach, creating two divergent migration philosophies with no indication which is correct.

## Findings

- **Architecture reviewer**: "Any developer who finds it and imports it to 'get the database' will get a database at version 1, missing the settings, photo_uri, audio_uri, and photo_description columns."
- The `seedData.ts` file imports from `database.ts` — meaning the richer seed experience (sample fragments + pre-generated report) also never runs for new users.

## Proposed Solutions

### Option A — Delete `database.ts` (Recommended)
The file is never imported. `repository.ts` is the live path. Remove `database.ts` and its sole consumer `seedData.ts` (or migrate the richer seeding logic into `repository.ts`'s `seedIfEmpty()`).
**Pros:** Eliminates the booby trap. Clean codebase.
**Cons:** Lose the richer seed data with a sample report (unless migrated first).
**Effort:** Small | **Risk:** Low

### Option B — Delete and migrate seed data
Before deleting, move the sample report seeding from `seedData.ts` into `repository.ts`'s `seedIfEmpty()` function. New users will see a sample weekly report on first launch (better onboarding).
**Pros:** Removes dead code AND improves first-run experience.
**Cons:** Slightly more work.
**Effort:** Small-Medium | **Risk:** Low

## Recommended Action

Option B — migrate the rich seed data (including sample report) into the live seed path, then delete `database.ts` and `seedData.ts`.

## Technical Details

- **Files to delete:** `src/db/database.ts`, `src/db/seedData.ts` (after migrating content)
- **File to update:** `src/db/repository.ts` — `seedIfEmpty()` function
- Also remove `src/db/queries/` directory (fragments.ts, reports.ts) — found by architecture reviewer to be entirely unused prototype code with stale schema

## Acceptance Criteria

- [ ] `src/db/database.ts` deleted
- [ ] `src/db/seedData.ts` deleted (or its seed content migrated)
- [ ] `src/db/queries/` directory deleted
- [ ] No remaining imports of `database.ts` anywhere
- [ ] New users get a meaningful first-run experience with seed data

## Work Log

- 2026-03-30: Finding raised by Architecture reviewer (P1 High). Todo created during code review of `feat/photo-description-pipeline`.
