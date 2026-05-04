import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import {
  type EquipmentStatus,
  getValidEquipmentTransitions,
} from '../machines/equipmentMachine'
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
} from './errors'

// ── Local type extensions ─────────────────────────────────────────────────────
// The generated database.ts types do not yet include the columns added by
// 20260417000001_equipment_service_layer.sql. These local types extend the DB
// row with the provenance/checkout columns so TypeScript does not complain
// about the fields we write in mutations.

export interface Equipment {
  id: string
  name: string
  type: string | null
  make: string | null
  model: string | null
  serial_number: string | null
  year: number | null
  ownership: string | null
  vendor: string | null
  rental_rate_daily: number | null
  rental_rate_weekly: number | null
  rental_rate_monthly: number | null
  status: EquipmentStatus | null
  current_location: string | null
  current_project_id: string | null
  project_id: string | null
  hours_meter: number | null
  last_service_date: string | null
  next_service_due: string | null
  qr_code: string | null
  insurance_policy: string | null
  insurance_expiry: string | null
  photos: unknown
  documents: unknown
  // Provenance (added by migration)
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  // Checkout tracking (added by migration)
  assigned_to: string | null
  checkout_date: string | null
  checkin_date: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EquipmentMaintenance {
  id: string
  equipment_id: string
  type: string | null
  description: string
  status: string | null
  scheduled_date: string | null
  completed_date: string | null
  cost: number | null
  vendor: string | null
  performed_by: string | null
  parts_used: unknown
  next_due_date: string | null
  next_due_hours: number | null
  // Provenance (added by migration)
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface EquipmentLog {
  id: string
  equipment_id: string
  project_id: string | null
  date: string
  hours_used: number | null
  fuel_gallons: number | null
  fuel_cost: number | null
  operator_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string | null
}

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateEquipmentInput = {
  project_id: string
  name: string
  type?: string
  make?: string
  model?: string
  serial_number?: string
  year?: number
  ownership?: 'owned' | 'rented' | 'leased'
  vendor?: string
  rental_rate_daily?: number
  rental_rate_weekly?: number
  rental_rate_monthly?: number
  current_location?: string
  insurance_policy?: string
  insurance_expiry?: string
}

export type CheckoutInput = {
  assigned_to?: string
  target_project_id: string
  current_location?: string
}

export type ScheduleMaintenanceInput = {
  equipment_id: string
  type: 'preventive' | 'corrective' | 'inspection'
  description: string
  scheduled_date?: string
  vendor?: string
  next_due_date?: string
  next_due_hours?: number
}

export type CompleteMaintenanceInput = {
  completed_date?: string
  cost?: number
  performed_by?: string
  parts_used?: unknown[]
  next_due_date?: string
  next_due_hours?: number
}

export type LogUsageInput = {
  equipment_id: string
  project_id: string
  date: string
  hours_used?: number
  fuel_gallons?: number
  fuel_cost?: number
  operator_id?: string
  notes?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null
  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, userId)
    .single()
  return (data as unknown as { role?: string } | null)?.role ?? null
}

// ── Service ───────────────────────────────────────────────────────────────────

export const equipmentService = {
  async loadEquipment(projectId: string): Promise<Result<Equipment[]>> {
    const { data, error } = await fromTable('equipment')
      .select('*')
      .eq('project_id' as never, projectId)
      .is('deleted_at' as never, null)
      .order('name', { ascending: true })

    if (error) return fail(dbError(error.message, { projectId }))
    return ok((data ?? []) as unknown as Equipment[])
  },

  async createEquipment(input: CreateEquipmentInput): Promise<Result<Equipment>> {
    const userId = await getCurrentUserId()
    const ownership = input.ownership ?? 'owned'

    const { data, error } = await fromTable('equipment')
      .insert({
        project_id: input.project_id,
        current_project_id: input.project_id,
        name: input.name,
        type: input.type ?? null,
        make: input.make ?? null,
        model_name: input.model ?? null,
        serial_number: input.serial_number ?? null,
        ownership,
        ownership_type: ownership,
        daily_rate: input.rental_rate_daily ?? null,
        status: 'idle' as EquipmentStatus,
        location: input.current_location ?? null,
        notes: null,
        created_by: userId,
        updated_by: userId,
      } as never)
      .select()
      .single()

    if (error) return fail(dbError(error.message, { project_id: input.project_id }))
    return ok(data as unknown as Equipment)
  },

  /**
   * Transition equipment status with lifecycle enforcement.
   * Resolves the user's authoritative role from the database — never trusts caller-supplied roles.
   */
  async transitionStatus(
    equipmentId: string,
    newStatus: EquipmentStatus,
  ): Promise<Result> {
    const { data: eq, error: fetchError } = await fromTable('equipment')
      .select('status, project_id')
      .eq('id' as never, equipmentId)
      .is('deleted_at' as never, null)
      .single()

    if (fetchError || !eq) {
      return fail(notFoundError('Equipment', equipmentId))
    }

    const projectId = (eq as unknown as Record<string, unknown>).project_id as string
    if (!projectId) {
      return fail(permissionError('Equipment is not associated with any project'))
    }

    const userId = await getCurrentUserId()
    const role = await resolveProjectRole(projectId, userId)
    if (!role) {
      return fail(permissionError('User is not a member of this project'))
    }

    const currentStatus = (eq as unknown as Record<string, unknown>).status as EquipmentStatus ?? 'idle'
    const validTransitions = getValidEquipmentTransitions(currentStatus, role)
    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      )
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    }
    if (newStatus === 'retired') {
      updates.deleted_at = now
      updates.deleted_by = userId
    }

    const { error } = await fromTable('equipment')
      .update(updates as never)
      .eq('id' as never, equipmentId)

    if (error) return fail(dbError(error.message, { equipmentId, newStatus }))
    return { data: null, error: null }
  },

  /**
   * Update equipment fields (non-status). Use transitionStatus() for status changes.
   */
  async updateEquipment(
    equipmentId: string,
    updates: Partial<Omit<Equipment, 'id' | 'created_by' | 'deleted_at' | 'deleted_by'>>,
  ): Promise<Result> {
    const userId = await getCurrentUserId()
    const safeUpdates = { ...(updates as unknown as Record<string, unknown>) }
    delete safeUpdates.status
    safeUpdates.updated_by = userId

    const { error } = await fromTable('equipment')
      .update(safeUpdates as never)
      .eq('id' as never, equipmentId)

    if (error) return fail(dbError(error.message, { equipmentId }))
    return { data: null, error: null }
  },

  async deleteEquipment(equipmentId: string): Promise<Result> {
    const userId = await getCurrentUserId()
    const now = new Date().toISOString()

    const { error } = await fromTable('equipment')
      .update({
        status: 'retired',
        deleted_at: now,
        deleted_by: userId,
      } as never)
      .eq('id' as never, equipmentId)

    if (error) return fail(dbError(error.message, { equipmentId }))
    return { data: null, error: null }
  },

  // ── Checkout / Checkin workflows ──────────────────────────────────────────

  /**
   * Checkout equipment: transitions idle → active, sets assignment fields.
   */
  async checkout(
    equipmentId: string,
    input: CheckoutInput,
  ): Promise<Result> {
    const { data: eq, error: fetchError } = await fromTable('equipment')
      .select('status, project_id')
      .eq('id' as never, equipmentId)
      .is('deleted_at' as never, null)
      .single()

    if (fetchError || !eq) {
      return fail(notFoundError('Equipment', equipmentId))
    }

    const projectId = (eq as unknown as Record<string, unknown>).project_id as string
    const userId = await getCurrentUserId()
    const role = await resolveProjectRole(input.target_project_id || projectId, userId)
    if (!role) {
      return fail(permissionError('User is not a member of this project'))
    }

    const currentStatus = (eq as unknown as Record<string, unknown>).status as EquipmentStatus ?? 'idle'
    if (currentStatus !== 'idle') {
      return fail(
        validationError(
          `Equipment must be idle to check out. Current status: ${currentStatus}`,
          { currentStatus, equipmentId },
        ),
      )
    }

    const { error } = await fromTable('equipment')
      .update({
        status: 'active' as EquipmentStatus,
        project_id: input.target_project_id,
        current_project_id: input.target_project_id,
        assigned_to: input.assigned_to ?? userId,
        checkout_date: new Date().toISOString(),
        checkin_date: null,
        current_location: input.current_location ?? null,
        updated_by: userId,
      } as never)
      .eq('id' as never, equipmentId)

    if (error) return fail(dbError(error.message, { equipmentId }))
    return { data: null, error: null }
  },

  /**
   * Checkin equipment: transitions active → idle, clears assignment fields.
   */
  async checkin(equipmentId: string): Promise<Result> {
    const { data: eq, error: fetchError } = await fromTable('equipment')
      .select('status, project_id, assigned_crew_id')
      .eq('id' as never, equipmentId)
      .is('deleted_at' as never, null)
      .single()

    if (fetchError || !eq) {
      return fail(notFoundError('Equipment', equipmentId))
    }

    const projectId = (eq as unknown as Record<string, unknown>).project_id as string
    const userId = await getCurrentUserId()
    const role = await resolveProjectRole(projectId, userId)
    if (!role) {
      return fail(permissionError('User is not a member of this project'))
    }

    const currentStatus = (eq as unknown as Record<string, unknown>).status as EquipmentStatus ?? 'idle'
    if (currentStatus !== 'active' && currentStatus !== 'transit') {
      return fail(
        validationError(
          `Equipment must be active or in transit to check in. Current status: ${currentStatus}`,
          { currentStatus, equipmentId },
        ),
      )
    }

    const { error } = await fromTable('equipment')
      .update({
        status: 'idle' as EquipmentStatus,
        assigned_to: null,
        checkin_date: new Date().toISOString(),
      } as never)
      .eq('id' as never, equipmentId)

    if (error) return fail(dbError(error.message, { equipmentId }))
    return { data: null, error: null }
  },

  // ── Maintenance workflows ─────────────────────────────────────────────────

  async loadMaintenanceRecords(projectId: string): Promise<Result<EquipmentMaintenance[]>> {
    // Two-step join: PostgREST embed via the typed wrapper requires a foreign-
    // key relationship that the regenerated types may not yet know about.
    // Fetch equipment ids for the project first, then maintenance rows for
    // those ids — same pattern used by the other services migrated this lap.
    const { data: equipRows, error: equipErr } = await fromTable('equipment')
      .select('id')
      .eq('project_id' as never, projectId)
      .is('deleted_at' as never, null)

    if (equipErr) return fail(dbError(equipErr.message, { projectId }))
    const equipIds = ((equipRows ?? []) as unknown as Array<{ id: string }>).map((r) => r.id)
    if (equipIds.length === 0) return ok([])

    const { data, error } = await fromTable('equipment_maintenance')
      .select('*')
      .in('equipment_id' as never, equipIds as never[])
      .is('deleted_at' as never, null)
      .order('scheduled_date', { ascending: true })

    if (error) return fail(dbError(error.message, { projectId }))
    return ok((data ?? []) as unknown as EquipmentMaintenance[])
  },

  async loadMaintenanceForEquipment(equipmentId: string): Promise<Result<EquipmentMaintenance[]>> {
    const { data, error } = await fromTable('equipment_maintenance')
      .select('*')
      .eq('equipment_id' as never, equipmentId)
      .is('deleted_at' as never, null)
      .order('scheduled_date', { ascending: true })

    if (error) return fail(dbError(error.message, { equipmentId }))
    return ok((data ?? []) as unknown as EquipmentMaintenance[])
  },

  async scheduleMaintenance(input: ScheduleMaintenanceInput): Promise<Result<EquipmentMaintenance>> {
    const userId = await getCurrentUserId()

    const { data, error } = await fromTable('equipment_maintenance')
      .insert({
        equipment_id: input.equipment_id,
        type: input.type,
        description: input.description,
        status: 'scheduled',
        scheduled_date: input.scheduled_date ?? null,
        vendor: input.vendor ?? null,
        next_due_date: input.next_due_date ?? null,
        next_due_hours: input.next_due_hours ?? null,
        created_by: userId,
      } as never)
      .select()
      .single()

    if (error) return fail(dbError(error.message, { equipment_id: input.equipment_id }))

    // Transition equipment into maintenance status
    const transResult = await equipmentService.transitionStatus(input.equipment_id, 'maintenance')
    if (transResult.error) {
      return fail({
        ...transResult.error,
        message: `Maintenance scheduled but status transition failed: ${transResult.error.message}`,
        userMessage: 'Maintenance record created but equipment status could not be updated. Please refresh and retry.',
      })
    }

    return ok(data as unknown as EquipmentMaintenance)
  },

  async completeMaintenance(
    maintenanceId: string,
    input: CompleteMaintenanceInput,
  ): Promise<Result> {
    const userId = await getCurrentUserId()

    // Load the maintenance record to get equipment_id
    const { data: maint, error: fetchErr } = await fromTable('equipment_maintenance')
      .select('equipment_id, status')
      .eq('id' as never, maintenanceId)
      .single()

    if (fetchErr || !maint) {
      return fail(notFoundError('MaintenanceRecord', maintenanceId))
    }

    const { error } = await fromTable('equipment_maintenance')
      .update({
        status: 'completed',
        completed_date: input.completed_date ?? new Date().toISOString(),
        cost: input.cost ?? null,
        performed_by: input.performed_by ?? userId,
        parts_used: input.parts_used ?? null,
        next_due_date: input.next_due_date ?? null,
        next_due_hours: input.next_due_hours ?? null,
      } as never)
      .eq('id' as never, maintenanceId)

    if (error) return fail(dbError(error.message, { maintenanceId }))

    // Transition equipment back to idle
    const equipmentId = (maint as unknown as Record<string, unknown>).equipment_id as string
    const transResult = await equipmentService.transitionStatus(equipmentId, 'idle')
    if (transResult.error) {
      return fail({
        ...transResult.error,
        message: `Maintenance completed but status transition failed: ${transResult.error.message}`,
        userMessage: 'Maintenance marked complete but equipment status could not be updated. Please refresh and retry.',
      })
    }

    // Update last_service_date and next_service_due on equipment
    const serviceUpdates: Record<string, unknown> = {
      last_service_date: input.completed_date ?? new Date().toISOString().split('T')[0],
    }
    void userId
    if (input.next_due_date) {
      serviceUpdates.next_service_due = input.next_due_date
    }

    await fromTable('equipment')
      .update(serviceUpdates as never)
      .eq('id' as never, equipmentId)

    return { data: null, error: null }
  },

  // ── Usage logging ─────────────────────────────────────────────────────────

  async logUsage(input: LogUsageInput): Promise<Result<EquipmentLog>> {
    const userId = await getCurrentUserId()

    const { data, error } = await fromTable('equipment_logs')
      .insert({
        equipment_id: input.equipment_id,
        project_id: input.project_id,
        date: input.date,
        hours_used: input.hours_used ?? null,
        fuel_gallons: input.fuel_gallons ?? null,
        fuel_cost: input.fuel_cost ?? null,
        operator_id: input.operator_id ?? null,
        notes: input.notes ?? null,
        created_by: userId,
      } as never)
      .select()
      .single()

    if (error) return fail(dbError(error.message, { equipment_id: input.equipment_id }))

    // Update hours_meter if hours_used provided
    if (input.hours_used != null) {
      const { data: eq } = await fromTable('equipment')
        .select('hours_meter')
        .eq('id' as never, input.equipment_id)
        .single()

      const currentHours = ((eq as unknown as Record<string, unknown> | null)?.hours_meter as number | null) ?? 0
      await fromTable('equipment')
        .update({
          hours_meter: currentHours + input.hours_used,
        } as never)
        .eq('id' as never, input.equipment_id)
      void userId
    }

    return ok(data as unknown as EquipmentLog)
  },

  async loadUsageLogs(equipmentId: string): Promise<Result<EquipmentLog[]>> {
    const { data, error } = await fromTable('equipment_logs')
      .select('*')
      .eq('equipment_id' as never, equipmentId)
      .order('date', { ascending: false })

    if (error) return fail(dbError(error.message, { equipmentId }))
    return ok((data ?? []) as unknown as EquipmentLog[])
  },
}
