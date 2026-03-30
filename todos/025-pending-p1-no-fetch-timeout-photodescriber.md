---
status: pending
priority: p1
issue_id: "025"
tags: [code-review, performance, network, reliability, react-native]
dependencies: [023]
---

# No timeout/AbortController on `callHunyuanRaw` fetch — hangs indefinitely on stalled network

## Problem Statement

`callHunyuanRaw` in `photoDescriber.ts` makes a `fetch()` call with no `AbortController` and no timeout signal:

```typescript
const response = await fetch(getApiUrl(), {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ model: VISION_MODEL, max_tokens: 512, ... }),
  // ← no signal, no timeout
});
```

If the network stalls mid-upload (common on mobile on LTE handoffs, tunnels, or low-signal areas), `fetch` will hang indefinitely. On iOS this is eventually killed by the OS (~60s), but on Android it can hang much longer — blocking the UI's `isGeneratingDescription` spinner and preventing the user from saving their fragment.

Note: this issue will be resolved as part of fixing #023 (extracting `callHunyuanText` from `client.ts`). **Check whether `client.ts`'s existing `callHunyuan` already has timeout handling** — if so, the fix comes for free. If not, add it to both.

## Findings

- **Performance reviewer**: "A vision model call typically takes 3–8 seconds on current APIs. If the Save button is gated on `isGeneratingDescription === false`, that's a significant dead-wait on a slow connection."
- **Performance reviewer**: "If the network stalls mid-upload, `fetch` will hang indefinitely. On iOS this is capped by the OS at ~60s; on Android it can hang much longer."

## Proposed Solutions

### Option A — AbortController with 30s timeout
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);

try {
  const response = await fetch(getApiUrl(), {
    signal: controller.signal,
    body: JSON.stringify({ ... }),
  });
} catch (err) {
  if (err.name === 'AbortError') {
    return Err({ kind: 'network', message: '请求超时，请检查网络连接' });
  }
  throw err;
} finally {
  clearTimeout(timeoutId);
}
```
**Effort:** Small | **Risk:** Low

### Option B — Fire-and-forget description (decouple from save)
Let the description generate in the background without blocking the Save button. The fragment saves with `photo_description: null` if the user taps Send before the description is ready. This removes the UX blocking entirely.
**Effort:** Medium | **Risk:** Medium (state management complexity)
**Pros:** Best UX for offline/slow networks.

## Recommended Action

Option A as a safety net (prevents indefinite hangs), plus consider Option B as a UX improvement tracked separately.

## Technical Details

- **Affected file:** `src/services/ai/photoDescriber.ts` — `callHunyuanRaw`
- **Also check:** `src/services/ai/client.ts` — `callHunyuan` for existing timeout handling
- **Note:** This issue is resolved automatically if #023 is fixed and `client.ts` already has timeout handling

## Acceptance Criteria

- [ ] All Hunyuan API fetch calls have an AbortController with ≤30s timeout
- [ ] AbortError is caught and returned as `Err({ kind: 'network', message: '...' })`
- [ ] User sees error state (not infinite spinner) if description generation times out

## Work Log

- 2026-03-30: Finding raised by Performance reviewer (High). Todo created during code review of `feat/photo-description-pipeline`.
