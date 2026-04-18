import React, { useState, useMemo } from 'react'
import { FileText, Plus, Briefcase, Users, FileSignature, ShoppingCart } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useContracts } from '../hooks/queries/financials'
import { useCreateContract, useDeleteContract, useUpdateContract } from '../hooks/queries/enterprise-modules'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

type TabKey = 'all' | 'prime' | 'subcontract' | 'psa' | 'purchase_order'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: FileText },
  { key: 'prime', label: 'Prime', icon: Briefcase },
  { key: 'subcontract', label: 'Subcontracts', icon: Users },
  { key: 'psa', label: 'PSAs', icon: FileSignature },
  { key: 'purchase_order', label: 'POs', icon: ShoppingCart },
]

interface Contract {
  id: string
  contract_type: string
  title: string
  counterparty_name: string
  contract_amount: number
  status: string
  start_date: string | null
  end_date: string | null
}

const col = createColumnHelper<Contract>()
const baseColumns = [
  col.accessor('contract_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue()
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        }}>
          {v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      )
    },
  }),
  col.accessor('title', { header: 'Title', cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium }}>{info.getValue()}</span> }),
  col.accessor('counterparty_name', { header: 'Counterparty', cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span> }),
  col.accessor('contract_amount', {
    header: 'Amount',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium }}>
        ${((info.getValue() || 0) / 100).toLocaleString()}
      </span>
    ),
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue()
      const colorMap: Record<string, { c: string; bg: string }> = {
        draft: { c: colors.textTertiary, bg: colors.surfaceInset },
        pending_signature: { c: colors.statusPending, bg: colors.statusPendingSubtle },
        active: { c: colors.statusActive, bg: colors.statusActiveSubtle },
        completed: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
        terminated: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
      }
      const { c, bg } = colorMap[v] || colorMap.draft
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: c, backgroundColor: bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />
          {v.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
        </span>
      )
    },
  }),
  col.accessor('end_date', {
    header: 'End',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '—'}</span>,
  }),
]

export const Contracts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: contracts, isLoading } = useContracts(projectId ?? undefined)
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const deleteContract = useDeleteContract()

  const handleDeleteContract = async (contract: Contract) => {
    if (!projectId) return
    if (!window.confirm(`Delete "${contract.title}"? This cannot be undone.`)) return
    try {
      await deleteContract.mutateAsync({ id: contract.id, projectId })
      toast.success('Contract deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contract')
    }
  }

  const handleUpdateContractStatus = async (contract: Contract, status: string) => {
    if (!projectId) return
    try {
      await updateContract.mutateAsync({ id: contract.id, projectId, updates: { status } })
      toast.success('Contract updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update contract')
    }
  }

  const columns = useMemo(
    () => [
      ...baseColumns,
      col.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const contract = info.row.original
          return (
            <div style={{ display: 'flex', gap: spacing.xs, justifyContent: 'flex-end' }}>
              <select
                value={contract.status}
                onChange={(e) => handleUpdateContractStatus(contract, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Change contract status"
                data-testid="edit-contract-status"
                style={{
                  padding: `2px ${spacing.xs}`,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: borderRadius.base,
                  backgroundColor: colors.surfaceRaised,
                  fontSize: typography.fontSize.caption,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                <option value="draft">Draft</option>
                <option value="pending_signature">Pending Signature</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
              </select>
              <PermissionGate permission="project.settings">
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteContract(contract)}
                  disabled={deleteContract.isPending}
                  aria-label={`Delete ${contract.title}`}
                  data-testid="delete-contract-button"
                >
                  Delete
                </Btn>
              </PermissionGate>
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteContract.isPending, projectId],
  )

  const [form, setForm] = useState({
    contract_type: 'subcontract',
    title: '',
    counterparty_name: '',
    contract_amount_dollars: '',
    start_date: '',
    end_date: '',
    retention_percentage: '10',
    scope_of_work: '',
    insurance_required: true,
    bonding_required: false,
  })

  const filtered = useMemo<Contract[]>(() => {
    const list = (contracts ?? []) as Contract[]
    if (activeTab === 'all') return list
    return list.filter((c) => c.contract_type === activeTab)
  }, [contracts, activeTab])

  const totalValue = (contracts ?? []).reduce((s: number, c: Contract) => s + (c.contract_amount || 0), 0) / 100
  const activeCount = (contracts ?? []).filter((c: Contract) => c.status === 'active').length
  const pendingCount = (contracts ?? []).filter((c: Contract) => c.status === 'pending_signature').length

  const handleSubmit = async () => {
    if (!projectId || !form.title || !form.counterparty_name) {
      toast.error('Title and counterparty required')
      return
    }
    try {
      await createContract.mutateAsync({
        project_id: projectId,
        contract_type: form.contract_type,
        title: form.title,
        counterparty_name: form.counterparty_name,
        contract_amount: Math.round(parseFloat(form.contract_amount_dollars || '0') * 100),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        retention_percentage: parseFloat(form.retention_percentage || '10'),
        scope_of_work: form.scope_of_work || null,
        insurance_required: form.insurance_required,
        bonding_required: form.bonding_required,
        created_by: user?.id,
      })
      toast.success('Contract created')
      setModalOpen(false)
      setForm({ ...form, title: '', counterparty_name: '', contract_amount_dollars: '', scope_of_work: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Contracts"
      subtitle="Prime contracts, subcontracts, PSAs, and purchase orders"
      actions={
        <PermissionGate
          permission="project.settings"
          fallback={<span title="Your role doesn't allow creating contracts. Request access from your admin."><Btn variant="primary" icon={<Plus size={16} />} disabled>New Contract</Btn></span>}
        >
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)} data-testid="create-contract-button">New Contract</Btn>
        </PermissionGate>
      }
    >
      <div style={{
        display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg, padding: spacing['1'], marginBottom: spacing['2xl'], overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`, border: 'none',
                borderRadius: borderRadius.base, cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Contracts" value={contracts?.length || 0} />
            <MetricBox label="Active" value={activeCount} />
            <MetricBox label="Pending Signature" value={pendingCount} />
            <MetricBox label="Total Value" value={`$${totalValue.toLocaleString()}`} />
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title={activeTab === 'all' ? 'All Contracts' : tabs.find((t) => t.key === activeTab)?.label || ''} />
            {filtered.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable columns={columns} data={filtered} />
              </div>
            ) : (
              <EmptyState icon={<FileText size={48} />} title="No contracts" description="Create a new contract to get started." />
            )}
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Contract" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Type</label>
              <select
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="prime">Prime</option>
                <option value="subcontract">Subcontract</option>
                <option value="psa">PSA</option>
                <option value="purchase_order">Purchase Order</option>
              </select>
            </div>
            <InputField label="Amount ($)" value={form.contract_amount_dollars} onChange={(v) => setForm({ ...form, contract_amount_dollars: v })} placeholder="0.00" />
          </div>
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Electrical subcontract" />
          <InputField label="Counterparty" value={form.counterparty_name} onChange={(v) => setForm({ ...form, counterparty_name: v })} placeholder="ABC Electric LLC" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <InputField label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            <InputField label="Retention %" value={form.retention_percentage} onChange={(v) => setForm({ ...form, retention_percentage: v })} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Scope of Work</label>
            <textarea
              value={form.scope_of_work}
              onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['4'] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={form.insurance_required} onChange={(e) => setForm({ ...form, insurance_required: e.target.checked })} /> Insurance required
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={form.bonding_required} onChange={(e) => setForm({ ...form, bonding_required: e.target.checked })} /> Bonding required
            </label>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createContract.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Contracts
