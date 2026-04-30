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
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { StreamItem } from '../types/stream'
import { generateIrisDraft } from '../services/iris/drafts'
import type { IrisDraft, ProjectContextSnapshot } from '../services/iris/types'

interface IrisDraftStore {
  drafts: Map<string, IrisDraft>
  loading: Set<string>

  generateDraft: (item: StreamItem, ctx: ProjectContextSnapshot) => Promise<void>
  approveDraft: (id: string) => void
  rejectDraft: (id: string) => void
  editDraft: (id: string, content: string) => void
  getDraft: (id: string) => IrisDraft | undefined
  isLoading: (id: string) => boolean
  // Test / cleanup helper. Not part of the spec contract; safe to leave unused.
  _reset: () => void
}

// Helpers that produce *new* Map / Set instances so Zustand's shallow
// comparison detects the change.
const withDraft = (drafts: Map<string, IrisDraft>, draft: IrisDraft) => {
  const next = new Map(drafts)
  next.set(draft.id, draft)
  return next
}

const withoutLoading = (loading: Set<string>, id: string) => {
  const next = new Set(loading)
  next.delete(id)
  return next
}

const withLoading = (loading: Set<string>, id: string) => {
  const next = new Set(loading)
  next.add(id)
  return next
}

export const useIrisDraftStore = create<IrisDraftStore>((set, get) => ({
  drafts: new Map(),
  loading: new Set(),

  generateDraft: async (item, ctx) => {
    const { drafts, loading } = get()
    // Idempotency: don't re-fire while one is in flight, and don't regenerate
    // a pending/edited/approved draft. Allow regeneration only if the existing
    // draft was rejected or errored out.
    if (loading.has(item.id)) return
    const existing = drafts.get(item.id)
    if (existing && existing.status !== 'rejected' && !existing.error) return

    set((s) => ({ loading: withLoading(s.loading, item.id) }))

    try {
      const draft = await generateIrisDraft(item, ctx)
      set((s) => ({
        drafts: withDraft(s.drafts, draft),
        loading: withoutLoading(s.loading, item.id),
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
        drafts: withDraft(s.drafts, errorDraft),
        loading: withoutLoading(s.loading, item.id),
      }))
    }
  },

  approveDraft: (id) => {
    const draft = get().drafts.get(id)
    if (!draft) return
    set((s) => ({ drafts: withDraft(s.drafts, { ...draft, status: 'approved' }) }))
  },

  rejectDraft: (id) => {
    const draft = get().drafts.get(id)
    if (!draft) return
    set((s) => ({ drafts: withDraft(s.drafts, { ...draft, status: 'rejected' }) }))
  },

  editDraft: (id, content) => {
    const draft = get().drafts.get(id)
    if (!draft) return
    set((s) => ({
      drafts: withDraft(s.drafts, {
        ...draft,
        editedContent: content,
        status: 'edited',
      }),
    }))
  },

  getDraft: (id) => get().drafts.get(id),

  isLoading: (id) => get().loading.has(id),

  _reset: () => set({ drafts: new Map(), loading: new Set() }),
}))
