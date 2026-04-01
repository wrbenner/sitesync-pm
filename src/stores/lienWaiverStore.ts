import { create } from 'zustand'
import {
  getLienWaivers,
  createLienWaiver as apiCreateLienWaiver,
  updateLienWaiverStatus as apiUpdateLienWaiverStatus,
  generateWaiversFromPayApp as apiGenerateWaiversFromPayApp,
} from '../api/endpoints/lienWaivers'
import type { LienWaiverRow, LienWaiverInsert, LienWaiverStatus } from '../types/api'

interface LienWaiverState {
  lienWaivers: LienWaiverRow[]
  loading: boolean
  error: string | null

  loadLienWaivers: (projectId: string) => Promise<void>
  createLienWaiver: (payload: LienWaiverInsert) => Promise<{ error: string | null }>
  updateStatus: (id: string, status: LienWaiverStatus, timestamp?: string) => Promise<{ error: string | null }>
  generateFromPayApp: (projectId: string, payAppId: string) => Promise<{ error: string | null }>
  getByPayApp: (payAppId: string) => LienWaiverRow[]
  getMissingCount: (payAppIds: string[]) => number
}

export const useLienWaiverStore = create<LienWaiverState>()((set, get) => ({
  lienWaivers: [],
  loading: false,
  error: null,

  loadLienWaivers: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const rows = await getLienWaivers(projectId)
      set({ lienWaivers: rows, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  createLienWaiver: async (payload) => {
    try {
      const row = await apiCreateLienWaiver(payload.project_id, {
        subcontractor_id: payload.subcontractor_id,
        payment_period: payload.payment_period,
        waiver_type: payload.waiver_type,
        amount: payload.amount,
        status: payload.status ?? 'pending',
        pay_application_id: payload.pay_application_id ?? null,
        waiver_date: payload.waiver_date ?? null,
        submitted_at: payload.submitted_at ?? null,
        received_at: payload.received_at ?? null,
      })
      set((s) => ({ lienWaivers: [row, ...s.lienWaivers] }))
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  },

  updateStatus: async (id, status, timestamp) => {
    const ts = timestamp ?? new Date().toISOString()
    try {
      const updated = await apiUpdateLienWaiverStatus(id, status, ts)
      set((s) => ({
        lienWaivers: s.lienWaivers.map((w) => (w.id === id ? updated : w)),
      }))
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  },

  generateFromPayApp: async (projectId, payAppId) => {
    try {
      const rows = await apiGenerateWaiversFromPayApp(projectId, payAppId)
      set((s) => ({ lienWaivers: [...rows, ...s.lienWaivers] }))
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  },

  getByPayApp: (payAppId) => {
    return get().lienWaivers.filter((w) => w.pay_application_id === payAppId)
  },

  // Returns count of pay apps that still have pending (not yet received or executed) waivers
  getMissingCount: (payAppIds) => {
    const { lienWaivers } = get()
    return payAppIds.filter((id) => {
      const waivers = lienWaivers.filter((w) => w.pay_application_id === id)
      return waivers.length === 0 || waivers.some((w) => w.status === 'pending')
    }).length
  },
}))
