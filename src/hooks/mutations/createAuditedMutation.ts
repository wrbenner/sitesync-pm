// Audited mutation factory.
// Every mutation MUST use this to get:
// 1. Permission check before execution
// 2. Audit trail entry
// 3. Optimistic update with rollback on error
// 4. Cache invalidation on success
// 5. Toast feedback on error
// 6. Sentry error capture
// 7. Analytics tracking

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissions, PermissionError, type Permission } from '../usePermissions'
import { useProjectId } from '../useProjectId'
import { useAuth } from '../useAuth'
import { toast } from 'sonner'
import posthog from '../../lib/analytics'
import Sentry from '../../lib/sentry'

// ── Types ────────────────────────────────────────────────

interface AuditedMutationConfig<TParams, TResult> {
  // Required permission to execute this mutation
  permission: Permission

  // The actual database operation
  mutationFn: (params: TParams) => Promise<TResult>

  // Query keys to invalidate on success
  invalidateKeys: (params: TParams, result: TResult) => (string | unknown)[][]

  // Audit trail metadata
  entityType: string
  action: string
  getEntityId?: (params: TParams, result?: TResult) => string | undefined
  getEntityTitle?: (params: TParams) => string | undefined
  getOldValue?: (params: TParams) => Record<string, unknown> | undefined
  getNewValue?: (params: TParams, result?: TResult) => Record<string, unknown> | undefined

  // Optimistic update (optional)
  optimistic?: {
    queryKey: (params: TParams) => unknown[]
    updater: (old: unknown, params: TParams) => unknown
  }

  // Analytics event
  analyticsEvent?: string
  getAnalyticsProps?: (params: TParams) => Record<string, unknown>

  // Custom error message
  errorMessage?: string

  // Additional onSuccess callback
  onSuccess?: (result: TResult, params: TParams) => void
}

// ── Hook ─────────────────────────────────────────────────

export function useAuditedMutation<TParams, TResult>(config: AuditedMutationConfig<TParams, TResult>) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const projectId = useProjectId()
  const { user } = useAuth()

  return useMutation({
    // ── onMutate: Optimistic update ──────────────────
    onMutate: config.optimistic
      ? async (params: TParams) => {
          const key = config.optimistic!.queryKey(params)
          // Cancel in-flight queries that might overwrite our optimistic update
          await queryClient.cancelQueries({ queryKey: key })
          // Snapshot for rollback
          const previousData = queryClient.getQueryData(key)
          // Apply optimistic update
          queryClient.setQueryData(key, (old: unknown) =>
            config.optimistic!.updater(old, params)
          )
          return { previousData, queryKey: key }
        }
      : undefined,

    // ── mutationFn: Permission check + execute + audit ──
    mutationFn: async (params: TParams) => {
      // Step 1: Check permission BEFORE executing
      if (!hasPermission(config.permission)) {
        throw new PermissionError(
          `You do not have permission to ${config.action.replace(/_/g, ' ')}`,
          config.permission
        )
      }

      // Step 2: Execute the actual mutation
      const result = await config.mutationFn(params)

      // Step 3: Write audit trail (fire and forget)
      if (projectId) {
        supabase.from('audit_trail' as any).insert({
          project_id: projectId,
          actor_id: user?.id || null,
          action: config.action,
          entity_type: config.entityType,
          entity_id: config.getEntityId?.(params, result) || null,
          entity_title: config.getEntityTitle?.(params) || null,
          old_value: config.getOldValue?.(params) || null,
          new_value: config.getNewValue?.(params, result) || null,
          user_agent: navigator.userAgent,
        } as any).then(() => {})
      }

      return result
    },

    // ── onSuccess: Invalidate caches + analytics ─────
    onSuccess: (result, params) => {
      const keys = config.invalidateKeys(params, result)
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key })
      }

      if (config.analyticsEvent) {
        posthog.capture(config.analyticsEvent, {
          project_id: projectId,
          ...config.getAnalyticsProps?.(params),
        })
      }

      config.onSuccess?.(result, params)
    },

    // ── onError: Rollback + toast + Sentry ───────────
    onError: (error, params, context) => {
      // Rollback optimistic update
      if (context && typeof context === 'object' && 'previousData' in context) {
        const ctx = context as { previousData: unknown; queryKey: unknown[] }
        queryClient.setQueryData(ctx.queryKey, ctx.previousData)
      }

      // User-facing feedback
      if (error instanceof PermissionError) {
        toast.error(error.message)
      } else {
        toast.error(config.errorMessage ?? `Failed to ${config.action.replace(/_/g, ' ')}`)
      }

      // Report to Sentry (skip permission errors, those are expected)
      if (!(error instanceof PermissionError)) {
        Sentry.captureException(error, {
          extra: {
            mutation: config.action,
            entityType: config.entityType,
            projectId,
          },
        })
      }
    },
  })
}

// ── Utility: Standard onError for non-audited mutations ──

export function createOnError(mutationName: string) {
  return (error: Error) => {
    toast.error(`Operation failed: ${mutationName.replace(/_/g, ' ')}`)
    Sentry.captureException(error, { extra: { mutation: mutationName } })
  }
}
