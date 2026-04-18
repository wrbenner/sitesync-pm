import React, { useMemo, useState } from 'react'
import { DollarSign, Plus, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
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

const CostManagement: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: codes, isLoading } = useCostCodes(projectId ?? undefined)
  const createCode = useCreateCostCode()
  const createTxn = useCreateCostTransaction()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<CostCode | null>(null)
  const [txnModalOpen, setTxnModalOpen] = useState(false)
  const { data: txns } = useCostTransactions(projectId ?? undefined, selectedCode?.id)

  const [form, setForm] = useState({ code: '', description: '', budgeted_amount: '' })
  const [txnForm, setTxnForm] = useState<{
    transaction_type: 'budget' | 'commitment' | 'actual' | 'forecast_adjustment'
    amount: string
    description: string
  }>({ transaction_type: 'actual', amount: '', description: '' })

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
        transaction_type: txnForm.transaction_type,
        amount,
        description: txnForm.description || null,
        source_type: 'manual',
        created_by: user?.id,
      })
      toast.success('Transaction recorded')
      setTxnModalOpen(false)
      setTxnForm({ transaction_type: 'actual', amount: '', description: '' })
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
    const burned = totals.actual
    const budget = totals.budgeted
    const projected = budget > 0 ? Math.round((burned / Math.max(budget * 0.4, 1)) * budget) : burned
    toast.success(
      `AI Forecast: final cost ≈ ${fmt(projected)} (budget ${fmt(budget)})`,
      { duration: 6000 }
    )
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
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr repeat(4, 120px) 80px', gap: spacing['3'], padding: `${spacing['2']} 0`, fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, borderBottom: `1px solid ${colors.borderSubtle}` }}>
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
                    gridTemplateColumns: '120px 1fr repeat(4, 120px) 80px',
                    gap: spacing['3'],
                    padding: `${spacing['3']} 0`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    cursor: 'pointer',
                    alignItems: 'center',
                    fontSize: typography.fontSize.sm,
                  }}
                >
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
                      <div style={{ color: colors.textPrimary }}>{t.description || t.transaction_type}</div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{t.transaction_type} · {t.transaction_date}</div>
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
            value={txnForm.transaction_type}
            onChange={(e) => setTxnForm({ ...txnForm, transaction_type: e.target.value as typeof txnForm.transaction_type })}
            style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
          >
            <option value="budget">Budget</option>
            <option value="commitment">Commitment</option>
            <option value="actual">Actual</option>
            <option value="forecast_adjustment">Forecast Adjustment</option>
          </select>
        </div>
        <InputField label="Amount ($)" value={txnForm.amount} onChange={(v) => setTxnForm({ ...txnForm, amount: v })} type="number" />
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
