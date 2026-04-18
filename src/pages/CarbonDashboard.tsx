import React, { useMemo, useState } from 'react'
import {
  Leaf, Plus, Award, Sparkles, Trash2, TrendingDown,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { PageContainer, Card, Btn, Modal, InputField, EmptyState, Skeleton } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable, supabase } from '../lib/supabase'
import { useProjectId } from '../hooks/useProjectId'
import { toast } from 'sonner'

interface CarbonFactor {
  id: string
  material_category: string
  material_name: string
  unit: string
  embodied_carbon_kg_per_unit: number
  source: string
}

interface CarbonEntry {
  id: string
  project_id: string
  scope: 'embodied' | 'construction' | 'operational'
  category: string
  description: string | null
  quantity: number
  unit: string
  carbon_factor_id: string | null
  carbon_kg: number
  source_type: string | null
  source_id: string | null
  created_at: string
}

interface LeedCredit {
  id: string
  project_id: string
  credit_category: string
  credit_id: string
  credit_name: string
  points_possible: number
  points_achieved: number
  status: 'not_started' | 'in_progress' | 'documented' | 'submitted' | 'achieved' | 'denied'
  documentation_notes: string | null
}

const CATEGORY_COLORS = [
  '#F47820', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#06B6D4', '#84CC16', '#A855F7',
]

const INDUSTRY_AVG_KG_PER_SF = 450

const DEFAULT_LEED_CREDITS: Array<Omit<LeedCredit, 'id' | 'project_id' | 'points_achieved' | 'status' | 'documentation_notes'>> = [
  { credit_category: 'Energy & Atmosphere', credit_id: 'EA.1', credit_name: 'Optimize Energy Performance', points_possible: 20 },
  { credit_category: 'Energy & Atmosphere', credit_id: 'EA.2', credit_name: 'Renewable Energy Production', points_possible: 3 },
  { credit_category: 'Materials & Resources', credit_id: 'MR.1', credit_name: 'Building Life-Cycle Impact Reduction', points_possible: 5 },
  { credit_category: 'Materials & Resources', credit_id: 'MR.2', credit_name: 'Environmental Product Declarations', points_possible: 2 },
  { credit_category: 'Materials & Resources', credit_id: 'MR.3', credit_name: 'Sourcing of Raw Materials', points_possible: 2 },
  { credit_category: 'Materials & Resources', credit_id: 'MR.4', credit_name: 'Construction & Demolition Waste Management', points_possible: 2 },
  { credit_category: 'Indoor Environmental Quality', credit_id: 'EQ.1', credit_name: 'Low-Emitting Materials', points_possible: 3 },
  { credit_category: 'Indoor Environmental Quality', credit_id: 'EQ.2', credit_name: 'Thermal Comfort', points_possible: 1 },
  { credit_category: 'Location & Transportation', credit_id: 'LT.1', credit_name: 'Sensitive Land Protection', points_possible: 1 },
  { credit_category: 'Water Efficiency', credit_id: 'WE.1', credit_name: 'Outdoor Water Use Reduction', points_possible: 2 },
]

function leedLevel(points: number): { label: string; color: string } {
  if (points >= 80) return { label: 'Platinum', color: '#E5E7EB' }
  if (points >= 60) return { label: 'Gold', color: '#F59E0B' }
  if (points >= 50) return { label: 'Silver', color: '#94A3B8' }
  if (points >= 40) return { label: 'Certified', color: '#10B981' }
  return { label: 'Not Yet Certified', color: colors.textTertiary }
}

const CarbonDashboard: React.FC = () => {
  const projectId = useProjectId()
  const qc = useQueryClient()
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)

  const { data: factors } = useQuery<CarbonFactor[]>({
    queryKey: ['carbon-factors'],
    queryFn: async () => {
      const { data, error } = await fromTable('carbon_factors').select('*').order('material_category')
      if (error) throw error
      return (data as CarbonFactor[]) ?? []
    },
  })

  const { data: entries, isLoading: entriesLoading } = useQuery<CarbonEntry[]>({
    queryKey: ['carbon-entries', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await fromTable('project_carbon_entries')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as CarbonEntry[]) ?? []
    },
  })

  const { data: leed } = useQuery<LeedCredit[]>({
    queryKey: ['leed-credits', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await fromTable('leed_credits').select('*').eq('project_id', projectId!)
      if (error) throw error
      return (data as LeedCredit[]) ?? []
    },
  })

  const seedLeed = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project')
      const rows = DEFAULT_LEED_CREDITS.map((c) => ({ ...c, project_id: projectId, points_achieved: 0, status: 'not_started' }))
      const { error } = await fromTable('leed_credits').insert(rows as never)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('LEED checklist initialized')
      qc.invalidateQueries({ queryKey: ['leed-credits', projectId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Seed failed'),
  })

  const upsertLeed = useMutation({
    mutationFn: async (credit: LeedCredit) => {
      const { error } = await fromTable('leed_credits')
        .update({
          points_achieved: credit.points_achieved,
          status: credit.status,
          documentation_notes: credit.documentation_notes,
        } as never)
        .eq('id', credit.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leed-credits', projectId] }),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable('project_carbon_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carbon-entries', projectId] }),
  })

  const breakdown = useMemo(() => {
    const byCat = new Map<string, number>()
    ;(entries ?? []).forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.carbon_kg)))
    return Array.from(byCat.entries()).map(([name, value]) => ({ name, value }))
  }, [entries])

  const totals = useMemo(() => {
    const totalKg = (entries ?? []).reduce((acc, e) => acc + Number(e.carbon_kg), 0)
    const totalTons = totalKg / 1000
    const avgPerSF = totalKg > 0 ? totalKg / 50000 : 0
    return { totalKg, totalTons, avgPerSF }
  }, [entries])

  const leedTotal = useMemo(() => {
    const achieved = (leed ?? []).reduce((a, c) => a + c.points_achieved, 0)
    const possible = (leed ?? []).reduce((a, c) => a + c.points_possible, 0)
    return { achieved, possible, level: leedLevel(achieved) }
  }, [leed])

  const highCarbonEntries = useMemo(() => {
    return (entries ?? []).slice().sort((a, b) => Number(b.carbon_kg) - Number(a.carbon_kg)).slice(0, 3)
  }, [entries])

  return (
    <PageContainer
      title="Carbon & Sustainability"
      subtitle="Track embodied carbon, compare against industry benchmarks, and manage LEED certification progress."
      actions={
        <>
          <Btn variant="ghost" onClick={() => setAiModalOpen(true)}>
            <Sparkles size={14} /> Low-carbon alternatives
          </Btn>
          <Btn variant="primary" onClick={() => setEntryModalOpen(true)}>
            <Plus size={14} /> Add entry
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing['4'], marginBottom: spacing['5'] }}>
        <SummaryCard
          icon={Leaf}
          label="Total Embodied Carbon"
          value={`${totals.totalTons.toFixed(1)} t CO₂e`}
          subtitle={`${totals.totalKg.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`}
          color="#10B981"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Carbon per SF"
          value={`${totals.avgPerSF.toFixed(1)} kg/SF`}
          subtitle={`Industry avg: ${INDUSTRY_AVG_KG_PER_SF} kg/SF`}
          color={totals.avgPerSF <= INDUSTRY_AVG_KG_PER_SF ? '#10B981' : '#EF4444'}
        />
        <SummaryCard
          icon={Award}
          label={`LEED ${leedTotal.level.label}`}
          value={`${leedTotal.achieved} / ${leedTotal.possible} pts`}
          subtitle={`Next tier needs ${Math.max(0, nextTierThreshold(leedTotal.achieved) - leedTotal.achieved)} pts`}
          color={leedTotal.level.color}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['5'] }}>
        <Card>
          <h3 style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
            Carbon by Category
          </h3>
          {entriesLoading ? (
            <Skeleton height="260px" />
          ) : breakdown.length === 0 ? (
            <EmptyState icon={<Leaf size={32} color={colors.textTertiary} />} title="No entries yet" description="Add a carbon entry to see the breakdown." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="name" outerRadius={100} label={false}>
                  {breakdown.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${(v / 1000).toFixed(1)} t CO₂e`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3 style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
            Carbon vs Industry Average
          </h3>
          {breakdown.length === 0 ? (
            <EmptyState icon={<TrendingDown size={32} color={colors.textTertiary} />} title="No data" description="Add entries to compare." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={breakdown}>
                <XAxis dataKey="name" stroke={colors.textTertiary} fontSize={11} />
                <YAxis stroke={colors.textTertiary} fontSize={11} />
                <Tooltip formatter={(v: number) => `${(v / 1000).toFixed(2)} t CO₂e`} />
                <Bar dataKey="value" fill="#10B981" />
                <ReferenceLine y={INDUSTRY_AVG_KG_PER_SF * 100} stroke="#EF4444" strokeDasharray="4 4" label="Industry Avg" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
            Carbon Entries
          </h3>
        </div>
        {entriesLoading ? (
          <Skeleton height="120px" />
        ) : !entries?.length ? (
          <EmptyState
            icon={<Leaf size={48} color={colors.textTertiary} />}
            title="No carbon entries yet"
            description="Add your first material to start tracking embodied carbon."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.body }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textTertiary, fontSize: typography.fontSize.label, textAlign: 'left' }}>
                <th style={{ padding: spacing['2'] }}>Category</th>
                <th style={{ padding: spacing['2'] }}>Description</th>
                <th style={{ padding: spacing['2'] }}>Qty</th>
                <th style={{ padding: spacing['2'] }}>Unit</th>
                <th style={{ padding: spacing['2'], textAlign: 'right' }}>kg CO₂e</th>
                <th style={{ padding: spacing['2'] }} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{e.category}</td>
                  <td style={{ padding: spacing['2'], color: colors.textPrimary }}>{e.description ?? '—'}</td>
                  <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{e.quantity}</td>
                  <td style={{ padding: spacing['2'], color: colors.textTertiary }}>{e.unit}</td>
                  <td style={{ padding: spacing['2'], textAlign: 'right', color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                    {Number(e.carbon_kg).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: spacing['2'], textAlign: 'right' }}>
                    <button
                      onClick={() => deleteEntry.mutate(e.id)}
                      aria-label="Delete entry"
                      style={{
                        width: 56, height: 56, border: 'none', background: 'transparent',
                        color: colors.textTertiary, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div style={{ marginTop: spacing['5'] }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
            <div>
              <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
                LEED Certification Tracker
              </h3>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                {leedTotal.achieved}/{leedTotal.possible} points · Progress toward {leedTotal.level.label}
              </div>
            </div>
            {!leed?.length && (
              <Btn variant="primary" onClick={() => seedLeed.mutate()} disabled={seedLeed.isPending}>
                Initialize checklist
              </Btn>
            )}
          </div>

          <div style={{ height: 10, background: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', marginBottom: spacing['4'] }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (leedTotal.achieved / Math.max(1, leedTotal.possible)) * 100)}%`,
                background: leedTotal.level.color,
                transition: 'width 300ms ease',
              }}
            />
          </div>

          {leed?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {leed.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 120px 120px',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: spacing['3'],
                    background: colors.surfaceInset,
                    borderRadius: borderRadius.base,
                  }}
                >
                  <div>
                    <div style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                      {c.credit_id} — {c.credit_name}
                    </div>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {c.credit_category}
                    </div>
                  </div>
                  <select
                    value={c.status}
                    onChange={(e) => upsertLeed.mutate({ ...c, status: e.target.value as LeedCredit['status'] })}
                    style={{
                      padding: spacing['2'],
                      background: colors.surfaceRaised,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.caption,
                    }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="documented">Documented</option>
                    <option value="submitted">Submitted</option>
                    <option value="achieved">Achieved</option>
                    <option value="denied">Denied</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={c.points_possible}
                    value={c.points_achieved}
                    onChange={(e) => upsertLeed.mutate({ ...c, points_achieved: Math.max(0, Math.min(c.points_possible, Number(e.target.value))) })}
                    style={{
                      padding: spacing['2'],
                      background: colors.surfaceRaised,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.caption,
                      width: '100%',
                    }}
                  />
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'right' }}>
                    of {c.points_possible} pts
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.body }}>
              Initialize the checklist to begin tracking LEED credits.
            </div>
          )}
        </Card>
      </div>

      <AddEntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        factors={factors ?? []}
        projectId={projectId}
      />

      <AiSuggestionsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        entries={highCarbonEntries}
      />
    </PageContainer>
  )
}

function nextTierThreshold(points: number): number {
  if (points < 40) return 40
  if (points < 50) return 50
  if (points < 60) return 60
  if (points < 80) return 80
  return 110
}

const SummaryCard: React.FC<{
  icon: React.ElementType
  label: string
  value: string
  subtitle: string
  color: string
}> = ({ icon: Icon, label, value, subtitle, color }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
      <Icon size={16} color={color} />
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
      {value}
    </div>
    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{subtitle}</div>
  </Card>
)

const AddEntryModal: React.FC<{
  open: boolean
  onClose: () => void
  factors: CarbonFactor[]
  projectId: string | null
}> = ({ open, onClose, factors, projectId }) => {
  const qc = useQueryClient()
  const [factorId, setFactorId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'embodied' | 'construction' | 'operational'>('embodied')

  const saving = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project')
      const factor = factors.find((f) => f.id === factorId)
      if (!factor) throw new Error('Pick a material')
      const qty = Number(quantity)
      if (!qty || qty <= 0) throw new Error('Quantity must be positive')
      const carbon_kg = qty * Number(factor.embodied_carbon_kg_per_unit)
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await fromTable('project_carbon_entries').insert({
        project_id: projectId,
        scope,
        category: factor.material_category,
        description: description || factor.material_name,
        quantity: qty,
        unit: factor.unit,
        carbon_factor_id: factor.id,
        carbon_kg,
        source_type: 'manual',
        created_by: userData?.user?.id ?? null,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Entry added')
      qc.invalidateQueries({ queryKey: ['carbon-entries', projectId] })
      setFactorId('')
      setQuantity('')
      setDescription('')
      onClose()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to save'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Add Carbon Entry">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['1'] }}>
          Scope
        </label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
          style={{
            padding: spacing['3'], background: colors.surfaceInset, color: colors.textPrimary,
            border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.body,
          }}
        >
          <option value="embodied">Embodied (materials)</option>
          <option value="construction">Construction (equipment, fuel)</option>
          <option value="operational">Operational</option>
        </select>

        <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['1'] }}>
          Material
        </label>
        <select
          value={factorId}
          onChange={(e) => setFactorId(e.target.value)}
          style={{
            padding: spacing['3'], background: colors.surfaceInset, color: colors.textPrimary,
            border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.body,
          }}
        >
          <option value="">Select material…</option>
          {factors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.material_category} — {f.material_name} ({f.embodied_carbon_kg_per_unit} kg/{f.unit})
            </option>
          ))}
        </select>

        <InputField label="Quantity" value={quantity} onChange={setQuantity} type="number" placeholder="e.g., 250" />
        <InputField label="Description (optional)" value={description} onChange={setDescription} placeholder="e.g., Level 1 slab pour" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => saving.mutate()} disabled={saving.isPending}>Save</Btn>
        </div>
      </div>
    </Modal>
  )
}

const AI_SUGGESTIONS: Record<string, { alternative: string; reductionPct: number }> = {
  concrete: { alternative: 'Replace OPC with 30% fly ash or GGBS blend', reductionPct: 22 },
  steel: { alternative: 'Specify ≥70% recycled-content steel (EAF-produced)', reductionPct: 45 },
  lumber: { alternative: 'Use FSC-certified mass timber from regional suppliers', reductionPct: 30 },
  insulation: { alternative: 'Switch closed-cell foam to mineral wool or cellulose', reductionPct: 65 },
  glass: { alternative: 'Triple-pane low-e IGU with argon fill', reductionPct: 15 },
  masonry: { alternative: 'Specify CMU with supplementary cementitious materials', reductionPct: 18 },
  roofing: { alternative: 'Cool-roof TPO with high SRI or bio-based membrane', reductionPct: 20 },
  drywall: { alternative: 'Synthetic gypsum board (50%+ recycled content)', reductionPct: 35 },
  mechanical: { alternative: 'Aluminum or pre-insulated ductwork with regional sourcing', reductionPct: 25 },
  plumbing: { alternative: 'PEX-A tubing in place of copper where code allows', reductionPct: 70 },
  flooring: { alternative: 'Polished slab reuse — no new flooring material', reductionPct: 40 },
}

const AiSuggestionsModal: React.FC<{
  open: boolean
  onClose: () => void
  entries: CarbonEntry[]
}> = ({ open, onClose, entries }) => (
  <Modal open={open} onClose={onClose} title="Low-Carbon Alternatives" width="640px">
    {entries.length === 0 ? (
      <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.body }}>
        Add carbon entries first to get material-specific suggestions.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {entries.map((e) => {
          const s = AI_SUGGESTIONS[e.category] ?? {
            alternative: 'Consider sourcing from a supplier with a lower-carbon EPD.',
            reductionPct: 10,
          }
          const savings = Number(e.carbon_kg) * (s.reductionPct / 100)
          return (
            <div key={e.id} style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.base }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <Sparkles size={14} color="#F47820" />
                <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, textTransform: 'uppercase' }}>
                  {e.category}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: '#10B981', fontWeight: typography.fontWeight.semibold }}>
                  −{s.reductionPct}% · saves {savings.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg CO₂e
                </span>
              </div>
              <div style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                {e.description ?? e.category}
              </div>
              <div style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
                {s.alternative}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </Modal>
)

export default CarbonDashboard
