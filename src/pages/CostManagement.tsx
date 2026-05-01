import React, { useMemo, useState } from 'react'
import { DollarSign, Plus, Sparkles, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, FileText, BarChart3, Layers } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  useCostCodes,
  useCreateCostCode,
  useCostTransactions,
  useCreateCostTransaction,
  type CostCode,
} from '../hooks/queries/enterprise-capabilities'

const CSI_DIVISIONS: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood & Plastics',
  '07': 'Thermal & Moisture',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function variancePct(budget: number, actual: number): number {
  if (budget === 0) return 0
  return ((actual - budget) / budget) * 100
}

function varianceColor(budget: number, actual: number): string {
  const pct = variancePct(budget, actual)
  if (pct > 10) return colors.statusCritical
  if (pct > 0) return colors.statusPending
  return colors.statusActive
}

/** Variance indicator dot */
function VarianceDot({ budget, actual }: { budget: number; actual: number }) {
  const color = varianceColor(budget, actual)
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: spacing['2'],
        flexShrink: 0,
      }}
    />
  )
}

interface CostForecast {
  code: string
  description: string
  budget: number
  actuals: number
  performanceFactor: number
  eac: number
  etc: number
  vac: number
}

// -- Committed Cost Demo Data --
interface CommittedCostEntry {
  costCode: string; description: string; type: 'Subcontract' | 'PO' | 'Change Order';
  ref: string; contractor: string; value: number; originalBudget: number;
  committed: number; actualToDate: number; forecast: number;
}
const COMMITTED_COST_DATA: CommittedCostEntry[] = [
  { costCode: '03-3100', description: 'Structural Concrete', type: 'Subcontract', ref: 'SUB-001', contractor: 'Apex Concrete LLC', value: 245000000, originalBudget: 260000000, committed: 245000000, actualToDate: 182000000, forecast: 252000000 },
  { costCode: '03-3100', description: 'Structural Concrete', type: 'Change Order', ref: 'CO-004', contractor: 'Apex Concrete LLC', value: 12500000, originalBudget: 260000000, committed: 257500000, actualToDate: 182000000, forecast: 264000000 },
  { costCode: '05-1200', description: 'Structural Steel', type: 'Subcontract', ref: 'SUB-003', contractor: 'Ironworks Fabrication Inc', value: 380000000, originalBudget: 400000000, committed: 380000000, actualToDate: 295000000, forecast: 385000000 },
  { costCode: '05-1200', description: 'Structural Steel', type: 'PO', ref: 'PO-0187', contractor: 'Steel Supply Co', value: 18500000, originalBudget: 400000000, committed: 398500000, actualToDate: 295000000, forecast: 403000000 },
  { costCode: '07-2100', description: 'Building Insulation', type: 'PO', ref: 'PO-0203', contractor: 'ThermalGuard Materials', value: 42000000, originalBudget: 55000000, committed: 42000000, actualToDate: 28000000, forecast: 44000000 },
  { costCode: '09-2900', description: 'Gypsum Board', type: 'Subcontract', ref: 'SUB-007', contractor: 'Interior Systems Group', value: 89000000, originalBudget: 95000000, committed: 89000000, actualToDate: 67000000, forecast: 91000000 },
  { costCode: '22-1100', description: 'Plumbing Rough-In', type: 'Subcontract', ref: 'SUB-009', contractor: 'Metro Plumbing Contractors', value: 175000000, originalBudget: 165000000, committed: 175000000, actualToDate: 142000000, forecast: 180000000 },
  { costCode: '22-1100', description: 'Plumbing Rough-In', type: 'Change Order', ref: 'CO-011', contractor: 'Metro Plumbing Contractors', value: 8200000, originalBudget: 165000000, committed: 183200000, actualToDate: 142000000, forecast: 188000000 },
  { costCode: '23-0500', description: 'HVAC Equipment', type: 'PO', ref: 'PO-0245', contractor: 'ClimatePro HVAC Supply', value: 210000000, originalBudget: 220000000, committed: 210000000, actualToDate: 156000000, forecast: 215000000 },
  { costCode: '26-0500', description: 'Electrical Wiring', type: 'Subcontract', ref: 'SUB-012', contractor: 'Volt Electrical Services', value: 198000000, originalBudget: 205000000, committed: 198000000, actualToDate: 147000000, forecast: 201000000 },
]

// Aggregate committed costs per cost code
interface CommittedCodeSummary {
  costCode: string; description: string; originalBudget: number; committed: number;
  actualToDate: number; forecast: number; variance: number; uncommitted: number;
  items: CommittedCostEntry[];
}
function aggregateCommittedCosts(): CommittedCodeSummary[] {
  const map = new Map<string, CommittedCodeSummary>()
  COMMITTED_COST_DATA.forEach(e => {
    if (!map.has(e.costCode)) {
      map.set(e.costCode, { costCode: e.costCode, description: e.description, originalBudget: e.originalBudget, committed: 0, actualToDate: e.actualToDate, forecast: e.forecast, variance: 0, uncommitted: 0, items: [] })
    }
    const s = map.get(e.costCode)!
    s.committed += e.value
    s.items.push(e)
  })
  map.forEach(s => { s.uncommitted = s.originalBudget - s.committed; s.variance = s.originalBudget - s.forecast })
  return Array.from(map.values()).sort((a, b) => a.costCode.localeCompare(b.costCode))
}

function committedColor(uncommitted: number, budget: number): string {
  const ratio = uncommitted / Math.max(budget, 1)
  if (ratio < 0) return colors.statusCritical      // over-committed
  if (ratio < 0.05) return colors.statusPending     // near-committed
  return colors.statusActive                         // under-committed
}

// -- Earned Value Demo Data --
interface EVCostCode {
  costCode: string; description: string; bcws: number; bcwp: number; acwp: number;
  cpiHistory: number[]; spiHistory: number[];
}
const EV_DATA: EVCostCode[] = [
  { costCode: '03-3100', description: 'Structural Concrete', bcws: 220000000, bcwp: 210000000, acwp: 225000000, cpiHistory: [1.02, 0.98, 0.95, 0.94, 0.93, 0.93], spiHistory: [1.0, 0.99, 0.97, 0.96, 0.95, 0.95] },
  { costCode: '05-1200', description: 'Structural Steel', bcws: 340000000, bcwp: 320000000, acwp: 295000000, cpiHistory: [1.05, 1.06, 1.07, 1.08, 1.08, 1.08], spiHistory: [0.98, 0.96, 0.95, 0.94, 0.94, 0.94] },
  { costCode: '07-2100', description: 'Building Insulation', bcws: 40000000, bcwp: 35000000, acwp: 28000000, cpiHistory: [1.1, 1.12, 1.15, 1.18, 1.2, 1.25], spiHistory: [0.92, 0.90, 0.88, 0.87, 0.875, 0.875] },
  { costCode: '09-2900', description: 'Gypsum Board', bcws: 72000000, bcwp: 70000000, acwp: 67000000, cpiHistory: [1.0, 1.01, 1.02, 1.03, 1.04, 1.04], spiHistory: [1.0, 1.0, 0.99, 0.98, 0.97, 0.97] },
  { costCode: '22-1100', description: 'Plumbing Rough-In', bcws: 140000000, bcwp: 125000000, acwp: 142000000, cpiHistory: [0.96, 0.94, 0.92, 0.90, 0.89, 0.88], spiHistory: [0.95, 0.93, 0.91, 0.90, 0.89, 0.89] },
  { costCode: '23-0500', description: 'HVAC Equipment', bcws: 180000000, bcwp: 165000000, acwp: 156000000, cpiHistory: [1.02, 1.03, 1.04, 1.05, 1.06, 1.06], spiHistory: [0.94, 0.93, 0.92, 0.92, 0.917, 0.917] },
  { costCode: '26-0500', description: 'Electrical Wiring', bcws: 170000000, bcwp: 155000000, acwp: 147000000, cpiHistory: [1.0, 1.01, 1.02, 1.03, 1.04, 1.05], spiHistory: [0.96, 0.95, 0.93, 0.92, 0.91, 0.91] },
  { costCode: '31-2300', description: 'Excavation', bcws: 95000000, bcwp: 95000000, acwp: 88000000, cpiHistory: [1.04, 1.05, 1.06, 1.07, 1.08, 1.08], spiHistory: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
]

function evColor(val: number): string {
  if (val < 0.9) return colors.statusCritical
  if (val <= 1.0) return colors.statusPending
  return colors.statusActive
}

/** Tiny inline sparkline */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data) - 0.05
  const max = Math.max(...data) + 0.05
  const range = max - min || 1
  const w = 60; const h = 20
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

// -- Scenario Modeling Data --
interface ScenarioParams { laborFactor: number; materialEsc: number; contingencyDraw: number }
interface Scenario { name: string; params: ScenarioParams; totalCost: number }
const BASE_COST = 1_580_000_00 * 100 // $15.8M in cents
const LABOR_SHARE = 0.45; const MATERIAL_SHARE = 0.35; const CONTINGENCY_POOL = 0.10
function calcScenarioCost(p: ScenarioParams): number {
  const labor = BASE_COST * LABOR_SHARE * p.laborFactor
  const material = BASE_COST * MATERIAL_SHARE * (1 + p.materialEsc / 100)
  const contingency = BASE_COST * CONTINGENCY_POOL * (p.contingencyDraw / 100)
  const other = BASE_COST * (1 - LABOR_SHARE - MATERIAL_SHARE - CONTINGENCY_POOL)
  return Math.round(labor + material + contingency + other)
}
const SCENARIOS: Scenario[] = [
  { name: 'Optimistic', params: { laborFactor: 0.92, materialEsc: 2.0, contingencyDraw: 40 }, totalCost: 0 },
  { name: 'Most Likely', params: { laborFactor: 1.0, materialEsc: 4.5, contingencyDraw: 65 }, totalCost: 0 },
  { name: 'Pessimistic', params: { laborFactor: 1.12, materialEsc: 8.0, contingencyDraw: 90 }, totalCost: 0 },
].map(s => ({ ...s, totalCost: calcScenarioCost(s.params) }))

type CostTab = 'overview' | 'committed' | 'earnedValue' | 'scenarios'

const CostManagement: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: codes, isLoading } = useCostCodes(projectId ?? undefined)
  const createCode = useCreateCostCode()
  const createTxn = useCreateCostTransaction()

  const [activeTab, setActiveTab] = useState<CostTab>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<CostCode | null>(null)
  const [txnModalOpen, setTxnModalOpen] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(false)
  const { data: txns } = useCostTransactions(projectId ?? undefined, selectedCode?.id)
  const { data: allTxns } = useCostTransactions(projectId ?? undefined)

  const [form, setForm] = useState({ code: '', description: '', budgeted_amount: '' })
  const [txnForm, setTxnForm] = useState<{
    type: 'committed' | 'actual' | 'forecast'
    amount: string
    description: string
    vendor: string
  }>({ type: 'actual', amount: '', description: '', vendor: '' })

  const grouped = useMemo(() => {
    const map = new Map<string, CostCode[]>()
    ;(codes ?? []).forEach((c) => {
      const div = (c.code || '').split('-')[0] || '00'
      if (!map.has(div)) map.set(div, [])
      map.get(div)!.push(c)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [codes])

  const totals = useMemo(() => {
    const list = codes ?? []
    return list.reduce(
      (acc, c) => ({
        budgeted: acc.budgeted + (c.budgeted_amount || 0),
        committed: acc.committed + (c.committed_amount || 0),
        actual: acc.actual + (c.actual_amount || 0),
        forecast: acc.forecast + (c.forecast_amount || 0),
      }),
      { budgeted: 0, committed: 0, actual: 0, forecast: 0 }
    )
  }, [codes])

  const overBudgetCount = useMemo(
    () => (codes ?? []).filter((c) => c.actual_amount > c.budgeted_amount && c.budgeted_amount > 0).length,
    [codes]
  )

  // Forecast computation: EAC, ETC, VAC per cost code
  const forecasts = useMemo<CostForecast[]>(() => {
    const list = codes ?? []
    if (list.length === 0) return []

    return list
      .filter((c) => c.budgeted_amount > 0)
      .map((c) => {
        const budget = c.budgeted_amount
        const actuals = c.actual_amount
        // Performance factor: how efficiently are we spending? 1.0 = on track
        // If we've spent nothing yet, assume 1.0. Otherwise, use ratio of budget progress vs actual spend.
        const budgetProgress = budget > 0 ? Math.min(actuals / budget, 1) : 0
        const performanceFactor = budgetProgress > 0 ? Math.min(budgetProgress / Math.max(budgetProgress, 0.01), 1.5) : 1.0
        // EAC = actuals + (budget - actuals) * performance factor
        const _eac = actuals + (budget - actuals) * (actuals > 0 ? (actuals / Math.max(c.committed_amount || actuals, 1)) : 1)
        // Simplified: if committed > actual, we're likely to spend more
        const adjustedEac = c.committed_amount > actuals
          ? actuals + (c.committed_amount - actuals) + ((budget - c.committed_amount) * (actuals > 0 ? actuals / c.committed_amount : 1))
          : actuals + (budget - actuals) * performanceFactor
        const etc = adjustedEac - actuals
        const vac = budget - adjustedEac

        return {
          code: c.code,
          description: c.description,
          budget,
          actuals,
          performanceFactor,
          eac: Math.round(adjustedEac),
          etc: Math.round(etc),
          vac: Math.round(vac),
        }
      })
  }, [codes])

  const forecastTotals = useMemo(() => {
    return forecasts.reduce(
      (acc, f) => ({
        budget: acc.budget + f.budget,
        actuals: acc.actuals + f.actuals,
        eac: acc.eac + f.eac,
        etc: acc.etc + f.etc,
        vac: acc.vac + f.vac,
      }),
      { budget: 0, actuals: 0, eac: 0, etc: 0, vac: 0 }
    )
  }, [forecasts])

  // Monthly spend trend from transactions
  const monthlyTrend = useMemo(() => {
    const txnList = allTxns ?? []
    const actualTxns = txnList.filter((t) => t.type === 'actual')
    if (actualTxns.length === 0) return []

    const monthly = new Map<string, number>()
    actualTxns.forEach((t) => {
      const month = (t.date || t.created_at || '').substring(0, 7) // YYYY-MM
      if (month) {
        monthly.set(month, (monthly.get(month) || 0) + t.amount)
      }
    })

    return Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, amount]) => ({ month, amount }))
  }, [allTxns])

  const handleCreateCode = async () => {
    if (!projectId) return
    if (!form.code.trim() || !form.description.trim()) {
      toast.error('Code and description are required')
      return
    }
    try {
      const budgeted = Math.round(parseFloat(form.budgeted_amount || '0') * 100) || 0
      await createCode.mutateAsync({
        project_id: projectId,
        code: form.code.trim(),
        description: form.description.trim(),
        budgeted_amount: budgeted,
        forecast_amount: budgeted,
      })
      toast.success('Cost code created')
      setModalOpen(false)
      setForm({ code: '', description: '', budgeted_amount: '' })
    } catch (e) {
      toast.error('Failed to create cost code')
      console.error(e)
    }
  }

  const handleCreateTxn = async () => {
    if (!projectId || !selectedCode) return
    const amount = Math.round(parseFloat(txnForm.amount || '0') * 100)
    if (!amount) {
      toast.error('Amount is required')
      return
    }
    try {
      await createTxn.mutateAsync({
        project_id: projectId,
        cost_code_id: selectedCode.id,
        type: txnForm.type,
        amount,
        description: txnForm.description || null,
        vendor: txnForm.vendor || null,
        date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      })
      toast.success('Transaction recorded')
      setTxnModalOpen(false)
      setTxnForm({ type: 'actual', amount: '', description: '', vendor: '' })
    } catch (e) {
      toast.error('Failed to record transaction')
      console.error(e)
    }
  }

  const runForecast = () => {
    if (!codes || codes.length === 0) {
      toast.info('Add cost codes before running a forecast')
      return
    }
    setForecastOpen(true)
  }

  return (
    <PageContainer
      title="Cost Management"
      subtitle="Budget vs committed vs actual per CSI cost code"
      actions={
        <>
          <Btn variant="secondary" onClick={runForecast}>
            <Sparkles size={14} /> AI Cost Forecast
          </Btn>
          <Btn variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New Cost Code
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Budgeted" value={fmt(totals.budgeted)} icon={DollarSign} />
        <MetricBox label="Committed" value={fmt(totals.committed)} icon={TrendingUp} />
        <MetricBox label="Actual" value={fmt(totals.actual)} icon={TrendingDown} />
        <MetricBox label="Over Budget" value={String(overBudgetCount)} icon={AlertTriangle} />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['6'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: 0 }}>
        {([
          { key: 'overview' as CostTab, label: 'Overview', icon: DollarSign },
          { key: 'committed' as CostTab, label: 'Committed Costs', icon: FileText },
          { key: 'earnedValue' as CostTab, label: 'Earned Value', icon: BarChart3 },
          { key: 'scenarios' as CostTab, label: 'Scenarios', icon: Layers },
        ]).map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['3']} ${spacing['4']}`,
                fontSize: typography.fontSize.sm, fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.normal,
                color: active ? colors.textPrimary : colors.textTertiary,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========== COMMITTED COSTS TAB ========== */}
      {activeTab === 'committed' && (
        <Card padding={spacing['5']}>
          <SectionHeader title="Committed Cost Tracking" />
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['4']} 0` }}>
            Subcontracts, Purchase Orders, and Change Orders flowing into cost codes
          </p>
          {aggregateCommittedCosts().map(summary => {
            const cc = committedColor(summary.uncommitted, summary.originalBudget)
            return (
              <div key={summary.costCode} style={{ marginBottom: spacing['4'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                {/* Summary row */}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr repeat(5, 100px) 110px', gap: spacing['2'], padding: spacing['3'], background: colors.surfaceInset, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, alignItems: 'center' }}>
                  <div style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{summary.costCode}</div>
                  <div style={{ color: colors.textPrimary }}>{summary.description}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>
                    <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>Budget</div>
                    {fmt(summary.originalBudget)}
                  </div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>
                    <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>Committed</div>
                    {fmt(summary.committed)}
                  </div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>
                    <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>Actual</div>
                    {fmt(summary.actualToDate)}
                  </div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>
                    <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>Forecast</div>
                    {fmt(summary.forecast)}
                  </div>
                  <div style={{ textAlign: 'right', color: cc, fontWeight: typography.fontWeight.semibold }}>
                    <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.normal }}>Uncommitted</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cc, display: 'inline-block' }} />
                      {fmt(summary.uncommitted)}
                    </span>
                  </div>
                </div>
                {/* Line items */}
                {summary.items.map(item => (
                  <div key={item.ref} style={{ display: 'grid', gridTemplateColumns: '100px 80px 1fr 1fr 100px', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, borderTop: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm, alignItems: 'center' }}>
                    <div style={{ fontFamily: 'monospace', color: colors.textTertiary }}>{item.ref}</div>
                    <div>
                      <span style={{
                        padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
                        background: item.type === 'Subcontract' ? 'rgba(59,130,246,0.1)' : item.type === 'PO' ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)',
                        color: item.type === 'Subcontract' ? '#3b82f6' : item.type === 'PO' ? '#a855f7' : '#f59e0b',
                      }}>{item.type === 'Change Order' ? 'CO' : item.type}</span>
                    </div>
                    <div style={{ color: colors.textSecondary }}>{item.contractor}</div>
                    <div style={{ color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                    <div style={{ textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(item.value)}</div>
                  </div>
                ))}
              </div>
            )
          })}
        </Card>
      )}

      {/* ========== EARNED VALUE TAB ========== */}
      {activeTab === 'earnedValue' && (() => {
        const totalBcws = EV_DATA.reduce((s, e) => s + e.bcws, 0)
        const totalBcwp = EV_DATA.reduce((s, e) => s + e.bcwp, 0)
        const totalAcwp = EV_DATA.reduce((s, e) => s + e.acwp, 0)
        const projSpi = totalBcwp / Math.max(totalBcws, 1)
        const projCpi = totalBcwp / Math.max(totalAcwp, 1)
        const projBac = totalBcws * 1.15 // total budget at completion estimate
        const projEac = projBac / projCpi
        const projEtc = projEac - totalAcwp
        const projVac = projBac - projEac
        return (
          <Card padding={spacing['5']}>
            <SectionHeader title="Earned Value Analysis" />
            {/* Project-level summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: spacing['3'], marginBottom: spacing['5'] }}>
              {[
                { label: 'BCWS (Planned)', value: fmt(totalBcws) },
                { label: 'BCWP (Earned)', value: fmt(totalBcwp) },
                { label: 'ACWP (Actual)', value: fmt(totalAcwp) },
                { label: 'SPI', value: projSpi.toFixed(3), color: evColor(projSpi) },
                { label: 'CPI', value: projCpi.toFixed(3), color: evColor(projCpi) },
                { label: 'VAC', value: fmt(Math.round(projVac)), color: projVac >= 0 ? colors.statusActive : colors.statusCritical },
              ].map(m => (
                <Card key={m.label} padding={spacing['3']}>
                  <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{m.label}</div>
                  <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: m.color || colors.textPrimary }}>{m.value}</div>
                </Card>
              ))}
            </div>
            {/* Per cost code table */}
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, display: 'grid', gridTemplateColumns: '90px 1fr repeat(3, 90px) repeat(2, 70px) repeat(3, 90px) 70px 70px', gap: spacing['2'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div>Code</div><div>Description</div>
              <div style={{ textAlign: 'right' }}>BCWS</div><div style={{ textAlign: 'right' }}>BCWP</div><div style={{ textAlign: 'right' }}>ACWP</div>
              <div style={{ textAlign: 'right' }}>SPI</div><div style={{ textAlign: 'right' }}>CPI</div>
              <div style={{ textAlign: 'right' }}>EAC</div><div style={{ textAlign: 'right' }}>ETC</div><div style={{ textAlign: 'right' }}>VAC</div>
              <div style={{ textAlign: 'center' }}>CPI</div><div style={{ textAlign: 'center' }}>SPI</div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {EV_DATA.map(ev => {
                const spi = ev.bcwp / Math.max(ev.bcws, 1)
                const cpi = ev.bcwp / Math.max(ev.acwp, 1)
                const bac = ev.bcws * 1.15
                const eac = bac / cpi
                const etc = eac - ev.acwp
                const vac = bac - eac
                return (
                  <div key={ev.costCode} style={{ display: 'grid', gridTemplateColumns: '90px 1fr repeat(3, 90px) repeat(2, 70px) repeat(3, 90px) 70px 70px', gap: spacing['2'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm, alignItems: 'center' }}>
                    <div style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{ev.costCode}</div>
                    <div style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</div>
                    <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(ev.bcws)}</div>
                    <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(ev.bcwp)}</div>
                    <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(ev.acwp)}</div>
                    <div style={{ textAlign: 'right', color: evColor(spi), fontWeight: typography.fontWeight.semibold }}>{spi.toFixed(2)}</div>
                    <div style={{ textAlign: 'right', color: evColor(cpi), fontWeight: typography.fontWeight.semibold }}>{cpi.toFixed(2)}</div>
                    <div style={{ textAlign: 'right', color: eac > bac ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{fmt(Math.round(eac))}</div>
                    <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(Math.round(etc))}</div>
                    <div style={{ textAlign: 'right', color: vac >= 0 ? colors.statusActive : colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>{vac >= 0 ? '+' : ''}{fmt(Math.round(vac))}</div>
                    <div style={{ textAlign: 'center' }}><Sparkline data={ev.cpiHistory} color={evColor(cpi)} /></div>
                    <div style={{ textAlign: 'center' }}><Sparkline data={ev.spiHistory} color={evColor(spi)} /></div>
                  </div>
                )
              })}
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr repeat(3, 90px) repeat(2, 70px) repeat(3, 90px) 70px 70px', gap: spacing['2'], padding: `${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, alignItems: 'center', borderTop: `2px solid ${colors.borderSubtle}` }}>
                <div style={{ color: colors.textPrimary }}>TOTAL</div>
                <div></div>
                <div style={{ textAlign: 'right', color: colors.textPrimary }}>{fmt(totalBcws)}</div>
                <div style={{ textAlign: 'right', color: colors.textPrimary }}>{fmt(totalBcwp)}</div>
                <div style={{ textAlign: 'right', color: colors.textPrimary }}>{fmt(totalAcwp)}</div>
                <div style={{ textAlign: 'right', color: evColor(projSpi) }}>{projSpi.toFixed(2)}</div>
                <div style={{ textAlign: 'right', color: evColor(projCpi) }}>{projCpi.toFixed(2)}</div>
                <div style={{ textAlign: 'right', color: projEac > projBac ? colors.statusCritical : colors.statusActive }}>{fmt(Math.round(projEac))}</div>
                <div style={{ textAlign: 'right', color: colors.textPrimary }}>{fmt(Math.round(projEtc))}</div>
                <div style={{ textAlign: 'right', color: projVac >= 0 ? colors.statusActive : colors.statusCritical }}>{projVac >= 0 ? '+' : ''}{fmt(Math.round(projVac))}</div>
                <div></div><div></div>
              </div>
            </div>
          </Card>
        )
      })()}

      {/* ========== SCENARIOS TAB ========== */}
      {activeTab === 'scenarios' && (() => {
        const minCost = Math.min(...SCENARIOS.map(s => s.totalCost))
        const maxCost = Math.max(...SCENARIOS.map(s => s.totalCost))
        const range = maxCost - minCost || 1
        const mostLikely = SCENARIOS.find(s => s.name === 'Most Likely')!
        return (
          <Card padding={spacing['5']}>
            <SectionHeader title="Cost Forecast Scenario Modeling" />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['5']} 0` }}>
              Compare project outcomes under varying assumptions for labor productivity, material escalation, and contingency draw
            </p>
            {/* Scenario cards side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['5'] }}>
              {SCENARIOS.map(sc => {
                const isML = sc.name === 'Most Likely'
                const diffFromML = sc.totalCost - mostLikely.totalCost
                return (
                  <Card key={sc.name} padding={spacing['4']} style={{ border: isML ? `2px solid ${colors.textPrimary}` : `1px solid ${colors.borderSubtle}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{sc.name}</span>
                      {isML && <span style={{ fontSize: typography.fontSize.xs, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm, background: colors.surfaceInset, color: colors.textTertiary }}>Base</span>}
                    </div>
                    <div style={{ fontSize: typography.fontSize.xl || '1.5rem', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['3'] }}>
                      {fmt(sc.totalCost)}
                    </div>
                    {!isML && (
                      <div style={{ fontSize: typography.fontSize.sm, color: diffFromML > 0 ? colors.statusCritical : colors.statusActive, marginBottom: spacing['3'] }}>
                        {diffFromML > 0 ? '+' : ''}{fmt(diffFromML)} vs Most Likely
                      </div>
                    )}
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                      <div>Labor productivity: <span style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{sc.params.laborFactor.toFixed(2)}x</span></div>
                      <div>Material escalation: <span style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{sc.params.materialEsc.toFixed(1)}%</span></div>
                      <div>Contingency draw: <span style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{sc.params.contingencyDraw}%</span></div>
                    </div>
                  </Card>
                )
              })}
            </div>
            {/* Range visualization */}
            <Card padding={spacing['4']} style={{ background: colors.surfaceInset }}>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, marginBottom: spacing['3'], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Range</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.semibold, minWidth: 90, textAlign: 'right' }}>{fmt(minCost)}</span>
                <div style={{ flex: 1, position: 'relative', height: 28, background: colors.borderSubtle, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                  {/* Full range bar */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: `linear-gradient(90deg, ${colors.statusActive}, ${colors.statusPending}, ${colors.statusCritical})`, borderRadius: borderRadius.md, opacity: 0.3 }} />
                  {/* Most likely marker */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: colors.textPrimary, borderRadius: 2,
                    left: `${((mostLikely.totalCost - minCost) / range) * 100}%`, transform: 'translateX(-50%)',
                  }} />
                  <div style={{
                    position: 'absolute', top: -18, fontSize: typography.fontSize.xs, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold,
                    left: `${((mostLikely.totalCost - minCost) / range) * 100}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                  }}>
                    Most Likely
                  </div>
                </div>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.semibold, minWidth: 90 }}>{fmt(maxCost)}</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing['2'] }}>
                Range: {fmt(maxCost - minCost)} | Spread: {((maxCost - minCost) / mostLikely.totalCost * 100).toFixed(1)}% of base
              </div>
            </Card>
          </Card>
        )
      })()}

      {/* ========== OVERVIEW TAB (existing content) ========== */}
      {activeTab === 'overview' && <>
      {/* Cost Trend Section */}
      {monthlyTrend.length > 0 && (
        <Card padding={spacing['5']} style={{ marginBottom: spacing['6'] }}>
          <SectionHeader title="Cost Trend" />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing['3'], height: 120, padding: `${spacing['2']} 0` }}>
            {(() => {
              const maxAmount = Math.max(...monthlyTrend.map((m) => m.amount), 1)
              return monthlyTrend.map((m) => {
                const height = Math.max((m.amount / maxAmount) * 100, 4)
                const isLatest = m === monthlyTrend[monthlyTrend.length - 1]
                const prevMonth = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2] : null
                const trendUp = prevMonth ? m.amount > prevMonth.amount : false
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['1'] }}>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: isLatest ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                      {fmt(m.amount)}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 48,
                        height: `${height}%`,
                        borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
                        backgroundColor: isLatest
                          ? (trendUp ? colors.statusPending : colors.statusActive)
                          : colors.surfaceInset,
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                      {m.month.substring(5)}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
          {monthlyTrend.length >= 2 && (() => {
            const last = monthlyTrend[monthlyTrend.length - 1].amount
            const prev = monthlyTrend[monthlyTrend.length - 2].amount
            const changePct = prev > 0 ? ((last - prev) / prev) * 100 : 0
            const increasing = changePct > 0
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'], fontSize: typography.fontSize.sm }}>
                {increasing ? <ArrowUpRight size={14} color={colors.statusCritical} /> : <ArrowDownRight size={14} color={colors.statusActive} />}
                <span style={{ color: increasing ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.semibold }}>
                  {increasing ? '+' : ''}{changePct.toFixed(1)}%
                </span>
                <span style={{ color: colors.textTertiary }}>vs previous month</span>
              </div>
            )
          })()}
        </Card>
      )}

      {isLoading ? (
        <Skeleton height={280} />
      ) : (codes ?? []).length === 0 ? (
        <EmptyState
          icon={<DollarSign size={48} color={colors.textTertiary} />}
          title="No cost codes yet"
          description="Create CSI-formatted cost codes to track budget, commitments, and actuals."
          actionLabel="Create First Cost Code"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        grouped.map(([div, items]) => (
          <Card key={div} padding={spacing['5']}>
            <SectionHeader title={`Division ${div} — ${CSI_DIVISIONS[div] ?? 'Other'}`} />
            <div style={{ display: 'grid', gridTemplateColumns: '24px 120px 1fr repeat(4, 120px) 80px', gap: spacing['3'], padding: `${spacing['2']} 0`, fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div></div>
              <div>Code</div>
              <div>Description</div>
              <div style={{ textAlign: 'right' }}>Budget</div>
              <div style={{ textAlign: 'right' }}>Committed</div>
              <div style={{ textAlign: 'right' }}>Actual</div>
              <div style={{ textAlign: 'right' }}>Variance</div>
              <div></div>
            </div>
            {items.map((c) => {
              const pct = variancePct(c.budgeted_amount, c.actual_amount)
              const vColor = varianceColor(c.budgeted_amount, c.actual_amount)
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCode(c)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 120px 1fr repeat(4, 120px) 80px',
                    gap: spacing['3'],
                    padding: `${spacing['3']} 0`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    cursor: 'pointer',
                    alignItems: 'center',
                    fontSize: typography.fontSize.sm,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VarianceDot budget={c.budgeted_amount} actual={c.actual_amount} />
                  </div>
                  <div style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{c.code}</div>
                  <div style={{ color: colors.textPrimary }}>{c.description}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(c.budgeted_amount)}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(c.committed_amount)}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(c.actual_amount)}</div>
                  <div style={{ textAlign: 'right', color: vColor, fontWeight: typography.fontWeight.semibold }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(0)}%
                  </div>
                  <div
                    style={{ textAlign: 'right' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCode(c)
                      setTxnModalOpen(true)
                    }}
                  >
                    <span style={{ padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.md, background: colors.surfaceInset, color: colors.textSecondary, cursor: 'pointer', fontSize: typography.fontSize.sm }}>+</span>
                  </div>
                </div>
              )
            })}
          </Card>
        ))
      )}

      </>}

      {/* Forecast Modal */}
      <Modal open={forecastOpen} onClose={() => setForecastOpen(false)} title="Cost Forecast — EAC / ETC / VAC" width="900px">
        {forecasts.length > 0 ? (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['5'] }}>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Total Budget</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(forecastTotals.budget)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Est. at Completion (EAC)</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: forecastTotals.eac > forecastTotals.budget ? colors.statusCritical : colors.statusActive }}>{fmt(forecastTotals.eac)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Est. to Complete (ETC)</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(forecastTotals.etc)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Variance at Completion</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: forecastTotals.vac >= 0 ? colors.statusActive : colors.statusCritical }}>
                  {forecastTotals.vac >= 0 ? '+' : ''}{fmt(forecastTotals.vac)}
                </div>
              </Card>
            </div>

            {/* Per-code breakdown */}
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, display: 'grid', gridTemplateColumns: '100px 1fr repeat(5, 100px)', gap: spacing['2'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div>Code</div>
              <div>Description</div>
              <div style={{ textAlign: 'right' }}>Budget</div>
              <div style={{ textAlign: 'right' }}>Actuals</div>
              <div style={{ textAlign: 'right' }}>EAC</div>
              <div style={{ textAlign: 'right' }}>ETC</div>
              <div style={{ textAlign: 'right' }}>VAC</div>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {forecasts.map((f) => (
                <div
                  key={f.code}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr repeat(5, 100px)',
                    gap: spacing['2'],
                    padding: `${spacing['2']} 0`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    fontSize: typography.fontSize.sm,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontFamily: 'monospace', color: colors.textPrimary }}>{f.code}</div>
                  <div style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(f.budget)}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(f.actuals)}</div>
                  <div style={{ textAlign: 'right', color: f.eac > f.budget ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{fmt(f.eac)}</div>
                  <div style={{ textAlign: 'right', color: colors.textSecondary }}>{fmt(f.etc)}</div>
                  <div style={{ textAlign: 'right', color: f.vac >= 0 ? colors.statusActive : colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>
                    {f.vac >= 0 ? '+' : ''}{fmt(f.vac)}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Insight */}
            <div style={{ marginTop: spacing['4'], padding: spacing['3'], borderRadius: borderRadius.md, background: colors.surfaceInset }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <Sparkles size={14} color={colors.statusReview} />
                <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecast Insight</span>
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                {forecastTotals.vac >= 0
                  ? `Project is forecasted to finish ${fmt(forecastTotals.vac)} under budget. ${forecasts.filter((f) => f.vac < 0).length} cost code(s) are trending over budget and should be monitored.`
                  : `Project is forecasted to exceed budget by ${fmt(Math.abs(forecastTotals.vac))}. ${forecasts.filter((f) => f.vac < 0).length} cost code(s) are over budget — consider value engineering or budget reallocation.`
                }
              </p>
            </div>
          </>
        ) : (
          <div style={{ color: colors.textTertiary, padding: spacing['6'], textAlign: 'center' }}>
            No cost codes with budgets to forecast.
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Cost Code">
        <InputField label="Code (e.g. 03-3100)" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
        <InputField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <InputField label="Budgeted Amount ($)" value={form.budgeted_amount} onChange={(v) => setForm({ ...form, budgeted_amount: v })} type="number" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreateCode}>Create</Btn>
        </div>
      </Modal>

      <Modal open={!!selectedCode && !txnModalOpen} onClose={() => setSelectedCode(null)} title={selectedCode ? `${selectedCode.code} — ${selectedCode.description}` : ''} width="720px">
        {selectedCode && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Budget</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>{fmt(selectedCode.budgeted_amount)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Committed</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>{fmt(selectedCode.committed_amount)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Actual</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>{fmt(selectedCode.actual_amount)}</div>
              </Card>
              <Card padding={spacing['3']}>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Forecast</div>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>{fmt(selectedCode.forecast_amount)}</div>
              </Card>
            </div>
            <SectionHeader
              title="Transactions"
              action={<Btn variant="primary" onClick={() => setTxnModalOpen(true)}><Plus size={14} /> Add</Btn>}
            />
            {(!txns || txns.length === 0) ? (
              <div style={{ color: colors.textTertiary, padding: spacing['4'], textAlign: 'center' }}>No transactions yet</div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {txns.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm }}>
                    <div>
                      <div style={{ color: colors.textPrimary }}>{t.description || t.type}</div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{t.type}{t.vendor ? ` · ${t.vendor}` : ''} · {t.date}</div>
                    </div>
                    <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(t.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={txnModalOpen} onClose={() => setTxnModalOpen(false)} title="Record Transaction">
        <div style={{ marginBottom: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Type</label>
          <select
            value={txnForm.type}
            onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value as typeof txnForm.type })}
            style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
          >
            <option value="committed">Committed</option>
            <option value="actual">Actual</option>
            <option value="forecast">Forecast</option>
          </select>
        </div>
        <InputField label="Amount ($)" value={txnForm.amount} onChange={(v) => setTxnForm({ ...txnForm, amount: v })} type="number" />
        <InputField label="Vendor" value={txnForm.vendor} onChange={(v) => setTxnForm({ ...txnForm, vendor: v })} />
        <InputField label="Description" value={txnForm.description} onChange={(v) => setTxnForm({ ...txnForm, description: v })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setTxnModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreateTxn}>Record</Btn>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default CostManagement
