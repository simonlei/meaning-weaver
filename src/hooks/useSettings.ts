import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from './useDatabase';

export const settingsKeys = {
  all: ['settings'] as const,
  apiKey: () => ['settings', 'apiKey'] as const,
  asrCredentials: () => ['settings', 'asrCredentials'] as const,
};

export function useApiKey() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: settingsKeys.apiKey(),
    queryFn: () => repo!.getApiKey(),
    enabled: !!repo,
  });
}

export function useSaveApiKey() {
  const { repo } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => repo!.setApiKey(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.apiKey() }),
  });
}

export function useAsrCredentials() {
  const { repo } = useDatabase();
  return useQuery({
    queryKey: settingsKeys.asrCredentials(),
    queryFn: () => repo!.getAsrCredentials(),
    enabled: !!repo,
  });
}

export function useSaveAsrCredentials() {
  const { repo } = useDatabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ secretId, secretKey }: { secretId: string; secretKey: string }) =>
      repo!.setAsrCredentials(secretId, secretKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.asrCredentials() }),
  });
}
