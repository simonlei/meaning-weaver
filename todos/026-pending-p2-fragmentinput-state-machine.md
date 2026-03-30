---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, typescript, react-native, state-management, ui]
dependencies: []
---

# `FragmentInput.tsx` photo description uses 6 `useState` calls — impossible states are representable

## Problem Statement

The photo description feature adds 6 tightly coupled state variables to `FragmentInput.tsx`:

```typescript
const [photoDescription, setPhotoDescription] = useState<string | null>(null);
const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
const [isEditingDescription, setIsEditingDescription] = useState(false);
const [editDescriptionText, setEditDescriptionText] = useState('');
const [isRegeneratingWithPrompt, setIsRegeneratingWithPrompt] = useState(false);
const [additionalPromptText, setAdditionalPromptText] = useState('');
```

These encode a 4-state machine (idle, generating, editing, regenerating) but allow impossible state combinations — e.g., `isGeneratingDescription: true` AND `isEditingDescription: true` simultaneously — which would render broken or contradictory UI. The current code handles transitions manually across multiple handlers, making it hard to verify correctness.

Additionally, `editDescriptionText` is initialized as `''` but populated in `handleStartEdit` when the user taps Edit. If state synchronisation has any race, the user edits a blank string and overwrites the real description.

## Findings

- **TypeScript reviewer**: "These encode a state machine with at least 4 meaningful states but no enforced transitions. Impossible states are representable."
- **Performance reviewer**: "Six `useState` calls is not a render performance problem by itself, but 6 tightly related variables that always change together are a code-smell that hints at a reducer."

## Proposed Solutions

### Option A — `useReducer` with discriminated union (Recommended)
```typescript
type DescriptionState =
  | { status: 'idle'; description: string | null }
  | { status: 'generating' }
  | { status: 'editing'; description: string; draft: string }
  | { status: 'regenerating'; description: string; additionalPrompt: string };

type DescriptionAction =
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; description: string }
  | { type: 'GENERATE_FAILURE'; reason: string }
  | { type: 'EDIT_START' }
  | { type: 'EDIT_COMMIT' }
  | { type: 'EDIT_CANCEL' }
  | { type: 'REGEN_TOGGLE' }
  | { type: 'REGEN_PROMPT_CHANGE'; prompt: string }
  | { type: 'REGEN_SUCCESS'; description: string }
  | { type: 'RESET' };

const [descState, dispatch] = useReducer(descriptionReducer, { status: 'idle', description: null });
```
**Pros:** Impossible states unrepresentable; single re-render per transition; testable reducer.
**Cons:** More boilerplate upfront.
**Effort:** Medium | **Risk:** Low

### Option B — Extract `usePhotoDescription(photoUri, apiKey)` custom hook
Keep the `useState` calls but extract them into a custom hook, cleaning up `FragmentInput`'s render function.
**Pros:** Less refactoring, still improves readability.
**Cons:** Doesn't fix the impossible state problem.
**Effort:** Small | **Risk:** Low

## Recommended Action

Option A — `useReducer` extracted as a custom hook `usePhotoDescription`. This makes `FragmentInput` focused on layout, and makes the description state machine testable in isolation.

## Technical Details

- **Affected file:** `src/components/FragmentInput.tsx`
- **New file:** `src/hooks/usePhotoDescription.ts` (if extracted)

## Acceptance Criteria

- [ ] Photo description state represented as discriminated union or equivalent
- [ ] No state combination can represent `generating` + `editing` simultaneously
- [ ] `editDescriptionText` draft initialized from current description at Edit-start time (not at mount)
- [ ] All existing photo description UI flows (generate, edit, regenerate, reset on remove) work correctly

## Work Log

- 2026-03-30: Finding raised by TypeScript reviewer (🟠 Medium) and Performance reviewer. Todo created during code review of `feat/photo-description-pipeline`.
