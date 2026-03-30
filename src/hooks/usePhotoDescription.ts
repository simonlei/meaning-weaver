import { useReducer } from 'react';

// ---------------------------------------------------------------------------
// State shape — discriminated union prevents impossible combinations
// ---------------------------------------------------------------------------

export type DescriptionState =
  | { status: 'idle'; description: string | null }
  | { status: 'generating' }
  | { status: 'editing'; description: string; draft: string }
  | { status: 'regenerating'; description: string; additionalPrompt: string };

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------

export type DescriptionAction =
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; description: string }
  | { type: 'GENERATE_FAILURE' }
  | { type: 'EDIT_START'; currentDescription: string }
  | { type: 'EDIT_COMMIT' }
  | { type: 'EDIT_CANCEL' }
  | { type: 'DRAFT_CHANGE'; draft: string }
  | { type: 'REGEN_TOGGLE' }
  | { type: 'REGEN_PROMPT_CHANGE'; prompt: string }
  | { type: 'REGEN_SUCCESS'; description: string }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState: DescriptionState = { status: 'idle', description: null };

function reducer(state: DescriptionState, action: DescriptionAction): DescriptionState {
  switch (action.type) {
    case 'GENERATE_START':
      return { status: 'generating' };

    case 'GENERATE_SUCCESS':
      return { status: 'idle', description: action.description };

    case 'GENERATE_FAILURE':
      // Stay idle with whatever description existed before (null for first-time generate)
      return { status: 'idle', description: null };

    case 'EDIT_START': {
      return {
        status: 'editing',
        description: action.currentDescription,
        draft: action.currentDescription,
      };
    }

    case 'DRAFT_CHANGE': {
      if (state.status !== 'editing') return state;
      return { ...state, draft: action.draft };
    }

    case 'EDIT_COMMIT': {
      if (state.status !== 'editing') return state;
      const committed = state.draft.trim() || null;
      return { status: 'idle', description: committed };
    }

    case 'EDIT_CANCEL': {
      if (state.status !== 'editing') return state;
      return { status: 'idle', description: state.description };
    }

    case 'REGEN_TOGGLE': {
      if (state.status === 'idle' && state.description !== null) {
        return { status: 'regenerating', description: state.description, additionalPrompt: '' };
      }
      if (state.status === 'regenerating') {
        return { status: 'idle', description: state.description };
      }
      return state;
    }

    case 'REGEN_PROMPT_CHANGE': {
      if (state.status !== 'regenerating') return state;
      return { ...state, additionalPrompt: action.prompt };
    }

    case 'REGEN_SUCCESS': {
      return { status: 'idle', description: action.description };
    }

    case 'RESET':
      return { status: 'idle', description: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UsePhotoDescriptionReturn {
  descState: DescriptionState;
  dispatch: React.Dispatch<DescriptionAction>;
  // Derived booleans / values for convenient use in the component
  isGenerating: boolean;
  isEditing: boolean;
  isRegenerating: boolean;
  description: string | null;
  draft: string;
  additionalPrompt: string;
}

export function usePhotoDescription(): UsePhotoDescriptionReturn {
  const [descState, dispatch] = useReducer(reducer, initialState);

  const isGenerating = descState.status === 'generating';
  const isEditing = descState.status === 'editing';
  const isRegenerating = descState.status === 'regenerating';

  const description =
    descState.status === 'idle'
      ? descState.description
      : descState.status === 'editing'
        ? descState.description
        : descState.status === 'regenerating'
          ? descState.description
          : null;

  const draft = descState.status === 'editing' ? descState.draft : '';
  const additionalPrompt = descState.status === 'regenerating' ? descState.additionalPrompt : '';

  return {
    descState,
    dispatch,
    isGenerating,
    isEditing,
    isRegenerating,
    description,
    draft,
    additionalPrompt,
  };
}
