import React, { useState } from 'react';
import { Users, Clock, ShieldCheck, Cloud, ChevronRight, Camera, Send, Sparkles, Calendar, X, Lock, AlertTriangle, RefreshCw, Truck, UserPlus, FileEdit } from 'lucide-react';
import { Card, Btn, SectionHeader, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme';
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [incidentForm, setIncidentForm] = useState<IncidentForm>({ type: 'near_miss', description: '', corrective_action: '' });
  const statusConfig = getDailyLogStatusConfig(logStatus);

  const todayMetrics = [
    { icon: <Users size={16} style={{ color: colors.textTertiary }} />, label: 'Workers', value: (today.workers_onsite ?? 0).toString(), valueColor: colors.textPrimary },
    { icon: <Clock size={16} style={{ color: colors.textTertiary }} />, label: 'Hours', value: (today.total_hours ?? 0).toLocaleString(), valueColor: colors.textPrimary },
    { icon: <ShieldCheck size={16} style={{ color: colors.textTertiary }} />, label: 'Incidents', value: (today.incidents ?? 0).toString(), valueColor: (today.incidents ?? 0) === 0 ? colors.statusActive : colors.statusCritical },
    { icon: <Cloud size={16} style={{ color: colors.textTertiary }} />, label: 'Weather', value: today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A'), valueColor: colors.textPrimary },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: spacing['6'] }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
        {!hasTodayLog && (
          <div
            aria-live="polite"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['3']} ${spacing['4']}`,
              backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md,
              borderLeft: `3px solid ${colors.primaryOrange}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <Calendar size={14} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, fontWeight: typography.fontWeight.medium }}>
                Today's daily log hasn't been started
              </span>
            </div>
            <PermissionGate permission="daily_log.create"><Btn size="sm" variant="primary" onClick={() => { setSelectedDate(todayStr); setShowCreateModal(true); }}>Start Log</Btn></PermissionGate>
          </div>
        )}

        {!isLocked && yesterday && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
            border: `1px solid ${colors.borderSubtle}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <RefreshCw size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Pre-fill crew and equipment from yesterday
              </span>
            </div>
            <Btn size="sm" variant="secondary" icon={<RefreshCw size={12} />} onClick={onSameAsYesterday}>
              Same as yesterday
            </Btn>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['2']} ${spacing['4']}`,
          backgroundColor: statusConfig.bg, borderRadius: borderRadius.md,
          borderLeft: `3px solid ${statusConfig.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            {isLocked && <Lock size={13} color={statusConfig.color} />}
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: statusConfig.color }}>{statusConfig.label}</span>
            {isApproved && approvedAt && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                This log was approved on {new Date(approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Changes require an addendum.
              </span>
            )}
            {isApproved && !approvedAt && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>This log is approved. Changes require an addendum.</span>
            )}
            {isSubmittedOnly && submittedAt && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                This log was submitted on {new Date(submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} and is locked for editing.
              </span>
            )}
            {isSubmittedOnly && !submittedAt && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>This log has been submitted and is locked for editing.</span>
            )}
          </div>
        </div>

        {isRejected && rejectionComments && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md,
            borderLeft: `3px solid ${colors.statusCritical}`,
          }}>
            <AlertTriangle size={14} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Returned for revision</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{rejectionComments}</p>
            </div>
          </div>
        )}

        {weather && (
          <WeatherWidget weather={weather} weatherIsAuto={weatherIsAuto} isLocked={isLocked} onUpdate={onWeatherUpdate} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: spacing['4'] }}>
          {todayMetrics.map((metric) => (
            <Card key={metric.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                {metric.icon}
                <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{metric.label}</span>
              </div>
              <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: metric.valueColor }}>{metric.value}</span>
            </Card>
          ))}
        </div>

        <CrewHoursEntry
          manpowerRows={manpowerRows}
          setManpowerRows={setManpowerRows}
          isLocked={isLocked}
          crewHours={crewHours}
        />

        <Card>
          <SectionHeader title="Equipment on Site" action={
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{(today.equipment_entries ?? []).length} items</span>
          } />
          {(today.equipment_entries ?? []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 120px', gap: 1 }}>
              {['Equipment', 'Qty', 'Hrs Operated'].map(h => (
                <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
              ))}
              {(today.equipment_entries as Array<{ type: string; count: number; hours_operated: number }>).map((eq, i) => (
                <React.Fragment key={i}>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.type}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{eq.count}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.hours_operated} hrs</span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No equipment entries. Use Quick Entry to log equipment.</p>
          )}
        </Card>

        <Card>
          <SectionHeader title="Material Deliveries" action={<Truck size={14} style={{ color: colors.textTertiary }} />} />
          {(today.material_deliveries ?? []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 120px 120px', gap: 1 }}>
              {['Description', 'Qty', 'PO Reference', 'Delivery Ticket'].map(h => (
                <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
              ))}
              {(today.material_deliveries as Array<{ description: string; quantity: number; po_reference: string; delivery_ticket: string }>).map((d, i) => (
                <React.Fragment key={i}>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.description}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{d.quantity || '—'}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.po_reference || '—'}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.delivery_ticket || '—'}</span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No material deliveries today.</p>
          )}
        </Card>

        <Card>
          <SectionHeader title="Safety" action={<ShieldCheck size={14} style={{ color: colors.textTertiary }} />} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {today.toolbox_talk_topic && (
              <div>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Toolbox Talk</span>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{today.toolbox_talk_topic}</p>
              </div>
            )}
            <div>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Observations</span>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{today.safety_observations || 'No safety observations recorded.'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Site Visitors" action={
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              {!isLocked && (
                <button
                  onClick={() => setNoVisitorsToday((v) => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily }}
                >
                  <div style={{
                    width: 32, height: 18, borderRadius: 9, position: 'relative', transition: 'background 160ms',
                    backgroundColor: noVisitorsToday ? colors.statusActive : colors.borderDefault,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: noVisitorsToday ? 16 : 2, width: 14, height: 14,
                      borderRadius: '50%', backgroundColor: colors.white, transition: 'left 160ms',
                    }} />
                  </div>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No visitors today</span>
                </button>
              )}
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <UserPlus size={12} /> {(today.visitors ?? []).length}
              </span>
            </div>
          } />
          {noVisitorsToday && (today.visitors ?? []).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
              <ShieldCheck size={14} color={colors.statusActive} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No visitors on site today</span>
            </div>
          ) : (today.visitors ?? []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 80px', gap: 1 }}>
              {['Name', 'Company', 'Purpose', 'Time In', 'Time Out'].map(h => (
                <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
              ))}
              {(today.visitors as Array<{ name: string; company: string; purpose: string; time_in: string; time_out: string }>).map((v, i) => (
                <React.Fragment key={i}>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.name}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.company || '—'}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.purpose || '—'}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.time_in || '—'}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.time_out || '—'}</span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No visitors today.</p>
          )}
        </Card>

        <Card>
          <SectionHeader title="Safety Incidents" action={
            !isLocked && (
              <button
                onClick={() => setNoIncidentsToday((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: typography.fontFamily }}
              >
                <div style={{
                  width: 32, height: 18, borderRadius: 9, position: 'relative', transition: 'background 160ms',
                  backgroundColor: noIncidentsToday ? colors.statusActive : colors.statusCritical,
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: noIncidentsToday ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', backgroundColor: colors.white, transition: 'left 160ms',
                  }} />
                </div>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No incidents today</span>
              </button>
            )
          } />
          {(today.incident_details ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginBottom: spacing['3'] }}>
              {(today.incident_details as Array<{ description: string; type: string; corrective_action: string }>).map((inc, i) => (
                <div key={i} style={{ padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
                  <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase', margin: 0, marginBottom: spacing['1'] }}>{inc.type.replace(/_/g, ' ')}</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{inc.description}</p>
                  {inc.corrective_action && (
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>Corrective action: {inc.corrective_action}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {noIncidentsToday && (today.incident_details ?? []).length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
              <ShieldCheck size={14} color={colors.statusActive} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No incidents reported today</span>
            </div>
          )}
          {!noIncidentsToday && !isLocked && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Log Incident</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Incident Type</label>
                <select
                  value={incidentForm.type}
                  onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))}
                  style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', backgroundColor: colors.white, color: colors.textPrimary }}
                >
                  <option value="near_miss">Near Miss</option>
                  <option value="first_aid">First Aid</option>
                  <option value="recordable">Recordable Injury</option>
                  <option value="property_damage">Property Damage</option>
                  <option value="environmental">Environmental</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Description</label>
                <textarea
                  value={incidentForm.description}
                  onChange={e => setIncidentForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what happened, where, and who was involved..."
                  rows={3}
                  style={{ padding: spacing['3'], fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', color: colors.textPrimary, backgroundColor: colors.white, boxSizing: 'border-box', lineHeight: '1.6' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Corrective Action Taken</label>
                <textarea
                  value={incidentForm.corrective_action}
                  onChange={e => setIncidentForm(p => ({ ...p, corrective_action: e.target.value }))}
                  placeholder="Describe the immediate corrective action taken..."
                  rows={2}
                  style={{ padding: spacing['3'], fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', color: colors.textPrimary, backgroundColor: colors.white, boxSizing: 'border-box', lineHeight: '1.6' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <button
                  onClick={() => { setNoIncidentsToday(true); setIncidentForm({ type: 'near_miss', description: '', corrective_action: '' }); }}
                  style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!incidentForm.description.trim()) return;
                    addToast('success', 'Incident logged. Save with Submit Log.');
                    setIncidentForm({ type: 'near_miss', description: '', corrective_action: '' });
                  }}
                  style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.statusCritical, color: colors.white, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: typography.fontWeight.medium }}
                >
                  Log Incident
                </button>
              </div>
            </div>
          )}
        </Card>

        {!isLocked && (
          <Card>
            <SectionHeader title="Speak Your Daily Log" />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `0 0 ${spacing['3']} 0` }}>
              Tap the mic and narrate your day. We'll transcribe and structure it into the form fields.
            </p>
            <VoiceRecorder
              kind="daily_log"
              label="Voice daily log"
              onStructured={(structured, transcript) => {
                const s = (structured || {}) as Record<string, unknown>;
                const activities = Array.isArray(s.activities) ? s.activities : [];
                const summaryParts: string[] = [];
                if (typeof s.summary === 'string' && s.summary) summaryParts.push(s.summary);
                activities.forEach((a) => {
                  const obj = a as Record<string, unknown>;
                  const desc = typeof obj.description === 'string' ? obj.description : '';
                  const loc = typeof obj.location === 'string' ? obj.location : '';
                  if (desc) summaryParts.push(`• ${desc}${loc ? ` (${loc})` : ''}`);
                });
                const newSummary = summaryParts.join('\n') || transcript;
                setWorkSummary((prev) => prev ? `${prev}\n\n${newSummary}` : newSummary);
                if (aiSummaryGenerated) setAiSummaryGenerated(false);
                const issues = Array.isArray(s.issues) ? s.issues : [];
                if (issues.length > 0) {
                  const issueText = issues.map((i) => {
                    const io = i as Record<string, unknown>;
                    return `• ${io.description || ''}`;
                  }).join('\n');
                  setIssuesDelays(issueText);
                }
              }}
            />
          </Card>
        )}

        <Card>
          <SectionHeader
            title="Work Summary"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {aiSummaryGenerated && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.statusReview,
                    backgroundColor: colors.statusReviewSubtle,
                    padding: `2px ${spacing['2']}`,
                    borderRadius: borderRadius.full,
                    letterSpacing: '0.2px',
                  }}>
                    AI Generated
                  </span>
                )}
                {!isLocked && (
                  <button
                    onClick={onAiSummary}
                    disabled={aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)}
                    title={(manpowerRows.length === 0 && logEntries.length === 0) ? 'Add work entries first for AI to summarize' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['1'],
                      padding: `5px ${spacing['3']}`,
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily,
                      color: (aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)) ? colors.textTertiary : colors.textSecondary,
                      backgroundColor: 'transparent',
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.md,
                      cursor: (aiSummaryLoading || (manpowerRows.length === 0 && logEntries.length === 0)) ? 'not-allowed' : 'pointer',
                      transition: transitions.default,
                      opacity: (manpowerRows.length === 0 && logEntries.length === 0) ? 0.5 : 1,
                    }}
                  >
                    <Sparkles size={13} color={colors.primaryOrange} />
                    Generate AI Summary
                  </button>
                )}
              </div>
            }
          />
          {aiSummaryLoading ? (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, animation: 'pulse-dl 1.2s ease-in-out infinite' }}>
              AI is summarizing today...
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Work performed</label>
                {!isLocked && (
                  <select
                    defaultValue=""
                    onChange={e => {
                      if (!e.target.value) return;
                      setWorkSummary(prev => prev ? `${prev}\n[Phase: ${e.target.value}] ` : `[Phase: ${e.target.value}] `);
                      e.target.value = '';
                    }}
                    style={{ padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', color: colors.textSecondary, backgroundColor: colors.white, cursor: 'pointer' }}
                  >
                    <option value="">+ Link schedule phase</option>
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
              <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'flex-start' }}>
                <textarea
                  value={workSummary}
                  onChange={e => { setWorkSummary(e.target.value); if (aiSummaryGenerated) setAiSummaryGenerated(false); }}
                  placeholder="Describe the work performed today, progress made, and any notable site conditions..."
                  disabled={isLocked}
                  rows={4}
                  style={{
                    flex: 1,
                    padding: spacing['3'],
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    border: `1px solid ${colors.borderDefault}`,
                    backgroundColor: isLocked ? colors.surfaceInset : colors.white,
                    borderRadius: borderRadius.md,
                    outline: 'none',
                    resize: 'vertical',
                    color: colors.textPrimary,
                    boxSizing: 'border-box',
                    lineHeight: '1.6',
                    cursor: isLocked ? 'not-allowed' : 'text',
                    minHeight: '56px',
                  }}
                />
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Issues and Delays" />
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium }}>
            Issues, delays, or blockers
          </label>
          <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'flex-start' }}>
            <textarea
              value={issuesDelays}
              onChange={e => setIssuesDelays(e.target.value)}
              placeholder="Note any issues, delays, or blockers encountered today..."
              disabled={isLocked}
              rows={3}
              style={{
                flex: 1,
                padding: spacing['3'],
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                border: `1px solid ${colors.borderDefault}`,
                backgroundColor: isLocked ? colors.surfaceInset : colors.white,
                borderRadius: borderRadius.md,
                outline: 'none',
                resize: 'vertical',
                color: colors.textPrimary,
                boxSizing: 'border-box',
                lineHeight: '1.6',
                cursor: isLocked ? 'not-allowed' : 'text',
                minHeight: '56px',
              }}
            />
          </div>
        </Card>

        <AutoNarrative logData={today as unknown as Record<string, unknown>} />

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

        <div>
          <SectionHeader title="Photo Documentation" action={
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{photos.length} captures
            </span>
          } />
          <PhotoGrid photos={photos} onCapture={!isLocked ? onPhotoCapture : undefined} />
        </div>

        {showAddendumForm && isApproved && (
          <Card>
            <SectionHeader title="Add Addendum" action={
              <button onClick={() => setShowAddendumForm(false)} aria-label="Close addendum form" style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}><X size={14} /></button>
            } />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
              <Lock size={13} color={colors.orangeText} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, margin: 0 }}>
                The original log is preserved. This addendum will be saved as a separate record linked to this log, with its own timestamp and author.
              </p>
            </div>
            <textarea
              value={addendumText}
              onChange={e => setAddendumText(e.target.value)}
              placeholder="Describe the addendum, correction, or additional information..."
              disabled={addendumSubmitting}
              style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '96px', boxSizing: 'border-box', color: colors.textPrimary }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['3'] }}>
              <Btn variant="ghost" size="md" onClick={() => { setShowAddendumForm(false); setAddendumText(''); }}>Cancel</Btn>
              <Btn variant="primary" size="md" icon={<FileEdit size={14} />} onClick={onAddendumSubmit} disabled={addendumSubmitting}>
                {addendumSubmitting ? 'Saving...' : 'Save Addendum'}
              </Btn>
            </div>
          </Card>
        )}

        <SignatureCapture
          visible={showSignature && logStatus === 'submitted'}
          onSign={async () => {
            await onApprove();
            setShowSignature(false);
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
            <SectionHeader title="Previous Days" />
            <input
              type="text"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search logs..."
              style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, outline: 'none', color: colors.textPrimary, backgroundColor: colors.white, width: 200, minHeight: '56px', boxSizing: 'border-box' }}
            />
          </div>
          {filteredPreviousDays.length === 0 && previousDays.length > 0 ? (
            <Card padding={spacing['6']}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: spacing['3'] }}>
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>No logs match your filters</p>
                <button
                  onClick={() => setHistorySearch('')}
                  style={{ backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textSecondary, cursor: 'pointer' }}
                >
                  Clear filters
                </button>
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
                  <div
                    key={log.id}
                    onClick={() => addToast('info', `Viewing details for ${formatted}`)}
                    onMouseEnter={() => setHoveredRow(log.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: `${spacing['4']} ${spacing['5']}`,
                      cursor: 'pointer',
                      backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                      transition: `background-color ${transitions.quick}`,
                      borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
                      gap: spacing['4'],
                    }}
                  >
                    <div style={{ minWidth: '120px', flexShrink: 0 }}>
                      <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, display: 'block' }}>{formatted}</span>
                      {log.ai_summary && (
                        <span style={{ fontSize: '11px', color: colors.textTertiary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{log.ai_summary}</span>
                      )}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: sc.color, backgroundColor: sc.bg, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, flexShrink: 0 }}>
                      {(entryStatus === 'submitted' || entryStatus === 'approved') && <Lock size={10} />}
                      {sc.label}
                    </span>
                    <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.summary ?? ''}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flexShrink: 0 }}>
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{log.workers_onsite ?? 0} workers</span>
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{(log.total_hours ?? 0).toLocaleString()} hrs</span>
                      {(log.incidents ?? 0) > 0 && (
                        <div>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedIncident(expandedIncident === log.id ? null : log.id); }} style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, fontWeight: typography.fontWeight.medium, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily, textDecoration: 'underline', padding: 0 }}>
                            {log.incidents ?? 0} incident{(log.incidents ?? 0) > 1 ? 's' : ''}
                          </button>
                        </div>
                      )}
                      <ChevronRight size={14} style={{ color: colors.textTertiary, opacity: isHovered ? 1 : 0, transition: `opacity ${transitions.quick}` }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        {logStatus === 'draft' && !isLocked && (
          <div style={{
            position: 'sticky', bottom: 0, zIndex: 10,
            padding: spacing.md,
            background: colors.surfaceRaised,
            borderTop: `1px solid ${colors.border}`,
            boxShadow: shadows.md,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'],
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <ShieldCheck size={14} color={colors.statusActive} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {noIncidentsToday ? 'No incidents' : 'Incidents logged'} · {noVisitorsToday ? 'No visitors' : 'Visitors logged'} · {manpowerRows.reduce((s, r) => s + r.headcount, 0)} workers on site
              </span>
            </div>
            <PermissionGate permission="daily_log.submit">
              <button
                onClick={onSubmit}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  backgroundColor: colors.primaryOrange, color: colors.white,
                  border: 'none', borderRadius: borderRadius.md,
                  padding: `${spacing['3']} ${spacing['5']}`,
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(244, 120, 32, 0.35)',
                  transition: 'opacity 160ms',
                  minHeight: '56px',
                }}
              >
                <Send size={15} />
                Submit Log for Approval
              </button>
            </PermissionGate>
          </div>
        )}
      </div>
    </div>
  );
};
