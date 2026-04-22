import { create } from 'zustand'
import { equipmentService } from '../services/equipmentService'
import type {
  Equipment,
  EquipmentMaintenance,
  EquipmentLog,
  CreateEquipmentInput,
  CheckoutInput,
  ScheduleMaintenanceInput,
  CompleteMaintenanceInput,
  LogUsageInput,
} from '../services/equipmentService'
import type { ServiceError } from '../services/errors'
import type { EquipmentStatus } from '../machines/equipmentMachine'

interface EquipmentState {
  equipment: Equipment[]
  maintenanceRecords: EquipmentMaintenance[]
  usageLogs: Record<string, EquipmentLog[]>
  loading: boolean
  maintenanceLoading: boolean
  error: string | null
  errorDetails: ServiceError | null

  loadEquipment: (projectId: string) => Promise<void>
  createEquipment: (input: CreateEquipmentInput) => Promise<{ error: string | null; equipment: Equipment | null }>
  updateEquipment: (equipmentId: string, updates: Partial<Equipment>) => Promise<{ error: string | null }>
  transitionStatus: (equipmentId: string, status: EquipmentStatus) => Promise<{ error: string | null }>
  deleteEquipment: (equipmentId: string) => Promise<{ error: string | null }>

  checkout: (equipmentId: string, input: CheckoutInput) => Promise<{ error: string | null }>
  checkin: (equipmentId: string) => Promise<{ error: string | null }>

  loadMaintenanceRecords: (projectId: string) => Promise<void>
  scheduleMaintenance: (input: ScheduleMaintenanceInput) => Promise<{ error: string | null; record: EquipmentMaintenance | null }>
  completeMaintenance: (maintenanceId: string, input: CompleteMaintenanceInput) => Promise<{ error: string | null }>

  logUsage: (input: LogUsageInput) => Promise<{ error: string | null }>
  loadUsageLogs: (equipmentId: string) => Promise<void>

  clearError: () => void
}

export const useEquipmentStore = create<EquipmentState>()((set, get) => ({
  equipment: [],
  maintenanceRecords: [],
  usageLogs: {},
  loading: false,
  maintenanceLoading: false,
  error: null,
  errorDetails: null,

  loadEquipment: async (projectId) => {
    set({ loading: true, error: null, errorDetails: null })
    const { data, error } = await equipmentService.loadEquipment(projectId)
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false })
    } else {
      set({ equipment: data ?? [], loading: false })
    }
  },

  createEquipment: async (input) => {
    const { data, error } = await equipmentService.createEquipment(input)
    if (error) return { error: error.userMessage, equipment: null }
    if (data) {
      set((s) => ({ equipment: [data, ...s.equipment] }))
    }
    return { error: null, equipment: data }
  },

  updateEquipment: async (equipmentId, updates) => {
    const { error } = await equipmentService.updateEquipment(equipmentId, updates)
    if (error) return { error: error.userMessage }
    set((s) => ({
      equipment: s.equipment.map((e) =>
        e.id === equipmentId ? { ...e, ...updates } : e,
      ),
    }))
    return { error: null }
  },

  transitionStatus: async (equipmentId, status) => {
    const { error } = await equipmentService.transitionStatus(equipmentId, status)
    if (error) return { error: error.userMessage }
    set((s) => ({
      equipment: s.equipment.map((e) =>
        e.id === equipmentId ? { ...e, status } : e,
      ),
    }))
    return { error: null }
  },

  deleteEquipment: async (equipmentId) => {
    const { error } = await equipmentService.deleteEquipment(equipmentId)
    if (error) return { error: error.userMessage }
    set((s) => ({
      equipment: s.equipment.filter((e) => e.id !== equipmentId),
    }))
    return { error: null }
  },

  // ── Checkout / Checkin ────────────────────────────────────────────────────

  checkout: async (equipmentId, input) => {
    const { error } = await equipmentService.checkout(equipmentId, input)
    if (error) return { error: error.userMessage }
    set((s) => ({
      equipment: s.equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              status: 'active' as EquipmentStatus,
              project_id: input.target_project_id,
              assigned_crew_id: input.assigned_to ?? e.assigned_crew_id,
              checkout_date: new Date().toISOString(),
              checkin_date: null,
            }
          : e,
      ),
    }))
    return { error: null }
  },

  checkin: async (equipmentId) => {
    const { error } = await equipmentService.checkin(equipmentId)
    if (error) return { error: error.userMessage }
    set((s) => ({
      equipment: s.equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              status: 'idle' as EquipmentStatus,
              assigned_crew_id: null,
              checkin_date: new Date().toISOString(),
            }
          : e,
      ),
    }))
    return { error: null }
  },

  // ── Maintenance ───────────────────────────────────────────────────────────

  loadMaintenanceRecords: async (projectId) => {
    set({ maintenanceLoading: true })
    const { data, error } = await equipmentService.loadMaintenanceRecords(projectId)
    if (error) {
      set({ maintenanceLoading: false })
    } else {
      set({ maintenanceRecords: data ?? [], maintenanceLoading: false })
    }
  },

  scheduleMaintenance: async (input) => {
    const { data, error } = await equipmentService.scheduleMaintenance(input)
    if (error) return { error: error.userMessage, record: null }
    if (data) {
      set((s) => ({ maintenanceRecords: [...s.maintenanceRecords, data] }))
      // Update equipment status to maintenance
      set((s) => ({
        equipment: s.equipment.map((e) =>
          e.id === input.equipment_id ? { ...e, status: 'maintenance' as EquipmentStatus } : e,
        ),
      }))
    }
    return { error: null, record: data }
  },

  completeMaintenance: async (maintenanceId, input) => {
    const { error } = await equipmentService.completeMaintenance(maintenanceId, input)
    if (error) return { error: error.userMessage }
    // Update maintenance record in store
    set((s) => ({
      maintenanceRecords: s.maintenanceRecords.map((m) =>
        m.id === maintenanceId
          ? {
              ...m,
              status: 'completed',
              completed_date: input.completed_date ?? new Date().toISOString(),
              cost: input.cost ?? m.cost,
            }
          : m,
      ),
    }))
    // Find the equipment and update its status back to idle
    const record = get().maintenanceRecords.find((m) => m.id === maintenanceId)
    if (record) {
      set((s) => ({
        equipment: s.equipment.map((e) =>
          e.id === record.equipment_id
            ? {
                ...e,
                status: 'idle' as EquipmentStatus,
                last_service_date: (input.completed_date ?? new Date().toISOString()).split('T')[0],
              }
            : e,
        ),
      }))
    }
    return { error: null }
  },

  // ── Usage Logs ────────────────────────────────────────────────────────────

  logUsage: async (input) => {
    const { error } = await equipmentService.logUsage(input)
    if (error) return { error: error.userMessage }
    // Reload usage logs for this equipment
    await get().loadUsageLogs(input.equipment_id)
    return { error: null }
  },

  loadUsageLogs: async (equipmentId) => {
    const { data, error } = await equipmentService.loadUsageLogs(equipmentId)
    if (!error && data) {
      set((s) => ({
        usageLogs: { ...s.usageLogs, [equipmentId]: data },
      }))
    }
  },

  clearError: () => set({ error: null, errorDetails: null }),
}))
