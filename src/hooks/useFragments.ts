import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from './useDatabase';
import {
  insertFragment,
  getRecentFragments,
  getCurrentWeekFragments,
  deleteFragment,
  getFragmentCount,
} from '../db/queries/fragments';

export const fragmentKeys = {
  all: ['fragments'] as const,
  list: () => ['fragments', 'list'] as const,
  currentWeek: () => ['fragments', 'currentWeek'] as const,
  count: () => ['fragments', 'count'] as const,
};

export function useRecentFragments() {
  const { db } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.list(),
    queryFn: () => getRecentFragments(db!, 100),
    enabled: !!db,
  });
}

export function useCurrentWeekFragments() {
  const { db } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.currentWeek(),
    queryFn: () => getCurrentWeekFragments(db!),
    enabled: !!db,
  });
}

export function useFragmentCount() {
  const { db } = useDatabase();
  return useQuery({
    queryKey: fragmentKeys.count(),
    queryFn: () => getFragmentCount(db!),
    enabled: !!db,
  });
}

export function useCreateFragment() {
  const { db } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => insertFragment(db!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fragmentKeys.all });
    },
  });
}

export function useDeleteFragment() {
  const { db } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFragment(db!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fragmentKeys.all });
    },
  });
}
