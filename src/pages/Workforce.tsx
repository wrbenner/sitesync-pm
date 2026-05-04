import React, { useState } from 'react'
import { Users, Clock, Calendar, Plus, Trash2, ShieldCheck, TrendingUp, BarChart3, Truck, AlertTriangle, Send, CheckCircle2 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, Btn } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { PermissionGate } from '../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { useWorkforceMembers, useTimeEntries, useCreateWorkforceMember, useDeleteWorkforceMember, useCreateTimeEntry, useApproveTimeEntry } from '../hooks/queries'
import type { Database } from '../types/database'

type WorkforceMemberRow = Database['public']['Tables']['workforce_members']['Row'] & { crew?: string | null }
type TimeEntryRow = Database['public']['Tables']['time_entries']['Row'] & { worker_name: string }
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

type TabKey = 'roster' | 'time' | 'forecast' | 'credentials' | 'productivity' | 'dispatch'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'roster', label: 'Roster', icon: Users },
  { key: 'time', label: 'Time Tracking', icon: Clock },
  { key: 'credentials', label: 'Credentials', icon: ShieldCheck },
  { key: 'forecast', label: 'Forecast', icon: TrendingUp },
  { key: 'productivity', label: 'Productivity', icon: BarChart3 },
  { key: 'dispatch', label: 'Dispatch', icon: Truck },
]

const TRADES = ['Electrical', 'Plumbing', 'HVAC', 'Concrete', 'Carpentry', 'Steel', 'Masonry', 'Painting', 'Roofing', 'General Labor', 'Other'] as const

// ── Credential Demo Data ────────────────────────────────
interface Certification {
  certName: string; authority: string; certNumber: string; issueDate: string; expirationDate: string; status: 'current' | 'expiring' | 'expired'
}
interface WorkerCredential {
  name: string; trade: string; company: string; orientationDate: string; safetyVideoCompleted: boolean; handbookSigned: boolean; certs: Certification[]
}

const credentialDemoData: WorkerCredential[] = [
  { name: 'Mike Torres', trade: 'Electrical', company: 'Apex Electric', orientationDate: '2025-11-01', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 30', authority: 'OSHA', certNumber: 'OSH-30-88412', issueDate: '2024-03-15', expirationDate: '2029-03-15', status: 'current' },
    { certName: 'Electrical License', authority: 'State Board', certNumber: 'EL-2024-5591', issueDate: '2024-01-10', expirationDate: '2027-01-10', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-449281', issueDate: '2025-06-20', expirationDate: '2026-06-20', status: 'current' },
    { certName: 'Arc Flash Safety', authority: 'NFPA', certNumber: 'AF-2024-113', issueDate: '2024-08-01', expirationDate: '2026-08-01', status: 'current' },
  ]},
  { name: 'Sarah Chen', trade: 'Plumbing', company: 'BluePipe Co', orientationDate: '2025-10-15', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 10', authority: 'OSHA', certNumber: 'OSH-10-33021', issueDate: '2023-05-10', expirationDate: '2028-05-10', status: 'current' },
    { certName: 'Master Plumber', authority: 'State Board', certNumber: 'MP-2023-8842', issueDate: '2023-02-28', expirationDate: '2026-02-28', status: 'current' },
    { certName: 'Confined Space', authority: 'OSHA', certNumber: 'CS-2025-1102', issueDate: '2025-01-15', expirationDate: '2026-01-15', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-551093', issueDate: '2024-11-01', expirationDate: '2025-11-01', status: 'current' },
    { certName: 'Backflow Prevention', authority: 'ASSE', certNumber: 'BF-2024-672', issueDate: '2024-06-01', expirationDate: '2026-06-01', status: 'current' },
  ]},
  { name: 'James Wilson', trade: 'Steel', company: 'IronWorks LLC', orientationDate: '2025-09-20', safetyVideoCompleted: true, handbookSigned: false, certs: [
    { certName: 'OSHA 30', authority: 'OSHA', certNumber: 'OSH-30-72910', issueDate: '2022-07-01', expirationDate: '2027-07-01', status: 'current' },
    { certName: 'Welding Cert (AWS D1.1)', authority: 'AWS', certNumber: 'AWS-D11-44523', issueDate: '2024-04-10', expirationDate: '2026-04-10', status: 'expiring' },
    { certName: 'Crane Operator', authority: 'NCCCO', certNumber: 'NCO-2023-8891', issueDate: '2023-03-01', expirationDate: '2026-03-01', status: 'current' },
    { certName: 'Scaffold Competent Person', authority: 'OSHA', certNumber: 'SCP-2024-220', issueDate: '2024-09-15', expirationDate: '2026-09-15', status: 'current' },
  ]},
  { name: 'Rosa Martinez', trade: 'HVAC', company: 'CoolAir Systems', orientationDate: '2025-12-01', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 10', authority: 'OSHA', certNumber: 'OSH-10-98712', issueDate: '2024-10-01', expirationDate: '2029-10-01', status: 'current' },
    { certName: 'EPA 608 Universal', authority: 'EPA', certNumber: 'EPA-608-55123', issueDate: '2023-06-15', expirationDate: '2028-06-15', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-330198', issueDate: '2024-04-20', expirationDate: '2025-04-20', status: 'expired' },
  ]},
  { name: 'Dave O\'Brien', trade: 'Concrete', company: 'Foundation Pro', orientationDate: '2025-11-10', safetyVideoCompleted: false, handbookSigned: true, certs: [
    { certName: 'OSHA 10', authority: 'OSHA', certNumber: 'OSH-10-41298', issueDate: '2025-01-05', expirationDate: '2030-01-05', status: 'current' },
    { certName: 'ACI Flatwork Finisher', authority: 'ACI', certNumber: 'ACI-FF-2024-091', issueDate: '2024-03-01', expirationDate: '2027-03-01', status: 'current' },
    { certName: 'Forklift Operator', authority: 'OSHA', certNumber: 'FO-2024-5530', issueDate: '2024-07-15', expirationDate: '2027-07-15', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-220145', issueDate: '2025-03-10', expirationDate: '2026-05-10', status: 'expiring' },
  ]},
  { name: 'Kenji Nakamura', trade: 'Carpentry', company: 'TimberCraft', orientationDate: '2025-10-28', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 30', authority: 'OSHA', certNumber: 'OSH-30-61234', issueDate: '2023-09-01', expirationDate: '2028-09-01', status: 'current' },
    { certName: 'Scaffold Competent Person', authority: 'OSHA', certNumber: 'SCP-2024-445', issueDate: '2024-05-20', expirationDate: '2026-05-20', status: 'expiring' },
    { certName: 'Fall Protection', authority: 'ANSI', certNumber: 'FP-2024-1893', issueDate: '2024-11-01', expirationDate: '2026-11-01', status: 'current' },
  ]},
  { name: 'Lisa Park', trade: 'Electrical', company: 'Apex Electric', orientationDate: '2025-08-15', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 10', authority: 'OSHA', certNumber: 'OSH-10-78901', issueDate: '2024-02-01', expirationDate: '2029-02-01', status: 'current' },
    { certName: 'Electrical License', authority: 'State Board', certNumber: 'EL-2024-6012', issueDate: '2024-06-15', expirationDate: '2027-06-15', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-881234', issueDate: '2024-01-05', expirationDate: '2025-01-05', status: 'expired' },
    { certName: 'Confined Space', authority: 'OSHA', certNumber: 'CS-2025-3321', issueDate: '2025-02-01', expirationDate: '2026-02-01', status: 'current' },
    { certName: 'Lockout/Tagout', authority: 'OSHA', certNumber: 'LOTO-2024-910', issueDate: '2024-09-10', expirationDate: '2026-09-10', status: 'current' },
  ]},
  { name: 'Carlos Reyes', trade: 'Masonry', company: 'StoneEdge', orientationDate: '2025-11-22', safetyVideoCompleted: true, handbookSigned: true, certs: [
    { certName: 'OSHA 10', authority: 'OSHA', certNumber: 'OSH-10-55412', issueDate: '2024-08-20', expirationDate: '2029-08-20', status: 'current' },
    { certName: 'Scaffold Competent Person', authority: 'OSHA', certNumber: 'SCP-2025-102', issueDate: '2025-01-10', expirationDate: '2027-01-10', status: 'current' },
    { certName: 'First Aid/CPR', authority: 'Red Cross', certNumber: 'RC-773200', issueDate: '2025-02-15', expirationDate: '2026-02-15', status: 'current' },
  ]},
]

// ── Headcount Forecast Demo Data ────────────────────────
const forecastMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
const forecastMonthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
interface ForecastTrade { trade: string; planned: number[]; actual: number[]; needed: number[]; phase: string[] }
const forecastDemoData: ForecastTrade[] = [
  { trade: 'Electrical', planned: [8, 12, 18, 22, 20, 16], actual: [7, 11, 16, 21, 0, 0], needed: [8, 12, 18, 22, 20, 16], phase: ['ramp-up','ramp-up','peak','peak','peak','ramp-down'] },
  { trade: 'Plumbing', planned: [6, 10, 14, 14, 12, 8], actual: [5, 8, 12, 13, 0, 0], needed: [6, 10, 14, 14, 12, 8], phase: ['ramp-up','ramp-up','peak','peak','ramp-down','ramp-down'] },
  { trade: 'HVAC', planned: [2, 4, 8, 12, 14, 14], actual: [2, 4, 7, 10, 0, 0], needed: [2, 4, 8, 12, 14, 14], phase: ['ramp-up','ramp-up','ramp-up','peak','peak','peak'] },
  { trade: 'Concrete', planned: [14, 16, 12, 8, 4, 2], actual: [14, 15, 11, 8, 0, 0], needed: [14, 16, 12, 8, 4, 2], phase: ['peak','peak','ramp-down','ramp-down','ramp-down','ramp-down'] },
  { trade: 'Steel', planned: [10, 14, 16, 14, 10, 6], actual: [9, 12, 14, 12, 0, 0], needed: [10, 14, 16, 14, 10, 6], phase: ['ramp-up','peak','peak','peak','ramp-down','ramp-down'] },
  { trade: 'Carpentry', planned: [4, 6, 10, 14, 16, 14], actual: [4, 6, 9, 13, 0, 0], needed: [4, 6, 10, 14, 16, 14], phase: ['ramp-up','ramp-up','ramp-up','peak','peak','peak'] },
]

// ── Productivity Demo Data ──────────────────────────────
const productivityWeeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
interface ProductivityTrade {
  trade: string; unit: string; benchmark: number
  weeklyData: { unitsPerHour: number; costPerUnit: number; plannedRatio: number }[]
  weatherDelayHrs: number; materialWaitHrs: number; reworkHrs: number
}
const productivityDemoData: ProductivityTrade[] = [
  { trade: 'Electrical', unit: 'outlets', benchmark: 3.2, weeklyData: [
    { unitsPerHour: 2.8, costPerUnit: 42, plannedRatio: 0.88 },{ unitsPerHour: 3.0, costPerUnit: 40, plannedRatio: 0.94 },
    { unitsPerHour: 3.1, costPerUnit: 39, plannedRatio: 0.97 },{ unitsPerHour: 3.3, costPerUnit: 37, plannedRatio: 1.03 },
    { unitsPerHour: 2.9, costPerUnit: 41, plannedRatio: 0.91 },{ unitsPerHour: 3.4, costPerUnit: 36, plannedRatio: 1.06 },
    { unitsPerHour: 3.2, costPerUnit: 38, plannedRatio: 1.00 },{ unitsPerHour: 3.5, costPerUnit: 35, plannedRatio: 1.09 },
  ], weatherDelayHrs: 12, materialWaitHrs: 8, reworkHrs: 6 },
  { trade: 'Plumbing', unit: 'fixtures', benchmark: 2.0, weeklyData: [
    { unitsPerHour: 1.6, costPerUnit: 85, plannedRatio: 0.80 },{ unitsPerHour: 1.8, costPerUnit: 78, plannedRatio: 0.90 },
    { unitsPerHour: 1.9, costPerUnit: 74, plannedRatio: 0.95 },{ unitsPerHour: 2.1, costPerUnit: 68, plannedRatio: 1.05 },
    { unitsPerHour: 2.0, costPerUnit: 72, plannedRatio: 1.00 },{ unitsPerHour: 1.7, costPerUnit: 80, plannedRatio: 0.85 },
    { unitsPerHour: 2.2, costPerUnit: 65, plannedRatio: 1.10 },{ unitsPerHour: 2.3, costPerUnit: 62, plannedRatio: 1.15 },
  ], weatherDelayHrs: 4, materialWaitHrs: 16, reworkHrs: 10 },
  { trade: 'Concrete', unit: 'CY poured', benchmark: 4.5, weeklyData: [
    { unitsPerHour: 3.8, costPerUnit: 155, plannedRatio: 0.84 },{ unitsPerHour: 4.2, costPerUnit: 142, plannedRatio: 0.93 },
    { unitsPerHour: 4.5, costPerUnit: 135, plannedRatio: 1.00 },{ unitsPerHour: 4.0, costPerUnit: 148, plannedRatio: 0.89 },
    { unitsPerHour: 3.5, costPerUnit: 165, plannedRatio: 0.78 },{ unitsPerHour: 4.6, costPerUnit: 132, plannedRatio: 1.02 },
    { unitsPerHour: 4.8, costPerUnit: 128, plannedRatio: 1.07 },{ unitsPerHour: 4.4, costPerUnit: 138, plannedRatio: 0.98 },
  ], weatherDelayHrs: 24, materialWaitHrs: 6, reworkHrs: 14 },
  { trade: 'Steel', unit: 'tons erected', benchmark: 1.8, weeklyData: [
    { unitsPerHour: 1.4, costPerUnit: 320, plannedRatio: 0.78 },{ unitsPerHour: 1.5, costPerUnit: 305, plannedRatio: 0.83 },
    { unitsPerHour: 1.7, costPerUnit: 280, plannedRatio: 0.94 },{ unitsPerHour: 1.8, costPerUnit: 270, plannedRatio: 1.00 },
    { unitsPerHour: 1.9, costPerUnit: 260, plannedRatio: 1.06 },{ unitsPerHour: 1.6, costPerUnit: 295, plannedRatio: 0.89 },
    { unitsPerHour: 2.0, costPerUnit: 250, plannedRatio: 1.11 },{ unitsPerHour: 1.9, costPerUnit: 258, plannedRatio: 1.06 },
  ], weatherDelayHrs: 18, materialWaitHrs: 22, reworkHrs: 4 },
]

// ── Dispatch Demo Data ──────────────────────────────────
interface DispatchEntry {
  id: string; date: string; crewName: string; foreman: string; workers: string[]; location: string; task: string; status: 'assigned' | 'in-progress' | 'completed'
}
interface WorkerAvailability { name: string; status: 'available' | 'assigned' | 'off' | 'injured'; crew?: string }
const dispatchDemoData: DispatchEntry[] = [
  { id: 'd1', date: '2026-04-19', crewName: 'Crew Alpha', foreman: 'Mike Torres', workers: ['Lisa Park', 'Jake Adams', 'Tom Reed'], location: 'Building A - Floor 3', task: 'Electrical rough-in', status: 'in-progress' },
  { id: 'd2', date: '2026-04-19', crewName: 'Crew Bravo', foreman: 'Sarah Chen', workers: ['Carlos Reyes', 'Ana Silva'], location: 'Building B - Basement', task: 'Underground plumbing', status: 'in-progress' },
  { id: 'd3', date: '2026-04-19', crewName: 'Crew Charlie', foreman: 'James Wilson', workers: ['Kenji Nakamura', 'Dave O\'Brien', 'Pete Hall', 'Ray Gomez'], location: 'Building A - Floor 5', task: 'Steel erection', status: 'assigned' },
  { id: 'd4', date: '2026-04-19', crewName: 'Crew Delta', foreman: 'Rosa Martinez', workers: ['Leo Tran', 'Sam West'], location: 'Building C - Roof', task: 'HVAC ductwork install', status: 'assigned' },
  { id: 'd5', date: '2026-04-19', crewName: 'Crew Echo', foreman: 'Dave O\'Brien', workers: ['Mark Young', 'Bill Fox'], location: 'Parking Structure', task: 'Concrete pour - Level 2 deck', status: 'completed' },
]
const workerAvailabilityData: WorkerAvailability[] = [
  { name: 'Mike Torres', status: 'assigned', crew: 'Crew Alpha' },
  { name: 'Lisa Park', status: 'assigned', crew: 'Crew Alpha' },
  { name: 'Jake Adams', status: 'assigned', crew: 'Crew Alpha' },
  { name: 'Sarah Chen', status: 'assigned', crew: 'Crew Bravo' },
  { name: 'Carlos Reyes', status: 'assigned', crew: 'Crew Bravo' },
  { name: 'James Wilson', status: 'assigned', crew: 'Crew Charlie' },
  { name: 'Kenji Nakamura', status: 'assigned', crew: 'Crew Charlie' },
  { name: 'Rosa Martinez', status: 'assigned', crew: 'Crew Delta' },
  { name: 'Dave O\'Brien', status: 'assigned', crew: 'Crew Echo' },
  { name: 'Tom Reed', status: 'assigned', crew: 'Crew Alpha' },
  { name: 'Ana Silva', status: 'assigned', crew: 'Crew Bravo' },
  { name: 'Leo Tran', status: 'assigned', crew: 'Crew Delta' },
  { name: 'Pete Hall', status: 'assigned', crew: 'Crew Charlie' },
  { name: 'Ray Gomez', status: 'assigned', crew: 'Crew Charlie' },
  { name: 'Sam West', status: 'assigned', crew: 'Crew Delta' },
  { name: 'Mark Young', status: 'assigned', crew: 'Crew Echo' },
  { name: 'Bill Fox', status: 'assigned', crew: 'Crew Echo' },
  { name: 'Chris Lang', status: 'available' },
  { name: 'Nina Patel', status: 'available' },
  { name: 'Oscar Ruiz', status: 'off' },
  { name: 'Walt Jenkins', status: 'injured' },
]

// ── Inline modal styles ─────────────────────────────────
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }
const modalBoxStyle: React.CSSProperties = { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing['6'], width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: spacing['3'], fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 2 }

// ── Column helpers ───────────────────────────────────────

const rosterCol = createColumnHelper<WorkforceMemberRow>()
const rosterColumns = [
  rosterCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  rosterCol.accessor('company', {
    header: 'Company',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('trade', {
    header: 'Trade',
    cell: (info) => {
      const v = info.getValue() as string
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        }}>
          {v || ''}
        </span>
      )
    },
  }),
  rosterCol.accessor('role', {
    header: 'Role',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('crew', {
    header: 'Crew',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('hourly_rate', {
    header: 'Hourly Rate',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? `$${v.toFixed(2)}` : ''}</span>
    },
  }),
  rosterCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'active' ? colors.statusActive
        : v === 'inactive' ? colors.textTertiary
        : v === 'on_leave' ? colors.statusPending
        : colors.statusInfo
      const statusBg = v === 'active' ? colors.statusActiveSubtle
        : v === 'inactive' ? colors.surfaceInset
        : v === 'on_leave' ? colors.statusPendingSubtle
        : colors.statusInfoSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
        </span>
      )
    },
  }),
]

const timeCol = createColumnHelper<TimeEntryRow>()
const timeColumns = [
  timeCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  timeCol.accessor('worker_name', {
    header: 'Worker',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  timeCol.accessor('clock_in', {
    header: 'Clock In',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  timeCol.accessor('clock_out', {
    header: 'Clock Out',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  timeCol.accessor('regular_hours', {
    header: 'Regular Hrs',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? v.toFixed(1) : ''}</span>
    },
  }),
  timeCol.accessor('overtime_hours', {
    header: 'OT Hrs',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (!v) return <span style={{ color: colors.textTertiary }}>0.0</span>
      return <span style={{ color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>{v.toFixed(1)}</span>
    },
  }),
  timeCol.accessor('cost_code', {
    header: 'Cost Code',
    cell: (info) => <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{info.getValue()}</span>,
  }),
  timeCol.accessor('approved', {
    header: 'Approved',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <span style={{ color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>&#10003;</span>
        : <span style={{ color: colors.textTertiary }}>&#10005;</span>
    },
  }),
]

// ── Main Component ───────────────────────────────────────

export const Workforce: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('roster')
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: members, isLoading: loadingMembers } = useWorkforceMembers(projectId)
  const { data: timeEntries, isLoading: loadingTime } = useTimeEntries(projectId)

  const [showAddWorker, setShowAddWorker] = useState(false)
  const [showLogTime, setShowLogTime] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const createMember = useCreateWorkforceMember()
  const deleteMember = useDeleteWorkforceMember()
  const createTimeEntry = useCreateTimeEntry()
  const approveEntry = useApproveTimeEntry()

  const totalWorkers = members?.length || 0
  const activeToday = (members as WorkforceMemberRow[] | undefined)?.filter(m => m.status === 'active').length || 0
  const totalRegularHrs = (timeEntries as TimeEntryRow[] | undefined)?.reduce((s, e) => s + (e.regular_hours || 0), 0) || 0
  const totalOTHrs = (timeEntries as TimeEntryRow[] | undefined)?.reduce((s, e) => s + (e.overtime_hours || 0), 0) || 0

  const isLoading = loadingMembers || loadingTime

  // Group members by trade for forecast
  const tradeGroups: Record<string, number> = {}
  ;(members as WorkforceMemberRow[] | undefined)?.forEach(m => {
    const trade = m.trade || 'Unassigned'
    tradeGroups[trade] = (tradeGroups[trade] || 0) + 1
  })

  // Delete columns: add actions column
  const rosterColumnsWithActions = [
    ...rosterColumns,
    rosterCol.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original as WorkforceMemberRow
        return (
          <PermissionGate permission="project.settings">
            <button
              title="Delete worker"
              onClick={() => setConfirmDeleteId(row.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}
            >
              <Trash2 size={14} />
            </button>
          </PermissionGate>
        )
      },
    }),
  ]

  // Time entries columns with approve action
  const timeColumnsWithActions = [
    ...timeColumns,
    timeCol.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original as TimeEntryRow
        if (row.approved) return null
        return (
          <PermissionGate permission="project.settings">
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!projectId || !user?.id) return
                approveEntry.mutate({ id: row.id, project_id: projectId, approved_by: user.id }, {
                  onSuccess: () => toast.success('Time entry approved'),
                  onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to approve'),
                })
              }}
            >
              Approve
            </Btn>
          </PermissionGate>
        )
      },
    }),
  ]

  // ── Delete handler ──────────────────────────────────────
  const handleDelete = () => {
    if (!confirmDeleteId || !projectId) return
    deleteMember.mutate({ id: confirmDeleteId, project_id: projectId }, {
      onSuccess: () => { toast.success('Worker removed'); setConfirmDeleteId(null) },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete'),
    })
  }

  return (
    <PageContainer
      title="Workforce"
      subtitle="Manage your crew roster, track time, and plan labor needs"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <PermissionGate permission="project.settings" fallback={<Btn variant="primary" icon={<Plus size={14} />} disabled>Add Worker</Btn>}>
            <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setShowAddWorker(true)}>Add Worker</Btn>
          </PermissionGate>
          <ExportButton pdfFilename="SiteSync_Workforce_Report" />
        </div>
      }
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: spacing['1'],
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: spacing['1'],
        marginBottom: spacing['2xl'],
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`,
                whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Workers" value={totalWorkers} />
          <MetricBox label="Active Today" value={activeToday} change={activeToday > 0 ? 1 : 0} />
          <MetricBox label="Hours This Week" value={totalRegularHrs.toFixed(0)} />
          <MetricBox label="OT Hours" value={totalOTHrs.toFixed(1)} change={totalOTHrs > 40 ? -1 : 0} changeLabel="overtime" />
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === 'roster' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Crew Roster" />
          {members && members.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={rosterColumnsWithActions} data={members} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No workforce members added yet.
            </p>
          )}
        </Card>
      )}

      {/* Time Tracking Tab */}
      {activeTab === 'time' && !isLoading && (
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHeader title="Time Entries" />
            <PermissionGate permission="project.settings" fallback={<Btn variant="primary" icon={<Clock size={14} />} disabled>Log Time</Btn>}>
              <Btn variant="primary" icon={<Clock size={14} />} onClick={() => setShowLogTime(true)}>Log Time</Btn>
            </PermissionGate>
          </div>
          {timeEntries && timeEntries.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={timeColumnsWithActions} data={timeEntries} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No time entries recorded yet.
            </p>
          )}
        </Card>
      )}

      {/* Credentials Tab */}
      {activeTab === 'credentials' && !isLoading && (() => {
        const allCerts = credentialDemoData.flatMap(w => w.certs)
        const totalCreds = allCerts.length
        const currentCreds = allCerts.filter(c => c.status === 'current').length
        const expiringCreds = allCerts.filter(c => c.status === 'expiring').length
        const expiredCreds = allCerts.filter(c => c.status === 'expired').length
        const currentPct = totalCreds > 0 ? Math.round((currentCreds / totalCreds) * 100) : 0
        const certStatusColor = (s: string) => s === 'expired' ? colors.statusCritical : s === 'expiring' ? colors.statusPending : colors.statusActive
        const certStatusBg = (s: string) => s === 'expired' ? colors.statusCriticalSubtle : s === 'expiring' ? colors.statusPendingSubtle : colors.statusActiveSubtle
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
              <MetricBox label="Workers Tracked" value={credentialDemoData.length} />
              <MetricBox label="Current Credentials" value={`${currentPct}%`} change={1} changeLabel="compliant" />
              <MetricBox label="Expiring Soon" value={expiringCreds} change={expiringCreds > 0 ? -1 : 0} changeLabel="need renewal" />
              <MetricBox label="Expired" value={expiredCreds} change={expiredCreds > 0 ? -1 : 0} changeLabel="action required" />
            </div>
            {credentialDemoData.map((worker) => (
              <Card key={worker.name} padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{worker.name}</h3>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{worker.trade} &middot; {worker.company}</p>
                  </div>
                  <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: spacing['1'], alignItems: 'center', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      <Calendar size={12} /> Orientation: {worker.orientationDate}
                    </div>
                    {worker.safetyVideoCompleted && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, backgroundColor: colors.statusActiveSubtle, color: colors.statusActive }}><CheckCircle2 size={10} /> Video</span>}
                    {worker.handbookSigned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, backgroundColor: colors.statusActiveSubtle, color: colors.statusActive }}><CheckCircle2 size={10} /> Handbook</span>}
                    {!worker.safetyVideoCompleted && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical }}><AlertTriangle size={10} /> Video pending</span>}
                    {!worker.handbookSigned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, backgroundColor: colors.statusPendingSubtle, color: colors.statusPending }}><AlertTriangle size={10} /> Handbook unsigned</span>}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.caption }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                      {['Certification', 'Authority', 'Cert #', 'Issued', 'Expires', 'Status', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: `${spacing['1']} ${spacing['2']}`, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {worker.certs.map((cert, ci) => (
                      <tr key={ci} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: `${spacing['2']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{cert.certName}</td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textSecondary }}>{cert.authority}</td>
                        <td style={{ padding: `${spacing['2']}`, fontFamily: 'monospace', color: colors.textTertiary, fontSize: 11 }}>{cert.certNumber}</td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textSecondary }}>{cert.issueDate}</td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textSecondary }}>{cert.expirationDate}</td>
                        <td style={{ padding: `${spacing['2']}` }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, fontWeight: typography.fontWeight.medium, color: certStatusColor(cert.status), backgroundColor: certStatusBg(cert.status) }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: certStatusColor(cert.status) }} />
                            {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: `${spacing['2']}` }}>
                          {(cert.status === 'expired' || cert.status === 'expiring') && (
                            <button onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser()
                                if (!user) { toast.error('Not authenticated'); return }
                                const { error } = await supabase.from('notifications').insert({
                                  user_id: user.id,
                                  title: `Cert Renewal: ${cert.certName}`,
                                  body: `${cert.certName} for ${cert.member} ${cert.status === 'expired' ? 'has expired' : `expires ${cert.expiryDate}`}. Renewal required.`,
                                  type: 'reminder',
                                  entity_type: 'workforce_certification',
                                  entity_id: cert.id ?? cert.certName,
                                  project_id: projectId ?? null,
                                })
                                if (error) throw error
                                toast.success(`Renewal reminder sent for ${cert.certName}`)
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Failed to send reminder')
                              }
                            }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: `3px 8px`, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', fontSize: 11, fontWeight: 500, backgroundColor: cert.status === 'expired' ? colors.statusCriticalSubtle : colors.statusPendingSubtle, color: cert.status === 'expired' ? colors.statusCritical : colors.statusPending }}>
                              <Send size={10} /> Remind
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </>
        )
      })()}

      {/* Forecast Tab (Enhanced) */}
      {activeTab === 'forecast' && !isLoading && (() => {
        const currentMonthIdx = 3 // April = index 3
        const totalPlanned = forecastDemoData.reduce((s, t) => s + t.planned[currentMonthIdx], 0)
        const totalActual = forecastDemoData.reduce((s, t) => s + t.actual[currentMonthIdx], 0)
        const totalGap = totalPlanned - totalActual
        const maxHeadcount = Math.max(...forecastDemoData.flatMap(t => [...t.planned, ...t.actual, ...t.needed]))
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
              <MetricBox label="Planned (Apr)" value={totalPlanned} />
              <MetricBox label="Actual (Apr)" value={totalActual} change={totalActual >= totalPlanned ? 1 : -1} />
              <MetricBox label="Gap" value={totalGap} change={totalGap > 0 ? -1 : 1} changeLabel="workers short" />
              <MetricBox label="Peak Month" value="May" />
            </div>

            {/* S-Curve Chart */}
            <Card padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
              <SectionHeader title="Headcount S-Curve" />
              <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'], fontSize: typography.fontSize.caption }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 3, backgroundColor: colors.statusInfo, borderRadius: 2 }} /> Planned</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 3, backgroundColor: colors.statusActive, borderRadius: 2 }} /> Actual</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.textTertiary }}>
                  <span style={{ padding: '0 4px', fontSize: 10, borderRadius: 2, backgroundColor: colors.statusPendingSubtle, color: colors.statusPending }}>ramp-up</span>
                  <span style={{ padding: '0 4px', fontSize: 10, borderRadius: 2, backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo }}>peak</span>
                  <span style={{ padding: '0 4px', fontSize: 10, borderRadius: 2, backgroundColor: colors.surfaceInset, color: colors.textTertiary }}>ramp-down</span>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.caption }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                      <th style={{ textAlign: 'left', padding: `${spacing['1']} ${spacing['2']}`, color: colors.textTertiary, fontWeight: typography.fontWeight.medium, width: 100 }}>Trade</th>
                      {forecastMonthLabels.map((m, i) => (
                        <th key={m} style={{ textAlign: 'center', padding: `${spacing['1']} ${spacing['2']}`, color: i === currentMonthIdx ? colors.orangeText : colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forecastDemoData.map((t) => (
                      <tr key={t.trade} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: `${spacing['2']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{t.trade}</td>
                        {forecastMonthLabels.map((_, i) => {
                          const planned = t.planned[i]; const actual = t.actual[i]; const gap = planned - actual
                          const phase = t.phase[i]
                          const phaseBg = phase === 'peak' ? colors.statusInfoSubtle : phase === 'ramp-up' ? colors.statusPendingSubtle : colors.surfaceInset
                          const isFuture = actual === 0 && i > currentMonthIdx - 1
                          const isUnder = !isFuture && gap > 2
                          return (
                            <td key={i} style={{ padding: `${spacing['1']} ${spacing['2']}`, textAlign: 'center', backgroundColor: isUnder ? colors.statusCriticalSubtle : phaseBg }}>
                              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{planned}</div>
                              {!isFuture && <div style={{ fontSize: 10, color: isUnder ? colors.statusCritical : colors.statusActive }}>{actual} actual{gap > 0 ? ` (-${gap})` : ''}</div>}
                              {isFuture && <div style={{ fontSize: 10, color: colors.textTertiary }}>projected</div>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${colors.borderDefault}` }}>
                      <td style={{ padding: `${spacing['2']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Total</td>
                      {forecastMonthLabels.map((_, i) => {
                        const p = forecastDemoData.reduce((s, t) => s + t.planned[i], 0)
                        const a = forecastDemoData.reduce((s, t) => s + t.actual[i], 0)
                        const isFuture = a === 0 && i > currentMonthIdx - 1
                        return (
                          <td key={i} style={{ padding: `${spacing['1']} ${spacing['2']}`, textAlign: 'center', fontWeight: typography.fontWeight.semibold }}>
                            <div style={{ color: colors.textPrimary }}>{p}</div>
                            {!isFuture && <div style={{ fontSize: 10, color: a < p ? colors.statusCritical : colors.statusActive }}>{a}</div>}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Visual bar chart */}
              <div style={{ marginTop: spacing['4'], display: 'flex', alignItems: 'flex-end', gap: spacing['2'], height: 120 }}>
                {forecastMonthLabels.map((m, i) => {
                  const p = forecastDemoData.reduce((s, t) => s + t.planned[i], 0)
                  const a = forecastDemoData.reduce((s, t) => s + t.actual[i], 0)
                  const maxTotal = forecastDemoData.reduce((s, t) => s + Math.max(...t.planned), 0)
                  const hP = (p / maxTotal) * 100
                  const hA = (a / maxTotal) * 100
                  const isFuture = a === 0 && i > currentMonthIdx - 1
                  return (
                    <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100, width: '100%', justifyContent: 'center' }}>
                        <div style={{ width: '35%', height: `${hP}%`, backgroundColor: colors.statusInfo, borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`, opacity: 0.7 }} title={`Planned: ${p}`} />
                        {!isFuture && <div style={{ width: '35%', height: `${hA}%`, backgroundColor: colors.statusActive, borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0` }} title={`Actual: ${a}`} />}
                      </div>
                      <span style={{ fontSize: 10, color: i === currentMonthIdx ? colors.orangeText : colors.textTertiary, fontWeight: i === currentMonthIdx ? 600 : 400 }}>{m}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Gap Analysis */}
            <Card padding={spacing['4']}>
              <SectionHeader title="Gap Analysis - Undermanned Trades (Current Month)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: spacing['3'], marginTop: spacing['3'] }}>
                {forecastDemoData.filter(t => t.actual[currentMonthIdx] > 0 && t.planned[currentMonthIdx] - t.actual[currentMonthIdx] > 0).map(t => {
                  const gap = t.planned[currentMonthIdx] - t.actual[currentMonthIdx]
                  const severity = gap >= 3 ? 'critical' : gap >= 2 ? 'warning' : 'minor'
                  return (
                    <div key={t.trade} style={{ padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: severity === 'critical' ? colors.statusCriticalSubtle : severity === 'warning' ? colors.statusPendingSubtle : colors.surfaceInset, border: `1px solid ${severity === 'critical' ? colors.statusCritical : severity === 'warning' ? colors.statusPending : colors.borderSubtle}` }}>
                      <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: 2 }}>{t.trade}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: severity === 'critical' ? colors.statusCritical : severity === 'warning' ? colors.statusPending : colors.textTertiary }}>
                        Short {gap} worker{gap > 1 ? 's' : ''} &middot; {t.actual[currentMonthIdx]}/{t.planned[currentMonthIdx]} filled
                      </div>
                    </div>
                  )
                })}
                {forecastDemoData.filter(t => t.actual[currentMonthIdx] > 0 && t.planned[currentMonthIdx] - t.actual[currentMonthIdx] <= 0).length === forecastDemoData.filter(t => t.actual[currentMonthIdx] > 0).length && (
                  <div style={{ padding: spacing['3'], color: colors.statusActive, fontSize: typography.fontSize.caption }}>All trades fully staffed this month.</div>
                )}
              </div>
            </Card>
          </>
        )
      })()}

      {/* Productivity Tab */}
      {activeTab === 'productivity' && !isLoading && (() => {
        const avgRatios = productivityDemoData.map(t => {
          const avg = t.weeklyData.reduce((s, w) => s + w.plannedRatio, 0) / t.weeklyData.length
          return { trade: t.trade, avg }
        })
        const bestPerformer = [...avgRatios].sort((a, b) => b.avg - a.avg)[0]
        const worstPerformer = [...avgRatios].sort((a, b) => a.avg - b.avg)[0]
        const overallAvg = avgRatios.reduce((s, r) => s + r.avg, 0) / avgRatios.length
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
              <MetricBox label="Overall Productivity" value={`${(overallAvg * 100).toFixed(0)}%`} change={overallAvg >= 1 ? 1 : -1} changeLabel="of plan" />
              <MetricBox label="Top Performer" value={bestPerformer.trade} />
              <MetricBox label="Needs Attention" value={worstPerformer.trade} change={-1} />
              <MetricBox label="Total Rework Hours" value={productivityDemoData.reduce((s, t) => s + t.reworkHrs, 0)} change={-1} changeLabel="hrs" />
            </div>

            {/* Per-trade productivity */}
            {productivityDemoData.map((t) => {
              const avgProd = t.weeklyData.reduce((s, w) => s + w.unitsPerHour, 0) / t.weeklyData.length
              const latest = t.weeklyData[t.weeklyData.length - 1]
              const maxUnits = Math.max(t.benchmark * 1.3, ...t.weeklyData.map(w => w.unitsPerHour))
              return (
                <Card key={t.trade} padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{t.trade}</h3>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{t.unit} per man-hour &middot; Benchmark: {t.benchmark}</p>
                    </div>
                    <div style={{ display: 'flex', gap: spacing['3'], fontSize: typography.fontSize.caption }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: colors.textTertiary }}>Avg</div>
                        <div style={{ fontWeight: typography.fontWeight.semibold, color: avgProd >= t.benchmark ? colors.statusActive : colors.statusPending }}>{avgProd.toFixed(1)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: colors.textTertiary }}>Latest</div>
                        <div style={{ fontWeight: typography.fontWeight.semibold, color: latest.unitsPerHour >= t.benchmark ? colors.statusActive : colors.statusCritical }}>{latest.unitsPerHour.toFixed(1)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: colors.textTertiary }}>Cost/Unit</div>
                        <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>${latest.costPerUnit}</div>
                      </div>
                    </div>
                  </div>
                  {/* Sparkline-style weekly bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginBottom: spacing['2'] }}>
                    {t.weeklyData.map((w, wi) => {
                      const h = (w.unitsPerHour / maxUnits) * 100
                      const benchH = (t.benchmark / maxUnits) * 100
                      const above = w.unitsPerHour >= t.benchmark
                      return (
                        <div key={wi} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <div style={{ width: '70%', height: `${h}%`, backgroundColor: above ? colors.statusActive : colors.statusPending, borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`, opacity: 0.8 }} title={`${productivityWeeks[wi]}: ${w.unitsPerHour} ${t.unit}/hr`} />
                          {wi === 0 && <div style={{ position: 'absolute', bottom: `${benchH}%`, left: 0, right: 0, borderTop: `1px dashed ${colors.statusInfo}`, pointerEvents: 'none' }} />}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textTertiary, marginBottom: spacing['3'] }}>
                    {productivityWeeks.map(w => <span key={w}>{w}</span>)}
                  </div>
                  {/* Productivity factors */}
                  <div style={{ display: 'flex', gap: spacing['4'], fontSize: typography.fontSize.caption, color: colors.textTertiary, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['2'] }}>
                    <span>Weather delays: <strong style={{ color: t.weatherDelayHrs > 15 ? colors.statusCritical : colors.textSecondary }}>{t.weatherDelayHrs}h</strong></span>
                    <span>Material wait: <strong style={{ color: t.materialWaitHrs > 15 ? colors.statusCritical : colors.textSecondary }}>{t.materialWaitHrs}h</strong></span>
                    <span>Rework: <strong style={{ color: t.reworkHrs > 10 ? colors.statusCritical : colors.textSecondary }}>{t.reworkHrs}h</strong></span>
                  </div>
                </Card>
              )
            })}

            {/* Benchmark comparison */}
            <Card padding={spacing['4']}>
              <SectionHeader title="Benchmark Comparison: Project vs Industry" />
              <div style={{ marginTop: spacing['3'] }}>
                {productivityDemoData.map((t) => {
                  const avgProd = t.weeklyData.reduce((s, w) => s + w.unitsPerHour, 0) / t.weeklyData.length
                  const ratio = avgProd / t.benchmark
                  const barW = Math.min(ratio * 100, 130)
                  return (
                    <div key={t.trade} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['2'] }}>
                      <span style={{ width: 80, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{t.trade}</span>
                      <div style={{ flex: 1, position: 'relative', height: 20, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barW}%`, backgroundColor: ratio >= 1 ? colors.statusActive : ratio >= 0.9 ? colors.statusPending : colors.statusCritical, borderRadius: borderRadius.base, transition: `width ${transitions.normal}` }} />
                        <div style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, width: 1, backgroundColor: colors.statusInfo, marginLeft: -1 }} title="Benchmark" />
                      </div>
                      <span style={{ width: 50, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: ratio >= 1 ? colors.statusActive : colors.statusCritical, textAlign: 'right' }}>{(ratio * 100).toFixed(0)}%</span>
                    </div>
                  )
                })}
                <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: spacing['2'] }}>Line = industry benchmark (100%). Green = meeting/exceeding, amber = within 10%, red = below 90%.</div>
              </div>
            </Card>
          </>
        )
      })()}

      {/* Dispatch Tab */}
      {activeTab === 'dispatch' && !isLoading && (() => {
        const assigned = workerAvailabilityData.filter(w => w.status === 'assigned').length
        const available = workerAvailabilityData.filter(w => w.status === 'available').length
        const off = workerAvailabilityData.filter(w => w.status === 'off').length
        const injured = workerAvailabilityData.filter(w => w.status === 'injured').length
        const availStatusColor = (s: string) => s === 'assigned' ? colors.statusInfo : s === 'available' ? colors.statusActive : s === 'off' ? colors.textTertiary : colors.statusCritical
        const availStatusBg = (s: string) => s === 'assigned' ? colors.statusInfoSubtle : s === 'available' ? colors.statusActiveSubtle : s === 'off' ? colors.surfaceInset : colors.statusCriticalSubtle
        const dispatchStatusColor = (s: string) => s === 'completed' ? colors.statusActive : s === 'in-progress' ? colors.statusInfo : colors.statusPending
        const dispatchStatusBg = (s: string) => s === 'completed' ? colors.statusActiveSubtle : s === 'in-progress' ? colors.statusInfoSubtle : colors.statusPendingSubtle
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
              <MetricBox label="Crews Today" value={dispatchDemoData.length} />
              <MetricBox label="Workers Assigned" value={assigned} />
              <MetricBox label="Available" value={available} change={available > 0 ? 1 : 0} />
              <MetricBox label="Off / Injured" value={off + injured} change={injured > 0 ? -1 : 0} />
            </div>

            {/* Dispatch Board */}
            <Card padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
              <SectionHeader title="Daily Crew Dispatch Board - April 19, 2026" />
              <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.caption }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                      {['Crew', 'Foreman', 'Workers', 'Location / Zone', 'Task', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: `${spacing['1']} ${spacing['2']}`, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchDemoData.map((d) => (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}`, cursor: 'grab' }} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)}>
                        <td style={{ padding: `${spacing['2']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{d.crewName}</td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textSecondary }}>{d.foreman}</td>
                        <td style={{ padding: `${spacing['2']}` }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {d.workers.map(w => (
                              <span key={w} style={{ display: 'inline-block', padding: `1px 6px`, borderRadius: borderRadius.full, fontSize: 10, backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo }}>{w}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textSecondary }}>{d.location}</td>
                        <td style={{ padding: `${spacing['2']}`, color: colors.textPrimary }}>{d.task}</td>
                        <td style={{ padding: `${spacing['2']}` }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: 11, fontWeight: typography.fontWeight.medium, color: dispatchStatusColor(d.status), backgroundColor: dispatchStatusBg(d.status) }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: dispatchStatusColor(d.status) }} />
                            {d.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Worker Availability */}
            <Card padding={spacing['4']}>
              <SectionHeader title="Worker Availability" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['3'] }}>
                {workerAvailabilityData.map((w) => (
                  <div key={w.name} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base, border: `1px solid ${colors.borderSubtle}`, backgroundColor: availStatusBg(w.status), fontSize: typography.fontSize.caption }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: availStatusColor(w.status) }} />
                    <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{w.name}</span>
                    <span style={{ color: availStatusColor(w.status), fontSize: 10 }}>{w.status}{w.crew ? ` (${w.crew})` : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: spacing['3'], fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', gap: spacing['4'] }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusActive }} /> Available ({available})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusInfo }} /> Assigned ({assigned})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.textTertiary }} /> Off ({off})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusCritical }} /> Injured ({injured})</span>
              </div>
              {(available === 0 && injured > 0) && (
                <div style={{ marginTop: spacing['3'], padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.statusPendingSubtle, border: `1px solid ${colors.statusPending}`, fontSize: typography.fontSize.caption, color: colors.statusPending, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <AlertTriangle size={14} /> Coverage gap: {injured} worker(s) injured with limited available pool. Consider requesting additional labor.
                </div>
              )}
            </Card>
          </>
        )
      })()}

      {/* ── Add Worker Modal ──────────────────────────────── */}
      {showAddWorker && <AddWorkerModal projectId={projectId!} onClose={() => setShowAddWorker(false)} onCreate={createMember} />}

      {/* ── Log Time Modal ────────────────────────────────── */}
      {showLogTime && <LogTimeModal projectId={projectId!} members={members ?? []} onClose={() => setShowLogTime(false)} onCreate={createTimeEntry} />}

      {/* ── Delete Confirmation ───────────────────────────── */}
      {confirmDeleteId && (
        <div role="dialog" aria-modal="true" style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null) }}>
          <div style={{ ...modalBoxStyle, maxWidth: 400 }}>
            <h2 style={{ margin: 0, marginBottom: spacing['3'], fontSize: 18 }}>Delete Worker</h2>
            <p style={{ margin: 0, marginBottom: spacing['4'], color: colors.textSecondary, fontSize: 14 }}>
              Are you sure you want to remove this worker? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleDelete} disabled={deleteMember.isPending}>
                {deleteMember.isPending ? 'Deleting...' : 'Delete'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

// ── Add Worker Modal ─────────────────────────────────────

interface AddWorkerModalProps {
  projectId: string
  onClose: () => void
  onCreate: ReturnType<typeof useCreateWorkforceMember>
}

const AddWorkerModal: React.FC<AddWorkerModalProps> = ({ projectId, onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    trade: '',
    role: '',
    hourly_rate: '',
    overtime_rate: '',
    hire_date: '',
    status: 'active',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })
  const [err, setErr] = useState<string | null>(null)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const submit = () => {
    if (!form.name.trim()) { setErr('Name is required'); return }
    setErr(null)
    const payload: Record<string, unknown> = {
      project_id: projectId,
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      trade: form.trade || null,
      role: form.role || null,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      overtime_rate: form.overtime_rate ? parseFloat(form.overtime_rate) : null,
      hire_date: form.hire_date || null,
      status: form.status,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    }
    onCreate.mutate(payload, {
      onSuccess: () => { toast.success('Worker added'); onClose() },
      onError: (e) => { setErr(e instanceof Error ? e.message : 'Failed to create worker') },
    })
  }

  return (
    <div role="dialog" aria-modal="true" style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: 18 }}>Add Worker</h2>

        <label style={labelStyle}>Name *</label>
        <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Full name" />

        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="worker@example.com" />

        <label style={labelStyle}>Phone</label>
        <input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" />

        <label style={labelStyle}>Company</label>
        <input style={inputStyle} value={form.company} onChange={set('company')} />

        <label style={labelStyle}>Trade</label>
        <select style={inputStyle} value={form.trade} onChange={set('trade')}>
          <option value="">Select trade...</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label style={labelStyle}>Role</label>
        <input style={inputStyle} value={form.role} onChange={set('role')} placeholder="Foreman, Journeyman, etc." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <div>
            <label style={labelStyle}>Hourly Rate</label>
            <input style={inputStyle} type="number" step="0.01" min="0" value={form.hourly_rate} onChange={set('hourly_rate')} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Overtime Rate</label>
            <input style={inputStyle} type="number" step="0.01" min="0" value={form.overtime_rate} onChange={set('overtime_rate')} placeholder="0.00" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
          <div>
            <label style={labelStyle}>Hire Date</label>
            <input style={inputStyle} type="date" value={form.hire_date} onChange={set('hire_date')} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
        </div>

        <label style={labelStyle}>Emergency Contact Name</label>
        <input style={inputStyle} value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />

        <label style={labelStyle}>Emergency Contact Phone</label>
        <input style={inputStyle} value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />

        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12, marginBottom: spacing['2'] }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: spacing['3'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={onCreate.isPending}>
            {onCreate.isPending ? 'Saving...' : 'Add Worker'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Log Time Modal ───────────────────────────────────────

interface LogTimeModalProps {
  projectId: string
  members: any[]
  onClose: () => void
  onCreate: ReturnType<typeof useCreateTimeEntry>
}

const LogTimeModal: React.FC<LogTimeModalProps> = ({ projectId, members, onClose, onCreate }) => {
  const [form, setForm] = useState({
    workforce_member_id: '',
    date: new Date().toISOString().slice(0, 10),
    regular_hours: '',
    overtime_hours: '',
    double_time_hours: '',
    cost_code: '',
    task_description: '',
    break_minutes: '',
  })
  const [err, setErr] = useState<string | null>(null)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const submit = () => {
    if (!form.workforce_member_id) { setErr('Select a worker'); return }
    if (!form.date) { setErr('Date is required'); return }
    setErr(null)
    const payload: Record<string, unknown> = {
      project_id: projectId,
      workforce_member_id: form.workforce_member_id,
      date: form.date,
      regular_hours: form.regular_hours ? parseFloat(form.regular_hours) : 0,
      overtime_hours: form.overtime_hours ? parseFloat(form.overtime_hours) : 0,
      double_time_hours: form.double_time_hours ? parseFloat(form.double_time_hours) : 0,
      cost_code: form.cost_code || null,
      task_description: form.task_description || null,
      break_minutes: form.break_minutes ? parseInt(form.break_minutes, 10) : 0,
    }
    onCreate.mutate(payload, {
      onSuccess: () => { toast.success('Time entry logged'); onClose() },
      onError: (e) => { setErr(e instanceof Error ? e.message : 'Failed to log time') },
    })
  }

  return (
    <div role="dialog" aria-modal="true" style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: 0, marginBottom: spacing['4'], fontSize: 18 }}>Log Time</h2>

        <label style={labelStyle}>Worker *</label>
        <select style={inputStyle} value={form.workforce_member_id} onChange={set('workforce_member_id')}>
          <option value="">Select worker...</option>
          {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <label style={labelStyle}>Date *</label>
        <input style={inputStyle} type="date" value={form.date} onChange={set('date')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
          <div>
            <label style={labelStyle}>Regular Hours</label>
            <input style={inputStyle} type="number" step="0.5" min="0" value={form.regular_hours} onChange={set('regular_hours')} placeholder="8" />
          </div>
          <div>
            <label style={labelStyle}>OT Hours</label>
            <input style={inputStyle} type="number" step="0.5" min="0" value={form.overtime_hours} onChange={set('overtime_hours')} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Double Time</label>
            <input style={inputStyle} type="number" step="0.5" min="0" value={form.double_time_hours} onChange={set('double_time_hours')} placeholder="0" />
          </div>
        </div>

        <label style={labelStyle}>Break Minutes</label>
        <input style={inputStyle} type="number" min="0" value={form.break_minutes} onChange={set('break_minutes')} placeholder="30" />

        <label style={labelStyle}>Cost Code</label>
        <input style={inputStyle} value={form.cost_code} onChange={set('cost_code')} placeholder="e.g. 03-100" />

        <label style={labelStyle}>Task Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.task_description}
          onChange={set('task_description')}
          placeholder="Describe the work performed"
        />

        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12, marginBottom: spacing['2'] }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: spacing['3'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={onCreate.isPending}>
            {onCreate.isPending ? 'Saving...' : 'Log Time'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export default Workforce
