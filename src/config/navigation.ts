// ─────────────────────────────────────────────────────────────────────────────
// Homepage Redesign — Navigation Config (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the role-filtered nav. Keyed by StreamRole, the
// 6-value UI persona derived from the canonical 15-value ProjectRole via
// toStreamRole(). Sidebar, CommandPalette, and MobileTabBar all read this.
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamRole } from '../types/stream'

export interface NavItem {
  id: string
  label: string
  icon: string          // Lucide icon component name (resolved at render time)
  route: string
  roles: StreamRole[]   // which stream personas see this item
  description?: string  // shown in command palette
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Command', icon: 'Zap', route: '/day', roles: ['pm', 'superintendent', 'owner', 'subcontractor', 'architect', 'executive'], description: 'Your daily priorities and actions' },
  { id: 'rfis', label: 'RFIs', icon: 'MessageCircle', route: '/rfis', roles: ['pm', 'subcontractor', 'architect'], description: 'Requests for information' },
  { id: 'submittals', label: 'Submittals', icon: 'FileCheck', route: '/submittals', roles: ['pm', 'subcontractor', 'architect'], description: 'Submittal tracking and approvals' },
  { id: 'schedule', label: 'Schedule', icon: 'Calendar', route: '/schedule', roles: ['pm', 'superintendent', 'owner', 'subcontractor'], description: 'Project schedule and critical path' },
  { id: 'budget', label: 'Budget', icon: 'DollarSign', route: '/budget', roles: ['pm', 'owner'], description: 'Budget, cost exposure, and change orders' },
  { id: 'drawings', label: 'Drawings', icon: 'Layers', route: '/drawings', roles: ['pm', 'superintendent', 'architect'], description: 'Drawing sets and markup' },
  { id: 'daily-log', label: 'Daily Log', icon: 'BookOpen', route: '/daily-log', roles: ['pm', 'superintendent'], description: 'Daily field reports' },
  { id: 'punch', label: 'Punch', icon: 'CheckCircle', route: '/punch-list', roles: ['pm', 'superintendent', 'subcontractor'], description: 'Punch list items' },
  { id: 'photos', label: 'Photos', icon: 'Camera', route: '/field-capture', roles: ['superintendent', 'owner', 'subcontractor'], description: 'Field photos and documentation' },
  { id: 'inspections', label: 'Inspections', icon: 'ClipboardCheck', route: '/permits', roles: ['superintendent'], description: 'Inspection checklists and status' },
  { id: 'reports', label: 'Reports', icon: 'FileText', route: '/reports', roles: ['pm', 'owner', 'executive'], description: 'Generate and view reports' },
  { id: 'documents', label: 'Documents', icon: 'FolderOpen', route: '/files', roles: ['pm', 'subcontractor'], description: 'Project documents and files' },
  { id: 'commitments', label: 'Commitments', icon: 'Handshake', route: '/commitments', roles: ['pm', 'owner', 'architect', 'subcontractor'], description: 'Track who owes what' },
  // Portfolio is post-Wave-1 (multi-project) — config preserved, role list
  // empty until then so it stays hidden everywhere except an explicit unlock.
  { id: 'portfolio', label: 'Portfolio', icon: 'BarChart3', route: '/portfolio', roles: [], description: 'Multi-project overview (post-Wave-1)' },
]

const NAV_BY_ID = new Map(NAV_ITEMS.map((item) => [item.id, item]))

export function getNavItem(id: string): NavItem | undefined {
  return NAV_BY_ID.get(id)
}

export function getNavForRole(role: StreamRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

// ── Mobile bottom-tab bar — 4 tabs per role + "More" sheet ───────────────────

export const MOBILE_TABS: Record<StreamRole, string[]> = {
  pm: ['command', 'rfis', 'schedule', 'budget'],
  superintendent: ['command', 'daily-log', 'punch', 'photos'],
  owner: ['command', 'budget', 'schedule', 'reports'],
  subcontractor: ['command', 'punch', 'photos', 'documents'],
  architect: ['command', 'rfis', 'submittals', 'drawings'],
  executive: ['command', 'reports'],
}

export function getMobileTabs(role: StreamRole): NavItem[] {
  return MOBILE_TABS[role]
    .map((id) => NAV_BY_ID.get(id))
    .filter((item): item is NavItem => !!item)
}

export function getMobileMoreItems(role: StreamRole): NavItem[] {
  const primary = new Set(MOBILE_TABS[role])
  return getNavForRole(role).filter((item) => !primary.has(item.id))
}

// ── Role-indicator label (for the user strip at sidebar bottom) ──────────────

export const STREAM_ROLE_LABEL: Record<StreamRole, string> = {
  pm: 'PM',
  superintendent: 'Super',
  owner: 'Owner',
  subcontractor: 'Sub',
  architect: 'Architect',
  executive: 'Exec',
}
