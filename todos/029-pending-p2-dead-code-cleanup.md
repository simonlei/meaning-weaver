---
status: pending
priority: p2
issue_id: "029"
tags: [code-review, dead-code, cleanup, architecture]
dependencies: []
---

# Dead code from previous vision architecture — `VISION_SYSTEM_PROMPT`, `buildVisionUserContent`, `useUpdatePhotoDescription`

## Problem Statement

The refactor to the two-stage pipeline left several dead exports that are no longer called from anywhere:

1. **`VISION_SYSTEM_PROMPT`** and **`buildVisionUserContent`** in `src/services/ai/prompts.ts` — ~130 lines representing the old architecture where raw images were sent directly to the report generator. Not imported by any file. (Note: `photoDescriber.ts` uses `PHOTO_DESCRIPTION_SYSTEM_PROMPT` and `buildPhotoDescriptionContent` — different functions.)

2. **`useUpdatePhotoDescription`** hook in `src/hooks/useFragments.ts` — exports a mutation for updating an existing fragment's description, but is never imported by any component. The description is always stored via `insertFragment` at send time.

3. **`updateFragmentPhotoDescription`** in the `Repository` interface and both `WebRepository`/`SQLiteRepository` implementations — implements the above hook's functionality, but since the hook is unused, this too is dead code.

Keeping these creates misleading signals: a future developer might assume `buildVisionUserContent` is the canonical path for image-in-report flows, or that `useUpdatePhotoDescription` is wired up for post-save editing.

## Findings

- **Architecture reviewer**: "`VISION_SYSTEM_PROMPT` and `buildVisionUserContent` are not imported anywhere in the codebase. They total ~130 lines in `prompts.ts`."
- **TypeScript reviewer**: "Dead exported code is particularly problematic because tree-shakers won't remove it (it's exported), it adds maintenance burden, and it signals that the feature is incomplete."
- **Architecture reviewer**: "The repository method and interface member are forward-looking scaffolding with no live connection."

## Proposed Solutions

### Option A — Delete all dead code (Recommended)
Remove:
- `VISION_SYSTEM_PROMPT` from `prompts.ts`
- `buildVisionUserContent` from `prompts.ts`
- `useUpdatePhotoDescription` from `useFragments.ts`
- `updateFragmentPhotoDescription` from `Repository` interface
- `updateFragmentPhotoDescription` from `WebRepository`
- `updateFragmentPhotoDescription` from `SQLiteRepository`

Git history preserves everything if needed later.
**Pros:** Clean codebase. No false signals.
**Cons:** Need to verify nothing secretly imports these.
**Effort:** Small | **Risk:** Low

### Option B — Keep with TODO comments
If `useUpdatePhotoDescription` is planned for a future "edit existing fragment" feature, add:
```typescript
// TODO(#ISSUE): Wire this up when fragment editing UI is implemented
export function useUpdatePhotoDescription() { ... }
```
And file a proper task for the editing feature.
**Pros:** Preserves the scaffold for a real upcoming feature.
**Cons:** Still leaves dead code that confuses reviewers.
**Effort:** Very Small | **Risk:** Low

## Recommended Action

Delete all three dead exports. If the "edit existing fragment description" feature is genuinely planned, file a separate task and rebuild from scratch when needed.

## Technical Details

- **Files affected:**
  - `src/services/ai/prompts.ts` — remove `VISION_SYSTEM_PROMPT`, `buildVisionUserContent` (~130 lines)
  - `src/hooks/useFragments.ts` — remove `useUpdatePhotoDescription`
  - `src/db/repository.ts` — remove `updateFragmentPhotoDescription` from interface + both impls

## Acceptance Criteria

- [ ] `VISION_SYSTEM_PROMPT` removed from `prompts.ts` (or TODO-commented with issue link)
- [ ] `buildVisionUserContent` removed from `prompts.ts`
- [ ] `useUpdatePhotoDescription` removed from `useFragments.ts`
- [ ] `updateFragmentPhotoDescription` removed from `Repository` interface and both implementations
- [ ] TypeScript still compiles with no unused-export warnings
- [ ] All tests pass

## Work Log

- 2026-03-30: Finding raised by Architecture reviewer (P2) and TypeScript reviewer (🟡 Low). Todo created during code review of `feat/photo-description-pipeline`.
