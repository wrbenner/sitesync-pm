import { colors } from '../styles/theme'

export type EquipmentStatus = 'idle' | 'active' | 'maintenance' | 'transit' | 'off_site' | 'retired'

// ── Valid transitions by status ──────────────────────────────────────────────

const TRANSITIONS: Record<EquipmentStatus, EquipmentStatus[]> = {
  idle:        ['active', 'maintenance', 'transit', 'retired'],
  active:      ['idle', 'maintenance', 'transit', 'off_site'],
  maintenance: ['idle', 'retired'],
  transit:     ['active', 'idle'],
  off_site:    ['idle', 'active'],
  retired:     [], // terminal state
}

const MANAGE_ROLES = new Set(['owner', 'admin', 'project_manager', 'superintendent', 'foreman'])
const RETIRE_ROLES = new Set(['owner', 'admin', 'project_manager'])

/**
 * Returns valid target statuses for the given current status and user role.
 * Never trusts caller-supplied roles — callers must resolve from DB first.
 */
export function getValidEquipmentTransitions(
  status: EquipmentStatus,
  role: string,
): EquipmentStatus[] {
  if (!MANAGE_ROLES.has(role)) return []
  const base = TRANSITIONS[status] ?? []
  return RETIRE_ROLES.has(role) ? base : base.filter((s) => s !== 'retired')
}

export function isValidEquipmentTransition(
  from: EquipmentStatus,
  to: EquipmentStatus,
  role: string,
): boolean {
  return getValidEquipmentTransitions(from, role).includes(to)
}

// ── Status display config ─────────────────────────────────────────────────────

export function getEquipmentStatusConfig(status: EquipmentStatus): {
  label: string
  color: string
  bg: string
} {
  const config: Record<EquipmentStatus, { label: string; color: string; bg: string }> = {
    idle:        { label: 'Idle',        color: colors.statusPending,  bg: colors.statusPendingSubtle  },
    active:      { label: 'Active',      color: colors.statusActive,   bg: colors.statusActiveSubtle   },
    maintenance: { label: 'Maintenance', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    transit:     { label: 'In Transit',  color: colors.statusInfo,     bg: colors.statusInfoSubtle     },
    off_site:    { label: 'Off-Site',    color: colors.statusNeutral,  bg: colors.statusNeutralSubtle  },
    retired:     { label: 'Retired',     color: colors.statusNeutral,  bg: colors.statusNeutralSubtle  },
  }
  return config[status] ?? config.idle
}

// ── Maintenance status display ────────────────────────────────────────────────

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed'

export function getMaintenanceStatusConfig(status: MaintenanceStatus): {
  label: string
  color: string
  bg: string
} {
  const config: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
    scheduled:   { label: 'Scheduled',   color: colors.statusPending,  bg: colors.statusPendingSubtle  },
    in_progress: { label: 'In Progress', color: colors.statusInfo,     bg: colors.statusInfoSubtle     },
    completed:   { label: 'Completed',   color: colors.statusActive,   bg: colors.statusActiveSubtle   },
  }
  return config[status] ?? config.scheduled
}

// ── Checkout permission guard ─────────────────────────────────────────────────

const CHECKOUT_ROLES = new Set(['owner', 'admin', 'project_manager', 'superintendent', 'foreman'])
const MAINTENANCE_ROLES = new Set(['owner', 'admin', 'project_manager', 'superintendent'])

export function canCheckout(role: string): boolean {
  return CHECKOUT_ROLES.has(role)
}

export function canScheduleMaintenance(role: string): boolean {
  return MAINTENANCE_ROLES.has(role)
}

export function canRetire(role: string): boolean {
  return RETIRE_ROLES.has(role)
}
