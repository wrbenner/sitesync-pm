import { useQuery as useTanstackQuery } from '@tanstack/react-query';

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean }
) {
  const result = useTanstackQuery({
    queryKey: [key],
    queryFn: fetcher,
    enabled: options?.enabled ?? true,
  });

  return {
    data: result.data ?? null,
    loading: result.isPending && result.fetchStatus !== 'idle',
    error: result.error?.message ?? null,
    refetch: result.refetch,
  };
}
