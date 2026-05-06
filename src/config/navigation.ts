// ─────────────────────────────────────────────────────────────────────────────
// Homepage Redesign — Navigation Config
// ─────────────────────────────────────────────────────────────────────────────
// VISION (locked, 2026-04-30): every page is reachable by every role.
// Per-action permissions (managed by admin) gate behavior INSIDE pages.
// Only the dashboard (Command stream) is role-dynamic — content + emphasis.
// Mobile bottom-tab primary set differentiates first-screen UX per role
// without hiding the rest of the app (always available via the More sheet).
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamRole } from '../types/stream'

export interface NavItem {
  id: string
  label: string
  icon: string          // Lucide icon component name (resolved at render time)
  route: string
  description?: string  // shown in command palette
}

// Every nav item is visible to every authenticated user. Permissions handle
// what they can DO inside each page; admin manages those.
export const NAV_ITEMS: NavItem[] = [
  { id: 'command',     label: 'Command',     icon: 'Zap',             route: '/day',           description: 'Your daily priorities and actions' },
  { id: 'rfis',        label: 'RFIs',        icon: 'MessageCircle',   route: '/rfis',          description: 'Requests for information' },
  { id: 'submittals',  label: 'Submittals',  icon: 'FileCheck',       route: '/submittals',    description: 'Submittal tracking and approvals' },
  { id: 'schedule',    label: 'Schedule',    icon: 'Calendar',        route: '/schedule',      description: 'Project schedule and critical path' },
  { id: 'budget',      label: 'Budget',      icon: 'DollarSign',      route: '/budget',        description: 'Budget, cost exposure, and change orders' },
  { id: 'drawings',    label: 'Drawings',    icon: 'Layers',          route: '/drawings',      description: 'Drawing sets and markup' },
  { id: 'daily-log',   label: 'Daily Log',   icon: 'BookOpen',        route: '/daily-log',     description: 'Daily field reports' },
  { id: 'punch',       label: 'Punch',       icon: 'CheckCircle',     route: '/punch-list',    description: 'Punch list items' },
  { id: 'photos',      label: 'Photos',      icon: 'Camera',          route: '/field-capture', description: 'Field photos and documentation' },
  { id: 'inspections', label: 'Inspections', icon: 'ClipboardCheck',  route: '/permits',       description: 'Inspection checklists and status' },
  { id: 'reports',     label: 'Reports',     icon: 'FileText',        route: '/reports',       description: 'Generate and view reports' },
  { id: 'documents',   label: 'Documents',   icon: 'FolderOpen',      route: '/files',         description: 'Project documents and files' },
  { id: 'commitments', label: 'Commitments', icon: 'Handshake',       route: '/commitments',   description: 'Track who owes what' },
]

const NAV_BY_ID = new Map(NAV_ITEMS.map((item) => [item.id, item]))

export function getNavItem(id: string): NavItem | undefined {
  return NAV_BY_ID.get(id)
}

// Returns the full nav list. Kept role-keyed for API stability — every role
// sees every page.
export function getNavForRole(_role: StreamRole): NavItem[] {
  return NAV_ITEMS
}

// ── Mobile bottom-tab bar — 4 primary tabs per role + "More" sheet ──────────
// "More" exposes the rest of NAV_ITEMS so nothing is ever hidden.

export const MOBILE_TABS: Record<StreamRole, string[]> = {
  pm:             ['command', 'rfis', 'schedule', 'budget'],
  superintendent: ['command', 'daily-log', 'punch', 'photos'],
  owner:          ['command', 'budget', 'schedule', 'reports'],
  subcontractor:  ['command', 'punch', 'photos', 'documents'],
  architect:      ['command', 'rfis', 'submittals', 'drawings'],
  executive:      ['command', 'reports', 'budget', 'schedule'],
}

export function getMobileTabs(role: StreamRole): NavItem[] {
  return MOBILE_TABS[role]
    .map((id) => NAV_BY_ID.get(id))
    .filter((item): item is NavItem => !!item)
}

export function getMobileMoreItems(role: StreamRole): NavItem[] {
  const primary = new Set(MOBILE_TABS[role])
  return NAV_ITEMS.filter((item) => !primary.has(item.id))
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
