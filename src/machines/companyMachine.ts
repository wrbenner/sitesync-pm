import { colors } from '../styles/theme'

export type CompanyStatus = 'active' | 'inactive' | 'suspended'

const ADMIN_ROLES = new Set(['admin', 'owner'])
const MANAGER_ROLES = new Set(['admin', 'owner', 'project_manager'])

/**
 * Resolve valid company status transitions for a given role.
 * Admin/owner can suspend; PM+ can activate/deactivate.
 */
export function getValidCompanyTransitions(
  status: CompanyStatus,
  role: string,
): CompanyStatus[] {
  if (ADMIN_ROLES.has(role)) {
    switch (status) {
      case 'active':   return ['inactive', 'suspended']
      case 'inactive': return ['active', 'suspended']
      case 'suspended': return ['active', 'inactive']
    }
  }
  if (MANAGER_ROLES.has(role)) {
    switch (status) {
      case 'active':   return ['inactive']
      case 'inactive': return ['active']
      case 'suspended': return []
    }
  }
  return []
}

export function getCompanyStatusConfig(status: CompanyStatus): {
  label: string
  color: string
  bg: string
} {
  const config: Record<CompanyStatus, { label: string; color: string; bg: string }> = {
    active:    { label: 'Active',    color: colors.statusActive,   bg: colors.statusActiveSubtle },
    inactive:  { label: 'Inactive',  color: colors.statusNeutral,  bg: colors.statusNeutralSubtle },
    suspended: { label: 'Suspended', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }
  return config[status]
}
