import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, Users, Wrench, HardHat, ShieldCheck, UserPlus, FileText, ChevronLeft, ChevronRight, Save, Lock, Truck, AlertTriangle, Plus, Trash2, WifiOff } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, zIndex, touchTarget } from '../../styles/theme';
import type { WeatherData } from '../../lib/weather';
import { useOfflineStore } from '../../services/offlineQueue';

type Section = 'weather' | 'crew' | 'equipment' | 'materials' | 'work' | 'safety' | 'visitors' | 'incidents' | 'notes';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'weather',   label: 'Weather',           icon: <Cloud size={18} /> },
  { id: 'crew',      label: 'Crew Entries',       icon: <Users size={18} /> },
  { id: 'equipment', label: 'Equipment',          icon: <Wrench size={18} /> },
  { id: 'materials', label: 'Material Deliveries',icon: <Truck size={18} /> },
  { id: 'work',      label: 'Work Performed',     icon: <HardHat size={18} /> },
  { id: 'safety',    label: 'Safety',             icon: <ShieldCheck size={18} /> },
  { id: 'visitors',  label: 'Visitors',           icon: <UserPlus size={18} /> },
  { id: 'incidents', label: 'Incidents',          icon: <AlertTriangle size={18} /> },
  { id: 'notes',     label: 'Notes',              icon: <FileText size={18} /> },
];

const touchInput: React.CSSProperties = {
  width: '100%', padding: `${spacing['3.5']} ${spacing['4']}`, fontSize: typography.fontSize.title, fontFamily: typography.fontFamily,
  border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
  outline: 'none', boxSizing: 'border-box', minHeight: touchTarget.comfortable,
};

const touchTextarea: React.CSSProperties = {
  ...touchInput, resize: 'vertical', minHeight: spacing['24'], lineHeight: typography.lineHeight.normal,
};

const touchLabel: React.CSSProperties = {
  display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
  color: colors.textPrimary, marginBottom: spacing['2'],
};

const smallInput: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
  border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
  outline: 'none', boxSizing: 'border-box', width: '100%',
};

// ── Types ────────────────────────────────────────────────

export interface CrewEntry        { company: string; trade: string; headcount: number; hours: number }
export interface EquipmentEntry   { type: string; count: number; hours_operated: number }
export interface MaterialDelivery { description: string; quantity: number; po_reference: string; delivery_ticket: string }
export interface VisitorEntry     { name: string; company: string; purpose: string; time_in: string; time_out: string }
export interface IncidentDetail   { description: string; type: string; corrective_action: string }

export interface QuickEntryData {
  weather: WeatherData | null;
  crew_entries: CrewEntry[];
  equipment_entries: EquipmentEntry[];
  material_deliveries: MaterialDelivery[];
  workPerformed: string;
  safety_observations: string;
  toolbox_talk_topic: string;
  visitors: VisitorEntry[];
  incident_details: IncidentDetail[];
  notes: string;
}

interface QuickEntryProps {
  initialWeather?: WeatherData | null;
  onSave: (data: QuickEntryData) => void;
  onSubmit: (data: QuickEntryData) => void;
  onClose: () => void;
}

const DEFAULT_CREW_TRADES = ['Concrete', 'Electrical', 'Mechanical', 'Plumbing', 'Steel', 'Carpentry', 'General Labor'];

function emptyCrewEntries(): CrewEntry[] {
  return DEFAULT_CREW_TRADES.map(trade => ({ company: '', trade, headcount: 0, hours: 0 }));
}

// ── AddRowButton ─────────────────────────────────────────

const AddRowBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: spacing['1'],
    padding: `${spacing['2']} ${spacing['3']}`, border: `1px dashed ${colors.borderDefault}`,
    borderRadius: borderRadius.md, backgroundColor: 'transparent', cursor: 'pointer',
    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textSecondary,
    width: '100%', justifyContent: 'center',
  }}>
    <Plus size={14} /> {label}
  </button>
);

const RemoveBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} style={{
    padding: spacing['2'], border: 'none', backgroundColor: 'transparent',
    cursor: 'pointer', color: colors.textTertiary, borderRadius: borderRadius.sm, flexShrink: 0,
  }}>
    <Trash2 size={14} />
  </button>
);

// ── Main Component ───────────────────────────────────────

export const QuickEntry: React.FC<QuickEntryProps> = ({ initialWeather, onSave, onSubmit, onClose }) => {
  const pendingCount = useOfflineStore(s => s.pendingCount);
  const [activeSection, setActiveSection] = useState(0);
  const [data, setData] = useState<QuickEntryData>({
    weather: initialWeather ?? null,
    crew_entries: emptyCrewEntries(),
    equipment_entries: [],
    material_deliveries: [],
    workPerformed: '',
    safety_observations: '',
    toolbox_talk_topic: '',
    visitors: [],
    incident_details: [],
    notes: '',
  });

  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      const current = JSON.stringify(data);
      if (current !== lastSavedRef.current) {
        onSave(data);
        lastSavedRef.current = current;
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data, onSave]);

  const goNext = useCallback(() => {
    if (activeSection < SECTIONS.length - 1) setActiveSection(s => s + 1);
  }, [activeSection]);

  const goPrev = useCallback(() => {
    if (activeSection > 0) setActiveSection(s => s - 1);
  }, [activeSection]);

  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) { if (diff > 0) goNext(); else goPrev(); }
  };

  // ── Crew helpers ──────────────────────────────────────

  const updateCrew = (idx: number, field: keyof CrewEntry, value: string | number) =>
    setData(prev => ({ ...prev, crew_entries: prev.crew_entries.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const addCrewRow = () =>
    setData(prev => ({ ...prev, crew_entries: [...prev.crew_entries, { company: '', trade: '', headcount: 0, hours: 0 }] }));

  const removeCrewRow = (idx: number) =>
    setData(prev => ({ ...prev, crew_entries: prev.crew_entries.filter((_, i) => i !== idx) }));

  // ── Equipment helpers ─────────────────────────────────

  const updateEquipment = (idx: number, field: keyof EquipmentEntry, value: string | number) =>
    setData(prev => ({ ...prev, equipment_entries: prev.equipment_entries.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const addEquipmentRow = () =>
    setData(prev => ({ ...prev, equipment_entries: [...prev.equipment_entries, { type: '', count: 1, hours_operated: 0 }] }));

  const removeEquipmentRow = (idx: number) =>
    setData(prev => ({ ...prev, equipment_entries: prev.equipment_entries.filter((_, i) => i !== idx) }));

  // ── Material helpers ──────────────────────────────────

  const updateMaterial = (idx: number, field: keyof MaterialDelivery, value: string | number) =>
    setData(prev => ({ ...prev, material_deliveries: prev.material_deliveries.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const addMaterialRow = () =>
    setData(prev => ({ ...prev, material_deliveries: [...prev.material_deliveries, { description: '', quantity: 0, po_reference: '', delivery_ticket: '' }] }));

  const removeMaterialRow = (idx: number) =>
    setData(prev => ({ ...prev, material_deliveries: prev.material_deliveries.filter((_, i) => i !== idx) }));

  // ── Visitor helpers ───────────────────────────────────

  const updateVisitor = (idx: number, field: keyof VisitorEntry, value: string) =>
    setData(prev => ({ ...prev, visitors: prev.visitors.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const addVisitorRow = () =>
    setData(prev => ({ ...prev, visitors: [...prev.visitors, { name: '', company: '', purpose: '', time_in: '', time_out: '' }] }));

  const removeVisitorRow = (idx: number) =>
    setData(prev => ({ ...prev, visitors: prev.visitors.filter((_, i) => i !== idx) }));

  // ── Incident helpers ──────────────────────────────────

  const updateIncident = (idx: number, field: keyof IncidentDetail, value: string) =>
    setData(prev => ({ ...prev, incident_details: prev.incident_details.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const addIncidentRow = () =>
    setData(prev => ({ ...prev, incident_details: [...prev.incident_details, { description: '', type: 'near_miss', corrective_action: '' }] }));

  const removeIncidentRow = (idx: number) =>
    setData(prev => ({ ...prev, incident_details: prev.incident_details.filter((_, i) => i !== idx) }));

  // ── Section Renderers ─────────────────────────────────

  const section = SECTIONS[activeSection];

  const renderSection = () => {
    switch (section.id) {

      case 'weather':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {data.weather ? (
              <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, textAlign: 'center' }}>
                <span style={{ fontSize: spacing['12'] }}>{data.weather.icon}</span>
                <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['2']} 0 0` }}>
                  {data.weather.temp_high}F / {data.weather.temp_low}F
                </p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
                  {data.weather.conditions} · Wind {data.weather.wind_speed}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center' }}>No weather data available.</p>
            )}
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center' }}>
              Weather auto fetched. Override values from the main log view.
            </p>
          </div>
        );

      case 'crew':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 72px 28px', gap: spacing['2'], padding: `0 ${spacing['1']}` }}>
              {['Company', 'Trade', 'Count', 'Hours', ''].map(h => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {data.crew_entries.map((crew, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 72px 28px', gap: spacing['2'], alignItems: 'center' }}>
                <input
                  type="text" value={crew.company} placeholder="Company"
                  onChange={e => updateCrew(idx, 'company', e.target.value)}
                  style={{ ...smallInput }}
                />
                <input
                  type="text" value={crew.trade} placeholder="Trade"
                  onChange={e => updateCrew(idx, 'trade', e.target.value)}
                  style={{ ...smallInput }}
                />
                <input
                  type="number" inputMode="numeric" value={crew.headcount || ''} placeholder="0"
                  onChange={e => updateCrew(idx, 'headcount', Number(e.target.value))}
                  style={{ ...smallInput, textAlign: 'center' }}
                />
                <input
                  type="number" inputMode="numeric" value={crew.hours || ''} placeholder="0"
                  onChange={e => updateCrew(idx, 'hours', Number(e.target.value))}
                  style={{ ...smallInput, textAlign: 'center' }}
                />
                <RemoveBtn onClick={() => removeCrewRow(idx)} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 72px 28px', gap: spacing['2'], padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, gridColumn: 'span 2' }}>Total</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' }}>{data.crew_entries.reduce((s, c) => s + c.headcount, 0)}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' }}>{data.crew_entries.reduce((s, c) => s + c.hours, 0)}</span>
              <span />
            </div>
            <AddRowBtn label="Add crew row" onClick={addCrewRow} />
          </div>
        );

      case 'equipment':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {data.equipment_entries.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 80px 28px', gap: spacing['2'], padding: `0 ${spacing['1']}` }}>
                {['Equipment Type', 'Qty', 'Hrs Operated', ''].map(h => (
                  <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
            )}
            {data.equipment_entries.map((eq, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 80px 28px', gap: spacing['2'], alignItems: 'center' }}>
                <input
                  type="text" value={eq.type} placeholder="e.g. Tower Crane"
                  onChange={e => updateEquipment(idx, 'type', e.target.value)}
                  style={{ ...smallInput }}
                />
                <input
                  type="number" inputMode="numeric" value={eq.count || ''} placeholder="1"
                  onChange={e => updateEquipment(idx, 'count', Number(e.target.value))}
                  style={{ ...smallInput, textAlign: 'center' }}
                />
                <input
                  type="number" inputMode="numeric" value={eq.hours_operated || ''} placeholder="0"
                  onChange={e => updateEquipment(idx, 'hours_operated', Number(e.target.value))}
                  style={{ ...smallInput, textAlign: 'center' }}
                />
                <RemoveBtn onClick={() => removeEquipmentRow(idx)} />
              </div>
            ))}
            {data.equipment_entries.length === 0 && (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing['4'] }}>No equipment logged. Add rows below.</p>
            )}
            <AddRowBtn label="Add equipment" onClick={addEquipmentRow} />
          </div>
        );

      case 'materials':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {data.material_deliveries.map((mat, idx) => (
              <div key={idx} style={{ backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, padding: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase' }}>Delivery {idx + 1}</span>
                  <RemoveBtn onClick={() => removeMaterialRow(idx)} />
                </div>
                <input
                  type="text" value={mat.description} placeholder="Material description"
                  onChange={e => updateMaterial(idx, 'description', e.target.value)}
                  style={{ ...smallInput }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['2'] }}>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Quantity</span>
                    <input
                      type="number" inputMode="numeric" value={mat.quantity || ''} placeholder="0"
                      onChange={e => updateMaterial(idx, 'quantity', Number(e.target.value))}
                      style={{ ...smallInput }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>PO Reference</span>
                    <input
                      type="text" value={mat.po_reference} placeholder="PO-001"
                      onChange={e => updateMaterial(idx, 'po_reference', e.target.value)}
                      style={{ ...smallInput }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Delivery Ticket</span>
                    <input
                      type="text" value={mat.delivery_ticket} placeholder="DT-001"
                      onChange={e => updateMaterial(idx, 'delivery_ticket', e.target.value)}
                      style={{ ...smallInput }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {data.material_deliveries.length === 0 && (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing['4'] }}>No deliveries today. Add below if received.</p>
            )}
            <AddRowBtn label="Add delivery" onClick={addMaterialRow} />
          </div>
        );

      case 'work':
        return (
          <div>
            <label style={touchLabel}>Work performed today</label>
            <textarea
              value={data.workPerformed}
              onChange={e => setData(prev => ({ ...prev, workPerformed: e.target.value }))}
              placeholder={'Concrete pour Level 9 complete\nElectrical rough in Floors 3 to 5\nSteel erection Floors 10 and 11'}
              style={{ ...touchTextarea, minHeight: '160px' }}
            />
          </div>
        );

      case 'safety':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <div>
              <label style={touchLabel}>Toolbox talk topic</label>
              <input
                type="text"
                value={data.toolbox_talk_topic}
                onChange={e => setData(prev => ({ ...prev, toolbox_talk_topic: e.target.value }))}
                placeholder="e.g. Fall protection awareness"
                style={{ ...touchInput }}
              />
            </div>
            <div>
              <label style={touchLabel}>Safety observations</label>
              <textarea
                value={data.safety_observations}
                onChange={e => setData(prev => ({ ...prev, safety_observations: e.target.value }))}
                placeholder={'All PPE compliance verified\nNo near misses observed\nHousekeeping inspection passed'}
                style={touchTextarea}
              />
            </div>
          </div>
        );

      case 'visitors':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {data.visitors.map((visitor, idx) => (
              <div key={idx} style={{ backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, padding: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase' }}>Visitor {idx + 1}</span>
                  <RemoveBtn onClick={() => removeVisitorRow(idx)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Name</span>
                    <input type="text" value={visitor.name} placeholder="Full name" onChange={e => updateVisitor(idx, 'name', e.target.value)} style={{ ...smallInput }} />
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Company</span>
                    <input type="text" value={visitor.company} placeholder="Company" onChange={e => updateVisitor(idx, 'company', e.target.value)} style={{ ...smallInput }} />
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Purpose of visit</span>
                  <input type="text" value={visitor.purpose} placeholder="e.g. Owner site walk" onChange={e => updateVisitor(idx, 'purpose', e.target.value)} style={{ ...smallInput }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Time in</span>
                    <input type="time" value={visitor.time_in} onChange={e => updateVisitor(idx, 'time_in', e.target.value)} style={{ ...smallInput }} />
                  </div>
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Time out</span>
                    <input type="time" value={visitor.time_out} onChange={e => updateVisitor(idx, 'time_out', e.target.value)} style={{ ...smallInput }} />
                  </div>
                </div>
              </div>
            ))}
            {data.visitors.length === 0 && (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing['4'] }}>No visitors today. Add below if applicable.</p>
            )}
            <AddRowBtn label="Add visitor" onClick={addVisitorRow} />
          </div>
        );

      case 'incidents':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {data.incident_details.map((inc, idx) => (
              <div key={idx} style={{ backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, padding: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'], borderLeft: `3px solid ${colors.statusCritical}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase' }}>Incident {idx + 1}</span>
                  <RemoveBtn onClick={() => removeIncidentRow(idx)} />
                </div>
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Type</span>
                  <select
                    value={inc.type}
                    onChange={e => updateIncident(idx, 'type', e.target.value)}
                    style={{ ...smallInput }}
                  >
                    <option value="near_miss">Near Miss</option>
                    <option value="first_aid">First Aid</option>
                    <option value="recordable">Recordable Injury</option>
                    <option value="property_damage">Property Damage</option>
                    <option value="environmental">Environmental</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Description</span>
                  <textarea
                    value={inc.description}
                    onChange={e => updateIncident(idx, 'description', e.target.value)}
                    placeholder="Describe what happened..."
                    style={{ ...smallInput, minHeight: '72px', resize: 'vertical' as const }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Corrective action taken</span>
                  <input
                    type="text" value={inc.corrective_action}
                    onChange={e => updateIncident(idx, 'corrective_action', e.target.value)}
                    placeholder="Immediate corrective action..."
                    style={{ ...smallInput }}
                  />
                </div>
              </div>
            ))}
            {data.incident_details.length === 0 && (
              <div style={{ textAlign: 'center', padding: spacing['6'] }}>
                <ShieldCheck size={28} color={colors.statusActive} style={{ marginBottom: spacing['2'] }} />
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.statusActive, margin: 0 }}>No incidents today</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing['1']} 0 0` }}>Add below only if an incident occurred.</p>
              </div>
            )}
            <AddRowBtn label="Record incident" onClick={addIncidentRow} />
          </div>
        );

      case 'notes':
        return (
          <div>
            <label style={touchLabel}>Additional notes</label>
            <textarea
              value={data.notes}
              onChange={e => setData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional observations, follow up items, or notes for tomorrow"
              style={{ ...touchTextarea, minHeight: '160px' }}
            />
          </div>
        );
    }
  };

  const isLastSection = activeSection === SECTIONS.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.surfacePage, zIndex: zIndex.tooltip as number, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised }}>
        <button onClick={onClose} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary, minHeight: touchTarget.min }}>Cancel</button>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Quick Entry</span>
        <button onClick={() => onSave(data)} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.orangeText, fontWeight: typography.fontWeight.semibold, minHeight: touchTarget.min, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <Save size={16} /> Save
        </button>
      </div>

      {/* Sync pending banner */}
      {pendingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['4']}`,
          backgroundColor: colors.statusWarningSubtle ?? '#FFF8E7',
          borderBottom: `1px solid ${colors.statusWarning ?? '#F59E0B'}`,
        }}>
          <WifiOff size={13} color={colors.statusWarning ?? '#F59E0B'} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusWarning ?? '#B45309', fontWeight: typography.fontWeight.medium }}>
            {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} pending sync
          </span>
        </div>
      )}

      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}` }}>
        {SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => setActiveSection(i)} style={{
            width: i === activeSection ? 24 : 8, height: 8,
            borderRadius: borderRadius.full, border: 'none', cursor: 'pointer',
            backgroundColor: i === activeSection ? colors.primaryOrange : i < activeSection ? colors.statusActive : colors.borderDefault,
            transition: `all ${transitions.quick}`,
          }} />
        ))}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['5']}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.orangeSubtle, color: colors.orangeText }}>
          {section.icon}
        </div>
        <div>
          <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{section.label}</p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Step {activeSection + 1} of {SECTIONS.length}</p>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderSection()}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}`,
        backgroundColor: colors.surfaceRaised,
        paddingBottom: `max(${spacing['3']}, env(safe-area-inset-bottom))`,
      }}>
        <button onClick={goPrev} disabled={activeSection === 0} style={{
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          padding: `${spacing['3']} ${spacing['4']}`, minHeight: touchTarget.comfortable,
          fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
          backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.md, cursor: activeSection === 0 ? 'default' : 'pointer',
          color: activeSection === 0 ? colors.textTertiary : colors.textPrimary,
          opacity: activeSection === 0 ? 0.5 : 1,
        }}>
          <ChevronLeft size={16} /> Back
        </button>

        {!isLastSection ? (
          <button onClick={goNext} style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: touchTarget.comfortable,
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.primaryOrange, color: colors.white,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
          }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => onSubmit(data)} style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: touchTarget.comfortable,
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.darkNavy, color: colors.white,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
          }}>
            <Lock size={16} /> Submit and Lock
          </button>
        )}
      </div>
    </div>
  );
};
