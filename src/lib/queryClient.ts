import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Sentry from './sentry'
import { ApiError, AuthError, NotFoundError, PermissionError } from '../api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30 seconds — prevents unnecessary refetches on component mounts
      gcTime: 5 * 60 * 1000,      // 5 minutes garbage collection
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry 4xx errors
        if (error instanceof NotFoundError) return false
        if (error instanceof AuthError) return false
        if (error instanceof PermissionError) return false
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    mutations: {
      retry: false,
      onError: (error) => {
        // Global mutation error handler: show toast and report to Sentry
        if (error instanceof ApiError) {
          toast.error(error.userMessage)
          if (error.status >= 500) {
            Sentry.captureException(error, { extra: { code: error.code, details: error.details } })
          }
        } else if (error instanceof Error) {
          toast.error('Something went wrong. Please try again.')
          Sentry.captureException(error)
        }
      },
    },
  },
})

export function optimisticUpdate<T>(
  queryKey: readonly unknown[],
  updater: (old: T[] | undefined) => T[],
) {
  queryClient.setQueryData<T[]>(queryKey, (old) => updater(old))
}
