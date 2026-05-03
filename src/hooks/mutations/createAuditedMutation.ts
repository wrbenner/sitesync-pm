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
import { type ZodType, ZodError } from 'zod'
import { usePermissions, PermissionError, type Permission } from '../usePermissions'
import { useProjectId } from '../useProjectId'
import { toast } from 'sonner'
import posthog from '../../lib/analytics'
import Sentry from '../../lib/sentry'
import { invalidateEntity, type EntityType } from '../../api/invalidation'
import { logAuditEntry } from '../../lib/auditLogger'
import { syncManager } from '../../lib/syncManager'

// ── Types ────────────────────────────────────────────────

export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>
  constructor(fieldErrors: Record<string, string[]>) {
    const summary = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${msgs[0]}`)
      .join(', ')
    super(`Validation failed: ${summary}`)
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

interface AuditedMutationConfig<TParams, TResult> {
  // Required permission to execute this mutation
  permission: Permission

  // Optional Zod schema to validate params.data (or the entire params object)
  schema?: ZodType
  // Which key in params contains the data to validate (default: 'data')
  schemaKey?: string

  // The actual database operation
  mutationFn: (params: TParams) => Promise<TResult>

  // Query keys to invalidate on success IN ADDITION to the entity's INVALIDATION_MAP entries.
  // Omit this to rely solely on the map (preferred). Include it for detail-page or non-standard keys.
  invalidateKeys?: (params: TParams, result: TResult) => (string | unknown)[][]

  // Audit trail metadata. When entityType matches a known EntityType, the INVALIDATION_MAP
  // is applied automatically so cross-entity dependencies (metrics, activity feed) are always fresh.
  entityType: EntityType | string
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject' | 'submit' | 'close'
  getEntityId?: (params: TParams, result?: TResult) => string | undefined
  getEntityTitle?: (params: TParams) => string | undefined
  // Snapshot of the record BEFORE the mutation (omit for creates)
  getBeforeState?: (params: TParams) => Record<string, unknown> | undefined
  // Snapshot of the record AFTER the mutation (omit for deletes)
  getAfterState?: (params: TParams, result?: TResult) => Record<string, unknown> | undefined
  // Additional metadata to attach to the audit entry
  getAuditMetadata?: (params: TParams) => Record<string, unknown> | undefined

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

  // Offline queue configuration. When the device is offline AND this is set,
  // the mutation is routed through the Dexie-backed offline queue instead of
  // hitting Supabase. `getData` must return the exact row shape the queue
  // will replay on reconnect (see src/lib/offlineDb.ts::processSyncQueue).
  // `getStubResult` produces the synchronous return value callers still
  // expect — optimistic updates will already have been applied via `onMutate`.
  offlineQueue?: {
    table: string
    operation: 'insert' | 'update' | 'delete'
    getData: (params: TParams) => Record<string, unknown>
    getStubResult: (params: TParams) => TResult
    offlineMessage?: string
  }
}

// ── Hook ─────────────────────────────────────────────────

export function useAuditedMutation<TParams, TResult>(config: AuditedMutationConfig<TParams, TResult>) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const projectId = useProjectId()

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

      // Step 2: Validate input with Zod schema (if provided)
      if (config.schema) {
        const key = config.schemaKey || 'data'
        const dataToValidate = (params as Record<string, unknown>)[key] ?? params
        try {
          config.schema.parse(dataToValidate)
        } catch (err) {
          if (err instanceof ZodError) {
            const fieldErrors: Record<string, string[]> = {}
            for (const issue of err.issues) {
              const field = issue.path.join('.') || '_root'
              if (!fieldErrors[field]) fieldErrors[field] = []
              fieldErrors[field].push(issue.message)
            }
            throw new ValidationError(fieldErrors)
          }
          throw err
        }
      }

      // Step 3a: If offline and this mutation declares offline-queue support,
      // short-circuit: push the row onto the sync queue, surface a toast, and
      // return a stub result. The optimistic update applied in onMutate keeps
      // the UI consistent; the sync engine replays on reconnect with retry +
      // exponential backoff (see processSyncQueue in offlineDb.ts).
      if (config.offlineQueue && typeof navigator !== 'undefined' && !navigator.onLine) {
        const { table, operation, getData, getStubResult, offlineMessage } = config.offlineQueue
        try {
          await syncManager.queueOfflineMutation(table, operation, getData(params))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not save for offline sync'
          toast.error(msg)
          throw err
        }
        toast.info(offlineMessage ?? 'Saved locally — will sync when online')
        return getStubResult(params)
      }

      // Step 3: Execute the actual mutation
      const result = await config.mutationFn(params)

      // Step 4: Write audit trail (fire and forget, failures never block the user)
      const entityId = config.getEntityId?.(params, result)
      if (projectId && entityId) {
        logAuditEntry({
          projectId,
          entityType: config.entityType,
          entityId,
          action: config.action,
          beforeState: config.getBeforeState?.(params),
          afterState: config.getAfterState?.(params, result),
          metadata: config.getAuditMetadata?.(params),
        }).catch(() => {}) // already logged inside logAuditEntry
      }

      return result
    },

    // ── onSuccess: Invalidate caches + analytics ─────
    onSuccess: (result, params) => {
      // Always invalidate via the map first (handles cross-entity deps).
      if (projectId) {
        invalidateEntity(config.entityType as EntityType, projectId)
      }
      // Then any caller-specified extra keys (detail pages, non-standard keys).
      const keys = config.invalidateKeys?.(params, result) ?? []
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
      } else if (error instanceof ValidationError) {
        const firstError = Object.values(error.fieldErrors)[0]?.[0]
        toast.error(firstError || 'Invalid input')
      } else {
        toast.error(config.errorMessage ?? `Failed to ${config.action.replace(/_/g, ' ')}`)
      }

      // Report to Sentry (skip permission/validation errors, those are expected)
      if (!(error instanceof PermissionError) && !(error instanceof ValidationError)) {
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
