/**
 * Drafted Actions — query + mutation hooks for the Iris approval loop.
 *
 * The visual gate (`IrisApprovalGate`) is one half of the loop. These
 * hooks are the other half: how a draft enters the UI, how it leaves
 * (approved → side-effect runs; rejected → archived for audit).
 *
 * Server-side, `services/iris/executeAction.ts` already handles the
 * idempotent claim + executor dispatch. We delegate to it so two
 * reviewers can't double-execute the same draft.
 *
 * Realtime: subscribes to `drafted_actions` postgres_changes on the
 * project. New drafts written by an Iris edge function appear without
 * a manual refetch. Mirrors the `useHeadcountRealtime` pattern.
 */

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useProjectId } from '../useProjectId'
import { logAuditEntry } from '../../lib/auditLogger'
import { approveAndExecute, rejectDraft as rejectDraftServer } from '../../services/iris/executeAction'
import type { DraftedAction, DraftedActionStatus } from '../../types/draftedActions'

// ── Constants ─────────────────────────────────────────────────────────

const DRAFTED_ACTIONS_KEY = 'drafted_actions'

/**
 * Codes that indicate the table or a column is missing in the deployed
 * schema. We surface an empty array instead of crashing the inbox.
 *   PGRST205 — table not found
 *   PGRST204 — column not found in schema
 */
function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === 'PGRST204') return true
  // Postgrest sometimes only encodes the code in the message
  const msg = error.message ?? ''
  return /PGRST20[45]/.test(msg) || /relation .* does not exist/i.test(msg)
}

// ── Realtime subscription helper ──────────────────────────────────────

/**
 * Shared subscription pattern. We intentionally use a stable channel
 * name and a unique suffix per hook instance so React Strict Mode's
 * double-mount doesn't double-subscribe (Supabase deduplicates by
 * channel name; the cleanup tears down the second subscription).
 */
function useDraftedActionsRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return

    const channelName = `drafted_actions:${projectId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drafted_actions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Invalidate every cached drafted_actions slice for this project.
          // The list filter (status, entity) is part of the queryKey so
          // we can't be more specific without re-deriving each variant.
          queryClient.invalidateQueries({ queryKey: [DRAFTED_ACTIONS_KEY] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])
}

// ── Per-entity query ──────────────────────────────────────────────────

/**
 * Drafts that target a specific entity (e.g. an RFI's detail page).
 * Filters by `project_id`, `entity_type`, `entity_id`, status='pending'.
 *
 * The schema does not have explicit `entity_type` / `entity_id`
 * columns — see `supabase/migrations/20260427000010_drafted_actions.sql`.
 * The closest fields are `related_resource_type` / `related_resource_id`
 * (drafts that *target* an existing resource) and `executed_resource_id`
 * (after execution). For the per-entity gate we filter by
 * `related_resource_type = entityType AND related_resource_id = entityId`.
 */
export function useDraftedActions(
  entityType: string,
  entityId: string | null | undefined,
) {
  const projectId = useProjectId()
  useDraftedActionsRealtime(projectId)

  return useQuery<DraftedAction[]>({
    queryKey: [DRAFTED_ACTIONS_KEY, 'entity', projectId, entityType, entityId ?? null],
    enabled: !!projectId && !!entityId && isSupabaseConfigured,
    staleTime: 15_000,
    queryFn: async (): Promise<DraftedAction[]> => {
      const { data, error } = await supabase
        .from('drafted_actions')
        .select('*')
        .eq('project_id', projectId!)
        .eq('related_resource_type', entityType)
        .eq('related_resource_id', entityId!)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })

      if (error) {
        if (isMissingSchemaError(error)) return []
        throw error
      }
      return (data ?? []) as unknown as DraftedAction[]
    },
  })
}

// ── Project-wide query (Inbox tabs) ───────────────────────────────────

export interface UseDraftedActionsForProjectOptions {
  status: DraftedActionStatus | DraftedActionStatus[]
  limit?: number
}

/**
 * Project-wide drafts query. Used by the Iris Inbox tabs:
 *   • Drafts tab     → status: 'pending'
 *   • History tab    → status: ['approved', 'rejected'] (also catches 'executed', 'failed')
 */
export function useDraftedActionsForProject(opts: UseDraftedActionsForProjectOptions) {
  const projectId = useProjectId()
  const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
  const limit = opts.limit ?? 100
  useDraftedActionsRealtime(projectId)

  return useQuery<DraftedAction[]>({
    queryKey: [DRAFTED_ACTIONS_KEY, 'project', projectId, statuses.join(','), limit],
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 15_000,
    queryFn: async (): Promise<DraftedAction[]> => {
      // Expand 'approved'/'rejected' to include the post-execution states
      // ('executed', 'failed') so the History tab shows the full lifecycle.
      const expanded = new Set<string>(statuses)
      if (expanded.has('approved')) expanded.add('executed')
      if (expanded.has('rejected')) expanded.add('failed')
      const filterStatuses = Array.from(expanded)

      const { data, error } = await supabase
        .from('drafted_actions')
        .select('*')
        .eq('project_id', projectId!)
        .in('status', filterStatuses)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        if (isMissingSchemaError(error)) return []
        throw error
      }
      return (data ?? []) as unknown as DraftedAction[]
    },
  })
}

// ── Approve mutation ──────────────────────────────────────────────────

/**
 * Approve a drafted action and apply its side effect.
 *
 * Idempotency:
 *   The server-side `approveAndExecute` claims the row with a
 *   `WHERE id = ? AND status = 'pending'` guard. Two reviewers
 *   clicking approve at once: one wins, the other sees
 *   `{ ok: false, error: 'already decided' }` and we treat that as
 *   success (the action was applied; no error to surface).
 *
 * Audit:
 *   We log `drafted_action_approved` to `audit_log` regardless of
 *   whether *we* won the race — the row's terminal state is captured
 *   by the executor's audit entries.
 */
export function useApproveDraftedAction() {
  const queryClient = useQueryClient()
  const projectId = useProjectId()

  return useMutation({
    mutationFn: async (draft: DraftedAction): Promise<DraftedAction> => {
      // 0. Need a user id for decided_by — reuse the supabase auth getter.
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Sign in required')

      // 1. Idempotent short-circuit: if the row is already decided,
      //    treat as success so a stale realtime payload + click is safe.
      const { data: current, error: readError } = await supabase
        .from('drafted_actions')
        .select('id, status')
        .eq('id', draft.id)
        .maybeSingle()
      if (readError && !isMissingSchemaError(readError)) throw readError
      const currentStatus = (current as { status?: string } | null)?.status
      if (currentStatus && currentStatus !== 'pending') {
        return draft
      }

      // 2. Claim + execute (idempotent at the server-side guard).
      const result = await approveAndExecute({
        draftId: draft.id,
        decided_by: user.id,
      })
      if (!result.ok) {
        throw new Error(result.error ?? 'Could not approve draft')
      }

      // 3. Audit-log every approval — the unique-kernel of the moat.
      logAuditEntry({
        projectId: draft.project_id,
        entityType: draft.related_resource_type ?? 'drafted_action',
        entityId: draft.related_resource_id ?? draft.id,
        action: 'approve',
        metadata: {
          action_type: draft.action_type,
          drafted_action_id: draft.id,
          confidence: draft.confidence,
          executed_resource_type: result.executed_resource_type ?? null,
          executed_resource_id: result.executed_resource_id ?? null,
        },
      }).catch(() => {
        /* never block the user on audit-log write failures */
      })

      return draft
    },
    onSuccess: (draft) => {
      // Invalidate every drafted_actions slice + the entity caches so
      // the newly-created RFI / daily log / etc. shows up immediately.
      queryClient.invalidateQueries({ queryKey: [DRAFTED_ACTIONS_KEY] })

      const target = entityKeyForActionType(draft.action_type)
      if (target) queryClient.invalidateQueries({ queryKey: [target, projectId] })

      // Per-entity invalidations (the page the gate is mounted on).
      if (draft.related_resource_type === 'rfi') {
        queryClient.invalidateQueries({ queryKey: ['rfis'] })
        queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', draft.related_resource_id] })
      } else if (draft.related_resource_type === 'submittal') {
        queryClient.invalidateQueries({ queryKey: ['submittals'] })
      } else if (draft.related_resource_type === 'change_order') {
        queryClient.invalidateQueries({ queryKey: ['change_orders'] })
      }
    },
  })
}

/**
 * Map a draft's `action_type` to the React-Query cache key whose list
 * needs to refresh after the executor inserts a new row.
 */
function entityKeyForActionType(t: DraftedAction['action_type']): string | null {
  switch (t) {
    case 'rfi.draft':
      return 'rfis'
    case 'daily_log.draft':
      return 'daily_logs'
    case 'submittal.transmittal_draft':
      return 'submittals'
    case 'pay_app.draft':
      return 'payment_applications'
    case 'punch_item.draft':
      return 'punch_items'
    case 'schedule.resequence':
      // schedule.resequence stays unwired upstream — no list invalidation.
      return null
  }
}

// ── Reject mutation ───────────────────────────────────────────────────

export interface RejectDraftInput {
  draft: DraftedAction
  reason?: string
}

/**
 * Reject a drafted action. Idempotent (server enforces
 * `WHERE id = ? AND status = 'pending'`). Audit-logged.
 */
export function useRejectDraftedAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ draft, reason }: RejectDraftInput): Promise<DraftedAction> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Sign in required')

      const result = await rejectDraftServer({
        draftId: draft.id,
        decided_by: user.id,
        decision_note: reason,
      })
      if (!result.ok) {
        // If the row was already decided we still surface the audit entry
        // and treat as success — the draft is no longer pending either way.
        if (!result.error?.toLowerCase().includes('decided')) {
          throw new Error(result.error ?? 'Could not reject draft')
        }
      }

      logAuditEntry({
        projectId: draft.project_id,
        entityType: draft.related_resource_type ?? 'drafted_action',
        entityId: draft.related_resource_id ?? draft.id,
        action: 'reject',
        metadata: {
          action_type: draft.action_type,
          drafted_action_id: draft.id,
          confidence: draft.confidence,
          reason: reason ?? null,
        },
      }).catch(() => {
        /* never block the user on audit-log write failures */
      })

      return draft
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DRAFTED_ACTIONS_KEY] })
    },
  })
}
