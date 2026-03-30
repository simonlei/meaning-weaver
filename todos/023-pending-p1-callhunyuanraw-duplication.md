---
status: pending
priority: p1
issue_id: "023"
tags: [code-review, architecture, ai-client, duplication, typescript]
dependencies: []
---

# `callHunyuanRaw` duplicates `HUNYUAN_URL`, `getApiUrl()`, and fetch logic from `client.ts`

## Problem Statement

`src/services/ai/photoDescriber.ts` contains a full private copy of the core Hunyuan API client logic — including `HUNYUAN_URL` constant, `getApiUrl()` function, and the entire fetch-error-check-parse chain — which already exists in `client.ts`. The only difference is the return type: plain `string` instead of parsed `ReportContent`.

This creates three distinct maintenance hazards:
1. **Security drift**: Auth header changes, TLS config, proxy URL scheme changes applied to `client.ts` won't apply to `photoDescriber.ts`.
2. **No response validation**: `callHunyuan` validates its response via Zod. `callHunyuanRaw` accepts any non-empty string directly, storing unvalidated AI output into SQLite and subsequently into report prompts.
3. **No test coverage**: `client.ts` has a thorough test suite. `callHunyuanRaw` has zero tests.

## Findings

- **TypeScript reviewer**: "The `getApiUrl()` function is also duplicated… Two sources of truth for the API base URL is an active maintenance hazard."
- **Security reviewer**: "If a future change is needed — TLS configuration, certificate pinning, header sanitization, a proxy URL scheme change — the developer must remember to apply it in two places. This is the canonical 'diverging copies' security anti-pattern."
- **Architecture reviewer**: "The duplication is worse than described. `photoDescriber.ts` duplicates `HUNYUAN_URL` (line 59) and `getApiUrl()` (lines 61–66) verbatim from `client.ts`. These are three separate things that now live in two places."

## Proposed Solutions

### Option A — Export `callHunyuanText` from `client.ts` (Recommended)
```typescript
// client.ts — add alongside existing callHunyuan
export async function callHunyuanText(
  apiKey: string | null,
  systemPrompt: string,
  userContent: string | ContentPart[],
  model: string = VISION_MODEL,
  maxTokens: number = 512
): Promise<Result<string, AIError>> {
  // same fetch logic as callHunyuan, but returns raw text
  // extract the shared fetch primitive that both call
}

// photoDescriber.ts — replace callHunyuanRaw with:
import { callHunyuanText } from './client';
const result = await callHunyuanText(apiKey, PHOTO_DESCRIPTION_SYSTEM_PROMPT, userContent);
```
**Pros:** Single source of truth; existing tests cover shared path; security fixes applied once.
**Cons:** Small refactor to `client.ts` required; need to add tests for the new export.
**Effort:** Medium | **Risk:** Low

### Option B — Extract shared `hunyuanFetch` primitive
```typescript
// client.ts — internal shared fetch layer
async function hunyuanFetch(apiKey, messages, model, maxTokens): Promise<string>

// callHunyuan: calls hunyuanFetch → parses with Zod
// callHunyuanText (new): calls hunyuanFetch → returns raw string
```
**Pros:** Cleanest layering; most testable.
**Cons:** More structural change.
**Effort:** Medium | **Risk:** Low

## Recommended Action

Option A — export `callHunyuanText` from `client.ts`, delete `callHunyuanRaw` and the duplicated `HUNYUAN_URL`/`getApiUrl` from `photoDescriber.ts`. Add tests for `callHunyuanText` in the existing `client.test.ts`.

## Technical Details

- **Files:** `src/services/ai/photoDescriber.ts` (lines 59–119), `src/services/ai/client.ts`
- **Duplicated code:** `HUNYUAN_URL` constant, `getApiUrl()` function, full fetch + error handling (~55 lines)
- **Missing coverage:** `callHunyuanRaw` error paths for 429, 401/403, non-ok, empty response

## Acceptance Criteria

- [ ] `photoDescriber.ts` no longer contains its own `HUNYUAN_URL`, `getApiUrl`, or fetch logic
- [ ] `callHunyuanText` (or equivalent) exported from `client.ts` and used by `describePhoto`
- [ ] Tests for `callHunyuanText` covering: no key, 429, 401, 500, empty response, valid response
- [ ] All existing `reportGenerator.test.ts` and `client.test.ts` tests still pass

## Work Log

- 2026-03-30: Finding raised independently by TypeScript, Security, and Architecture reviewers. Unanimous P1. Todo created during code review of `feat/photo-description-pipeline`.
