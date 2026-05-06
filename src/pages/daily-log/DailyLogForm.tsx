import React, { useState, useMemo } from 'react';
import { Users, Clock, ShieldCheck, Cloud, ChevronRight, Camera, Send, Sparkles, Calendar, X, Lock, AlertTriangle, RefreshCw, UserPlus, FileEdit, Plus, Trash2, ClipboardList, Search, Wrench, Package, HardHat } from 'lucide-react';
import { Card, Btn, SectionHeader, useToast, Modal, InputField } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme';
import { useCreateDailyLogEntry, useDeleteDailyLogEntry } from '../../hooks/mutations';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectId } from '../../hooks/useProjectId';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ConfirmDialog';
import { AutoNarrative } from '../../components/dailylog/AutoNarrative';
import { DayComparison } from '../../components/dailylog/DayComparison';
import { PhotoGrid } from '../../components/dailylog/PhotoGrid';
import type { DailyLogPhoto } from '../../components/dailylog/PhotoGrid';
import type { CrewHoursEntry as CrewHoursEntryType } from '../../components/dailylog/CrewHoursSummary';
import type { WeatherData } from '../../lib/weather';
import { formatWeatherSummary } from '../../lib/weather';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { getDailyLogStatusConfig } from '../../machines/dailyLogMachine';
import type { DailyLogState } from '../../machines/dailyLogMachine';
import type { ExtendedDailyLog, ManpowerRow, IncidentForm } from './types';
import { CrewHoursEntry } from './CrewHoursEntry';
import { WeatherWidget } from './WeatherWidget';
import { SignatureCapture } from './SignatureCapture';
import { VoiceRecorder } from '../../components/voice/VoiceRecorder';

/* ── Shared inline styles ─────────────────────────────── */
const tableHeaderStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`,
  textAlign: 'left',
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  whiteSpace: 'nowrap',
  backgroundColor: colors.surfaceInset,
};

const tableCellStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`,
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  borderTop: `1px solid ${colors.borderSubtle}`,
};

const inlineInputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${spacing['1']} ${spacing['2']}`,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.sm,
  outline: 'none',
  boxSizing: 'border-box' as const,
  color: colors.textPrimary,
  backgroundColor: colors.white,
};

const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: spacing['1'],
  padding: `${spacing['1']} ${spacing['3']}`,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  fontFamily: typography.fontFamily,
  color: colors.primaryOrange,
  backgroundColor: colors.orangeSubtle,
  border: `1px solid ${colors.primaryOrange}`,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  padding: `${spacing['1']} ${spacing['2']}`,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  backgroundColor: colors.primaryOrange,
  color: colors.white,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
  fontWeight: typography.fontWeight.medium,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: `${spacing['1']} ${spacing['2']}`,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  backgroundColor: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: colors.textTertiary,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  padding: 0,
};

const textareaStyle = (locked: boolean): React.CSSProperties => ({
  width: '100%',
  padding: spacing['3'],
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  border: `1px solid ${colors.borderDefault}`,
  backgroundColor: locked ? colors.surfaceInset : colors.white,
  borderRadius: borderRadius.md,
  outline: 'none',
  resize: 'vertical' as const,
  color: colors.textPrimary,
  boxSizing: 'border-box' as const,
  lineHeight: '1.6',
  cursor: locked ? 'not-allowed' : 'text',
  minHeight: '56px',
});

/* ── Types ────────────────────────────────────────────── */
interface EquipmentRow { id: string; type: string; count: number; hours_operated: number }
interface MaterialRow { id: string; description: string; quantity: number; po_reference: string; delivery_ticket: string }
interface VisitorRow { id: string; name: string; company: string; purpose: string; time_in: string; time_out: string }

interface DailyLogFormProps {
  today: ExtendedDailyLog;
  yesterday: ExtendedDailyLog | undefined;
  lastWeek: ExtendedDailyLog | undefined;
  filteredPreviousDays: ExtendedDailyLog[];
  previousDays: ExtendedDailyLog[];
  historySearch: string;
  setHistorySearch: (v: string) => void;
  hasTodayLog: boolean;
  todayStr: string;
  isMobile: boolean;
  isLocked: boolean;
  isApproved: boolean;
  isSubmittedOnly: boolean;
  isRejected: boolean;
  logStatus: DailyLogState;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionComments: string | null | undefined;
  weather: WeatherData | null;
  weatherIsAuto: boolean;
  manpowerRows: ManpowerRow[];
  setManpowerRows: React.Dispatch<React.SetStateAction<ManpowerRow[]>>;
  crewHours: CrewHoursEntryType[];
  photos: DailyLogPhoto[];
  logEntries: Array<unknown>;
  workSummary: string;
  setWorkSummary: (v: string | ((p: string) => string)) => void;
  aiSummaryLoading: boolean;
  aiSummaryGenerated: boolean;
  setAiSummaryGenerated: (v: boolean) => void;
  onAiSummary: () => Promise<void>;
  issuesDelays: string;
  setIssuesDelays: (v: string) => void;
  noIncidentsToday: boolean;
  setNoIncidentsToday: (v: boolean | ((p: boolean) => boolean)) => void;
  noVisitorsToday: boolean;
  setNoVisitorsToday: (v: boolean | ((p: boolean) => boolean)) => void;
  expandedIncident: string | null;
  setExpandedIncident: (v: string | null) => void;
  showComparison: boolean;
  setShowComparison: (v: boolean) => void;
  compareMode: 'yesterday' | 'lastweek' | null;
  showSignature: boolean;
  showAddendumForm: boolean;
  setShowAddendumForm: (v: boolean) => void;
  addendumText: string;
  setAddendumText: (v: string) => void;
  addendumSubmitting: boolean;
  onAddendumSubmit: () => Promise<void>;
  onSameAsYesterday: () => Promise<void>;
  onPhotoCapture: () => void;
  onWeatherUpdate: (updated: WeatherData) => Promise<void>;
  onSubmit: () => Promise<void>;
  onApprove: () => Promise<void>;
  setShowSignature: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  setSelectedDate: (v: string) => void;
}

export const DailyLogForm: React.FC<DailyLogFormProps> = (props) => {
  const {
    today, yesterday, lastWeek, filteredPreviousDays, previousDays,
    historySearch, setHistorySearch, hasTodayLog, todayStr, isMobile,
    isLocked, isApproved, isSubmittedOnly, isRejected, logStatus,
    submittedAt, approvedAt, rejectionComments, weather, weatherIsAuto,
    manpowerRows, setManpowerRows, crewHours, photos, logEntries,
    workSummary, setWorkSummary, aiSummaryLoading, aiSummaryGenerated, setAiSummaryGenerated,
    onAiSummary, issuesDelays, setIssuesDelays, noIncidentsToday, setNoIncidentsToday,
    noVisitorsToday, setNoVisitorsToday, expandedIncident, setExpandedIncident,
    showComparison, setShowComparison, compareMode, showSignature,
    showAddendumForm, setShowAddendumForm, addendumText, setAddendumText, addendumSubmitting, onAddendumSubmit,
    onSameAsYesterday, onPhotoCapture, onWeatherUpdate, onSubmit, onApprove,
    setShowSignature, setShowCreateModal, setSelectedDate,
  } = props;

  const { addToast } = useToast();
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const createEntry = useCreateDailyLogEntry();
  const deleteEntry = useDeleteDailyLogEntry();

  // ── Local state for inline forms ──
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [incidentForm, setIncidentForm] = useState<IncidentForm>({ type: 'near_miss', description: '', corrective_action: '' });

  // Log Entries modal
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ type: 'work_performed' as string, description: '', trade: '', headcount: '', hours: '', location: '' });

  // Equipment inline add
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>(() =>
    (today.equipment_entries ?? []).map((e, i) => ({ id: `eq-${i}`, type: e.type, count: e.count, hours_operated: e.hours_operated }))
  );
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({ type: '', count: 1, hours_operated: 0 });

  // Material inline add
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() =>
    (today.material_deliveries ?? []).map((m, i) => ({ id: `mat-${i}`, description: m.description, quantity: m.quantity, po_reference: m.po_reference, delivery_ticket: m.delivery_ticket }))
  );
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ description: '', quantity: 1, po_reference: '', delivery_ticket: '' });

  // Visitor inline add
  const [visitorRows, setVisitorRows] = useState<VisitorRow[]>(() =>
    (today.visitors ?? []).map((v, i) => ({ id: `vis-${i}`, name: v.name, company: v.company, purpose: v.purpose, time_in: v.time_in, time_out: v.time_out }))
  );
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [newVisitor, setNewVisitor] = useState({ name: '', company: '', purpose: '', time_in: '', time_out: '' });

  // Safety editable state
  const [toolboxTopic, setToolboxTopic] = useState(today.toolbox_talk_topic ?? '');
  const [safetyObs, setSafetyObs] = useState(today.safety_observations ?? '');

  const statusConfig = getDailyLogStatusConfig(logStatus);

  const ENTRY_TYPES = [
    { value: 'work_performed', label: 'Work Performed', color: colors.statusActive },
    { value: 'delay', label: 'Delay', color: colors.statusCritical },
    { value: 'visitor', label: 'Visitor', color: colors.statusInfo },
    { value: 'equipment', label: 'Equipment', color: colors.statusPending },
    { value: 'material_received', label: 'Material Received', color: colors.primaryOrange },
    { value: 'note', label: 'Safety / General Note', color: '#8B5CF6' },
  ];

  const typedLogEntries = logEntries as Array<{
    id: string; type: string; description: string;
    trade?: string; headcount?: number; hours?: number; location?: string; created_at?: string;
  }>;

  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof typedLogEntries> = {};
    for (const entry of typedLogEntries) {
      const t = entry.type || 'work_performed';
      if (!groups[t]) groups[t] = [];
      groups[t].push(entry);
    }
    return groups;
  }, [typedLogEntries]);

  const entrySubtotals = useMemo(() => {
    const subtotals: Record<string, { count: number; totalHours: number; totalCrew: number }> = {};
    for (const [type, entries] of Object.entries(groupedEntries)) {
      subtotals[type] = {
        count: entries.length,
        totalHours: entries.reduce((s, e) => s + (e.hours ?? 0), 0),
        totalCrew: entries.reduce((s, e) => s + (e.headcount ?? 0), 0),
      };
    }
    return subtotals;
  }, [groupedEntries]);

  const handleAddEntry = async () => {
    if (!entryForm.description.trim()) { toast.error('Description is required'); return; }
    if (!today.id || !projectId) return;
    try {
      await createEntry.mutateAsync({
        data: {
          daily_log_id: today.id,
          type: entryForm.type,
          description: entryForm.description,
          trade: entryForm.trade || null,
          headcount: entryForm.headcount ? Number(entryForm.headcount) : null,
          hours: entryForm.hours ? Number(entryForm.hours) : null,
          location: entryForm.location || null,
        },
        projectId,
      });
      queryClient.invalidateQueries({ queryKey: ['daily_log_entries', today.id] });
      setShowAddEntryModal(false);
      setEntryForm({ type: 'work_performed', description: '', trade: '', headcount: '', hours: '', location: '' });
      toast.success('Entry added');
    } catch { toast.error('Failed to add entry'); }
  };

  const { confirm: confirmDeleteEntry, dialog: deleteEntryDialog } = useConfirm();

  const handleDeleteEntry = async (entryId: string) => {
    if (!today.id || !projectId) return;
    const ok = await confirmDeleteEntry({
      title: 'Delete log entry?',
      description: 'This entry is removed from today\'s daily log. Linked photos and observations remain in the project record.',
      destructiveLabel: 'Delete entry',
    });
    if (!ok) return;
    try {
      await deleteEntry.mutateAsync({ id: entryId, dailyLogId: today.id, projectId });
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete entry'); }
  };

  // ── Metric cards ──
  const todayMetrics = [
    { icon: <Users size={16} />, bg: colors.statusInfoSubtle, fg: colors.statusInfo, label: 'Workers', value: (today.workers_onsite ?? 0).toString() },
    { icon: <Clock size={16} />, bg: colors.orangeSubtle, fg: colors.primaryOrange, label: 'Hours', value: (today.total_hours ?? 0).toLocaleString() },
    { icon: <ShieldCheck size={16} />, bg: (today.incidents ?? 0) === 0 ? colors.statusActiveSubtle : colors.statusCriticalSubtle, fg: (today.incidents ?? 0) === 0 ? colors.statusActive : colors.statusCritical, label: 'Incidents', value: (today.incidents ?? 0).toString() },
    { icon: <Cloud size={16} />, bg: colors.surfaceInset, fg: colors.textSecondary, label: 'Weather', value: today.weather ?? (weather ? formatWeatherSummary(weather) : '—') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>

      {/* ── Status Banners ─────────────────────────────── */}
      {!hasTodayLog && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.primaryOrange}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Calendar size={14} color={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, fontWeight: typography.fontWeight.medium }}>Today's daily log hasn't been started</span>
          </div>
          <PermissionGate permission="daily_log.create"><Btn size="sm" variant="primary" onClick={() => { setSelectedDate(todayStr); setShowCreateModal(true); }}>Start Log</Btn></PermissionGate>
        </div>
      )}

      {!isLocked && yesterday && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2.5']} ${spacing['4']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <RefreshCw size={13} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Pre-fill from yesterday's log</span>
          </div>
          <Btn size="sm" variant="secondary" icon={<RefreshCw size={12} />} onClick={onSameAsYesterday}>Same as yesterday</Btn>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing['2']} ${spacing['4']}`, backgroundColor: statusConfig.bg, borderRadius: borderRadius.md, borderLeft: `3px solid ${statusConfig.color}`, gap: spacing['2'] }}>
        {isLocked && <Lock size={13} color={statusConfig.color} />}
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: statusConfig.color }}>{statusConfig.label}</span>
        {isApproved && <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>— {approvedAt ? `Approved ${new Date(approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Changes require an addendum'}</span>}
        {isSubmittedOnly && <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>— {submittedAt ? `Submitted ${new Date(submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Locked for editing'}</span>}
      </div>

      {isRejected && rejectionComments && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
          <AlertTriangle size={14} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Returned for revision</p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{rejectionComments}</p>
          </div>
        </div>
      )}

      {/* ── Weather ────────────────────────────────────── */}
      {weather && <WeatherWidget weather={weather} weatherIsAuto={weatherIsAuto} isLocked={isLocked} onUpdate={onWeatherUpdate} />}

      {/* ── Quick Metrics ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: spacing['3'] }}>
        {todayMetrics.map((m) => (
          <Card key={m.label} padding={spacing['3']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: m.bg, color: m.fg, flexShrink: 0 }}>{m.icon}</div>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{m.label}</span>
            </div>
            <span style={{ fontSize: m.label === 'Weather' ? typography.fontSize.sm : typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: m.fg === colors.textSecondary ? colors.textPrimary : m.fg, lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{m.value}</span>
          </Card>
        ))}
      </div>

      {/* ── Manpower / Crew Hours ──────────────────────── */}
      <CrewHoursEntry manpowerRows={manpowerRows} setManpowerRows={setManpowerRows} isLocked={isLocked} crewHours={crewHours} />

      {/* ── Equipment on Site ──────────────────────────── */}
      <Card>
        <SectionHeader title="Equipment on Site" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Wrench size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{equipmentRows.length} items
            </span>
            {!isLocked && (
              <button onClick={() => setShowAddEquipment(true)} style={addBtnStyle}>+ Add</button>
            )}
          </div>
        } />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr>
                {['Equipment', 'Qty', 'Hrs Operated', ...(isLocked ? [] : [''])].map(h => (
                  <th key={h} style={tableHeaderStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipmentRows.length === 0 && !showAddEquipment && (
                <tr><td colSpan={isLocked ? 3 : 4} style={{ padding: `${spacing['4']} ${spacing['3']}`, color: colors.textTertiary, fontSize: typography.fontSize.sm, textAlign: 'center' }}>
                  No equipment logged. Click "+ Add" to track equipment on site.
                </td></tr>
              )}
              {equipmentRows.map((row) => (
                <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)} style={{ backgroundColor: hoveredRow === row.id ? colors.surfaceHover : 'transparent', transition: `background-color 160ms`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={tableCellStyle}>{row.type}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>{row.count}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{row.hours_operated}h</td>
                  {!isLocked && (
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                      <button onClick={() => setEquipmentRows(prev => prev.filter(r => r.id !== row.id))} style={removeBtnStyle}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              {showAddEquipment && !isLocked && (
                <tr style={{ backgroundColor: colors.orangeSubtle, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="text" placeholder="e.g. Excavator" value={newEquipment.type} onChange={e => setNewEquipment(p => ({ ...p, type: e.target.value }))} style={inlineInputStyle} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="number" placeholder="1" min={0} value={newEquipment.count || ''} onChange={e => setNewEquipment(p => ({ ...p, count: parseInt(e.target.value) || 0 }))} style={{ ...inlineInputStyle, width: 72, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="number" placeholder="0" min={0} step={0.5} value={newEquipment.hours_operated || ''} onChange={e => setNewEquipment(p => ({ ...p, hours_operated: parseFloat(e.target.value) || 0 }))} style={{ ...inlineInputStyle, width: 72, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <div style={{ display: 'flex', gap: spacing['1'] }}>
                      <button onClick={() => {
                        if (!newEquipment.type.trim()) return;
                        setEquipmentRows(prev => [...prev, { id: crypto.randomUUID(), ...newEquipment }]);
                        setNewEquipment({ type: '', count: 1, hours_operated: 0 });
                        setShowAddEquipment(false);
                      }} style={confirmBtnStyle}>Add</button>
                      <button onClick={() => { setShowAddEquipment(false); setNewEquipment({ type: '', count: 1, hours_operated: 0 }); }} style={cancelBtnStyle}>Cancel</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Material Deliveries ────────────────────────── */}
      <Card>
        <SectionHeader title="Material Deliveries" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Package size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{materialRows.length} deliveries
            </span>
            {!isLocked && (
              <button onClick={() => setShowAddMaterial(true)} style={addBtnStyle}>+ Add</button>
            )}
          </div>
        } />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr>
                {['Description', 'Qty', 'PO Ref', 'Ticket', ...(isLocked ? [] : [''])].map(h => (
                  <th key={h} style={tableHeaderStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materialRows.length === 0 && !showAddMaterial && (
                <tr><td colSpan={isLocked ? 4 : 5} style={{ padding: `${spacing['4']} ${spacing['3']}`, color: colors.textTertiary, fontSize: typography.fontSize.sm, textAlign: 'center' }}>
                  No deliveries today. Click "+ Add" to log material deliveries.
                </td></tr>
              )}
              {materialRows.map((row) => (
                <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)} style={{ backgroundColor: hoveredRow === row.id ? colors.surfaceHover : 'transparent', transition: `background-color 160ms`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={tableCellStyle}>{row.description}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>{row.quantity || '—'}</td>
                  <td style={{ ...tableCellStyle }}>{row.po_reference || '—'}</td>
                  <td style={{ ...tableCellStyle }}>{row.delivery_ticket || '—'}</td>
                  {!isLocked && (
                    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                      <button onClick={() => setMaterialRows(prev => prev.filter(r => r.id !== row.id))} style={removeBtnStyle}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              {showAddMaterial && !isLocked && (
                <tr style={{ backgroundColor: colors.orangeSubtle, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="text" placeholder="e.g. Rebar #5" value={newMaterial.description} onChange={e => setNewMaterial(p => ({ ...p, description: e.target.value }))} style={inlineInputStyle} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="number" placeholder="0" min={0} value={newMaterial.quantity || ''} onChange={e => setNewMaterial(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} style={{ ...inlineInputStyle, width: 64, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="text" placeholder="PO-xxxx" value={newMaterial.po_reference} onChange={e => setNewMaterial(p => ({ ...p, po_reference: e.target.value }))} style={{ ...inlineInputStyle, width: 100 }} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <input type="text" placeholder="Ticket #" value={newMaterial.delivery_ticket} onChange={e => setNewMaterial(p => ({ ...p, delivery_ticket: e.target.value }))} style={{ ...inlineInputStyle, width: 100 }} />
                  </td>
                  <td style={{ padding: `${spacing['2']}` }}>
                    <div style={{ display: 'flex', gap: spacing['1'] }}>
                      <button onClick={() => {
                        if (!newMaterial.description.trim()) return;
                        setMaterialRows(prev => [...prev, { id: crypto.randomUUID(), ...newMaterial }]);
                        setNewMaterial({ description: '', quantity: 1, po_reference: '', delivery_ticket: '' });
                        setShowAddMaterial(false);
                      }} style={confirmBtnStyle}>Add</button>
                      <button onClick={() => { setShowAddMaterial(false); setNewMaterial({ description: '', quantity: 1, po_reference: '', delivery_ticket: '' }); }} style={cancelBtnStyle}>Cancel</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Site Visitors ──────────────────────────────── */}
      <Card>
        <SectionHeader title="Site Visitors" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            {!isLocked && (
              <button onClick={() => setNoVisitorsToday((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily }}>
                <div style={{ width: 32, height: 18, borderRadius: 9, position: 'relative', transition: 'background 160ms', backgroundColor: noVisitorsToday ? colors.statusActive : colors.borderDefault }}>
                  <div style={{ position: 'absolute', top: 2, left: noVisitorsToday ? 16 : 2, width: 14, height: 14, borderRadius: '50%', backgroundColor: colors.white, transition: 'left 160ms' }} />
                </div>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No visitors</span>
              </button>
            )}
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <UserPlus size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{visitorRows.length}
            </span>
            {!isLocked && !noVisitorsToday && (
              <button onClick={() => setShowAddVisitor(true)} style={addBtnStyle}>+ Add</button>
            )}
          </div>
        } />
        {noVisitorsToday && visitorRows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
            <ShieldCheck size={14} color={colors.statusActive} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No visitors on site today</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr>
                  {['Name', 'Company', 'Purpose', 'In', 'Out', ...(isLocked ? [] : [''])].map(h => (
                    <th key={h} style={tableHeaderStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitorRows.length === 0 && !showAddVisitor && (
                  <tr><td colSpan={isLocked ? 5 : 6} style={{ padding: `${spacing['4']} ${spacing['3']}`, color: colors.textTertiary, fontSize: typography.fontSize.sm, textAlign: 'center' }}>
                    No visitors logged yet. Click "+ Add" to log visitors.
                  </td></tr>
                )}
                {visitorRows.map((row) => (
                  <tr key={row.id} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)} style={{ backgroundColor: hoveredRow === row.id ? colors.surfaceHover : 'transparent', transition: `background-color 160ms`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <td style={{ ...tableCellStyle, fontWeight: typography.fontWeight.medium }}>{row.name}</td>
                    <td style={{ ...tableCellStyle, color: colors.textSecondary }}>{row.company || '—'}</td>
                    <td style={{ ...tableCellStyle, color: colors.textSecondary }}>{row.purpose || '—'}</td>
                    <td style={{ ...tableCellStyle, color: colors.textSecondary }}>{row.time_in || '—'}</td>
                    <td style={{ ...tableCellStyle, color: colors.textSecondary }}>{row.time_out || '—'}</td>
                    {!isLocked && (
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <button onClick={() => setVisitorRows(prev => prev.filter(r => r.id !== row.id))} style={removeBtnStyle}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
                {showAddVisitor && !isLocked && (
                  <tr style={{ backgroundColor: colors.orangeSubtle, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <input type="text" placeholder="Name" value={newVisitor.name} onChange={e => setNewVisitor(p => ({ ...p, name: e.target.value }))} style={inlineInputStyle} />
                    </td>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <input type="text" placeholder="Company" value={newVisitor.company} onChange={e => setNewVisitor(p => ({ ...p, company: e.target.value }))} style={{ ...inlineInputStyle, width: 120 }} />
                    </td>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <input type="text" placeholder="Purpose" value={newVisitor.purpose} onChange={e => setNewVisitor(p => ({ ...p, purpose: e.target.value }))} style={{ ...inlineInputStyle, width: 120 }} />
                    </td>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <input type="time" value={newVisitor.time_in} onChange={e => setNewVisitor(p => ({ ...p, time_in: e.target.value }))} style={{ ...inlineInputStyle, width: 90 }} />
                    </td>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <input type="time" value={newVisitor.time_out} onChange={e => setNewVisitor(p => ({ ...p, time_out: e.target.value }))} style={{ ...inlineInputStyle, width: 90 }} />
                    </td>
                    <td style={{ padding: `${spacing['2']}` }}>
                      <div style={{ display: 'flex', gap: spacing['1'] }}>
                        <button onClick={() => {
                          if (!newVisitor.name.trim()) return;
                          setVisitorRows(prev => [...prev, { id: crypto.randomUUID(), ...newVisitor }]);
                          setNewVisitor({ name: '', company: '', purpose: '', time_in: '', time_out: '' });
                          setShowAddVisitor(false);
                        }} style={confirmBtnStyle}>Add</button>
                        <button onClick={() => { setShowAddVisitor(false); setNewVisitor({ name: '', company: '', purpose: '', time_in: '', time_out: '' }); }} style={cancelBtnStyle}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Log Entries ────────────────────────────────── */}
      <Card>
        <SectionHeader title="Log Entries" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <ClipboardList size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{typedLogEntries.length} entries
            </span>
            {!isLocked && (
              <Btn size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setShowAddEntryModal(true)}>Add Entry</Btn>
            )}
          </div>
        } />
        {typedLogEntries.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>
            No entries yet. Add entries to track work, delays, and more.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {ENTRY_TYPES.map(({ value: type, label, color }) => {
              const entries = groupedEntries[type];
              if (!entries || entries.length === 0) return null;
              const sub = entrySubtotals[type];
              return (
                <div key={type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], paddingBottom: spacing['1'], borderBottom: `2px solid ${color}` }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      ({sub.count}{sub.totalHours > 0 ? ` · ${sub.totalHours}h` : ''}{sub.totalCrew > 0 ? ` · ${sub.totalCrew} crew` : ''})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                    {entries.map((entry) => (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, borderLeft: `3px solid ${color}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{entry.description}</p>
                          <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['1'], flexWrap: 'wrap' }}>
                            {entry.trade && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Trade: {entry.trade}</span>}
                            {entry.headcount != null && entry.headcount > 0 && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Crew: {entry.headcount}</span>}
                            {entry.hours != null && entry.hours > 0 && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Hours: {entry.hours}</span>}
                            {entry.location && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Location: {entry.location}</span>}
                          </div>
                        </div>
                        {!isLocked && (
                          <PermissionGate permission="daily_log.edit">
                            <button onClick={() => handleDeleteEntry(entry.id)} title="Delete entry" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: borderRadius.md, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, flexShrink: 0 }}>
                              <Trash2 size={14} />
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Add Entry Modal ────────────────────────────── */}
      {showAddEntryModal && (
        <Modal open={showAddEntryModal} onClose={() => setShowAddEntryModal(false)} title="Add Log Entry" width="520px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Entry Type</label>
              <select value={entryForm.type} onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
                {ENTRY_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description *</label>
              <textarea value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} placeholder="Describe the entry..." rows={3} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <InputField label="Trade" value={entryForm.trade} onChange={(v) => setEntryForm({ ...entryForm, trade: v })} placeholder="e.g. Electrical" />
              <InputField label="Location" value={entryForm.location} onChange={(v) => setEntryForm({ ...entryForm, location: v })} placeholder="e.g. Floor 2" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <InputField label="Headcount" type="number" value={entryForm.headcount} onChange={(v) => setEntryForm({ ...entryForm, headcount: v })} placeholder="0" />
              <InputField label="Hours" type="number" value={entryForm.hours} onChange={(v) => setEntryForm({ ...entryForm, hours: v })} placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
              <Btn variant="secondary" onClick={() => setShowAddEntryModal(false)}>Cancel</Btn>
              <PermissionGate permission="daily_log.edit">
                <Btn variant="primary" onClick={handleAddEntry} loading={createEntry.isPending}>Add Entry</Btn>
              </PermissionGate>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Safety ─────────────────────────────────────── */}
      <Card>
        <SectionHeader title="Safety" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <HardHat size={14} style={{ color: colors.textTertiary }} />
            {!isLocked && (
              <button onClick={() => setNoIncidentsToday((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily }}>
                <div style={{ width: 32, height: 18, borderRadius: 9, position: 'relative', transition: 'background 160ms', backgroundColor: noIncidentsToday ? colors.statusActive : colors.statusCritical }}>
                  <div style={{ position: 'absolute', top: 2, left: noIncidentsToday ? 16 : 2, width: 14, height: 14, borderRadius: '50%', backgroundColor: colors.white, transition: 'left 160ms' }} />
                </div>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No incidents</span>
              </button>
            )}
          </div>
        } />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Toolbox Talk */}
          <div>
            <label style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Toolbox Talk Topic</label>
            {isLocked ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{toolboxTopic || 'None recorded'}</p>
            ) : (
              <input type="text" value={toolboxTopic} onChange={e => setToolboxTopic(e.target.value)} placeholder="e.g. Fall protection, trenching safety, heat illness prevention..." style={{ ...inlineInputStyle, width: '100%', padding: `${spacing['2']} ${spacing['3']}` }} />
            )}
          </div>

          {/* Safety Observations */}
          <div>
            <label style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Safety Observations</label>
            {isLocked ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{safetyObs || 'No observations recorded'}</p>
            ) : (
              <textarea value={safetyObs} onChange={e => setSafetyObs(e.target.value)} placeholder="Record any safety observations, hazards noticed, or corrective actions taken..." rows={2} style={textareaStyle(false)} />
            )}
          </div>

          {/* Existing Incidents */}
          {(today.incident_details ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {(today.incident_details as Array<{ description: string; type: string; corrective_action: string }>).map((inc, i) => (
                <div key={i} style={{ padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
                  <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase', margin: 0, marginBottom: spacing['1'] }}>{inc.type.replace(/_/g, ' ')}</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{inc.description}</p>
                  {inc.corrective_action && <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>Corrective action: {inc.corrective_action}</p>}
                </div>
              ))}
            </div>
          )}

          {noIncidentsToday && (today.incident_details ?? []).length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <ShieldCheck size={14} color={colors.statusActive} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No incidents reported today</span>
            </div>
          )}

          {/* Log Incident Form */}
          {!noIncidentsToday && !isLocked && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Log Incident</p>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Type</label>
                <select value={incidentForm.type} onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', backgroundColor: colors.white, color: colors.textPrimary, width: '100%' }}>
                  <option value="near_miss">Near Miss</option>
                  <option value="first_aid">First Aid</option>
                  <option value="recordable">Recordable Injury</option>
                  <option value="property_damage">Property Damage</option>
                  <option value="environmental">Environmental</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Description</label>
                <textarea value={incidentForm.description} onChange={e => setIncidentForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe what happened..." rows={3} style={textareaStyle(false)} />
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium, display: 'block', marginBottom: spacing['1'] }}>Corrective Action</label>
                <textarea value={incidentForm.corrective_action} onChange={e => setIncidentForm(p => ({ ...p, corrective_action: e.target.value }))} placeholder="Describe corrective action taken..." rows={2} style={textareaStyle(false)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <button onClick={() => { setNoIncidentsToday(true); setIncidentForm({ type: 'near_miss', description: '', corrective_action: '' }); }} style={cancelBtnStyle}>Cancel</button>
                <button onClick={() => {
                  if (!incidentForm.description.trim()) return;
                  addToast('success', 'Incident logged. Save with Submit Log.');
                  setIncidentForm({ type: 'near_miss', description: '', corrective_action: '' });
                }} style={{ ...confirmBtnStyle, backgroundColor: colors.statusCritical }}>Log Incident</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Voice Recorder ─────────────────────────────── */}
      {!isLocked && (
        <Card>
          <SectionHeader title="Speak Your Daily Log" />
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `0 0 ${spacing['3']} 0` }}>
            Tap the mic and narrate your day. We'll transcribe and structure it automatically.
          </p>
          <VoiceRecorder
            kind="daily_log"
            label="Voice daily log"
            onStructured={(structured, transcript) => {
              const s = (structured || {}) as unknown as Record<string, unknown>;
              const activities = Array.isArray(s.activities) ? s.activities : [];
              const summaryParts: string[] = [];
              if (typeof s.summary === 'string' && s.summary) summaryParts.push(s.summary);
              activities.forEach((a) => {
                const obj = a as unknown as Record<string, unknown>;
                const desc = typeof obj.description === 'string' ? obj.description : '';
                const loc = typeof obj.location === 'string' ? obj.location : '';
                if (desc) summaryParts.push(`• ${desc}${loc ? ` (${loc})` : ''}`);
              });
              const newSummary = summaryParts.join('\n') || transcript;
              setWorkSummary((prev) => prev ? `${prev}\n\n${newSummary}` : newSummary);
              if (aiSummaryGenerated) setAiSummaryGenerated(false);
              const issues = Array.isArray(s.issues) ? s.issues : [];
              if (issues.length > 0) {
                setIssuesDelays(issues.map((i) => `• ${(i as unknown as Record<string, unknown>).description || ''}`).join('\n'));
              }
            }}
          />
        </Card>
      )}

      {/* ── Work Summary ───────────────────────────────── */}
      <Card>
        <SectionHeader title="Work Summary" action={
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            {aiSummaryGenerated && (
              <span style={{ fontSize: '11px', fontWeight: typography.fontWeight.semibold, color: colors.statusReview, backgroundColor: colors.statusReviewSubtle, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, letterSpacing: '0.2px' }}>AI Generated</span>
            )}
            {!isLocked && (
              <PermissionGate permission="ai.use">
              <button
                onClick={onAiSummary}
                disabled={aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)}
                title={(manpowerRows.length === 0 && logEntries.length === 0) ? 'Add work entries first' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `4px ${spacing['3']}`, fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                  color: (aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)) ? colors.textTertiary : colors.textSecondary,
                  backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.md,
                  cursor: (aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)) ? 'not-allowed' : 'pointer',
                  opacity: (manpowerRows.length === 0 && logEntries.length === 0) ? 0.5 : 1,
                }}
              >
                <Sparkles size={13} color={colors.primaryOrange} />
                AI Summary
              </button>
              </PermissionGate>
            )}
          </div>
        } />
        {aiSummaryLoading ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, animation: 'pulse-dl 1.2s ease-in-out infinite' }}>Generating AI summary...</p>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Work performed</label>
              {!isLocked && (
                <select
                  defaultValue=""
                  onChange={e => { if (!e.target.value) return; setWorkSummary(prev => prev ? `${prev}\n[Phase: ${e.target.value}] ` : `[Phase: ${e.target.value}] `); e.target.value = ''; }}
                  style={{ padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', color: colors.textSecondary, backgroundColor: colors.white, cursor: 'pointer' }}
                >
                  <option value="">+ Link phase</option>
                  <option value="Site Work">Site Work</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Structural Steel">Structural Steel</option>
                  <option value="Framing">Framing</option>
                  <option value="MEP Rough-In">MEP Rough-In</option>
                  <option value="Exterior Envelope">Exterior Envelope</option>
                  <option value="Interior Finishes">Interior Finishes</option>
                  <option value="Commissioning">Commissioning</option>
                  <option value="Punch List">Punch List</option>
                </select>
              )}
            </div>
            <textarea
              value={workSummary}
              onChange={e => { setWorkSummary(e.target.value); if (aiSummaryGenerated) setAiSummaryGenerated(false); }}
              placeholder="Describe the work performed today, progress made, and any notable site conditions..."
              disabled={isLocked}
              rows={4}
              style={textareaStyle(isLocked)}
            />
          </div>
        )}
      </Card>

      {/* ── Issues and Delays ──────────────────────────── */}
      <Card>
        <SectionHeader title="Issues and Delays" />
        <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium }}>
          Issues, delays, or blockers
        </label>
        <textarea
          value={issuesDelays}
          onChange={e => setIssuesDelays(e.target.value)}
          placeholder="Note any issues, delays, or blockers encountered today..."
          disabled={isLocked}
          rows={3}
          style={textareaStyle(isLocked)}
        />
      </Card>

      {/* ── Auto Narrative ─────────────────────────────── */}
      <AutoNarrative logData={today as unknown as Record<string, unknown>} />

      {/* ── Day Comparison ─────────────────────────────── */}
      {showComparison && yesterday && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
            <SectionHeader title={compareMode === 'lastweek' ? 'vs Same Day Last Week' : 'vs Yesterday'} />
            <button onClick={() => setShowComparison(false)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}>Close</button>
          </div>
          <DayComparison
            today={{ label: 'Today', workers: today.workers_onsite ?? 0, hours: today.total_hours ?? 0, incidents: today.incidents ?? 0 }}
            yesterday={compareMode === 'lastweek' && lastWeek
              ? { label: 'Last Week', workers: lastWeek.workers_onsite ?? 0, hours: lastWeek.total_hours ?? 0, incidents: lastWeek.incidents ?? 0 }
              : { label: 'Yesterday', workers: yesterday.workers_onsite ?? 0, hours: yesterday.total_hours ?? 0, incidents: yesterday.incidents ?? 0 }
            }
            lastWeek={lastWeek ? { label: 'Last Week', workers: lastWeek.workers_onsite ?? 0, hours: lastWeek.total_hours ?? 0, incidents: lastWeek.incidents ?? 0 } : { label: 'Last Week', workers: 0, hours: 0, incidents: 0 }}
          />
        </Card>
      )}

      {/* ── Photo Documentation ────────────────────────── */}
      <div>
        <SectionHeader title="Photo Documentation" action={
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            <Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{photos.length} captures
          </span>
        } />
        <PhotoGrid photos={photos} onCapture={!isLocked ? onPhotoCapture : undefined} />
      </div>

      {/* ── Addendum Form ──────────────────────────────── */}
      {showAddendumForm && isApproved && (
        <Card>
          <SectionHeader title="Add Addendum" action={
            <button onClick={() => setShowAddendumForm(false)} aria-label="Close" style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}><X size={14} /></button>
          } />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
            <Lock size={13} color={colors.orangeText} style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, margin: 0 }}>
              The original log is preserved. This addendum is saved as a separate record.
            </p>
          </div>
          <textarea value={addendumText} onChange={e => setAddendumText(e.target.value)} placeholder="Describe the addendum, correction, or additional information..." disabled={addendumSubmitting} style={{ ...textareaStyle(false), minHeight: '96px' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['3'] }}>
            <Btn variant="ghost" size="md" onClick={() => { setShowAddendumForm(false); setAddendumText(''); }}>Cancel</Btn>
            <Btn variant="primary" size="md" icon={<FileEdit size={14} />} onClick={onAddendumSubmit} disabled={addendumSubmitting}>
              {addendumSubmitting ? 'Saving...' : 'Save Addendum'}
            </Btn>
          </div>
        </Card>
      )}

      {/* ── Signature ──────────────────────────────────── */}
      <SignatureCapture
        visible={showSignature && logStatus === 'submitted'}
        onSign={async () => { await onApprove(); setShowSignature(false); }}
      />

      {/* ── Previous Days ──────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <SectionHeader title="Previous Days" />
          <div style={{ position: 'relative', width: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: spacing['2.5'], top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary, pointerEvents: 'none' }} />
            <input
              type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search logs..."
              style={{ width: '100%', padding: `${spacing['1.5']} ${spacing['3']} ${spacing['1.5']} ${spacing['8']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, outline: 'none', color: colors.textPrimary, backgroundColor: colors.surfaceRaised, boxSizing: 'border-box', height: 32 }}
              onFocus={e => { e.currentTarget.style.borderColor = colors.borderFocus; }}
              onBlur={e => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
            />
          </div>
        </div>
        {filteredPreviousDays.length === 0 && previousDays.length > 0 ? (
          <Card padding={spacing['6']}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: spacing['3'] }}>
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>No logs match your search</p>
              <button onClick={() => setHistorySearch('')} style={{ ...cancelBtnStyle, padding: `${spacing['2']} ${spacing['3']}` }}>Clear search</button>
            </div>
          </Card>
        ) : (
          <Card padding="0">
            {filteredPreviousDays.map((log, index) => {
              const logDate = new Date(log.log_date + 'T12:00:00');
              const formatted = logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const isHovered = hoveredRow === log.id;
              const isLast = index === filteredPreviousDays.length - 1;
              const entryStatus = (log.status as DailyLogState) || (log.approved ? 'approved' : 'draft');
              const sc = getDailyLogStatusConfig(entryStatus);
              return (
                <div key={log.id} onClick={() => { setSelectedDate(log.log_date); }} onMouseEnter={() => setHoveredRow(log.id)} onMouseLeave={() => setHoveredRow(null)} style={{ display: 'flex', alignItems: 'center', padding: `${spacing['3']} ${spacing['4']}`, cursor: 'pointer', backgroundColor: isHovered ? colors.surfaceHover : 'transparent', transition: `background-color ${transitions.quick}`, borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`, gap: spacing['3'] }}>
                  <div style={{ minWidth: '100px', flexShrink: 0 }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, display: 'block' }}>{formatted}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: sc.color, backgroundColor: sc.bg, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, flexShrink: 0 }}>
                    {(entryStatus === 'submitted' || entryStatus === 'approved') && <Lock size={10} />}
                    {sc.label}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.summary ?? ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], flexShrink: 0 }}>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{log.workers_onsite ?? 0} workers</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{(log.total_hours ?? 0).toLocaleString()} hrs</span>
                    {(log.incidents ?? 0) > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); setExpandedIncident(expandedIncident === log.id ? null : log.id); }} style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.medium, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily, textDecoration: 'underline', padding: 0 }}>
                        {log.incidents ?? 0} incident{(log.incidents ?? 0) > 1 ? 's' : ''}
                      </button>
                    )}
                    <ChevronRight size={14} style={{ color: colors.textTertiary, opacity: isHovered ? 1 : 0, transition: `opacity ${transitions.quick}` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* ── Sticky Submit Bar ──────────────────────────── */}
      {logStatus === 'draft' && !isLocked && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: zIndex.sticky,
          padding: `${spacing['3']} ${spacing['4']}`,
          background: colors.surfaceRaised,
          borderTop: `1px solid ${colors.borderSubtle}`,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
          borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'],
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <ShieldCheck size={14} color={colors.statusActive} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {noIncidentsToday ? 'No incidents' : 'Incidents logged'} · {manpowerRows.reduce((s, r) => s + r.headcount, 0)} workers · {equipmentRows.length} equipment · {materialRows.length} deliveries
            </span>
          </div>
          <PermissionGate permission="daily_log.submit">
            <button onClick={onSubmit} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['5']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: shadows.glow, height: 38 }}>
              <Send size={14} />
              Submit for Approval
            </button>
          </PermissionGate>
        </div>
      )}
      {deleteEntryDialog}
    </div>
  );
};
