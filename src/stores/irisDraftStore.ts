// ─────────────────────────────────────────────────────────────────────────────
// Iris draft store (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// In-memory Zustand store for Iris-generated drafts. Wave 1 keeps these
// out of Supabase entirely — drafts live for the session and are regenerated
// on demand if the user comes back. Approval/dismiss is also session state;
// the *underlying* action (sending the email, saving the daily log) is
// handled by existing mutation hooks in the UI layer (Tab B).
//
// API surface mirrors the spec in SESSION-4-iris-stream-integration.md so
// other tabs can call this without surprises.
//
// Keys are scoped as `${projectId}:${itemId}` so drafts never leak between
// projects. Callers that don't have a project (e.g. pre-warm) pass null;
// those entries land under `_:${itemId}`. After Send the entry is cleared
// so reopening the same item starts a fresh draft instead of resurfacing
// stale "approved" state.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { StreamItem } from '../types/stream'
import { generateIrisDraft } from '../services/iris/drafts'
import type { IrisDraft, ProjectContextSnapshot } from '../services/iris/types'

interface IrisDraftStore {
  drafts: Map<string, IrisDraft>
  loading: Set<string>

  generateDraft: (item: StreamItem, ctx: ProjectContextSnapshot) => Promise<void>
  approveDraft: (id: string, projectId?: string | null) => void
  rejectDraft: (id: string, projectId?: string | null) => void
  editDraft: (id: string, content: string, projectId?: string | null) => void
  /** Drop a draft from the store entirely. Use after a successful Send so the
   *  next open of the same item starts a fresh generation. */
  clearDraft: (id: string, projectId?: string | null) => void
  getDraft: (id: string, projectId?: string | null) => IrisDraft | undefined
  isLoading: (id: string, projectId?: string | null) => boolean
  // Test / cleanup helper. Not part of the spec contract; safe to leave unused.
  _reset: () => void
}

// Project-scoped key. Null project goes into a shared `_` namespace so
// pre-warm and other unscoped flows still get deduplicated by item id.
function keyOf(projectId: string | null | undefined, itemId: string): string {
  return `${projectId ?? '_'}:${itemId}`
}

// Helpers that produce *new* Map / Set instances so Zustand's shallow
// comparison detects the change.
const withDraft = (drafts: Map<string, IrisDraft>, key: string, draft: IrisDraft) => {
  const next = new Map(drafts)
  next.set(key, draft)
  return next
}

const withoutDraft = (drafts: Map<string, IrisDraft>, key: string) => {
  if (!drafts.has(key)) return drafts
  const next = new Map(drafts)
  next.delete(key)
  return next
}

const withoutLoading = (loading: Set<string>, key: string) => {
  const next = new Set(loading)
  next.delete(key)
  return next
}

const withLoading = (loading: Set<string>, key: string) => {
  const next = new Set(loading)
  next.add(key)
  return next
}

export const useIrisDraftStore = create<IrisDraftStore>((set, get) => ({
  drafts: new Map(),
  loading: new Set(),

  generateDraft: async (item, ctx) => {
    const key = keyOf(ctx.projectId, item.id)
    const { drafts, loading } = get()
    // Idempotency: don't re-fire while one is in flight, and don't regenerate
    // a pending/edited/approved draft. Allow regeneration only if the existing
    // draft was rejected or errored out.
    if (loading.has(key)) return
    const existing = drafts.get(key)
    if (existing && existing.status !== 'rejected' && !existing.error) return

    set((s) => ({ loading: withLoading(s.loading, key) }))

    try {
      const draft = await generateIrisDraft(item, ctx)
      set((s) => ({
        drafts: withDraft(s.drafts, key, draft),
        loading: withoutLoading(s.loading, key),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate draft'
      const errorDraft: IrisDraft = {
        id: item.id,
        type: item.irisEnhancement?.draftType ?? 'follow_up_email',
        content: '',
        sources: [],
        status: 'rejected',
        generatedAt: new Date().toISOString(),
        error: message,
      }
      set((s) => ({
        drafts: withDraft(s.drafts, key, errorDraft),
        loading: withoutLoading(s.loading, key),
      }))
    }
  },

  approveDraft: (id, projectId) => {
    const key = keyOf(projectId, id)
    const draft = get().drafts.get(key)
    if (!draft) return
    set((s) => ({ drafts: withDraft(s.drafts, key, { ...draft, status: 'approved' }) }))
  },

  rejectDraft: (id, projectId) => {
    const key = keyOf(projectId, id)
    const draft = get().drafts.get(key)
    if (!draft) return
    set((s) => ({ drafts: withDraft(s.drafts, key, { ...draft, status: 'rejected' }) }))
  },

  editDraft: (id, content, projectId) => {
    const key = keyOf(projectId, id)
    const draft = get().drafts.get(key)
    if (!draft) return
    set((s) => ({
      drafts: withDraft(s.drafts, key, {
        ...draft,
        editedContent: content,
        status: 'edited',
      }),
    }))
  },

  clearDraft: (id, projectId) => {
    const key = keyOf(projectId, id)
    set((s) => ({
      drafts: withoutDraft(s.drafts, key),
      loading: withoutLoading(s.loading, key),
    }))
  },

  getDraft: (id, projectId) => get().drafts.get(keyOf(projectId, id)),

  isLoading: (id, projectId) => get().loading.has(keyOf(projectId, id)),

  _reset: () => set({ drafts: new Map(), loading: new Set() }),
}))
