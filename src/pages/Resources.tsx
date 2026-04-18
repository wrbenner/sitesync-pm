import React, { useState, useMemo } from 'react'
import { Users, Package, Truck, Plus, Calculator, Download, Layers } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { toast } from 'sonner'
import {
  useLaborRates, useCreateLaborRate,
  useMaterialRates, useCreateMaterialRate,
  useEquipmentRates, useCreateEquipmentRate,
  useImportDavisBacon,
  type LaborRate, type MaterialRate, type EquipmentRate,
} from '../hooks/queries/resources'

type TabKey = 'labor' | 'materials' | 'equipment' | 'csi'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'labor', label: 'Labor', icon: Users },
  { key: 'materials', label: 'Materials', icon: Package },
  { key: 'equipment', label: 'Equipment', icon: Truck },
  { key: 'csi', label: 'CSI Divisions', icon: Layers },
]

const CSI_DIVISIONS: { code: number; label: string }[] = [
  { code: 1, label: '01 — General Requirements' },
  { code: 3, label: '03 — Concrete' },
  { code: 4, label: '04 — Masonry' },
  { code: 5, label: '05 — Metals' },
  { code: 6, label: '06 — Wood & Plastics' },
  { code: 7, label: '07 — Thermal & Moisture' },
  { code: 8, label: '08 — Openings' },
  { code: 9, label: '09 — Finishes' },
  { code: 21, label: '21 — Fire Suppression' },
  { code: 22, label: '22 — Plumbing' },
  { code: 23, label: '23 — HVAC' },
  { code: 26, label: '26 — Electrical' },
  { code: 31, label: '31 — Earthwork' },
  { code: 32, label: '32 — Exterior Improvements' },
  { code: 33, label: '33 — Utilities' },
]

export const Resources: React.FC = () => {
  const projectId = useProjectId()
  const [activeTab, setActiveTab] = useState<TabKey>('labor')
  const [laborModal, setLaborModal] = useState(false)
  const [materialModal, setMaterialModal] = useState(false)
  const [equipmentModal, setEquipmentModal] = useState(false)
  const [dbImportModal, setDbImportModal] = useState(false)

  const { data: labor, isLoading: laborLoading } = useLaborRates(projectId ?? undefined)
  const { data: materials, isLoading: matLoading } = useMaterialRates(projectId ?? undefined)
  const { data: equipment, isLoading: eqLoading } = useEquipmentRates(projectId ?? undefined)

  const createLabor = useCreateLaborRate()
  const createMaterial = useCreateMaterialRate()
  const createEquipment = useCreateEquipmentRate()
  const importDB = useImportDavisBacon(projectId ?? undefined)

  const [laborForm, setLaborForm] = useState({ trade: '', classification: 'Journeyman', hourly_rate: '', overtime_rate: '', benefits_rate: '', effective_date: new Date().toISOString().slice(0, 10), source: 'manual' as LaborRate['source'] })
  const [materialForm, setMaterialForm] = useState({ item_name: '', unit: 'ea', unit_cost: '', supplier: '', lead_time_days: '', csi_division: '' })
  const [equipmentForm, setEquipmentForm] = useState({ equipment_name: '', daily_rate: '', weekly_rate: '', monthly_rate: '', operator_included: false, fuel_included: false })
  const [dbForm, setDbForm] = useState({ state: '', county: '' })

  const [calc, setCalc] = useState<{ laborId: string; hours: string }>({ laborId: '', hours: '' })

  const totalLaborRates = (labor ?? []).length
  const totalMaterials = (materials ?? []).length
  const totalEquipment = (equipment ?? []).length

  const avgLaborRate = useMemo(() => {
    const list = labor ?? []
    if (list.length === 0) return 0
    return list.reduce((s, l) => s + (l.hourly_rate || 0), 0) / list.length / 100
  }, [labor])

  const calcTotal = useMemo(() => {
    if (!calc.laborId || !calc.hours) return null
    const rate = (labor ?? []).find((l) => l.id === calc.laborId)
    if (!rate) return null
    const hrs = parseFloat(calc.hours)
    if (isNaN(hrs)) return null
    return (rate.hourly_rate / 100) * hrs
  }, [calc, labor])

  const csiSummary = useMemo(() => {
    const buckets: Record<number, { labor: number; materials: number; equipment: number }> = {}
    CSI_DIVISIONS.forEach((d) => { buckets[d.code] = { labor: 0, materials: 0, equipment: 0 } })
    ;(materials ?? []).forEach((m) => {
      const code = m.csi_division
      if (code != null && buckets[code]) buckets[code].materials += 1
    })
    return buckets
  }, [materials])

  const handleCreateLabor = async () => {
    if (!projectId || !laborForm.trade || !laborForm.hourly_rate) {
      toast.error('Trade and rate required')
      return
    }
    try {
      await createLabor.mutateAsync({
        project_id: projectId,
        trade: laborForm.trade,
        classification: laborForm.classification,
        hourly_rate: Math.round(parseFloat(laborForm.hourly_rate) * 100),
        overtime_rate: laborForm.overtime_rate ? Math.round(parseFloat(laborForm.overtime_rate) * 100) : null,
        benefits_rate: laborForm.benefits_rate ? Math.round(parseFloat(laborForm.benefits_rate) * 100) : null,
        effective_date: laborForm.effective_date,
        source: laborForm.source,
      })
      toast.success('Labor rate added')
      setLaborModal(false)
      setLaborForm({ ...laborForm, trade: '', hourly_rate: '', overtime_rate: '', benefits_rate: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateMaterial = async () => {
    if (!projectId || !materialForm.item_name || !materialForm.unit_cost) {
      toast.error('Item and cost required')
      return
    }
    try {
      await createMaterial.mutateAsync({
        project_id: projectId,
        item_name: materialForm.item_name,
        unit: materialForm.unit,
        unit_cost: Math.round(parseFloat(materialForm.unit_cost) * 100),
        supplier: materialForm.supplier || null,
        lead_time_days: materialForm.lead_time_days ? parseInt(materialForm.lead_time_days, 10) : null,
        csi_division: materialForm.csi_division ? parseInt(materialForm.csi_division, 10) : null,
      })
      toast.success('Material added')
      setMaterialModal(false)
      setMaterialForm({ item_name: '', unit: 'ea', unit_cost: '', supplier: '', lead_time_days: '', csi_division: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateEquipment = async () => {
    if (!projectId || !equipmentForm.equipment_name || !equipmentForm.daily_rate) {
      toast.error('Name and daily rate required')
      return
    }
    try {
      await createEquipment.mutateAsync({
        project_id: projectId,
        equipment_name: equipmentForm.equipment_name,
        daily_rate: Math.round(parseFloat(equipmentForm.daily_rate) * 100),
        weekly_rate: equipmentForm.weekly_rate ? Math.round(parseFloat(equipmentForm.weekly_rate) * 100) : null,
        monthly_rate: equipmentForm.monthly_rate ? Math.round(parseFloat(equipmentForm.monthly_rate) * 100) : null,
        operator_included: equipmentForm.operator_included,
        fuel_included: equipmentForm.fuel_included,
      })
      toast.success('Equipment added')
      setEquipmentModal(false)
      setEquipmentForm({ equipment_name: '', daily_rate: '', weekly_rate: '', monthly_rate: '', operator_included: false, fuel_included: false })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleImport = async () => {
    if (!dbForm.state) {
      toast.error('State required')
      return
    }
    try {
      const res = await importDB.mutateAsync({ state: dbForm.state.toUpperCase(), county: dbForm.county || undefined })
      toast.success(`Imported ${res.inserted} rates`)
      setDbImportModal(false)
    } catch (err) {
      toast.error('Import failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Resources"
      subtitle="Labor, material, and equipment rates"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" icon={<Download size={16} />} onClick={() => setDbImportModal(true)}>Import Davis-Bacon</Btn>
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => {
            if (activeTab === 'labor') setLaborModal(true)
            else if (activeTab === 'materials') setMaterialModal(true)
            else if (activeTab === 'equipment') setEquipmentModal(true)
          }}>Add</Btn>
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
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['4']}`, border: 'none',
              borderRadius: borderRadius.base, cursor: 'pointer',
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
              color: isActive ? colors.orangeText : colors.textSecondary,
              backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
              transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
            }}>
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Labor Rates" value={totalLaborRates} />
        <MetricBox label="Avg Hourly" value={`$${avgLaborRate.toFixed(2)}`} />
        <MetricBox label="Materials" value={totalMaterials} />
        <MetricBox label="Equipment" value={totalEquipment} />
      </div>

      {activeTab === 'labor' && (
        <>
          <Card padding={spacing['4']}>
            <SectionHeader title="Labor Rates" />
            {laborLoading ? <Skeleton width="100%" height="180px" /> : (labor ?? []).length === 0 ? (
              <EmptyState icon={<Users size={48} />} title="No labor rates" description="Add rates manually or import Davis-Bacon prevailing wages." />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <th style={thStyle}>Trade</th>
                    <th style={thStyle}>Classification</th>
                    <th style={thStyle}>Hourly</th>
                    <th style={thStyle}>Overtime</th>
                    <th style={thStyle}>Benefits</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {(labor ?? []).map((l) => (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={tdStyle}>{l.trade}</td>
                      <td style={tdStyle}>{l.classification}</td>
                      <td style={tdStyle}>${(l.hourly_rate / 100).toFixed(2)}</td>
                      <td style={tdStyle}>{l.overtime_rate != null ? `$${(l.overtime_rate / 100).toFixed(2)}` : '—'}</td>
                      <td style={tdStyle}>{l.benefits_rate != null ? `$${(l.benefits_rate / 100).toFixed(2)}` : '—'}</td>
                      <td style={tdStyle}>{l.source.replace(/_/g, ' ')}</td>
                      <td style={tdStyle}>{new Date(l.effective_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card padding={spacing['4']} >
            <SectionHeader title="Cost Calculator" />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: spacing['3'], marginTop: spacing['3'], alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Select Rate</label>
                <select value={calc.laborId} onChange={(e) => setCalc({ ...calc, laborId: e.target.value })} style={selectStyle}>
                  <option value="">— choose —</option>
                  {(labor ?? []).map((l) => <option key={l.id} value={l.id}>{l.trade} · {l.classification} · ${(l.hourly_rate / 100).toFixed(2)}/hr</option>)}
                </select>
              </div>
              <InputField label="Hours" value={calc.hours} onChange={(v) => setCalc({ ...calc, hours: v })} placeholder="40" />
              <div style={{ minWidth: 160, padding: spacing['2'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Calculator size={16} color={colors.textSecondary} />
                <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                  {calcTotal !== null ? `$${calcTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'materials' && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Materials" />
          {matLoading ? <Skeleton width="100%" height="180px" /> : (materials ?? []).length === 0 ? (
            <EmptyState icon={<Package size={48} />} title="No materials" description="Add material unit costs." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Unit</th>
                  <th style={thStyle}>Unit Cost</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Lead Time</th>
                  <th style={thStyle}>CSI</th>
                </tr>
              </thead>
              <tbody>
                {(materials ?? []).map((m) => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <td style={tdStyle}>{m.item_name}</td>
                    <td style={tdStyle}>{m.unit}</td>
                    <td style={tdStyle}>${(m.unit_cost / 100).toFixed(2)}</td>
                    <td style={tdStyle}>{m.supplier || '—'}</td>
                    <td style={tdStyle}>{m.lead_time_days != null ? `${m.lead_time_days}d` : '—'}</td>
                    <td style={tdStyle}>{m.csi_division != null ? String(m.csi_division).padStart(2, '0') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'equipment' && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Equipment" />
          {eqLoading ? <Skeleton width="100%" height="180px" /> : (equipment ?? []).length === 0 ? (
            <EmptyState icon={<Truck size={48} />} title="No equipment" description="Add equipment rental rates." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <th style={thStyle}>Equipment</th>
                  <th style={thStyle}>Daily</th>
                  <th style={thStyle}>Weekly</th>
                  <th style={thStyle}>Monthly</th>
                  <th style={thStyle}>Operator</th>
                  <th style={thStyle}>Fuel</th>
                </tr>
              </thead>
              <tbody>
                {(equipment ?? []).map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <td style={tdStyle}>{e.equipment_name}</td>
                    <td style={tdStyle}>${(e.daily_rate / 100).toFixed(2)}</td>
                    <td style={tdStyle}>{e.weekly_rate != null ? `$${(e.weekly_rate / 100).toFixed(2)}` : '—'}</td>
                    <td style={tdStyle}>{e.monthly_rate != null ? `$${(e.monthly_rate / 100).toFixed(2)}` : '—'}</td>
                    <td style={tdStyle}>{e.operator_included ? 'Yes' : 'No'}</td>
                    <td style={tdStyle}>{e.fuel_included ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'csi' && (
        <Card padding={spacing['4']}>
          <SectionHeader title="CSI Division Summary" />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: spacing['3'] }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                <th style={thStyle}>Division</th>
                <th style={thStyle}>Materials</th>
              </tr>
            </thead>
            <tbody>
              {CSI_DIVISIONS.map((d) => (
                <tr key={d.code} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={tdStyle}>{d.label}</td>
                  <td style={tdStyle}>{csiSummary[d.code]?.materials ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={laborModal} onClose={() => setLaborModal(false)} title="Add Labor Rate" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Trade" value={laborForm.trade} onChange={(v) => setLaborForm({ ...laborForm, trade: v })} placeholder="Electrician" />
            <InputField label="Classification" value={laborForm.classification} onChange={(v) => setLaborForm({ ...laborForm, classification: v })} placeholder="Journeyman" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Hourly ($)" value={laborForm.hourly_rate} onChange={(v) => setLaborForm({ ...laborForm, hourly_rate: v })} placeholder="45.00" />
            <InputField label="Overtime ($)" value={laborForm.overtime_rate} onChange={(v) => setLaborForm({ ...laborForm, overtime_rate: v })} placeholder="67.50" />
            <InputField label="Benefits ($)" value={laborForm.benefits_rate} onChange={(v) => setLaborForm({ ...laborForm, benefits_rate: v })} placeholder="12.50" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Effective Date" type="date" value={laborForm.effective_date} onChange={(v) => setLaborForm({ ...laborForm, effective_date: v })} />
            <div>
              <label style={labelStyle}>Source</label>
              <select value={laborForm.source} onChange={(e) => setLaborForm({ ...laborForm, source: e.target.value as LaborRate['source'] })} style={selectStyle}>
                <option value="manual">Manual</option>
                <option value="davis_bacon">Davis-Bacon</option>
                <option value="prevailing_wage">Prevailing Wage</option>
                <option value="union">Union</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setLaborModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateLabor} loading={createLabor.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={materialModal} onClose={() => setMaterialModal(false)} title="Add Material" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Item Name" value={materialForm.item_name} onChange={(v) => setMaterialForm({ ...materialForm, item_name: v })} placeholder="2x4 Lumber (8')" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Unit" value={materialForm.unit} onChange={(v) => setMaterialForm({ ...materialForm, unit: v })} placeholder="ea" />
            <InputField label="Unit Cost ($)" value={materialForm.unit_cost} onChange={(v) => setMaterialForm({ ...materialForm, unit_cost: v })} placeholder="8.50" />
            <InputField label="Lead Time (days)" value={materialForm.lead_time_days} onChange={(v) => setMaterialForm({ ...materialForm, lead_time_days: v })} placeholder="7" />
          </div>
          <InputField label="Supplier" value={materialForm.supplier} onChange={(v) => setMaterialForm({ ...materialForm, supplier: v })} placeholder="Home Depot" />
          <div>
            <label style={labelStyle}>CSI Division</label>
            <select value={materialForm.csi_division} onChange={(e) => setMaterialForm({ ...materialForm, csi_division: e.target.value })} style={selectStyle}>
              <option value="">—</option>
              {CSI_DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setMaterialModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateMaterial} loading={createMaterial.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={equipmentModal} onClose={() => setEquipmentModal(false)} title="Add Equipment" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Equipment Name" value={equipmentForm.equipment_name} onChange={(v) => setEquipmentForm({ ...equipmentForm, equipment_name: v })} placeholder="Skid-Steer Loader" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Daily ($)" value={equipmentForm.daily_rate} onChange={(v) => setEquipmentForm({ ...equipmentForm, daily_rate: v })} placeholder="250" />
            <InputField label="Weekly ($)" value={equipmentForm.weekly_rate} onChange={(v) => setEquipmentForm({ ...equipmentForm, weekly_rate: v })} placeholder="900" />
            <InputField label="Monthly ($)" value={equipmentForm.monthly_rate} onChange={(v) => setEquipmentForm({ ...equipmentForm, monthly_rate: v })} placeholder="3000" />
          </div>
          <div style={{ display: 'flex', gap: spacing['4'] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={equipmentForm.operator_included} onChange={(e) => setEquipmentForm({ ...equipmentForm, operator_included: e.target.checked })} /> Operator included
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <input type="checkbox" checked={equipmentForm.fuel_included} onChange={(e) => setEquipmentForm({ ...equipmentForm, fuel_included: e.target.checked })} /> Fuel included
            </label>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEquipmentModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateEquipment} loading={createEquipment.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={dbImportModal} onClose={() => setDbImportModal(false)} title="Import Davis-Bacon Rates" width="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
            Pull prevailing wage rates from the federal Davis-Bacon database by state and county.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: spacing['3'] }}>
            <InputField label="State" value={dbForm.state} onChange={(v) => setDbForm({ ...dbForm, state: v })} placeholder="CA" />
            <InputField label="County (optional)" value={dbForm.county} onChange={(v) => setDbForm({ ...dbForm, county: v })} placeholder="Los Angeles" />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setDbImportModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleImport} loading={importDB.isPending}>Import</Btn>
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

// Suppress unused warnings for optional form types/interfaces
void ({} as MaterialRate)
void ({} as EquipmentRate)

export default Resources
