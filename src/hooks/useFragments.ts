import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from './useDatabase';

export const fragmentKeys = {
  all: ['fragments'] as const,
  list: () => ['fragments', 'list'] as const,
  currentWeek: () => ['fragments', 'currentWeek'] as const,
  count: () => ['fragments', 'count'] as const,
};

export function useRecentFragments() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.list(),
    queryFn: () => repo!.getRecentFragments(100),
    enabled: !!repo,
  });
}

export function useCurrentWeekFragments() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.currentWeek(),
    queryFn: () => repo!.getCurrentWeekFragments(),
    enabled: !!repo,
  });
}

export function useFragmentCount() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.count(),
    queryFn: () => repo!.getFragmentCount(),
    enabled: !!repo,
  });
}

export type CreateFragmentInput = {
  content: string;
  photoUri?: string;
  photoDescription?: string;
};

export function useCreateFragment() {
  const { repo } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, photoUri, photoDescription }: CreateFragmentInput) =>
      repo!.insertFragment(content, photoUri, photoDescription),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fragmentKeys.all });
    },
  });
}

export function useDeleteFragment() {
  const { repo } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo!.deleteFragment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fragmentKeys.all });
    },
  });
}
