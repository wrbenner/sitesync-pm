import { useQuery as useTanstackQuery } from '@tanstack/react-query';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Drop-in wrapper around TanStack Query that preserves the existing API surface
 * used across all pages. Returns { data, loading, error, refetch }.
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean }
): QueryState<T> {
  const { data, isLoading, error, refetch } = useTanstackQuery<T, Error>({
    queryKey: [key],
    queryFn: fetcher,
    enabled: options?.enabled ?? true,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
