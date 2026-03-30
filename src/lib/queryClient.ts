import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Sentry from './sentry'
import { ApiError, AuthError, NotFoundError, PermissionError } from '../api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,       // 1 minute default
      gcTime: 1000 * 60 * 10,     // 10 minute garbage collection
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry 404s or auth errors
        if (error instanceof NotFoundError) return false
        if (error instanceof AuthError) return false
        if (error instanceof PermissionError) return false
        if (error instanceof ApiError && error.status === 404) return false
        if (error instanceof ApiError && error.status === 403) return false
        if (error instanceof ApiError && error.status === 401) return false
        return failureCount < 3
      },
    },
    mutations: {
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
