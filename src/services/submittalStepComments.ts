// Phase 7c-1 — Submittal step comments service.
//
// Backed by SECURITY-DEFINER RPCs in 20260512000000_submittal_multi_approval.sql.
// The thread reader collapses the edit-history chain (parent_comment_id) to
// the latest leaf per chain, so consumers see "current version" without
// needing to dereference the chain themselves.

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import { type Result, ok, fail, dbError } from './errors'

export interface StepComment {
  id: string
  reviewer_step_id: string
  author_id: string | null
  body_md: string
  attachments: Array<{ name: string; url?: string; size?: number }>
  mentions: string[]
  parent_comment_id: string | null
  is_deleted: boolean
  reason_code: string | null
  created_at: string
}

export interface CreateCommentInput {
  reviewer_step_id: string
  body_md: string
  attachments?: Array<{ name: string; url?: string; size?: number }>
  mentions?: string[]
}

export interface EditCommentInput {
  comment_id: string
  body_md: string
  attachments?: Array<{ name: string; url?: string; size?: number }>
  mentions?: string[]
}

export const submittalStepCommentsService = {
  /** Loads the thread for a step. Collapses edit-history chains to the
   *  latest leaf per chain. Hides deleted leaves but keeps an "edited" or
   *  "deleted" marker so the audit timeline reads cleanly. */
  async listThread(reviewerStepId: string): Promise<Result<StepComment[]>> {
    const { data, error } = await fromTable('submittal_step_comments' as never)
      .select('*')
      .eq('reviewer_step_id' as never, reviewerStepId)
      .order('created_at', { ascending: true })

    if (error) return fail(dbError(error.message, { reviewerStepId }))
    const rows = ((data as unknown) as StepComment[]) ?? []
    return ok(collapseEditHistory(rows))
  },

  async create(input: CreateCommentInput): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_create_step_comment' as never, {
      p_reviewer_step_id: input.reviewer_step_id,
      p_body_md: input.body_md,
      p_attachments: input.attachments ?? [],
      p_mentions: input.mentions ?? [],
    } as never)
    if (error) return fail(dbError(error.message, { input }))
    return ok((data as unknown as string) ?? '')
  },

  async edit(input: EditCommentInput): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_edit_step_comment' as never, {
      p_comment_id: input.comment_id,
      p_body_md: input.body_md,
      p_attachments: input.attachments ?? [],
      p_mentions: input.mentions ?? [],
    } as never)
    if (error) return fail(dbError(error.message, { input }))
    return ok((data as unknown as string) ?? '')
  },

  async remove(commentId: string): Promise<Result<void>> {
    const { error } = await supabase.rpc('submittal_delete_step_comment' as never, {
      p_comment_id: commentId,
    } as never)
    if (error) return fail(dbError(error.message, { commentId }))
    return ok(undefined)
  },
}

// ── Edit-history collapse ───────────────────────────────────────────────────

/**
 * Given the raw chronological list of comment rows (including edit chains
 * via parent_comment_id), return the "current version" view: one row per
 * top-of-chain, with `body_md` / `attachments` / `mentions` from the latest
 * leaf in its edit chain. Deleted leaves render as { is_deleted: true }
 * so the UI can show a tombstone marker.
 *
 * Exported for testability.
 */
export function collapseEditHistory(rows: StepComment[]): StepComment[] {
  // 1. Build a map: id → row.
  const byId = new Map<string, StepComment>()
  for (const r of rows) byId.set(r.id, r)

  // 2. Find the chain root for any comment by walking parent_comment_id.
  const rootOf = (id: string): string => {
    let cur = id
    const seen = new Set<string>()
    while (true) {
      if (seen.has(cur)) return cur // cycle guard
      seen.add(cur)
      const r = byId.get(cur)
      if (!r || !r.parent_comment_id) return cur
      cur = r.parent_comment_id
    }
  }

  // 3. Bucket all rows by their chain root.
  const byRoot = new Map<string, StepComment[]>()
  for (const r of rows) {
    const root = rootOf(r.id)
    const list = byRoot.get(root)
    if (list) list.push(r)
    else byRoot.set(root, [r])
  }

  // 4. For each chain, the "current" row is the latest leaf (max
  //    created_at) UNLESS that leaf is deleted, in which case we still
  //    surface it (so the UI shows a tombstone).
  const out: StepComment[] = []
  for (const [, chain] of byRoot) {
    const latest = [...chain].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)
    if (!latest) continue
    out.push(latest)
  }

  // 5. Sort the collapsed view by the chain root's creation time (the
  //    original comment), not the latest edit. So edits don't reorder
  //    the thread.
  out.sort((a, b) => {
    const aRoot = byId.get(rootOf(a.id))
    const bRoot = byId.get(rootOf(b.id))
    return (aRoot?.created_at ?? a.created_at).localeCompare(bRoot?.created_at ?? b.created_at)
  })

  return out
}

/** When the thread view shows "Show edit history" for a single chain,
 *  return the full chain (oldest → newest). */
export function getEditHistory(rows: StepComment[], rootId: string): StepComment[] {
  const byId = new Map<string, StepComment>(rows.map((r) => [r.id, r]))
  const byParent = new Map<string, StepComment>()
  for (const r of rows) {
    if (r.parent_comment_id) byParent.set(r.parent_comment_id, r)
  }
  const chain: StepComment[] = []
  let cur: string | null = rootId
  while (cur) {
    const node = byId.get(cur)
    if (!node) break
    chain.push(node)
    const child = byParent.get(cur)
    cur = child?.id ?? null
  }
  return chain
}
