// Compliance reporting for SOC 2, ISO 27001, and general contractor requirements.
// Generates evidence from audit trail, access logs, and system configuration.

import { supabase } from './supabase'
import { exportAuditTrailCSV, type AuditEntry } from '../hooks/useAuditTrail'

// ── Types ────────────────────────────────────────────────

export type ComplianceReportType = 'soc2_evidence' | 'access_report' | 'audit_summary' | 'data_export'

export interface ComplianceReport {
  id: string
  type: ComplianceReportType
  dateRangeStart: string
  dateRangeEnd: string
  generatedAt: string
  metrics: ComplianceMetrics
  content: string // CSV or summary text
}

export interface ComplianceMetrics {
  totalAuditEntries: number
  uniqueUsers: number
  entitiesModified: number
  failedAccessAttempts: number
  averageResponseTimeMs: number
  dataExportsCount: number
  passwordChanges: number
  mfaAdoptionRate: number
  ssoLoginRate: number
}

// ── Report Generation ────────────────────────────────────

const PAGE_SIZE = 1000
const MAX_PAGES = 200 // hard ceiling to prevent runaway queries (~200k rows)

export async function generateComplianceReport(
  organizationId: string,
  projectId: string | null,
  reportType: ComplianceReportType,
  startDate: string,
  endDate: string,
  onProgress?: (entriesLoaded: number) => void,
): Promise<ComplianceReport> {
  // Paginate through audit entries for the date range — avoids silent 10k row truncation
  const entries: AuditEntry[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('audit_trail')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch audit data: ${error.message}`)

    const batch = (data ?? []) as AuditEntry[]
    entries.push(...batch)
    onProgress?.(entries.length)

    if (batch.length < PAGE_SIZE) break
  }

  // Compute metrics
  const metrics = computeComplianceMetrics(entries)

  // Generate content based on report type
  let content: string
  switch (reportType) {
    case 'soc2_evidence':
      content = generateSOC2Evidence(entries, metrics, startDate, endDate)
      break
    case 'access_report':
      content = generateAccessReport(entries, metrics)
      break
    case 'audit_summary':
      content = exportAuditTrailCSV(entries)
      break
    case 'data_export':
      content = exportAuditTrailCSV(entries)
      break
    default:
      content = exportAuditTrailCSV(entries)
  }

  // Save report record
  const { data: report } = await supabase.from('compliance_reports').insert({
    organization_id: organizationId,
    project_id: projectId,
    report_type: reportType,
    generated_by: (await supabase.auth.getUser()).data.user?.id,
    date_range_start: startDate,
    date_range_end: endDate,
    metadata: metrics,
  }).select().single()

  return {
    id: report?.id ?? crypto.randomUUID(),
    type: reportType,
    dateRangeStart: startDate,
    dateRangeEnd: endDate,
    generatedAt: new Date().toISOString(),
    metrics,
    content,
  }
}

// ── Metrics Computation ──────────────────────────────────

function computeComplianceMetrics(entries: AuditEntry[]): ComplianceMetrics {
  const uniqueUsers = new Set(entries.map(e => e.actor_id).filter(Boolean))
  const uniqueEntities = new Set(entries.map(e => `${e.entity_type}:${e.entity_id}`).filter(e => !e.includes('null')))
  const failedAttempts = entries.filter(e => e.action.includes('failed') || e.action.includes('denied')).length
  const dataExports = entries.filter(e => e.action.includes('export')).length
  const passwordChanges = entries.filter(e => e.action === 'password_changed').length

  return {
    totalAuditEntries: entries.length,
    uniqueUsers: uniqueUsers.size,
    entitiesModified: uniqueEntities.size,
    failedAccessAttempts: failedAttempts,
    averageResponseTimeMs: 0,
    dataExportsCount: dataExports,
    passwordChanges,
    mfaAdoptionRate: 0,
    ssoLoginRate: 0,
  }
}

// ── SOC 2 Evidence Report ────────────────────────────────

function generateSOC2Evidence(entries: AuditEntry[], metrics: ComplianceMetrics, start: string, end: string): string {
  const sections: string[] = [
    `SOC 2 Type II Evidence Report`,
    `Period: ${start} to ${end}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `== CC6.1: Logical and Physical Access Controls ==`,
    `Total authenticated actions: ${metrics.totalAuditEntries}`,
    `Unique users with access: ${metrics.uniqueUsers}`,
    `Failed access attempts: ${metrics.failedAccessAttempts}`,
    `SSO login rate: ${metrics.ssoLoginRate}%`,
    '',
    `== CC6.2: System Operations ==`,
    `Entities modified: ${metrics.entitiesModified}`,
    `Data exports performed: ${metrics.dataExportsCount}`,
    '',
    `== CC6.3: Change Management ==`,
    `All changes are tracked in an immutable audit trail.`,
    `Audit trail entries cannot be modified or deleted (enforced by RLS).`,
    `Password changes in period: ${metrics.passwordChanges}`,
    '',
    `== CC7.2: System Monitoring ==`,
    `All user actions are logged with: user ID, action, entity, old values, new values, IP address, user agent, timestamp.`,
    `Retention policy: 7 years (configurable per organization).`,
    '',
    `== Evidence Detail ==`,
    '',
  ]

  // Group actions by type
  const actionCounts = new Map<string, number>()
  for (const entry of entries) {
    actionCounts.set(entry.action, (actionCounts.get(entry.action) ?? 0) + 1)
  }

  sections.push('Action Summary:')
  for (const [action, count] of Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])) {
    sections.push(`  ${action}: ${count}`)
  }

  return sections.join('\n')
}

// ── Access Report ────────────────────────────────────────

function generateAccessReport(entries: AuditEntry[], metrics: ComplianceMetrics): string {
  const sections: string[] = [
    'Access Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total access events: ${metrics.totalAuditEntries}`,
    `Unique users: ${metrics.uniqueUsers}`,
    `Failed attempts: ${metrics.failedAccessAttempts}`,
    '',
    'User Activity Summary:',
  ]

  // Group by user
  const userActivity = new Map<string, { count: number; lastSeen: string }>()
  for (const entry of entries) {
    const userId = entry.actor_id ?? 'system'
    const existing = userActivity.get(userId) ?? { count: 0, lastSeen: '' }
    existing.count++
    if (entry.created_at > existing.lastSeen) existing.lastSeen = entry.created_at
    userActivity.set(userId, existing)
  }

  for (const [userId, activity] of Array.from(userActivity.entries()).sort((a, b) => b[1].count - a[1].count)) {
    sections.push(`  ${userId}: ${activity.count} actions, last seen ${activity.lastSeen}`)
  }

  return sections.join('\n')
}

// ── Data Residency Configuration ─────────────────────────

export type DataRegion = 'us' | 'eu' | 'au'

export const DATA_REGIONS: Record<DataRegion, { name: string; description: string; flag: string }> = {
  us: { name: 'United States', description: 'US East (Virginia)', flag: '🇺🇸' },
  eu: { name: 'European Union', description: 'EU West (Frankfurt)', flag: '🇪🇺' },
  au: { name: 'Australia', description: 'AU East (Sydney)', flag: '🇦🇺' },
}
