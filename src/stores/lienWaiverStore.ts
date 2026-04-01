import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { LienWaiverRow, LienWaiverInsert, LienWaiverStatus } from '../types/api'

interface LienWaiverState {
  lienWaivers: LienWaiverRow[]
  loading: boolean
  error: string | null

  loadLienWaivers: (projectId: string) => Promise<void>
  createLienWaiver: (payload: LienWaiverInsert) => Promise<{ error: string | null }>
  updateStatus: (id: string, status: LienWaiverStatus) => Promise<{ error: string | null }>
  getByPayApp: (payAppId: string) => LienWaiverRow[]
  getMissingCount: (payAppIds: string[]) => number
}

export const useLienWaiverStore = create<LienWaiverState>()((set, get) => ({
  lienWaivers: [],
  loading: false,
  error: null,

  loadLienWaivers: async (projectId) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('lien_waivers')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) {
      set({ error: error.message, loading: false })
      return
    }
    set({ lienWaivers: (data || []) as LienWaiverRow[], loading: false })
  },

  createLienWaiver: async (payload) => {
    const { data, error } = await (supabase.from('lien_waivers') as any).insert({
      ...payload,
      status: payload.status ?? 'pending',
    }).select().single()
    if (error) return { error: error.message }
    set((s) => ({ lienWaivers: [data as LienWaiverRow, ...s.lienWaivers] }))
    return { error: null }
  },

  updateStatus: async (id, status) => {
    const { error } = await (supabase.from('lien_waivers') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    set((s) => ({
      lienWaivers: s.lienWaivers.map((w) => (w.id === id ? { ...w, status } : w)),
    }))
    return { error: null }
  },

  getByPayApp: (payAppId) => {
    return get().lienWaivers.filter((w) => w.pay_app_id === payAppId)
  },

  // Returns count of pay apps that have no received waiver
  getMissingCount: (payAppIds) => {
    const { lienWaivers } = get()
    return payAppIds.filter((id) => {
      const waivers = lienWaivers.filter((w) => w.pay_app_id === id)
      return waivers.length === 0 || waivers.every((w) => w.status === 'pending')
    }).length
  },
}))
