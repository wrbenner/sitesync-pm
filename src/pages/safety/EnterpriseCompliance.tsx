import React, { useState } from 'react';
import { FileText, Search, Shield, Flame, AlertTriangle, Plus, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Btn, Modal, InputField, EmptyState } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useIncidents } from '../../hooks/queries';
import { usePreTaskPlans } from '../../hooks/queries/enterprise-modules';
import { usePermits } from '../../hooks/queries/permits';
import { useMaterialInventory, useCreateMaterialItem } from '../../hooks/queries/procurement-equipment';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'
import { useQueryClient } from '@tanstack/react-query';

/* ================================================================
   OSHA 300 / 300A LOG
   ================================================================ */

interface OshaRecord {
  caseNo: string; employee: string; jobTitle: string; dateOfInjury: string;
  location: string; description: string; classification: 'death' | 'days_away' | 'restricted' | 'other';
  daysAway: number; daysRestricted: number;
}

const classifyLabel: Record<string, string> = { death: 'Death', days_away: 'Days Away', restricted: 'Job Restriction/Transfer', other: 'Other Recordable' };
const classifyColor: Record<string, string> = { death: colors.statusCritical, days_away: colors.statusWarning, restricted: colors.statusPending, other: colors.statusNeutral };

const cellSt: React.CSSProperties = { padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' };
const thSt: React.CSSProperties = { ...cellSt, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, backgroundColor: colors.surfaceInset, position: 'sticky' as const, top: 0 };

function mapSeverityToClassification(severity: string): 'death' | 'days_away' | 'restricted' | 'other' {
  switch (severity) {
    case 'fatality': return 'death';
    case 'lost_time': return 'days_away';
    case 'medical_treatment': return 'restricted';
    default: return 'other';
  }
}

export const OshaLogsTab: React.FC = () => {
  const projectId = useProjectId();
  const { data: incidents, isLoading } = useIncidents(projectId);

  const oshaRecords: OshaRecord[] = (incidents ?? []).map((inc: Record<string, unknown>, idx: number) => {
    const year = inc.date ? new Date(inc.date as string).getFullYear() : new Date().getFullYear();
    return {
      caseNo: `${year}-${String(idx + 1).padStart(3, '0')}`,
      employee: (inc.injured_party_name as string) || (inc.reported_by as string) || 'Unknown',
      jobTitle: (inc.job_title as string) || 'Worker',
      dateOfInjury: (inc.date as string) || '',
      location: (inc.location as string) || '',
      description: (inc.description as string) || '',
      classification: mapSeverityToClassification((inc.severity as string) || ''),
      daysAway: (inc.days_away_from_work as number) || 0,
      daysRestricted: (inc.days_restricted as number) || 0,
    };
  });

  const totalCases = oshaRecords.length;
  const totalDeaths = oshaRecords.filter(r => r.classification === 'death').length;
  const totalDaysAway = oshaRecords.reduce((s, r) => s + r.daysAway, 0);
  const totalRestricted = oshaRecords.reduce((s, r) => s + r.daysRestricted, 0);
  const totalOther = oshaRecords.filter(r => r.classification === 'other').length;
  const avgEmployees = 148;
  const totalHours = 312480;
  const trir = totalCases > 0 ? ((totalCases * 200000) / totalHours).toFixed(2) : '0.00';
  const dart = totalCases > 0 ? (((oshaRecords.filter(r => r.classification === 'days_away' || r.classification === 'restricted').length) * 200000) / totalHours).toFixed(2) : '0.00';

  if (isLoading) {
    return (
      <Card>
        <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          Loading OSHA log data...
        </div>
      </Card>
    );
  }

  if (oshaRecords.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={40} />}
        title="No Recordable Incidents"
        description="No recordable incidents. Your OSHA 300 log will populate automatically from incident reports."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Establishment Info */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
          <div>
            <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>OSHA 300 Log &mdash; Log of Work-Related Injuries and Illnesses</h3>
            <p style={{ margin: `${spacing['1']} 0 0`, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>Establishment: SiteSync Construction LLC &bull; 1200 Industrial Blvd, Houston TX 77001 &bull; SIC 1542 &bull; Year {new Date().getFullYear()}</p>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => alert('OSHA 300 PDF generation triggered (simulated)')}>Generate 300 PDF</Btn>
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => alert('OSHA 300A PDF generation triggered (simulated)')}>Generate 300A PDF</Btn>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thSt}>Case No.</th><th style={thSt}>Employee Name</th><th style={thSt}>Job Title</th>
                <th style={thSt}>Date of Injury</th><th style={thSt}>Where Occurred</th><th style={{ ...thSt, minWidth: 180 }}>Description</th>
                <th style={thSt}>Classification</th><th style={thSt}>Days Away</th><th style={thSt}>Days Restricted</th>
              </tr>
            </thead>
            <tbody>
              {oshaRecords.map(r => (
                <tr key={r.caseNo}>
                  <td style={cellSt}>{r.caseNo}</td>
                  <td style={cellSt}>{r.employee}</td>
                  <td style={cellSt}>{r.jobTitle}</td>
                  <td style={cellSt}>{r.dateOfInjury}</td>
                  <td style={cellSt}>{r.location}</td>
                  <td style={{ ...cellSt, whiteSpace: 'normal', maxWidth: 260 }}>{r.description}</td>
                  <td style={cellSt}><span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: `${classifyColor[r.classification]}18`, color: classifyColor[r.classification] }}>{classifyLabel[r.classification]}</span></td>
                  <td style={{ ...cellSt, textAlign: 'center' }}>{r.daysAway || '-'}</td>
                  <td style={{ ...cellSt, textAlign: 'center' }}>{r.daysRestricted || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 300A Summary */}
      <Card>
        <h3 style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>OSHA 300A &mdash; Summary of Work-Related Injuries and Illnesses</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing['3'] }}>
          {[
            { label: 'Total Cases', value: totalCases },
            { label: 'Total Deaths', value: totalDeaths },
            { label: 'Total Days Away', value: totalDaysAway },
            { label: 'Total Restricted/Transfer', value: totalRestricted },
            { label: 'Other Recordable', value: totalOther },
            { label: 'Avg Employees', value: avgEmployees },
            { label: 'Total Hours Worked', value: totalHours.toLocaleString() },
            { label: 'TRIR', value: trir },
            { label: 'DART Rate', value: dart },
          ].map(m => (
            <div key={m.label} style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{m.value}</div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


/* ================================================================
   JOB HAZARD ANALYSIS (JHA)
   ================================================================ */

interface JhaStep { stepNo: number; description: string; hazards: string; controls: string; responsible: string; likelihood: number; severity: number; }
interface Jha { id: string; taskName: string; location: string; date: string; preparedBy: string; reviewedBy: string; steps: JhaStep[]; ppe: string[]; template: string; }

const PPE_OPTIONS = ['Hard Hat', 'Safety Glasses', 'Gloves', 'Fall Protection', 'Respirator', 'Hearing Protection', 'Hi-Vis Vest', 'Steel Toe Boots'];
const JHA_TEMPLATES = ['Concrete Pour', 'Steel Erection', 'Excavation', 'Roofing', 'Electrical', 'Hot Work', 'Confined Space'];

const riskColor = (score: number) => score >= 15 ? colors.statusCritical : score >= 8 ? colors.statusWarning : score >= 4 ? colors.statusPending : colors.statusSuccess;
const riskLabel = (score: number) => score >= 15 ? 'Critical' : score >= 8 ? 'High' : score >= 4 ? 'Medium' : 'Low';

function mapPreTaskPlanToJha(ptp: Record<string, unknown>): Jha {
  const hazards = (ptp.hazards as Array<Record<string, unknown>>) || [];
  const steps: JhaStep[] = hazards.map((h, idx) => ({
    stepNo: idx + 1,
    description: (h.hazard as string) || 'Identified hazard',
    hazards: (h.hazard as string) || '',
    controls: (h.control_measure as string) || '',
    responsible: (ptp.foreman as string) || 'Crew Lead',
    likelihood: 2,
    severity: 3,
  }));

  const ppeList: string[] = hazards
    .map(h => (h.ppe_required as string) || '')
    .filter(Boolean)
    .flatMap(p => p.split(',').map(s => s.trim()))
    .filter((v, i, a) => v && a.indexOf(v) === i);

  return {
    id: ptp.id as string,
    taskName: (ptp.task_description as string) || 'Untitled Task',
    location: (ptp.crew_name as string) || 'On-site',
    date: (ptp.date as string) || '',
    preparedBy: (ptp.foreman as string) || 'Unknown',
    reviewedBy: '',
    steps,
    ppe: ppeList.length > 0 ? ppeList : ['Hard Hat', 'Safety Glasses'],
    template: 'Pre-Task Plan',
  };
}

export const JhaTab: React.FC<{ onNavigateToPTP?: () => void }> = ({ onNavigateToPTP }) => {
  const projectId = useProjectId();
  const { data: ptps, isLoading } = usePreTaskPlans(projectId ?? undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const jhaList: Jha[] = (ptps ?? []).map((p: unknown) => mapPreTaskPlanToJha(p as unknown as Record<string, unknown>));

  if (isLoading) {
    return (
      <Card>
        <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          Loading job hazard analyses...
        </div>
      </Card>
    );
  }

  if (jhaList.length === 0) {
    return (
      <EmptyState
        icon={<Shield size={40} />}
        title="No Job Hazard Analyses"
        description="No job hazard analyses yet. Create pre-task plans to build your JHA library."
        actionLabel="Create JHA"
        onAction={() => setShowModal(true)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>Job Hazard Analyses</h3>
          <p style={{ margin: `${spacing['1']} 0 0`, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>Templates: {JHA_TEMPLATES.join(', ')}</p>
        </div>
        <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>Create JHA</Btn>
      </div>

      {jhaList.map(jha => {
        const isOpen = expanded === jha.id;
        return (
          <Card key={jha.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : jha.id)}>
              <div>
                <div style={{ fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.base }}>{jha.taskName}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>{jha.location} &bull; {jha.date} &bull; Prepared by {jha.preparedBy}{jha.reviewedBy ? ` \u2022 Reviewed by ${jha.reviewedBy}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: colors.surfaceInset, color: colors.textSecondary }}>{jha.template}</span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            {isOpen && (
              <div style={{ marginTop: spacing['3'] }}>
                <div style={{ marginBottom: spacing['3'] }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Required PPE:</span>{' '}
                  {jha.ppe.map(p => <span key={p} style={{ display: 'inline-block', margin: `2px ${spacing['1']}`, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: colors.surfaceInset }}>{p}</span>)}
                </div>
                {jha.steps.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thSt}>#</th><th style={thSt}>Step</th><th style={thSt}>Hazards</th><th style={thSt}>Controls</th><th style={thSt}>Responsible</th><th style={thSt}>L</th><th style={thSt}>S</th><th style={thSt}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jha.steps.map(s => {
                        const score = s.likelihood * s.severity;
                        return (
                          <tr key={s.stepNo}>
                            <td style={cellSt}>{s.stepNo}</td>
                            <td style={{ ...cellSt, whiteSpace: 'normal', maxWidth: 200 }}>{s.description}</td>
                            <td style={{ ...cellSt, whiteSpace: 'normal', maxWidth: 200 }}>{s.hazards}</td>
                            <td style={{ ...cellSt, whiteSpace: 'normal', maxWidth: 220 }}>{s.controls}</td>
                            <td style={cellSt}>{s.responsible}</td>
                            <td style={{ ...cellSt, textAlign: 'center' }}>{s.likelihood}</td>
                            <td style={{ ...cellSt, textAlign: 'center' }}>{s.severity}</td>
                            <td style={{ ...cellSt, textAlign: 'center' }}>
                              <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, backgroundColor: `${riskColor(score)}18`, color: riskColor(score) }}>{score} {riskLabel(score)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: spacing['3'], color: colors.textSecondary, fontSize: typography.fontSize.sm, textAlign: 'center' }}>No hazard steps defined for this plan.</div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {showModal && (
        <Modal open onClose={() => setShowModal(false)} title="Create Job Hazard Analysis">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <InputField label="Job/Task Name" value="" onChange={() => {}} placeholder="e.g., Concrete Pour - Level 5" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <InputField label="Location" value="" onChange={() => {}} placeholder="Tower A Level 8" />
              <InputField label="Date" value={new Date().toISOString().split('T')[0]} onChange={() => {}} type="date" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <InputField label="Prepared By" value="" onChange={() => {}} />
              <InputField label="Reviewed By" value="" onChange={() => {}} />
            </div>
            <div>
              <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], display: 'block' }}>Template</label>
              <select style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.border}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
                <option value="">Select a template...</option>
                {JHA_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], display: 'block' }}>Required PPE</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
                {PPE_OPTIONS.map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, cursor: 'pointer' }}>
                    <input type="checkbox" /> {p}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
              <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => { setShowModal(false); if (onNavigateToPTP) { onNavigateToPTP(); } }}>Create JHA</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


/* ================================================================
   SAFETY DATA SHEET (SDS) MANAGEMENT
   ================================================================ */

interface Chemical {
  id: string; productName: string; manufacturer: string; sdsDate: string;
  hazards: string[]; location: string; quantity: string;
}

const GHS_ICONS: Record<string, string> = { flame: '\u{1F525}', skull: '\u2620\uFE0F', exclamation: '\u26A0\uFE0F', health: '\u{1F3E5}', environment: '\u{1F33F}' };

const isExpired = (sdsDate: string): boolean => {
  const d = new Date(sdsDate);
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  return d < threeYearsAgo;
};

function mapMaterialToChemical(mat: Record<string, unknown>): Chemical {
  // Parse hazards from material_inventory — stored as tags or description keywords
  const tags = (mat.tags as string[]) || [];
  const hazardKeywords: string[] = [];
  const desc = ((mat.description as string) || '').toLowerCase();
  const name = ((mat.name as string) || '').toLowerCase();
  if (desc.includes('flammab') || name.includes('fuel') || name.includes('acetylene') || tags.includes('flammable')) hazardKeywords.push('flame');
  if (desc.includes('toxic') || desc.includes('poison') || tags.includes('toxic')) hazardKeywords.push('skull');
  if (desc.includes('irritant') || desc.includes('hazard') || tags.includes('hazardous')) hazardKeywords.push('exclamation');
  if (desc.includes('health') || desc.includes('carcinogen') || desc.includes('silica') || tags.includes('health_hazard')) hazardKeywords.push('health');
  if (desc.includes('environment') || desc.includes('aquatic') || tags.includes('environmental')) hazardKeywords.push('environment');
  // Default to exclamation if nothing matched but item is in SDS context
  if (hazardKeywords.length === 0) hazardKeywords.push('exclamation');

  return {
    id: mat.id as string,
    productName: (mat.name as string) || 'Unknown Product',
    manufacturer: (mat.manufacturer as string) || (mat.supplier as string) || '',
    sdsDate: (mat.sds_date as string) || (mat.updated_at as string) || (mat.created_at as string) || '',
    hazards: hazardKeywords,
    location: (mat.storage_location as string) || (mat.location as string) || '',
    quantity: mat.quantity != null ? `${mat.quantity} ${(mat.unit as string) || ''}`.trim() : '',
  };
}

export const SdsTab: React.FC = () => {
  const projectId = useProjectId();
  const { data: materials, isLoading } = useMaterialInventory(projectId ?? undefined);
  const createMaterial = useCreateMaterialItem();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Form state for adding chemicals
  const [addForm, setAddForm] = useState({
    productName: '',
    manufacturer: '',
    sdsDate: '',
    hazards: [] as string[],
    location: '',
    quantity: '',
  });

  const chemicals: Chemical[] = (materials ?? []).map((m: unknown) => mapMaterialToChemical(m as unknown as Record<string, unknown>));

  const filtered = chemicals.filter(c =>
    c.productName.toLowerCase().includes(search.toLowerCase()) ||
    c.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
    c.hazards.some(h => h.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleHazard = (key: string) => {
    setAddForm(prev => ({
      ...prev,
      hazards: prev.hazards.includes(key) ? prev.hazards.filter(h => h !== key) : [...prev.hazards, key],
    }));
  };

  const handleAddChemical = async () => {
    if (!projectId || !addForm.productName) {
      toast.error('Product name is required');
      return;
    }
    try {
      await createMaterial.mutateAsync({
        project_id: projectId,
        name: addForm.productName,
        manufacturer: addForm.manufacturer || null,
        sds_date: addForm.sdsDate || null,
        storage_location: addForm.location || null,
        quantity: addForm.quantity ? parseFloat(addForm.quantity) || 0 : 0,
        tags: addForm.hazards.length > 0 ? addForm.hazards : ['hazardous'],
        description: `SDS Chemical: ${addForm.productName}`,
      });
      toast.success('Chemical added to inventory');
      setShowAdd(false);
      setAddForm({ productName: '', manufacturer: '', sdsDate: '', hazards: [], location: '', quantity: '' });
    } catch {
      toast.error('Failed to add chemical');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          Loading safety data sheets...
        </div>
      </Card>
    );
  }

  if (chemicals.length === 0 && !search) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <EmptyState
          icon={<AlertTriangle size={40} />}
          title="No Chemical Inventory"
          description="No safety data sheets found. Add chemicals to track their SDS information and GHS hazard classifications."
          actionLabel="Add Chemical"
          onAction={() => setShowAdd(true)}
        />
        {showAdd && renderAddModal()}
      </div>
    );
  }

  function renderAddModal() {
    return (
      <Modal open onClose={() => setShowAdd(false)} title="Add Chemical to Inventory">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <InputField label="Product Name" value={addForm.productName} onChange={v => setAddForm(prev => ({ ...prev, productName: v }))} placeholder="e.g., Portland Cement Type I/II" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Manufacturer" value={addForm.manufacturer} onChange={v => setAddForm(prev => ({ ...prev, manufacturer: v }))} />
            <InputField label="SDS Date" value={addForm.sdsDate} onChange={v => setAddForm(prev => ({ ...prev, sdsDate: v }))} type="date" />
          </div>
          <div>
            <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], display: 'block' }}>GHS Hazard Pictograms</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
              {Object.entries(GHS_ICONS).map(([k, v]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, cursor: 'pointer' }}>
                  <input type="checkbox" checked={addForm.hazards.includes(k)} onChange={() => toggleHazard(k)} /> {v} {k.charAt(0).toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Storage Location" value={addForm.location} onChange={v => setAddForm(prev => ({ ...prev, location: v }))} />
            <InputField label="Quantity" value={addForm.quantity} onChange={v => setAddForm(prev => ({ ...prev, quantity: v }))} placeholder="e.g., 200" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleAddChemical}>Add Chemical</Btn>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>Safety Data Sheets &mdash; Chemical Inventory</h3>
        <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>Add Chemical</Btn>
      </div>

      <div style={{ position: 'relative', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
        <input
          placeholder="Search by product name or hazard..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: `${spacing['2']} ${spacing['2']} ${spacing['2']} 30px`, border: `1px solid ${colors.border}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}
        />
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thSt}>Product Name</th><th style={thSt}>Manufacturer</th><th style={thSt}>SDS Date</th>
                <th style={thSt}>GHS Hazards</th><th style={thSt}>Location</th><th style={thSt}>Quantity</th><th style={thSt}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...cellSt, textAlign: 'center', padding: spacing['6'], color: colors.textSecondary }}>
                    No chemicals match your search.
                  </td>
                </tr>
              ) : filtered.map(c => {
                const expired = c.sdsDate ? isExpired(c.sdsDate) : false;
                return (
                  <tr key={c.id} style={expired ? { backgroundColor: `${colors.statusWarning}08` } : undefined}>
                    <td style={{ ...cellSt, fontWeight: typography.fontWeight.medium }}>{c.productName}</td>
                    <td style={cellSt}>{c.manufacturer || '-'}</td>
                    <td style={cellSt}>{c.sdsDate || '-'}</td>
                    <td style={cellSt}>{c.hazards.map(h => <span key={h} title={h} style={{ marginRight: 4, fontSize: '16px' }}>{GHS_ICONS[h]}</span>)}</td>
                    <td style={cellSt}>{c.location || '-'}</td>
                    <td style={cellSt}>{c.quantity || '-'}</td>
                    <td style={cellSt}>
                      {!c.sdsDate
                        ? <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: `${colors.textTertiary}18`, color: colors.textTertiary }}>No SDS Date</span>
                        : expired
                          ? <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: `${colors.statusWarning}18`, color: colors.statusWarning, fontWeight: typography.fontWeight.medium }}>SDS &gt; 3 yrs - Update</span>
                          : <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, backgroundColor: `${colors.statusSuccess}18`, color: colors.statusSuccess }}>Current</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {showAdd && renderAddModal()}
    </div>
  );
};


/* ================================================================
   PERMIT-TO-WORK SYSTEM
   ================================================================ */

interface WorkPermit {
  id: string; type: string; location: string; duration: string;
  issuedBy: string; validFrom: string; validTo: string;
  conditions: string; signOffRequired: string;
  status: 'draft' | 'issued' | 'active' | 'closed' | 'expired';
}

const PERMIT_TYPES = ['Hot Work', 'Confined Space Entry', 'Excavation', 'Electrical (LOTO)', 'Crane/Rigging', 'Roof Access'];

const permitStatusColor: Record<string, string> = {
  draft: colors.textTertiary, issued: colors.statusPending, active: colors.statusSuccess, closed: colors.statusNeutral, expired: colors.statusWarning,
  pending: colors.statusPending, approved: colors.statusSuccess, rejected: colors.statusCritical,
};

function mapPermitRow(row: Record<string, unknown>): WorkPermit {
  const status = (row.status as string) || 'draft';
  // Normalize status to our local union
  const normalizedStatus: WorkPermit['status'] =
    status === 'approved' || status === 'active' ? 'active' :
    status === 'closed' || status === 'completed' ? 'closed' :
    status === 'expired' ? 'expired' :
    status === 'issued' ? 'issued' :
    'draft';

  return {
    id: row.id as string,
    type: (row.type as string) || (row.permit_type as string) || 'General',
    location: (row.location as string) || '',
    duration: (row.duration as string) || '',
    issuedBy: (row.issued_by as string) || (row.created_by as string) || '',
    validFrom: (row.valid_from as string) || (row.start_date as string) || (row.issue_date as string) || '',
    validTo: (row.valid_to as string) || (row.expiration_date as string) || (row.end_date as string) || '',
    conditions: (row.conditions as string) || (row.notes as string) || '',
    signOffRequired: (row.sign_off_required as string) || '',
    status: normalizedStatus,
  };
}

export const PermitsTab: React.FC = () => {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { data: permits, isLoading } = usePermits(projectId ?? undefined);
  const [showCreatePermit, setShowCreatePermit] = useState(false);
  const [permitForm, setPermitForm] = useState({ type: 'Hot Work', location: '', description: '' });
  const [creating, setCreating] = useState(false);

  const handleCreatePermit = async () => {
    if (!projectId || !permitForm.type || !permitForm.location) {
      toast.error('Permit type and location are required');
      return;
    }
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const { error } = await fromTable('permits').insert({
        project_id: projectId,
        permit_type: permitForm.type,
        location: permitForm.location,
        description: permitForm.description || null,
        status: 'active',
        issued_by: userId,
        issued_date: new Date().toISOString().slice(0, 10),
        expiry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      } as never);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      toast.success(`${permitForm.type} permit created`);
      setShowCreatePermit(false);
      setPermitForm({ type: 'Hot Work', location: '', description: '' });
    } catch (err) {
      toast.error(`Failed to create permit: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const permitList: WorkPermit[] = (permits ?? []).map((p: unknown) => mapPermitRow(p as unknown as Record<string, unknown>));
  const activeCt = permitList.filter(p => p.status === 'active').length;

  if (isLoading) {
    return (
      <Card>
        <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          Loading permits...
        </div>
      </Card>
    );
  }

  if (permitList.length === 0) {
    return (
      <EmptyState
        icon={<Flame size={40} />}
        title="No Work Permits"
        description="No active work permits. Create permits from the Permits module."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>Permit-to-Work System</h3>
          <span style={{ padding: `2px ${spacing['3']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, backgroundColor: `${colors.statusSuccess}18`, color: colors.statusSuccess }}>{activeCt} Active Permits</span>
        </div>
        <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreatePermit(true)}>New Permit</Btn>
      </div>
      {showCreatePermit && (
        <Modal title="Create Work Permit" onClose={() => setShowCreatePermit(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['1'] }}>Permit Type</label>
              <select
                value={permitForm.type}
                onChange={(e) => setPermitForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}
              >
                {PERMIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <InputField label="Location" value={permitForm.location} onChange={(v) => setPermitForm(f => ({ ...f, location: v }))} />
            <InputField label="Description" value={permitForm.description} onChange={(v) => setPermitForm(f => ({ ...f, description: v }))} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
              <Btn variant="secondary" onClick={() => setShowCreatePermit(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreatePermit} disabled={creating}>{creating ? 'Creating...' : 'Create Permit'}</Btn>
            </div>
          </div>
        </Modal>
      )}
      <p style={{ margin: 0, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
        Permit types: {PERMIT_TYPES.join(' \u2022 ')}
      </p>

      {permitList.map(p => (
        <Card key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.base }}>{p.type}</span>
                <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, backgroundColor: `${permitStatusColor[p.status] || colors.textTertiary}18`, color: permitStatusColor[p.status] || colors.textTertiary, textTransform: 'capitalize' }}>{p.status}</span>
              </div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                {p.location ? `${p.location} \u2022 ` : ''}{p.duration ? `Duration: ${p.duration} \u2022 ` : ''}{p.issuedBy ? `Issued by: ${p.issuedBy}` : ''}
              </div>
              {(p.validFrom || p.validTo) && (
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                  Valid: {p.validFrom || 'N/A'} &rarr; {p.validTo || 'N/A'}
                </div>
              )}
            </div>
          </div>
          {p.conditions && (
            <div style={{ marginTop: spacing['2'], padding: spacing['2'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption }}>
              <strong>Conditions:</strong> {p.conditions}
            </div>
          )}
          {p.signOffRequired && (
            <div style={{ marginTop: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
              <strong>Sign-off required:</strong> {p.signOffRequired}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
