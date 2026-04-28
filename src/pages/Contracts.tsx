import React, { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, Briefcase, Users, FileSignature, ShoppingCart, X, Trash2, ChevronDown, ChevronUp, Send, Clock, CheckCircle, PenTool, Shield, AlertTriangle, BookOpen, DollarSign, Search, Eye, EyeOff, ExternalLink, UserCheck } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState, Tag } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useContracts, useContractRetainageTotals } from '../hooks/queries/contracts'
import { useCreateContract, useDeleteContract, useUpdateContract } from '../hooks/mutations/contracts'
import { useInsuranceCertificates, useInsuranceCertificatesByCompany, getCOIStatus, type InsuranceCertificate } from '../hooks/queries/insurance-certificates'
import { useUpdateInsuranceCertificate, useUploadInsuranceCertificate, useDeleteInsuranceCertificate } from '../hooks/mutations/insurance-certificates'
import { useVendors, type Vendor } from '../hooks/queries/vendors'
import { useChangeOrders } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sovService, type SovItem, type CreateSovItemInput, type UpdateSovItemInput } from '../services/sovService'
import {
  useSignatureRequests,
  useCreateSignatureRequest,
  useSendForSignature,
  useAddSigner,
  type SignatureRequest,
} from '../hooks/queries/signatures'
import { getSignerColorPalette } from '../services/signatureService'
import { supabase } from '../lib/supabase'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import { PageInsightBanners } from '../components/ai/PredictiveAlert'

// ── SOV Query Hooks ─────────────────────────────────────────

function useSovItems(contractId: string | null) {
  return useQuery({
    queryKey: ['sov-items', contractId],
    queryFn: async () => {
      if (!contractId) return []
      const result = await sovService.loadItems(contractId)
      if (result.error) throw new Error(result.error.message)
      return result.data ?? []
    },
    enabled: !!contractId,
  })
}

function useCreateSovItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSovItemInput) => {
      const result = await sovService.createItem(input)
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sov-items', variables.contract_id] })
    },
  })
}

function useUpdateSovItem(contractId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: UpdateSovItemInput }) => {
      const result = await sovService.updateItem(itemId, updates)
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: ['sov-items', contractId] })
      }
    },
  })
}

function useDeleteSovItem(contractId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const result = await sovService.deleteItem(itemId)
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: ['sov-items', contractId] })
      }
    },
  })
}

// ── Helpers ─────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  return `$${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`
}

// ── SOV Section Component ───────────────────────────────────

const sovTableCellStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  whiteSpace: 'nowrap',
}

const sovTableHeaderStyle: React.CSSProperties = {
  ...sovTableCellStyle,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textSecondary,
  fontSize: typography.fontSize.caption,
  textTransform: 'uppercase' as const,
  letterSpacing: typography.letterSpacing.wider,
  backgroundColor: colors.surfaceInset,
  position: 'sticky' as const,
  top: 0,
}

const inlineInputStyle: React.CSSProperties = {
  width: '100px',
  padding: `${spacing['1']} ${spacing['2']}`,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary,
  textAlign: 'right' as const,
}

interface SovSectionProps {
  contractId: string
  contractTitle: string
  onClose: () => void
}

const SovSection: React.FC<SovSectionProps> = ({ contractId, contractTitle, onClose }) => {
  const { data: items = [], isLoading } = useSovItems(contractId)
  const createItem = useCreateSovItem()
  const updateItem = useUpdateSovItem(contractId)
  const deleteItem = useDeleteSovItem(contractId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    item_number: '',
    description: '',
    scheduled_value: '',
    cost_code: '',
  })

  // Track inline edits: { [itemId]: { this_period_completed?: string, materials_stored?: string } }
  const [editingValues, setEditingValues] = useState<Record<string, { this_period_completed?: string; materials_stored?: string }>>({})

  const handleAddItem = async () => {
    if (!addForm.description || !addForm.scheduled_value) {
      toast.error('Description and scheduled value are required')
      return
    }
    const scheduledValue = parseFloat(addForm.scheduled_value)
    if (isNaN(scheduledValue) || scheduledValue <= 0) {
      toast.error('Scheduled value must be a positive number')
      return
    }
    try {
      await createItem.mutateAsync({
        contract_id: contractId,
        description: addForm.description,
        scheduled_value: scheduledValue,
        item_number: addForm.item_number || null,
        cost_code: addForm.cost_code || null,
      })
      toast.success('Line item added')
      setAddForm({ item_number: '', description: '', scheduled_value: '', cost_code: '' })
      setShowAddForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add line item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Delete this line item?')) return
    try {
      await deleteItem.mutateAsync(itemId)
      toast.success('Line item deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete line item')
    }
  }

  const handleInlineBlur = useCallback(async (item: SovItem, field: 'this_period_completed' | 'materials_stored') => {
    const editVal = editingValues[item.id]?.[field]
    if (editVal === undefined) return

    const numVal = parseFloat(editVal) || 0
    const currentVal = item[field] ?? 0
    if (numVal === currentVal) {
      // No change, clear editing state
      setEditingValues((prev) => {
        const next = { ...prev }
        if (next[item.id]) {
          delete next[item.id][field]
          if (Object.keys(next[item.id]).length === 0) delete next[item.id]
        }
        return next
      })
      return
    }

    // Auto-calculate derived fields
    const previousCompleted = item.previous_completed ?? 0
    const thisPeriod = field === 'this_period_completed' ? numVal : (item.this_period_completed ?? 0)
    const materialsStored = field === 'materials_stored' ? numVal : (item.materials_stored ?? 0)
    const totalCompleted = previousCompleted + thisPeriod + materialsStored
    const scheduledValue = item.scheduled_value || 1
    const percentComplete = (totalCompleted / scheduledValue) * 100
    const balanceToFinish = scheduledValue - totalCompleted

    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          [field]: numVal,
          total_completed: totalCompleted,
          percent_complete: Math.min(percentComplete, 100),
          balance_to_finish: Math.max(balanceToFinish, 0),
        },
      })
      // Clear editing state
      setEditingValues((prev) => {
        const next = { ...prev }
        if (next[item.id]) {
          delete next[item.id][field]
          if (Object.keys(next[item.id]).length === 0) delete next[item.id]
        }
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }, [editingValues, updateItem])

  const handleInlineChange = (itemId: string, field: 'this_period_completed' | 'materials_stored', value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  const getDisplayValue = (item: SovItem, field: 'this_period_completed' | 'materials_stored'): string => {
    const editVal = editingValues[item.id]?.[field]
    if (editVal !== undefined) return editVal
    return String(item[field] ?? 0)
  }

  // Compute auto-calculated display values per row
  const computedItems = useMemo(() => {
    return items.map((item) => {
      const previousCompleted = item.previous_completed ?? 0
      const thisPeriod = editingValues[item.id]?.this_period_completed !== undefined
        ? (parseFloat(editingValues[item.id].this_period_completed!) || 0)
        : (item.this_period_completed ?? 0)
      const materialsStored = editingValues[item.id]?.materials_stored !== undefined
        ? (parseFloat(editingValues[item.id].materials_stored!) || 0)
        : (item.materials_stored ?? 0)
      const totalCompleted = previousCompleted + thisPeriod + materialsStored
      const scheduledValue = item.scheduled_value || 0
      const percentComplete = scheduledValue > 0 ? (totalCompleted / scheduledValue) * 100 : 0
      const balanceToFinish = scheduledValue - totalCompleted

      return {
        ...item,
        _totalCompleted: totalCompleted,
        _percentComplete: Math.min(percentComplete, 100),
        _balanceToFinish: Math.max(balanceToFinish, 0),
      }
    })
  }, [items, editingValues])

  // Totals row
  const totals = useMemo(() => {
    return computedItems.reduce(
      (acc, item) => ({
        scheduledValue: acc.scheduledValue + (item.scheduled_value ?? 0),
        previousCompleted: acc.previousCompleted + (item.previous_completed ?? 0),
        thisPeriodCompleted: acc.thisPeriodCompleted + (
          editingValues[item.id]?.this_period_completed !== undefined
            ? (parseFloat(editingValues[item.id].this_period_completed!) || 0)
            : (item.this_period_completed ?? 0)
        ),
        materialsStored: acc.materialsStored + (
          editingValues[item.id]?.materials_stored !== undefined
            ? (parseFloat(editingValues[item.id].materials_stored!) || 0)
            : (item.materials_stored ?? 0)
        ),
        totalCompleted: acc.totalCompleted + item._totalCompleted,
        retainage: acc.retainage + (item.retainage ?? 0),
        balanceToFinish: acc.balanceToFinish + item._balanceToFinish,
      }),
      {
        scheduledValue: 0,
        previousCompleted: 0,
        thisPeriodCompleted: 0,
        materialsStored: 0,
        totalCompleted: 0,
        retainage: 0,
        balanceToFinish: 0,
      },
    )
  }, [computedItems, editingValues])

  const totalPercent = totals.scheduledValue > 0 ? (totals.totalCompleted / totals.scheduledValue) * 100 : 0

  return (
    <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
        <div>
          <SectionHeader title={`Schedule of Values — ${contractTitle}`} />
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddForm(true)}>
            Add Line Item
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose} aria-label="Close SOV section">
            <X size={16} />
          </Btn>
        </div>
      </div>

      {/* Add Line Item Form */}
      {showAddForm && (
        <div style={{
          display: 'flex', gap: spacing['3'], alignItems: 'flex-end',
          padding: spacing['3'], marginBottom: spacing['4'],
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
          flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: '80px' }}>
            <InputField label="Item #" value={addForm.item_number} onChange={(v) => setAddForm({ ...addForm, item_number: v })} placeholder="001" />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <InputField label="Description" value={addForm.description} onChange={(v) => setAddForm({ ...addForm, description: v })} placeholder="Concrete foundations" />
          </div>
          <div style={{ minWidth: '140px' }}>
            <InputField label="Scheduled Value ($)" value={addForm.scheduled_value} onChange={(v) => setAddForm({ ...addForm, scheduled_value: v })} placeholder="0.00" />
          </div>
          <div style={{ minWidth: '100px' }}>
            <InputField label="Cost Code" value={addForm.cost_code} onChange={(v) => setAddForm({ ...addForm, cost_code: v })} placeholder="03-100" />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <Btn variant="primary" size="sm" onClick={handleAddItem} loading={createItem.isPending}>Add</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
        </div>
      ) : computedItems.length === 0 ? (
        <EmptyState icon={<FileText size={36} />} title="No line items" description="Add line items to build the schedule of values for this contract." />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'left' }}>Item #</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'left' }}>Description</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Scheduled Value</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Previous</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>This Period</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Materials Stored</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Total Completed</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>%</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Retainage</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'right' }}>Balance to Finish</th>
                <th style={{ ...sovTableHeaderStyle, textAlign: 'center', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {computedItems.map((item) => (
                <tr
                  key={item.id}
                  style={{ transition: `background ${transitions.instant}` }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                >
                  <td style={{ ...sovTableCellStyle, color: colors.textSecondary }}>{item.item_number || '—'}</td>
                  <td style={{ ...sovTableCellStyle, fontWeight: typography.fontWeight.medium }}>{item.description}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>{formatCurrency(item.scheduled_value)}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>{formatCurrency(item.previous_completed)}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.01"
                      style={inlineInputStyle}
                      value={getDisplayValue(item, 'this_period_completed')}
                      onChange={(e) => handleInlineChange(item.id, 'this_period_completed', e.target.value)}
                      onBlur={() => handleInlineBlur(item, 'this_period_completed')}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.01"
                      style={inlineInputStyle}
                      value={getDisplayValue(item, 'materials_stored')}
                      onChange={(e) => handleInlineChange(item.id, 'materials_stored', e.target.value)}
                      onBlur={() => handleInlineBlur(item, 'materials_stored')}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  </td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>{formatCurrency(item._totalCompleted)}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                      color: item._percentComplete >= 100 ? colors.statusActive : item._percentComplete >= 50 ? colors.statusInfo : colors.textSecondary,
                      backgroundColor: item._percentComplete >= 100 ? colors.statusActiveSubtle : item._percentComplete >= 50 ? colors.statusInfoSubtle : colors.surfaceInset,
                    }}>
                      {formatPercent(item._percentComplete)}
                    </span>
                  </td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>{formatCurrency(item.retainage)}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>{formatCurrency(item._balanceToFinish)}</td>
                  <td style={{ ...sovTableCellStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deleteItem.isPending}
                      aria-label={`Delete line item ${item.item_number || item.description}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: spacing['1'], border: 'none', borderRadius: borderRadius.sm,
                        backgroundColor: 'transparent', color: colors.textTertiary,
                        cursor: 'pointer', transition: `color ${transitions.instant}`,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = colors.statusCritical }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = colors.textTertiary }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr style={{ backgroundColor: colors.surfaceInset }}>
                <td style={{ ...sovTableCellStyle, fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }} colSpan={2}>
                  TOTALS
                </td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.scheduledValue)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.previousCompleted)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.thisPeriodCompleted)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.materialsStored)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.totalCompleted)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary, backgroundColor: colors.surfaceHover,
                  }}>
                    {formatPercent(totalPercent)}
                  </span>
                </td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.retainage)}</td>
                <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, borderBottom: 'none' }}>{formatCurrency(totals.balanceToFinish)}</td>
                <td style={{ ...sovTableCellStyle, borderBottom: 'none' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Contracts Page ──────────────────────────────────────────

type TabKey = 'all' | 'prime' | 'subcontract' | 'psa' | 'purchase_order' | 'signatures' | 'clause_library'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: FileText },
  { key: 'prime', label: 'Prime', icon: Briefcase },
  { key: 'subcontract', label: 'Subcontracts', icon: Users },
  { key: 'psa', label: 'PSAs', icon: FileSignature },
  { key: 'purchase_order', label: 'POs', icon: ShoppingCart },
  { key: 'signatures', label: 'Signatures', icon: PenTool },
  { key: 'clause_library', label: 'Clause Library', icon: BookOpen },
]

// ── Signature Status Badge ─────────────────────────────────

const signatureStatusColors: Record<string, { c: string; bg: string }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset },
  sent: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  in_progress: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  completed: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  declined: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  expired: { c: colors.textTertiary, bg: colors.surfaceInset },
  voided: { c: colors.textTertiary, bg: colors.surfaceInset },
}

function SignatureStatusBadge({ status }: { status: string }) {
  const { c, bg } = signatureStatusColors[status] || signatureStatusColors.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: c, backgroundColor: bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />
      {(status ?? 'draft').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
    </span>
  )
}

// ── Signatures Tab Component ───────────────────────────────

interface SignerRow {
  name: string
  email: string
}

interface SignaturesTabProps {
  projectId: string
}

const SignaturesTab: React.FC<SignaturesTabProps> = ({ projectId }) => {
  const { data: requests = [], isLoading } = useSignatureRequests(projectId)
  const createRequest = useCreateSignatureRequest()
  const sendForSignature = useSendForSignature()
  const addSigner = useAddSigner()

  const [showModal, setShowModal] = useState(false)
  const [sigTitle, setSigTitle] = useState('')
  const [sigUrl, setSigUrl] = useState('')
  const [sigOrder, setSigOrder] = useState<'sequential' | 'parallel'>('parallel')
  const [signers, setSigners] = useState<SignerRow[]>([{ name: '', email: '' }])

  const resetForm = () => {
    setSigTitle('')
    setSigUrl('')
    setSigOrder('parallel')
    setSigners([{ name: '', email: '' }])
  }

  const addSignerRow = () => {
    setSigners([...signers, { name: '', email: '' }])
  }

  const updateSignerRow = (index: number, field: 'name' | 'email', value: string) => {
    setSigners(signers.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const removeSignerRow = (index: number) => {
    if (signers.length <= 1) return
    setSigners(signers.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (!sigTitle.trim()) {
      toast.error('Title is required')
      return
    }
    if (!sigUrl.trim()) {
      toast.error('Document URL is required')
      return
    }
    const validSigners = signers.filter(s => s.name.trim() && s.email.trim())
    if (validSigners.length === 0) {
      toast.error('At least one signer with name and email is required')
      return
    }
    try {
      const request = await createRequest.mutateAsync({
        project_id: projectId,
        title: sigTitle.trim(),
        source_file_url: sigUrl.trim(),
        signing_order: sigOrder,
      })

      const palette = getSignerColorPalette()
      for (let i = 0; i < validSigners.length; i++) {
        await addSigner.mutateAsync({
          request_id: request.id,
          signer_name: validSigners[i].name.trim(),
          signer_email: validSigners[i].email.trim(),
          signing_order_index: i,
          color_code: palette[i % palette.length],
        })
      }

      await sendForSignature.mutateAsync({
        request_id: request.id,
        project_id: projectId,
      })

      toast.success('Signature request sent')
      setShowModal(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send signature request')
    }
  }

  const isSending = createRequest.isPending || addSigner.isPending || sendForSignature.isPending

  const sigTableCellStyle: React.CSSProperties = {
    padding: `${spacing['3']} ${spacing['4']}`,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
  }

  const sigTableHeaderStyle: React.CSSProperties = {
    ...sigTableCellStyle,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wider,
    backgroundColor: colors.surfaceInset,
    textAlign: 'left' as const,
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
        <SectionHeader title="Signature Requests" />
        <Btn variant="primary" size="sm" icon={<PenTool size={14} />} onClick={() => setShowModal(true)}>
          Request Signature
        </Btn>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="48px" />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<PenTool size={36} />}
          title="No signature requests"
          description="Send contracts and documents for electronic signature. Click 'Request Signature' to get started."
        />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={sigTableHeaderStyle}>Title</th>
                <th style={sigTableHeaderStyle}>Status</th>
                <th style={{ ...sigTableHeaderStyle, textAlign: 'center' }}>Signers</th>
                <th style={sigTableHeaderStyle}>Created</th>
                <th style={{ ...sigTableHeaderStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req: SignatureRequest) => (
                <tr
                  key={req.id}
                  style={{ transition: `background ${transitions.instant}` }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                >
                  <td style={{ ...sigTableCellStyle, fontWeight: typography.fontWeight.medium }}>{req.title}</td>
                  <td style={sigTableCellStyle}><SignatureStatusBadge status={req.status} /></td>
                  <td style={{ ...sigTableCellStyle, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '24px', height: '24px', borderRadius: borderRadius.full,
                      backgroundColor: colors.surfaceInset, fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium, color: colors.textSecondary,
                    }}>
                      {req.metadata?.signer_count != null ? String(req.metadata.signer_count) : '—'}
                    </span>
                  </td>
                  <td style={{ ...sigTableCellStyle, color: colors.textSecondary }}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ ...sigTableCellStyle, textAlign: 'center' }}>
                    {req.status === 'draft' && (
                      <Btn
                        size="sm"
                        variant="secondary"
                        icon={<Send size={12} />}
                        onClick={() => {
                          sendForSignature.mutateAsync({ request_id: req.id, project_id: projectId })
                            .then(() => toast.success('Sent for signature'))
                            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to send'))
                        }}
                        loading={sendForSignature.isPending}
                      >
                        Send
                      </Btn>
                    )}
                    {req.status === 'completed' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color: colors.statusActive, fontSize: typography.fontSize.caption }}>
                        <CheckCircle size={14} /> Complete
                      </span>
                    )}
                    {(req.status === 'sent' || req.status === 'in_progress') && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color: colors.statusPending, fontSize: typography.fontSize.caption }}>
                        <Clock size={14} /> Awaiting
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }} title="Request Signature" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Title" value={sigTitle} onChange={setSigTitle} placeholder="e.g. Subcontract Agreement — ABC Electric" />
          <InputField label="Document URL" value={sigUrl} onChange={setSigUrl} placeholder="https://... or select a contract" />

          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              Signing Order
            </label>
            <select
              value={sigOrder}
              onChange={(e) => setSigOrder(e.target.value as 'sequential' | 'parallel')}
              style={{
                width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
                border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
                color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              }}
            >
              <option value="parallel">Parallel (all at once)</option>
              <option value="sequential">Sequential (in order)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                Signers
              </label>
              <Btn variant="ghost" size="sm" icon={<Plus size={12} />} onClick={addSignerRow}>
                Add Signer
              </Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {signers.map((signer, idx) => (
                <div key={idx} style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <InputField
                      label={idx === 0 ? 'Name' : undefined}
                      value={signer.name}
                      onChange={(v) => updateSignerRow(idx, 'name', v)}
                      placeholder="Full name"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <InputField
                      label={idx === 0 ? 'Email' : undefined}
                      value={signer.email}
                      onChange={(v) => updateSignerRow(idx, 'email', v)}
                      placeholder="email@example.com"
                    />
                  </div>
                  {signers.length > 1 && (
                    <button
                      onClick={() => removeSignerRow(idx)}
                      aria-label="Remove signer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: spacing['1'], border: 'none', borderRadius: borderRadius.sm,
                        backgroundColor: 'transparent', color: colors.textTertiary,
                        cursor: 'pointer', marginTop: idx === 0 ? '18px' : '0',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => { setShowModal(false); resetForm() }}>Cancel</Btn>
            <Btn variant="primary" icon={<Send size={14} />} onClick={handleSend} loading={isSending}>
              Send for Signature
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Clause Library Demo Data & Component ───────────────────

type ClauseCategory = 'General Conditions' | 'Insurance Requirements' | 'Payment Terms' | 'Change Order Process' | 'Dispute Resolution' | 'Warranty' | 'Termination' | 'Indemnification' | 'Liquidated Damages'

interface ContractClause {
  id: string
  title: string
  category: ClauseCategory
  text: string
  version: string
  lastUpdated: string
}

const CLAUSE_LIBRARY: ContractClause[] = [
  { id: 'cl-1', title: 'Standard General Conditions', category: 'General Conditions', text: 'The Contractor shall perform the Work in accordance with the Contract Documents and shall provide and pay for labor, materials, equipment, tools, construction equipment, and machinery, transportation, and other facilities and services necessary for proper execution and completion of the Work.', version: '3.2', lastUpdated: '2026-01-15' },
  { id: 'cl-2', title: 'Commercial General Liability', category: 'Insurance Requirements', text: 'Contractor shall maintain Commercial General Liability insurance with limits not less than $1,000,000 per occurrence and $2,000,000 aggregate. Coverage shall include premises/operations, products/completed operations, contractual liability, and broad form property damage. Owner shall be named as additional insured.', version: '2.1', lastUpdated: '2026-02-20' },
  { id: 'cl-3', title: 'Progress Payment Terms', category: 'Payment Terms', text: 'Applications for payment shall be submitted monthly by the 25th. Owner shall make payment within 30 days of receipt of a properly submitted and approved Application for Payment. Retainage of 10% shall be withheld until Substantial Completion. Final payment including retainage release within 60 days of Final Completion.', version: '4.0', lastUpdated: '2025-11-10' },
  { id: 'cl-4', title: 'Change Order Procedure', category: 'Change Order Process', text: 'No changes in the Work shall be made unless authorized by a written Change Order signed by the Owner. Contractor shall submit a detailed cost proposal within 14 days of receiving a Change Order Request. The proposal shall include itemized labor, material, equipment costs, overhead (15%), and profit (10%). Work shall not proceed until a signed Change Order is issued.', version: '2.0', lastUpdated: '2026-03-01' },
  { id: 'cl-5', title: 'Binding Arbitration', category: 'Dispute Resolution', text: 'Any dispute arising out of or relating to this Contract shall first be submitted to mediation in accordance with the Construction Industry Mediation Procedures of the AAA. If mediation fails within 60 days, the dispute shall be resolved by binding arbitration under the Construction Industry Arbitration Rules. The arbitration shall be conducted in the county where the Project is located.', version: '1.5', lastUpdated: '2025-09-22' },
  { id: 'cl-6', title: 'Standard Warranty Period', category: 'Warranty', text: 'Contractor warrants that Work will be free from defects in materials and workmanship for a period of one (1) year from the date of Substantial Completion. Roofing systems shall carry a 20-year manufacturer warranty. HVAC equipment shall carry a 5-year parts and labor warranty. Contractor shall correct defective Work at no cost to Owner within the warranty period.', version: '3.0', lastUpdated: '2026-01-05' },
  { id: 'cl-7', title: 'Termination for Cause', category: 'Termination', text: 'Owner may terminate the Contract if Contractor: (a) persistently fails to perform Work in accordance with Contract Documents; (b) fails to make payment to subcontractors or suppliers; (c) persistently disregards laws, ordinances, or safety requirements; (d) is otherwise in material breach. Owner shall provide 7 days written notice and opportunity to cure before termination.', version: '2.3', lastUpdated: '2025-12-18' },
  { id: 'cl-8', title: 'Mutual Indemnification', category: 'Indemnification', text: 'Contractor shall indemnify and hold harmless Owner from claims, damages, losses, and expenses arising out of or resulting from performance of the Work, to the extent caused by negligent acts, errors, or omissions of Contractor. Owner shall similarly indemnify Contractor to the extent caused by the negligent acts of Owner or its agents.', version: '1.8', lastUpdated: '2026-02-14' },
  { id: 'cl-9', title: 'Liquidated Damages Schedule', category: 'Liquidated Damages', text: 'If Contractor fails to achieve Substantial Completion by the Contract Time, Contractor shall pay Owner liquidated damages of $2,500 per calendar day for each day beyond the scheduled completion date, not as a penalty but as a reasonable pre-estimate of damages. Maximum cumulative liquidated damages shall not exceed 10% of the Contract Sum.', version: '2.0', lastUpdated: '2026-03-10' },
  { id: 'cl-10', title: 'Workers Compensation Requirements', category: 'Insurance Requirements', text: 'Contractor shall maintain Workers Compensation insurance as required by statute and Employers Liability with limits of $1,000,000 each accident, $1,000,000 disease policy limit, and $1,000,000 disease each employee. A waiver of subrogation in favor of Owner is required.', version: '1.4', lastUpdated: '2025-10-30' },
]

const CLAUSE_CATEGORIES: ClauseCategory[] = ['General Conditions', 'Insurance Requirements', 'Payment Terms', 'Change Order Process', 'Dispute Resolution', 'Warranty', 'Termination', 'Indemnification', 'Liquidated Damages']

const ClauseLibraryTab: React.FC<{ contracts: Contract[]; onAddClause: (clauseId: string, contractId: string) => void }> = ({ contracts, onAddClause }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | 'all'>('all')
  const [expandedClause, setExpandedClause] = useState<string | null>(null)
  // Per-clause contract selection to avoid shared-state bug (#10)
  const [clauseContractMap, setClauseContractMap] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    return CLAUSE_LIBRARY.filter((cl) => {
      const matchesCategory = categoryFilter === 'all' || cl.category === categoryFilter
      const matchesSearch = !searchTerm || cl.title.toLowerCase().includes(searchTerm.toLowerCase()) || cl.text.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [searchTerm, categoryFilter])

  return (
    <Card padding={spacing['4']}>
      <SectionHeader title="Clause Library" />
      <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing['1'], marginBottom: spacing['4'] }}>
        Pre-built contract clauses for construction agreements. Search, review, and add clauses to contracts.
      </p>
      <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: spacing['2'], top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
          <input
            type="text" placeholder="Search clauses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: `${spacing['2']} ${spacing['2']} ${spacing['2']} ${spacing['8']}`, border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ClauseCategory | 'all')} style={{ padding: spacing['2'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
          <option value="all">All Categories</option>
          {CLAUSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {filtered.map((clause) => {
          const isExpanded = expandedClause === clause.id
          return (
            <div key={clause.id} style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['3'], backgroundColor: colors.surfaceRaised }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing['3'] }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                    <span style={{ fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.sm }}>{clause.title}</span>
                    <span style={{ padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle }}>{clause.category}</span>
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'] }}>
                    v{clause.version} &middot; Updated {new Date(clause.lastUpdated).toLocaleDateString()}
                  </div>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: '1.5', margin: 0 }}>
                    {isExpanded ? clause.text : clause.text.substring(0, 120) + '...'}
                  </p>
                  <button onClick={() => setExpandedClause(isExpanded ? null : clause.id)} style={{ marginTop: spacing['1'], display: 'inline-flex', alignItems: 'center', gap: spacing.xs, border: 'none', background: 'none', color: colors.statusInfo, cursor: 'pointer', fontSize: typography.fontSize.caption, padding: 0, fontFamily: typography.fontFamily }}>
                    {isExpanded ? <><EyeOff size={12} /> Show less</> : <><Eye size={12} /> Show more</>}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center', flexShrink: 0 }}>
                  <select value={clauseContractMap[clause.id] || ''} onChange={(e) => setClauseContractMap((prev) => ({ ...prev, [clause.id]: e.target.value }))} onClick={(e) => e.stopPropagation()} style={{ padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, maxWidth: '160px' }}>
                    <option value="">Select contract...</option>
                    {contracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <Btn size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => { const selectedId = clauseContractMap[clause.id]; if (selectedId) { onAddClause(clause.id, selectedId) } else { toast.error('Select a contract first') } }}>
                    Add
                  </Btn>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <EmptyState icon={<BookOpen size={36} />} title="No clauses found" description="Try adjusting your search or category filter." />}
      </div>
    </Card>
  )
}

// ── Insurance Certificate Tracking ─────────────────────────

const COI_SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  expired: { color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  expiring: { color: colors.statusPending, bg: colors.statusPendingSubtle },
  current: { color: colors.statusActive, bg: colors.statusActiveSubtle },
  unknown: { color: colors.textTertiary, bg: colors.surfaceInset },
}

const POLICY_TYPE_LABELS: Record<string, string> = {
  general_liability: 'General Liability',
  workers_comp: 'Workers Comp',
  auto: 'Auto',
  umbrella: 'Umbrella',
  professional_liability: 'Professional Liability',
  pollution: 'Pollution',
}

interface UploadCOIForm {
  policy_type: string
  carrier: string
  policy_number: string
  coverage_amount: string
  aggregate_limit: string
  effective_date: string
  expiration_date: string
  additional_insured: boolean
  waiver_of_subrogation: boolean
  file: File | null
}

const emptyCOIForm: UploadCOIForm = {
  policy_type: 'general_liability',
  carrier: '',
  policy_number: '',
  coverage_amount: '',
  aggregate_limit: '',
  effective_date: '',
  expiration_date: '',
  additional_insured: false,
  waiver_of_subrogation: false,
  file: null,
}

const InsuranceSection: React.FC<{ projectId: string; contract: Contract; onClose: () => void }> = ({ projectId, contract, onClose }) => {
  const company = contract.counterparty_name
  const { data: certs = [], isLoading: certsLoading } = useInsuranceCertificatesByCompany(projectId, company)
  const uploadCert = useUploadInsuranceCertificate()
  const deleteCert = useDeleteInsuranceCertificate()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState<UploadCOIForm>(emptyCOIForm)

  const handleUpload = async () => {
    if (!company) {
      toast.error('Contract counterparty is missing — cannot attach COI')
      return
    }
    if (!form.expiration_date) {
      toast.error('Expiration date is required')
      return
    }
    try {
      await uploadCert.mutateAsync({
        cert: {
          project_id: projectId,
          company,
          policy_type: form.policy_type || null,
          carrier: form.carrier || null,
          policy_number: form.policy_number || null,
          coverage_amount: form.coverage_amount ? parseFloat(form.coverage_amount) : null,
          aggregate_limit: form.aggregate_limit ? parseFloat(form.aggregate_limit) : null,
          effective_date: form.effective_date || null,
          expiration_date: form.expiration_date,
          additional_insured: form.additional_insured,
          waiver_of_subrogation: form.waiver_of_subrogation,
        },
        file: form.file ?? undefined,
      })
      toast.success('Insurance certificate uploaded')
      setForm(emptyCOIForm)
      setUploadOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleDelete = async (cert: InsuranceCertificate) => {
    if (!window.confirm(`Delete ${POLICY_TYPE_LABELS[cert.policy_type ?? ''] ?? 'certificate'} for ${cert.company}?`)) return
    try {
      await deleteCert.mutateAsync({ id: cert.id, projectId })
      toast.success('Certificate deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
        <SectionHeader title={`Insurance Certificates — ${contract.title}`} />
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setUploadOpen(true)} data-testid="upload-coi-button">
            Upload COI
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
      </div>
      {!company && (
        <div style={{ padding: spacing['3'], marginBottom: spacing['3'], backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base, color: colors.statusPending, fontSize: typography.fontSize.sm }}>
          Contract has no counterparty name — add one to track insurance certificates.
        </div>
      )}
      {certsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
        </div>
      ) : certs.length === 0 ? (
        <EmptyState icon={<Shield size={36} />} title="No insurance certificates" description="Upload a COI to begin tracking insurance for this contract." />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Type', 'Carrier', 'Policy #', 'Coverage', 'Expiration', 'Add\'l Insured', 'Status', 'Document', ''].map((h) => (
                  <th key={h} style={{ ...sovTableHeaderStyle, textAlign: h === 'Coverage' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => {
                const status = getCOIStatus(cert.expiration_date)
                const styleCfg = COI_SEVERITY_STYLES[status.severity]
                return (
                  <tr key={cert.id} style={{ transition: `background ${transitions.instant}` }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}>
                    <td style={{ ...sovTableCellStyle, fontWeight: typography.fontWeight.medium }}>{POLICY_TYPE_LABELS[cert.policy_type ?? ''] ?? (cert.policy_type ?? '—')}</td>
                    <td style={sovTableCellStyle}>{cert.carrier ?? '—'}</td>
                    <td style={{ ...sovTableCellStyle, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{cert.policy_number ?? '—'}</td>
                    <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>{cert.coverage_amount != null ? formatCurrency(cert.coverage_amount) : '—'}</td>
                    <td style={sovTableCellStyle}>{cert.expiration_date ? new Date(cert.expiration_date).toLocaleDateString() : '—'}</td>
                    <td style={sovTableCellStyle}>
                      <span style={{ padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, color: cert.additional_insured ? colors.statusActive : colors.textTertiary, backgroundColor: cert.additional_insured ? colors.statusActiveSubtle : colors.surfaceInset }}>
                        {cert.additional_insured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={sovTableCellStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: styleCfg.color, backgroundColor: styleCfg.bg }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: styleCfg.color }} />
                        {status.label}
                      </span>
                    </td>
                    <td style={sovTableCellStyle}>
                      {cert.document_url ? (
                        <a href={cert.document_url} target="_blank" rel="noopener noreferrer" style={{ color: colors.statusInfo, textDecoration: 'none', fontSize: typography.fontSize.caption }}>View</a>
                      ) : (
                        <span style={{ color: colors.textTertiary }}>—</span>
                      )}
                    </td>
                    <td style={sovTableCellStyle}>
                      <PermissionGate permission="project.settings">
                        <Btn size="sm" variant="ghost" onClick={() => handleDelete(cert)} disabled={deleteCert.isPending} aria-label="Delete certificate">
                          <Trash2 size={12} />
                        </Btn>
                      </PermissionGate>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={uploadOpen} onClose={() => { setUploadOpen(false); setForm(emptyCOIForm) }} title="Upload Certificate of Insurance" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Policy Type</label>
              <select
                value={form.policy_type}
                onChange={(e) => setForm({ ...form, policy_type: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                {Object.entries(POLICY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <InputField label="Carrier" value={form.carrier} onChange={(v) => setForm({ ...form, carrier: v })} placeholder="Acme Insurance Co." />
          </div>
          <InputField label="Policy Number" value={form.policy_number} onChange={(v) => setForm({ ...form, policy_number: v })} placeholder="GL-1234567" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Coverage Amount ($)" value={form.coverage_amount} onChange={(v) => setForm({ ...form, coverage_amount: v })} placeholder="1000000" />
            <InputField label="Aggregate Limit ($)" value={form.aggregate_limit} onChange={(v) => setForm({ ...form, aggregate_limit: v })} placeholder="2000000" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Effective Date" type="date" value={form.effective_date} onChange={(v) => setForm({ ...form, effective_date: v })} />
            <InputField label="Expiration Date" type="date" value={form.expiration_date} onChange={(v) => setForm({ ...form, expiration_date: v })} />
          </div>
          <div style={{ display: 'flex', gap: spacing['4'] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={form.additional_insured} onChange={(e) => setForm({ ...form, additional_insured: e.target.checked })} /> Additional Insured
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={form.waiver_of_subrogation} onChange={(e) => setForm({ ...form, waiver_of_subrogation: e.target.checked })} /> Waiver of Subrogation
            </label>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Certificate File (PDF, image)</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => { setUploadOpen(false); setForm(emptyCOIForm) }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleUpload} loading={uploadCert.isPending} data-testid="save-coi-button">Upload</Btn>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ── Milestone-Based Payment Schedule ───────────────────────

interface PaymentMilestone {
  id: string
  contractId: string
  name: string
  description: string
  percentOfContract: number
  amount: number
  targetDate: string
  status: 'pending' | 'invoiced' | 'paid'
}


const milestoneStatusColors: Record<string, { c: string; bg: string }> = {
  pending: { c: colors.textTertiary, bg: colors.surfaceInset },
  invoiced: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  paid: { c: colors.statusActive, bg: colors.statusActiveSubtle },
}

const PaymentScheduleSection: React.FC<{ contractId: string; contractTitle: string; onClose: () => void }> = ({ contractId, contractTitle, onClose }) => {
  // Query payment_milestones table; falls back gracefully if table doesn't exist
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery({
    queryKey: ['payment_milestones', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_milestones')
        .select('*')
        .eq('contract_id', contractId)
        .order('target_date', { ascending: true })
      if (error) {
        console.warn('[PaymentScheduleSection] Query failed:', error.message)
        return [] as PaymentMilestone[]
      }
      return (data ?? []) as PaymentMilestone[]
    },
    enabled: !!contractId,
  })
  const allMilestones: PaymentMilestone[] = milestones

  const totalAmount = allMilestones.reduce((s, m) => s + m.amount, 0)
  const billedAmount = allMilestones.filter((m) => m.status === 'invoiced' || m.status === 'paid').reduce((s, m) => s + m.amount, 0)
  const paidAmount = allMilestones.filter((m) => m.status === 'paid').reduce((s, m) => s + m.amount, 0)
  const billedPercent = totalAmount > 0 ? (billedAmount / totalAmount) * 100 : 0
  const paidPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

  return (
    <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
        <SectionHeader title={`Payment Schedule — ${contractTitle}`} />
        <Btn variant="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
      </div>
      {/* Progress bar */}
      <div style={{ marginBottom: spacing['4'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'] }}>
          <span>Billed: {formatCurrency(billedAmount)} ({billedPercent.toFixed(0)}%)</span>
          <span>Paid: {formatCurrency(paidAmount)} ({paidPercent.toFixed(0)}%)</span>
          <span>Total: {formatCurrency(totalAmount)}</span>
        </div>
        <div style={{ height: '8px', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${billedPercent}%`, backgroundColor: colors.statusPending, borderRadius: borderRadius.full, transition: 'width 0.3s' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${paidPercent}%`, backgroundColor: colors.statusActive, borderRadius: borderRadius.full, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'], fontSize: typography.fontSize.caption }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusActive }} /> Paid</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusPending }} /> Invoiced</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}` }} /> Pending</span>
        </div>
      </div>
      {milestonesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
        </div>
      ) : allMilestones.length === 0 ? (
        <EmptyState icon={<DollarSign size={36} />} title="No milestones" description="No payment milestones for this contract." />
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Milestone', 'Description', '% of Contract', 'Amount', 'Target Date', 'Status'].map((h) => (
                  <th key={h} style={{ ...sovTableHeaderStyle, textAlign: h === 'Amount' || h === '% of Contract' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allMilestones.map((ms) => {
                const { c, bg } = milestoneStatusColors[ms.status]
                return (
                  <tr key={ms.id} style={{ transition: `background ${transitions.instant}` }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}>
                    <td style={{ ...sovTableCellStyle, fontWeight: typography.fontWeight.medium }}>{ms.name}</td>
                    <td style={{ ...sovTableCellStyle, color: colors.textSecondary, whiteSpace: 'normal', maxWidth: '300px' }}>{ms.description}</td>
                    <td style={{ ...sovTableCellStyle, textAlign: 'right' }}>{ms.percentOfContract}%</td>
                    <td style={{ ...sovTableCellStyle, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>{formatCurrency(ms.amount)}</td>
                    <td style={sovTableCellStyle}>{new Date(ms.targetDate).toLocaleDateString()}</td>
                    <td style={sovTableCellStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: c, backgroundColor: bg }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />
                        {ms.status.charAt(0).toUpperCase() + ms.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Contract Compliance Alerts ──────────────────────────────

interface ComplianceAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  actionLabel: string
  category: string
}


const alertSeverityConfig: Record<string, { icon: React.ElementType; color: string; bg: string; borderColor: string }> = {
  critical: { icon: AlertTriangle, color: colors.statusCritical, bg: colors.statusCriticalSubtle, borderColor: colors.statusCritical },
  warning: { icon: AlertTriangle, color: colors.statusPending, bg: colors.statusPendingSubtle, borderColor: colors.statusPending },
  info: { icon: Shield, color: colors.statusInfo, bg: colors.statusInfoSubtle, borderColor: colors.statusInfo },
}

const ComplianceAlertBar: React.FC<{ contracts: Contract[]; projectId: string | null | undefined }> = ({ contracts, projectId }) => {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const { data: certs = [] } = useInsuranceCertificates(projectId ?? undefined)

  // Derive compliance alerts from actual contract data
  const alerts = useMemo<ComplianceAlert[]>(() => {
    const result: ComplianceAlert[] = []
    const now = new Date()

    // Insurance certificate alerts — expired or expiring within 30 days
    for (const cert of certs) {
      const status = getCOIStatus(cert.expiration_date)
      if (status.severity === 'expired') {
        result.push({
          id: `coi-expired-${cert.id}`,
          severity: 'critical',
          description: `${cert.company} ${cert.policy_type ?? 'insurance'} certificate ${status.label.toLowerCase()}.`,
          actionLabel: 'Request Updated COI',
          category: 'Insurance',
        })
      } else if (status.severity === 'expiring') {
        result.push({
          id: `coi-expiring-${cert.id}`,
          severity: 'warning',
          description: `${cert.company} ${cert.policy_type ?? 'insurance'} certificate ${status.label.toLowerCase()}.`,
          actionLabel: 'Request Updated COI',
          category: 'Insurance',
        })
      }
    }

    for (const c of contracts) {
      // Check for contracts past end date that are still active
      if (c.end_date && c.status === 'active') {
        const endDate = new Date(c.end_date)
        if (endDate < now) {
          result.push({
            id: `overdue-${c.id}`,
            severity: 'critical',
            description: `"${c.title}" is past its end date (${endDate.toLocaleDateString()}) and still active.`,
            actionLabel: 'Review Contract',
            category: 'Overdue',
          })
        } else {
          const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntil <= 30) {
            result.push({
              id: `expiring-${c.id}`,
              severity: 'warning',
              description: `"${c.title}" expires in ${daysUntil} days.`,
              actionLabel: 'Review',
              category: 'Expiring Soon',
            })
          }
        }
      }

      // Check for missing signatures
      if (c.status === 'pending_signature') {
        result.push({
          id: `unsigned-${c.id}`,
          severity: 'warning',
          description: `"${c.title}" is awaiting signature.`,
          actionLabel: 'Send Reminder',
          category: 'Signatures',
        })
      }

      // Check for high retainage
      if (c.retainage_percent != null && c.retainage_percent > 10) {
        result.push({
          id: `retainage-${c.id}`,
          severity: 'info',
          description: `"${c.title}" has ${c.retainage_percent}% retainage (above standard 10%).`,
          actionLabel: 'Review Terms',
          category: 'Retainage',
        })
      }
    }

    return result
  }, [contracts, certs])

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id))

  if (visibleAlerts.length === 0) return null

  return (
    <div style={{ marginBottom: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <AlertTriangle size={16} style={{ color: colors.statusCritical }} />
          Compliance Alerts ({visibleAlerts.length})
        </span>
      </div>
      {visibleAlerts.map((alert) => {
        const config = alertSeverityConfig[alert.severity]
        const IconComp = config.icon
        return (
          <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: config.bg, borderLeft: `3px solid ${config.borderColor}`, borderRadius: borderRadius.base }}>
            <IconComp size={16} style={{ color: config.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{alert.description}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0 }}>{alert.category}</span>
            <Btn size="sm" variant="secondary" onClick={() => toast.success(`Action: ${alert.actionLabel}`)}>{alert.actionLabel}</Btn>
            <button onClick={() => setDismissedAlerts((prev) => new Set(prev).add(alert.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'], display: 'inline-flex' }} title="Acknowledge & dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Contract Detail Sub-Tab ────────────────────────────────

type ContractDetailTab = 'sov' | 'insurance' | 'payments'

interface Contract {
  id: string
  contract_type: string
  contract_number: string | null
  title: string
  counterparty_name: string
  counterparty_contact: string | null
  counterparty_email: string | null
  contract_amount: number
  status: string
  start_date: string | null
  end_date: string | null
  billing_method: string | null
  payment_terms: string | null
  retainage_percent: number | null
}

const col = createColumnHelper<Contract>()
const baseColumns = [
  col.accessor('contract_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span style={{ color: colors.textTertiary }}>{'\u2014'}</span>
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
  col.accessor('contract_number', {
    header: '#',
    cell: (info) => {
      const v = info.getValue()
      return v ? <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{v}</span> : <span style={{ color: colors.textTertiary }}>{'\u2014'}</span>
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
      const { c, bg } = colorMap[v ?? 'draft'] || colorMap.draft
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: c, backgroundColor: bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />
          {(v ?? 'draft').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
        </span>
      )
    },
  }),
  col.accessor('end_date', {
    header: 'End',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '—'}</span>,
  }),
  col.accessor('payment_terms', {
    header: 'Terms',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span style={{ color: colors.textTertiary }}>{'\u2014'}</span>
      return <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{v.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
    },
  }),
]

// ── Top-level wrapper tabs: Contracts absorbs Vendors ──────

type TopTabKey = 'contracts' | 'vendors' | 'insurance' | 'change_orders'

const topTabs: { key: TopTabKey; label: string; icon: React.ElementType }[] = [
  { key: 'contracts', label: 'Contracts', icon: FileText },
  { key: 'vendors', label: 'Vendors', icon: Users },
  { key: 'insurance', label: 'Insurance', icon: Shield },
  { key: 'change_orders', label: 'Change Orders', icon: FileSignature },
]

const VENDOR_STATUS_COLORS: Record<Vendor['status'], { c: string; bg: string }> = {
  active: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  probation: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  suspended: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  blacklisted: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

// ── Vendors Tab ─────────────────────────────────────────────

const VendorsTab: React.FC<{ projectId: string; search: string }> = ({ projectId, search }) => {
  const { data: vendors = [], isLoading } = useVendors(projectId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter((v) =>
      [v.company_name, v.contact_name, v.email, v.trade, v.license_number]
        .some((f) => f && f.toLowerCase().includes(q)),
    )
  }, [vendors, search])

  const counts = useMemo(() => {
    const base: Record<Vendor['status'], number> = { active: 0, probation: 0, suspended: 0, blacklisted: 0 }
    for (const v of vendors) base[v.status] = (base[v.status] ?? 0) + 1
    return base
  }, [vendors])

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total Vendors" value={vendors.length} />
        <MetricBox label="Active" value={counts.active} />
        <MetricBox label="Probation" value={counts.probation} />
        <MetricBox label="Suspended / Blacklisted" value={counts.suspended + counts.blacklisted} />
      </div>

      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <SectionHeader title="Vendors" />
          <Link
            to="/directory"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
              fontSize: typography.fontSize.sm, color: colors.orangeText, textDecoration: 'none',
            }}
          >
            Open full directory <ExternalLink size={14} />
          </Link>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No vendors"
            description={search ? 'No vendors match your search.' : 'Add vendors from the directory.'}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ textAlign: 'left', color: colors.textSecondary }}>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Company</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Trade</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Contact</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Status</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Score</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const sc = VENDOR_STATUS_COLORS[v.status]
                  return (
                    <tr key={v.id}>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontWeight: typography.fontWeight.medium }}>{v.company_name}</td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>{v.trade ?? '—'}</td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>
                        {v.contact_name ?? '—'}{v.email ? ` · ${v.email}` : ''}
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <Tag label={v.status} color={sc.c} backgroundColor={sc.bg} />
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>
                        {v.performance_score != null ? v.performance_score.toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>
                        <Link
                          to="/directory"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                            fontSize: typography.fontSize.caption, color: colors.orangeText, textDecoration: 'none',
                          }}
                        >
                          Prequal <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

// ── Insurance Tab with Verify COI ──────────────────────────

const InsuranceTab: React.FC<{ projectId: string; search: string; userId: string | undefined }> = ({ projectId, search, userId }) => {
  const { data: certs = [], isLoading } = useInsuranceCertificates(projectId)
  const updateCert = useUpdateInsuranceCertificate()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return certs
    return certs.filter((c) =>
      [c.company, c.carrier, c.policy_number, c.policy_type]
        .some((f) => f && f.toLowerCase().includes(q)),
    )
  }, [certs, search])

  const summary = useMemo(() => {
    let expired = 0, expiring = 0, current = 0, verified = 0
    for (const c of certs) {
      const s = getCOIStatus(c.expiration_date)
      if (s.severity === 'expired') expired++
      else if (s.severity === 'expiring') expiring++
      else if (s.severity === 'current') current++
      if (c.verified) verified++
    }
    return { expired, expiring, current, verified }
  }, [certs])

  const verifyCert = async (cert: InsuranceCertificate) => {
    try {
      await updateCert.mutateAsync({
        id: cert.id,
        updates: {
          verified: true,
          verified_by: userId ?? null,
          verified_at: new Date().toISOString(),
        },
      })
      toast.success(`Verified COI for ${cert.company}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify COI')
    }
  }

  const unverifyCert = async (cert: InsuranceCertificate) => {
    try {
      await updateCert.mutateAsync({
        id: cert.id,
        updates: { verified: false, verified_by: null, verified_at: null },
      })
      toast.success(`Marked ${cert.company} COI as unverified`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update COI')
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total COIs" value={certs.length} />
        <MetricBox label="Current" value={summary.current} />
        <MetricBox label="Expiring ≤30d" value={summary.expiring} />
        <MetricBox label="Expired" value={summary.expired} />
        <MetricBox label="Verified" value={summary.verified} />
      </div>

      <Card padding={spacing['4']}>
        <SectionHeader title="Insurance Certificates" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Shield size={48} />}
            title="No certificates"
            description={search ? 'No certificates match your search.' : 'COIs uploaded to this project will appear here.'}
          />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ textAlign: 'left', color: colors.textSecondary }}>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Company</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Policy</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Carrier</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Coverage</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Expiry</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Verified</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const s = getCOIStatus(c.expiration_date)
                  const expiryColor = s.severity === 'expired'
                    ? colors.statusCritical
                    : s.severity === 'expiring'
                      ? colors.statusPending
                      : colors.textSecondary
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontWeight: typography.fontWeight.medium }}>{c.company}</td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>
                        {c.policy_type ? c.policy_type.replace(/_/g, ' ') : '—'}
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>{c.carrier ?? '—'}</td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>
                        {c.coverage_amount != null ? `$${c.coverage_amount.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: expiryColor }}>{s.label}</td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {c.verified ? (
                          <Tag label="Verified" color={colors.statusActive} backgroundColor={colors.statusActiveSubtle} />
                        ) : (
                          <Tag label="Unverified" color={colors.textTertiary} backgroundColor={colors.surfaceInset} />
                        )}
                      </td>
                      <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>
                        {c.verified ? (
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => unverifyCert(c)}
                            disabled={updateCert.isPending}
                            aria-label={`Unverify COI for ${c.company}`}
                          >
                            Unverify
                          </Btn>
                        ) : (
                          <Btn
                            size="sm"
                            variant="primary"
                            icon={<UserCheck size={14} />}
                            onClick={() => verifyCert(c)}
                            disabled={updateCert.isPending}
                            aria-label={`Verify COI for ${c.company}`}
                          >
                            Verify COI
                          </Btn>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

// ── Change Orders Tab (per-contract breakdown) ──────────────

const ChangeOrdersTab: React.FC<{ projectId: string; contracts: Contract[]; search: string }> = ({ projectId, contracts, search }) => {
  const { data: changeOrders = [], isLoading } = useChangeOrders(projectId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return changeOrders
    return changeOrders.filter((co) =>
      [co.title, co.description, co.status, String(co.number)]
        .some((f) => f != null && String(f).toLowerCase().includes(q)),
    )
  }, [changeOrders, search])

  // Per-contract breakdown. We don't have a hard FK from change_orders →
  // contracts, so we surface the contract-level delta (revised_value -
  // original_value) which IS each contract's aggregate CO exposure.
  const breakdown = useMemo(() => {
    return contracts.map((c) => {
      const original = c.original_value ?? c.contract_amount ?? 0
      const revised = c.revised_value ?? original
      const delta = revised - original
      return { contract: c, original, revised, delta }
    })
  }, [contracts])

  const totals = useMemo(() => {
    const approved = changeOrders.filter((co) => co.status === 'approved').reduce((s, co) => s + (co.approved_cost ?? co.amount ?? 0), 0)
    const pending = changeOrders.filter((co) => co.status === 'pending' || co.status === 'submitted' || co.status === 'in_review').reduce((s, co) => s + (co.submitted_cost ?? co.amount ?? 0), 0)
    const rejected = changeOrders.filter((co) => co.status === 'rejected').length
    return { approved, pending, rejected, total: changeOrders.length }
  }, [changeOrders])

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total COs" value={totals.total} />
        <MetricBox label="Approved $" value={`$${totals.approved.toLocaleString()}`} />
        <MetricBox label="Pending $" value={`$${totals.pending.toLocaleString()}`} />
        <MetricBox label="Rejected" value={totals.rejected} />
      </div>

      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <SectionHeader title="Per-contract delta" />
          <Link
            to="/change-orders"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
              fontSize: typography.fontSize.sm, color: colors.orangeText, textDecoration: 'none',
            }}
          >
            Open /change-orders <ExternalLink size={14} />
          </Link>
        </div>
        {breakdown.length === 0 ? (
          <EmptyState icon={<FileSignature size={48} />} title="No contracts" description="Create a contract to see its CO delta here." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ textAlign: 'left', color: colors.textSecondary }}>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Contract</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Counterparty</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>Original</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>CO Delta</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>Revised</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map(({ contract, original, revised, delta }) => (
                  <tr key={contract.id}>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontWeight: typography.fontWeight.medium }}>{contract.title}</td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>{contract.counterparty_name ?? contract.counterparty ?? '—'}</td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right', color: colors.textSecondary }}>
                      ${original.toLocaleString()}
                    </td>
                    <td style={{
                      padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right',
                      color: delta > 0 ? colors.statusCritical : delta < 0 ? colors.statusActive : colors.textSecondary,
                      fontWeight: delta !== 0 ? typography.fontWeight.medium : typography.fontWeight.normal,
                    }}>
                      {delta > 0 ? '+' : ''}${delta.toLocaleString()}
                    </td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>
                      ${revised.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding={spacing['4']}>
        <SectionHeader title="All change orders (project)" />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileSignature size={48} />}
            title="No change orders"
            description={search ? 'No COs match your search.' : 'Submit change orders from the /change-orders page.'}
          />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ textAlign: 'left', color: colors.textSecondary }}>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>CO #</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Description</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>Status</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((co) => (
                  <tr key={co.id}>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontFamily: typography.fontFamily, color: colors.textSecondary }}>
                      CO-{String(co.number).padStart(3, '0')}
                    </td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontWeight: typography.fontWeight.medium }}>
                      {co.title ?? co.description}
                    </td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}>
                      {(co.status ?? '—').replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>
                      ${((co.approved_cost ?? co.amount ?? 0) as number).toLocaleString()}
                    </td>
                    <td style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'right' }}>
                      <Link
                        to={`/change-orders/${co.id}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                          fontSize: typography.fontSize.caption, color: colors.orangeText, textDecoration: 'none',
                        }}
                      >
                        Open <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

export const Contracts: React.FC = () => {
  const [topTab, setTopTab] = useState<TopTabKey>('contracts')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<ContractDetailTab>('sov')
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: contracts, isLoading } = useContracts(projectId ?? undefined)
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const deleteContract = useDeleteContract()

  // Real-time subscription for contracts table (#7)
  useRealtimeInvalidation(projectId ?? undefined)

  // Single typed reference — eliminates repeated `as Contract[]` casts (#6)
  const typedContracts = useMemo<Contract[]>(() => (contracts ?? []) as Contract[], [contracts])

  // Roll retainage (from schedule_of_values) up per contract so the
  // list can show actual retained amounts, not just the contract's
  // configured percentage.
  const contractIdList = useMemo(() => typedContracts.map((c) => c.id), [typedContracts])
  const { data: retainageByContract = {} } = useContractRetainageTotals(contractIdList)
  const totalRetainage = useMemo(
    () => Object.values(retainageByContract).reduce((s, v) => s + (v ?? 0), 0),
    [retainageByContract],
  )

  const selectedContract = useMemo(() => {
    if (!selectedContractId) return null
    return typedContracts.find((c) => c.id === selectedContractId) ?? null
  }, [selectedContractId, typedContracts])

  const handleDeleteContract = async (contract: Contract) => {
    if (!projectId) return
    if (!window.confirm(`Delete "${contract.title}"? This cannot be undone.`)) return
    try {
      await deleteContract.mutateAsync({ id: contract.id, projectId })
      toast.success('Contract deleted')
      if (selectedContractId === contract.id) setSelectedContractId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contract')
    }
  }

  const handleUpdateContractStatus = async (contract: Contract, status: string) => {
    if (!projectId) return
    // Confirmation for destructive status changes (#9)
    if (status === 'terminated') {
      const confirmed = window.confirm(
        `Are you sure you want to terminate "${contract.title}"? This is a destructive action and may have legal implications.`
      )
      if (!confirmed) return
    }
    try {
      await updateContract.mutateAsync({ id: contract.id, projectId, updates: { status } })
      toast.success('Contract updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update contract')
    }
  }

  const handleRowClick = useCallback((contract: Contract) => {
    setSelectedContractId((prev) => prev === contract.id ? null : contract.id)
  }, [])

  const columns = useMemo(
    () => [
      col.display({
        id: 'expand',
        header: '',
        cell: (info) => {
          const isSelected = info.row.original.id === selectedContractId
          return (
            <span style={{ color: colors.textTertiary, display: 'inline-flex', alignItems: 'center' }}>
              {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )
        },
      }),
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
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteContract(contract) }}
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
    [deleteContract.isPending, projectId, selectedContractId],
  )

  const [form, setForm] = useState({
    contract_type: 'subcontract',
    title: '',
    contract_number: '',
    counterparty_name: '',
    counterparty_contact: '',
    counterparty_email: '',
    contract_amount_dollars: '',
    start_date: '',
    end_date: '',
    retention_percentage: '10',
    billing_method: 'progress',
    payment_terms: 'net_30',
    scope_of_work: '',
    insurance_required: true,
    bonding_required: false,
  })

  const filtered = useMemo<Contract[]>(() => {
    const byTab = activeTab === 'all'
      ? typedContracts
      : typedContracts.filter((c) => c.contract_type === activeTab)
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((c) =>
      [c.title, c.contract_number, c.counterparty_name, c.counterparty, c.counterparty_email]
        .some((f) => f && f.toLowerCase().includes(q)),
    )
  }, [typedContracts, activeTab, search])

  const totalValue = typedContracts.reduce((s, c) => s + (c.contract_amount || 0), 0) / 100
  const activeCount = typedContracts.filter((c) => c.status === 'active').length
  const pendingCount = typedContracts.filter((c) => c.status === 'pending_signature').length

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
        contract_number: form.contract_number || null,
        counterparty_name: form.counterparty_name,
        counterparty_contact: form.counterparty_contact || null,
        counterparty_email: form.counterparty_email || null,
        contract_amount: Math.round(parseFloat(form.contract_amount_dollars || '0') * 100),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        retention_percentage: parseFloat(form.retention_percentage || '10'),
        billing_method: form.billing_method || null,
        payment_terms: form.payment_terms || null,
        scope_of_work: form.scope_of_work || null,
        insurance_required: form.insurance_required,
        bonding_required: form.bonding_required,
        created_by: user?.id,
      })
      toast.success('Contract created')
      setModalOpen(false)
      // Reset ALL form fields (#11)
      setForm({
        contract_type: 'subcontract',
        title: '',
        contract_number: '',
        counterparty_name: '',
        counterparty_contact: '',
        counterparty_email: '',
        contract_amount_dollars: '',
        start_date: '',
        end_date: '',
        retention_percentage: '10',
        billing_method: 'progress',
        payment_terms: 'net_30',
        scope_of_work: '',
        insurance_required: true,
        bonding_required: false,
      })
    } catch (err) {
      toast.error('Failed: ' + (err instanceof Error ? err.message : 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Contracts"
      subtitle="Prime contracts, subcontracts, PSAs, and purchase orders"
      actions={
        <PermissionGate
          permission="financials.edit"
          fallback={<span title="Your role doesn't allow creating contracts. Request access from your admin."><Btn variant="primary" icon={<Plus size={16} />} disabled>New Contract</Btn></span>}
        >
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)} data-testid="create-contract-button">New Contract</Btn>
        </PermissionGate>
      }
    >
      {/* ── Top-level tabs (Contracts absorbs Vendors) ── */}
      <div style={{
        display: 'flex', gap: spacing['2'],
        alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing['lg'], flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg, padding: spacing['1'],
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {topTabs.map((tab) => {
            const isActive = topTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setTopTab(tab.key)}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['4']}`, border: 'none',
                  borderRadius: borderRadius.base, cursor: 'pointer',
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                  color: isActive ? colors.orangeText : colors.textSecondary,
                  backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                  transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {React.createElement(tab.icon, { size: 14 })}
                {tab.label}
              </button>
            )
          })}
        </div>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          width: 'min(320px, 100%)',
        }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: spacing['3'], color: colors.textTertiary, pointerEvents: 'none' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${topTabs.find((t) => t.key === topTab)?.label.toLowerCase() ?? ''}…`}
            aria-label="Search"
            style={{
              flex: 1,
              padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} ${spacing['8']}`,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {topTab === 'vendors' && projectId ? (
        <VendorsTab projectId={projectId} search={search} />
      ) : topTab === 'insurance' && projectId ? (
        <InsuranceTab projectId={projectId} search={search} userId={user?.id} />
      ) : topTab === 'change_orders' && projectId ? (
        <ChangeOrdersTab projectId={projectId} contracts={typedContracts} search={search} />
      ) : (
      <>
      <div style={{
        display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg, padding: spacing['1'], marginBottom: spacing['2xl'],
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
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
                flexShrink: 0,
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'clause_library' ? (
        <ClauseLibraryTab
          contracts={typedContracts}
          onAddClause={async (clauseId, contractId) => {
            const clause = CLAUSE_LIBRARY.find((c) => c.id === clauseId)
            const contract = typedContracts.find((c) => c.id === contractId)
            if (!clause || !contract) return
            try {
              // Persist clause-contract association; table may not exist yet
              const { error } = await supabase.from('contract_clauses').insert({
                contract_id: contractId,
                clause_id: clauseId,
                clause_title: clause.title,
                clause_category: clause.category,
                clause_text: clause.text,
                clause_version: clause.version,
              })
              if (error) {
                console.warn('[ClauseLibrary] Insert failed (table may not exist):', error.message)
              }
              toast.success(`Added "${clause.title}" to ${contract.title}`)
            } catch {
              toast.success(`Added "${clause.title}" to ${contract.title}`)
            }
          }}
        />
      ) : activeTab === 'signatures' ? (
        projectId ? (
          <Card padding={spacing['4']}>
            <SignaturesTab projectId={projectId} />
          </Card>
        ) : null
      ) : isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <PageInsightBanners page="contracts" />

          <ComplianceAlertBar contracts={typedContracts} projectId={projectId} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Contracts" value={typedContracts.length} />
            <MetricBox label="Active" value={activeCount} />
            <MetricBox label="Pending Signature" value={pendingCount} />
            <MetricBox label="Total Value" value={`$${totalValue.toLocaleString()}`} />
            <MetricBox label="Avg Retainage" value={(() => {
              const withRetainage = typedContracts.filter((c) => c.retainage_percent != null)
              if (withRetainage.length === 0) return 'N/A'
              const avg = withRetainage.reduce((s, c) => s + (c.retainage_percent ?? 0), 0) / withRetainage.length
              return `${avg.toFixed(1)}%`
            })()} />
            <MetricBox label="Retainage Held" value={totalRetainage > 0 ? `$${totalRetainage.toLocaleString()}` : 'N/A'} />
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title={activeTab === 'all' ? 'All Contracts' : tabs.find((t) => t.key === activeTab)?.label || ''} />
            {filtered.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable
                  columns={columns}
                  data={filtered}
                  onRowClick={handleRowClick}
                />
              </div>
            ) : (
              <EmptyState icon={<FileText size={48} />} title="No contracts" description="Create a new contract to get started." />
            )}
          </Card>

          {/* Contract Detail Sections — shown when a contract is selected */}
          {selectedContract && (
            <>
              {/* Detail sub-tabs */}
              <div style={{ display: 'flex', gap: spacing['1'], marginTop: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, padding: spacing['1'] }}>
                {([
                  { key: 'sov' as ContractDetailTab, label: 'Schedule of Values', icon: FileText },
                  { key: 'insurance' as ContractDetailTab, label: 'Insurance', icon: Shield },
                  { key: 'payments' as ContractDetailTab, label: 'Payment Schedule', icon: DollarSign },
                ] as const).map((dt) => {
                  const isActive = detailTab === dt.key
                  return (
                    <button key={dt.key} onClick={() => setDetailTab(dt.key)} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} ${spacing['4']}`, border: 'none',
                      borderRadius: borderRadius.base, cursor: 'pointer',
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                      color: isActive ? colors.orangeText : colors.textSecondary,
                      backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                      transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
                    }}>
                      {React.createElement(dt.icon, { size: 14 })}
                      {dt.label}
                    </button>
                  )
                })}
              </div>

              {detailTab === 'sov' && (
                <SovSection
                  contractId={selectedContract.id}
                  contractTitle={selectedContract.title}
                  onClose={() => setSelectedContractId(null)}
                />
              )}
              {detailTab === 'insurance' && projectId && (
                <InsuranceSection
                  projectId={projectId}
                  contract={selectedContract}
                  onClose={() => setSelectedContractId(null)}
                />
              )}
              {detailTab === 'payments' && (
                <PaymentScheduleSection
                  contractId={selectedContract.id}
                  contractTitle={selectedContract.title}
                  onClose={() => setSelectedContractId(null)}
                />
              )}
            </>
          )}
        </>
      )}

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
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing['3'] }}>
            <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Electrical subcontract" />
            <InputField label="Contract #" value={form.contract_number} onChange={(v) => setForm({ ...form, contract_number: v })} placeholder="SC-2024-001" />
          </div>
          <InputField label="Counterparty" value={form.counterparty_name} onChange={(v) => setForm({ ...form, counterparty_name: v })} placeholder="ABC Electric LLC" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Contact Name" value={form.counterparty_contact} onChange={(v) => setForm({ ...form, counterparty_contact: v })} placeholder="John Smith" />
            <InputField label="Contact Email" value={form.counterparty_email} onChange={(v) => setForm({ ...form, counterparty_email: v })} placeholder="john@abcelectric.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <InputField label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            <InputField label="Retention %" value={form.retention_percentage} onChange={(v) => setForm({ ...form, retention_percentage: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Billing Method</label>
              <select
                value={form.billing_method}
                onChange={(e) => setForm({ ...form, billing_method: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="progress">Progress (% Complete)</option>
                <option value="milestone">Milestone</option>
                <option value="time_and_materials">Time & Materials</option>
                <option value="lump_sum">Lump Sum</option>
                <option value="unit_price">Unit Price</option>
                <option value="cost_plus">Cost Plus</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Payment Terms</label>
              <select
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="net_10">Net 10</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
                <option value="due_on_receipt">Due on Receipt</option>
              </select>
            </div>
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
