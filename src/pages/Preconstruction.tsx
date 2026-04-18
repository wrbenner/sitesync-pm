import React, { useState, useMemo } from 'react'
import { FileText, Plus, Package, Award, BarChart2, Sparkles, AlertTriangle } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  usePreconBidPackages,
  useCreatePreconBidPackage,
  useUpdatePreconBidPackage,
  usePreconBidSubmissions,
  useAllPreconBidSubmissions,
  useCreatePreconBidSubmission,
  type PreconBidPackage,
  type PreconBidSubmission,
} from '../hooks/queries/precon-enterprise'
import { useCreateContract } from '../hooks/queries/enterprise-modules'

type TabKey = 'packages' | 'submissions' | 'comparison'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'packages', label: 'Bid Packages', icon: Package },
  { key: 'submissions', label: 'Bid Submissions', icon: FileText },
  { key: 'comparison', label: 'Bid Comparison', icon: BarChart2 },
]

const CSI_DIVISIONS: { code: number; label: string }[] = [
  { code: 1, label: '01 — General Requirements' },
  { code: 2, label: '02 — Existing Conditions' },
  { code: 3, label: '03 — Concrete' },
  { code: 4, label: '04 — Masonry' },
  { code: 5, label: '05 — Metals' },
  { code: 6, label: '06 — Wood & Plastics' },
  { code: 7, label: '07 — Thermal & Moisture' },
  { code: 8, label: '08 — Openings' },
  { code: 9, label: '09 — Finishes' },
  { code: 10, label: '10 — Specialties' },
  { code: 11, label: '11 — Equipment' },
  { code: 12, label: '12 — Furnishings' },
  { code: 13, label: '13 — Special Construction' },
  { code: 14, label: '14 — Conveying Equipment' },
  { code: 21, label: '21 — Fire Suppression' },
  { code: 22, label: '22 — Plumbing' },
  { code: 23, label: '23 — HVAC' },
  { code: 26, label: '26 — Electrical' },
  { code: 27, label: '27 — Communications' },
  { code: 31, label: '31 — Earthwork' },
  { code: 32, label: '32 — Exterior Improvements' },
  { code: 33, label: '33 — Utilities' },
]

const STATUS_COLORS: Record<string, { c: string; bg: string }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset },
  issued: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  receiving_bids: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  evaluating: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  awarded: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  cancelled: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

function Pill({ value, palette }: { value: string; palette?: { c: string; bg: string } }) {
  const p = palette || STATUS_COLORS[value] || STATUS_COLORS.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: p.c, backgroundColor: p.bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.c }} />
      {value.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
    </span>
  )
}

export const Preconstruction: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('packages')
  const [pkgModalOpen, setPkgModalOpen] = useState(false)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)

  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: packages, isLoading } = usePreconBidPackages(projectId ?? undefined)
  const { data: allSubs } = useAllPreconBidSubmissions(projectId ?? undefined)
  const { data: selectedSubs } = usePreconBidSubmissions(selectedPackageId ?? undefined)
  const createPackage = useCreatePreconBidPackage()
  const updatePackage = useUpdatePreconBidPackage()
  const createSubmission = useCreatePreconBidSubmission()
  const createContract = useCreateContract()

  const [pkgForm, setPkgForm] = useState({
    package_number: '',
    title: '',
    description: '',
    csi_division: '',
    trade: '',
    estimated_value: '',
    bid_due_date: '',
  })

  const [subForm, setSubForm] = useState({
    bid_package_id: '',
    bidder_name: '',
    bidder_company: '',
    bid_amount: '',
    notes: '',
  })

  const packageList = packages ?? []
  const allSubmissions = allSubs ?? []

  const totalValue = packageList.reduce((s, p) => s + (p.estimated_value || 0), 0) / 100
  const issuedCount = packageList.filter((p) => p.status === 'issued' || p.status === 'receiving_bids' || p.status === 'evaluating').length
  const awardedCount = packageList.filter((p) => p.status === 'awarded').length

  const selectedPackage = useMemo(
    () => packageList.find((p) => p.id === selectedPackageId) || null,
    [packageList, selectedPackageId]
  )

  const aiAnalysis = useMemo(() => {
    if (!selectedPackage || !selectedSubs || selectedSubs.length === 0) return null
    const bids = [...selectedSubs].sort((a, b) => a.bid_amount - b.bid_amount)
    const amounts = bids.map((b) => b.bid_amount)
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length
    const lowest = bids[0]
    const highest = bids[bids.length - 1]
    const spread = highest.bid_amount - lowest.bid_amount
    const variancePct = avg > 0 ? ((spread / avg) * 100) : 0
    const unusuallyLow = bids.filter((b) => b.bid_amount < avg * 0.75)
    const notes: string[] = []
    if (selectedPackage.estimated_value && lowest.bid_amount < selectedPackage.estimated_value * 0.7) {
      notes.push(`Lowest bid is >30% below engineer's estimate — verify scope coverage.`)
    }
    if (variancePct > 25) notes.push(`High spread (${variancePct.toFixed(0)}% of avg) — possible scope ambiguity.`)
    if (unusuallyLow.length > 0) notes.push(`${unusuallyLow.length} bidder(s) >25% below avg — review for errors.`)
    if (notes.length === 0) notes.push('Bids cluster tightly — pricing looks competitive.')
    return { bids, avg, lowest, highest, spread, variancePct, unusuallyLow, notes }
  }, [selectedPackage, selectedSubs])

  const handleCreatePackage = async () => {
    if (!projectId || !pkgForm.package_number || !pkgForm.title) {
      toast.error('Package number and title required')
      return
    }
    try {
      await createPackage.mutateAsync({
        project_id: projectId,
        package_number: pkgForm.package_number,
        title: pkgForm.title,
        description: pkgForm.description || null,
        csi_division: pkgForm.csi_division ? parseInt(pkgForm.csi_division, 10) : null,
        trade: pkgForm.trade || null,
        estimated_value: pkgForm.estimated_value ? Math.round(parseFloat(pkgForm.estimated_value) * 100) : 0,
        bid_due_date: pkgForm.bid_due_date || null,
        created_by: user?.id ?? null,
      })
      toast.success('Bid package created')
      setPkgModalOpen(false)
      setPkgForm({ package_number: '', title: '', description: '', csi_division: '', trade: '', estimated_value: '', bid_due_date: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateSubmission = async () => {
    if (!subForm.bid_package_id || !subForm.bidder_name || !subForm.bid_amount) {
      toast.error('Package, bidder and amount required')
      return
    }
    try {
      await createSubmission.mutateAsync({
        bid_package_id: subForm.bid_package_id,
        bidder_name: subForm.bidder_name,
        bidder_company: subForm.bidder_company || null,
        bid_amount: Math.round(parseFloat(subForm.bid_amount) * 100),
        notes: subForm.notes || null,
      })
      toast.success('Submission recorded')
      setSubModalOpen(false)
      setSubForm({ bid_package_id: '', bidder_name: '', bidder_company: '', bid_amount: '', notes: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleAward = async (pkg: PreconBidPackage, sub: PreconBidSubmission) => {
    try {
      await updatePackage.mutateAsync({
        id: pkg.id,
        patch: { status: 'awarded', awarded_amount: sub.bid_amount } as Partial<PreconBidPackage>,
      })
      if (projectId) {
        await createContract.mutateAsync({
          project_id: projectId,
          contract_type: 'subcontract',
          title: pkg.title,
          counterparty_name: sub.bidder_company || sub.bidder_name,
          contract_amount: sub.bid_amount,
          scope_of_work: pkg.description,
          status: 'draft',
          created_by: user?.id,
        })
        toast.success('Awarded — contract draft created')
      } else {
        toast.success('Awarded')
      }
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Preconstruction & Bidding"
      subtitle="Manage bid packages, capture submissions, and compare pricing"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" icon={<Sparkles size={16} />} onClick={() => setAiPanelOpen(!aiPanelOpen)}>AI Bid Analysis</Btn>
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setPkgModalOpen(true)}>New Bid Package</Btn>
        </div>
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
            <MetricBox label="Bid Packages" value={packageList.length} />
            <MetricBox label="In Market" value={issuedCount} />
            <MetricBox label="Awarded" value={awardedCount} />
            <MetricBox label="Estimated Value" value={`$${totalValue.toLocaleString()}`} />
          </div>

          {activeTab === 'packages' && (
            <Card padding={spacing['4']}>
              <SectionHeader title="Bid Packages" />
              {packageList.length === 0 ? (
                <EmptyState icon={<Package size={48} />} title="No bid packages" description="Create a new bid package to start soliciting bids." />
              ) : (
                <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {packageList.map((pkg) => (
                    <div key={pkg.id} onClick={() => { setSelectedPackageId(pkg.id); setActiveTab('comparison') }} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: spacing['3'], border: `1px solid ${colors.borderLight}`,
                      borderRadius: borderRadius.base, cursor: 'pointer', backgroundColor: colors.surfaceFlat,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <span style={{ fontFamily: 'monospace', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>{pkg.package_number}</span>
                        <div>
                          <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{pkg.title}</div>
                          <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                            {pkg.trade || '—'} {pkg.csi_division ? `· CSI ${pkg.csi_division}` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                          ${((pkg.estimated_value || 0) / 100).toLocaleString()}
                        </span>
                        <Pill value={pkg.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'submissions' && (
            <Card padding={spacing['4']}>
              <SectionHeader
                title="All Submissions"
                action={<Btn variant="primary" icon={<Plus size={14} />} onClick={() => setSubModalOpen(true)}>Add Submission</Btn>}
              />
              {allSubmissions.length === 0 ? (
                <EmptyState icon={<FileText size={48} />} title="No submissions" description="Record bids as subs return pricing." />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                      <th style={thStyle}>Bidder</th>
                      <th style={thStyle}>Company</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSubmissions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={tdStyle}>{s.bidder_name}</td>
                        <td style={tdStyle}>{s.bidder_company || '—'}</td>
                        <td style={tdStyle}>${(s.bid_amount / 100).toLocaleString()}</td>
                        <td style={tdStyle}><Pill value={s.status} /></td>
                        <td style={tdStyle}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {activeTab === 'comparison' && (
            <Card padding={spacing['4']}>
              <SectionHeader title="Bid Comparison" />
              <div style={{ marginBottom: spacing['4'] }}>
                <label style={labelStyle}>Select Bid Package</label>
                <select
                  value={selectedPackageId || ''}
                  onChange={(e) => setSelectedPackageId(e.target.value || null)}
                  style={selectStyle}
                >
                  <option value="">— choose a package —</option>
                  {packageList.map((p) => <option key={p.id} value={p.id}>{p.package_number} · {p.title}</option>)}
                </select>
              </div>

              {!selectedPackage && (
                <EmptyState icon={<BarChart2 size={48} />} title="Select a bid package" description="Pick a package to compare its submissions side-by-side." />
              )}

              {selectedPackage && aiAnalysis && (
                <>
                  {aiPanelOpen && (
                    <div style={{
                      padding: spacing['4'], marginBottom: spacing['4'],
                      backgroundColor: colors.statusInfoSubtle,
                      border: `1px solid ${colors.statusInfo}`,
                      borderRadius: borderRadius.base,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium, color: colors.statusInfo }}>
                        <Sparkles size={16} /> AI Bid Analysis
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                        {aiAnalysis.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                        <th style={thStyle}>Rank</th>
                        <th style={thStyle}>Bidder</th>
                        <th style={thStyle}>Amount</th>
                        <th style={thStyle}>Variance vs Low</th>
                        <th style={thStyle}>Flags</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiAnalysis.bids.map((b, idx) => {
                        const low = aiAnalysis.lowest.bid_amount
                        const variance = low > 0 ? ((b.bid_amount - low) / low) * 100 : 0
                        const isLowOutlier = aiAnalysis.unusuallyLow.some((u) => u.id === b.id)
                        return (
                          <tr key={b.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                            <td style={tdStyle}>{idx + 1}</td>
                            <td style={tdStyle}>
                              {b.bidder_name}
                              {b.bidder_company && <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>{b.bidder_company}</div>}
                            </td>
                            <td style={{ ...tdStyle, fontWeight: typography.fontWeight.medium }}>${(b.bid_amount / 100).toLocaleString()}</td>
                            <td style={tdStyle}>{idx === 0 ? '— (low)' : `+${variance.toFixed(1)}%`}</td>
                            <td style={tdStyle}>
                              {isLowOutlier && (
                                <span style={{ color: colors.statusCritical, display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
                                  <AlertTriangle size={14} /> Unusually low
                                </span>
                              )}
                            </td>
                            <td style={tdStyle}>
                              {selectedPackage.status !== 'awarded' && (
                                <Btn variant="secondary" icon={<Award size={14} />} onClick={() => handleAward(selectedPackage, b)}>Award</Btn>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {selectedPackage && (!selectedSubs || selectedSubs.length === 0) && (
                <EmptyState icon={<FileText size={48} />} title="No submissions yet" description="Record submissions from the Bid Submissions tab." />
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={pkgModalOpen} onClose={() => setPkgModalOpen(false)} title="New Bid Package" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: spacing['3'] }}>
            <InputField label="Package #" value={pkgForm.package_number} onChange={(v) => setPkgForm({ ...pkgForm, package_number: v })} placeholder="BP-001" />
            <InputField label="Title" value={pkgForm.title} onChange={(v) => setPkgForm({ ...pkgForm, title: v })} placeholder="Electrical rough-in" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={pkgForm.description}
              onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
              rows={2}
              style={textareaStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={labelStyle}>CSI Division</label>
              <select value={pkgForm.csi_division} onChange={(e) => setPkgForm({ ...pkgForm, csi_division: e.target.value })} style={selectStyle}>
                <option value="">—</option>
                {CSI_DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
              </select>
            </div>
            <InputField label="Trade" value={pkgForm.trade} onChange={(v) => setPkgForm({ ...pkgForm, trade: v })} placeholder="Electrical" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Estimated Value ($)" value={pkgForm.estimated_value} onChange={(v) => setPkgForm({ ...pkgForm, estimated_value: v })} placeholder="0.00" />
            <InputField label="Bid Due Date" type="date" value={pkgForm.bid_due_date} onChange={(v) => setPkgForm({ ...pkgForm, bid_due_date: v })} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setPkgModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreatePackage} loading={createPackage.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={subModalOpen} onClose={() => setSubModalOpen(false)} title="New Bid Submission" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={labelStyle}>Bid Package</label>
            <select value={subForm.bid_package_id} onChange={(e) => setSubForm({ ...subForm, bid_package_id: e.target.value })} style={selectStyle}>
              <option value="">— choose —</option>
              {packageList.map((p) => <option key={p.id} value={p.id}>{p.package_number} · {p.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Bidder Name" value={subForm.bidder_name} onChange={(v) => setSubForm({ ...subForm, bidder_name: v })} placeholder="John Smith" />
            <InputField label="Company" value={subForm.bidder_company} onChange={(v) => setSubForm({ ...subForm, bidder_company: v })} placeholder="ABC Electric" />
          </div>
          <InputField label="Bid Amount ($)" value={subForm.bid_amount} onChange={(v) => setSubForm({ ...subForm, bid_amount: v })} placeholder="0.00" />
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={subForm.notes} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} rows={2} style={textareaStyle} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setSubModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateSubmission} loading={createSubmission.isPending}>Submit</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: spacing['2'], color: colors.textSecondary,
  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
  textTransform: 'uppercase',
}
const tdStyle: React.CSSProperties = {
  padding: spacing['2'], color: colors.textPrimary, fontSize: typography.fontSize.sm,
}
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: spacing['1'],
  fontSize: typography.fontSize.caption, color: colors.textSecondary,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm,
}
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
  resize: 'vertical',
}

export default Preconstruction
