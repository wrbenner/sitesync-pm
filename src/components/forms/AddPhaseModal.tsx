import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Link2, AlertTriangle, Users, Clock } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme';
import { Btn } from '../Primitives';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'
import { useProjectStore } from '../../stores/projectStore';

/* ── Types ────────────────────────────────────────────────── */

interface PhaseData {
  name: string;
  start_date: string;
  end_date: string;
  status?: string;
  is_critical_path?: boolean;
  percent_complete?: number;
  predecessor_ids?: string[];
  assigned_crew_id?: string | null;
  float_days?: number;
}

interface ExistingPhase { id: string; name: string }
interface CrewOption { id: string; name: string }

interface AddPhaseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PhaseData) => Promise<void> | void;
}

/* ── Shared styles ────────────────────────────────────────── */

const inputBase: React.CSSProperties = {
  padding: `10px ${spacing['3']}`,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  backgroundColor: colors.surfacePage,
  color: colors.textPrimary,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  minHeight: 40,
  transition: `border-color 150ms, box-shadow 150ms`,
};

const labelBase: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.4px',
  display: 'block',
  marginBottom: spacing['1'],
};

const selectBase: React.CSSProperties = {
  ...inputBase,
  cursor: 'pointer',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `right ${spacing['3']} center`,
  paddingRight: spacing['8'],
};

const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = colors.primaryOrange;
  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryOrange}20`;
};
const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = colors.borderDefault;
  e.currentTarget.style.boxShadow = 'none';
};

/* ── Component ────────────────────────────────────────────── */

const AddPhaseModal: React.FC<AddPhaseModalProps> = ({ open, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [percentComplete, setPercentComplete] = useState(0);
  const [isCriticalPath, setIsCriticalPath] = useState(false);
  const [isMilestone, setIsMilestone] = useState(false);
  const [predecessorIds, setPredecessorIds] = useState<string[]>([]);
  const [assignedCrewId, setAssignedCrewId] = useState<string | null>(null);

  const [showDeps, setShowDeps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingPhases, setExistingPhases] = useState<ExistingPhase[]>([]);
  const [crews, setCrews] = useState<CrewOption[]>([]);

  const { activeProject } = useProjectStore();

  useEffect(() => {
    if (!open || !activeProject?.id) return;
    (async () => {
      const [phasesRes, crewsRes] = await Promise.all([
        fromTable('schedule_phases').select('id, name').eq('project_id' as never, activeProject.id).order('start_date'),
        fromTable('crews').select('id, name').eq('project_id' as never, activeProject.id).order('name'),
      ]);
      if (phasesRes.data) setExistingPhases(phasesRes.data);
      if (crewsRes.data) setCrews(crewsRes.data);
    })();
  }, [open, activeProject?.id]);

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
    return diff >= 0 ? Math.round(diff) : null;
  }, [startDate, endDate]);

  if (!open) return null;

  const reset = () => {
    setName(''); setStartDate(''); setEndDate('');
    setStatus('upcoming'); setPercentComplete(0);
    setIsCriticalPath(false); setIsMilestone(false); setPredecessorIds([]);
    setAssignedCrewId(null); setShowDeps(false); setError(null);
  };

  const handleClose = () => { if (!submitting) { reset(); onClose(); } };

  const togglePredecessor = (id: string) => {
    setPredecessorIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Phase name is required.'); return; }
    if (!startDate || !endDate) { setError('Start and end dates are required.'); return; }
    if (new Date(endDate) < new Date(startDate)) { setError('End date must be on or after start date.'); return; }

    setSubmitting(true); setError(null);
    try {
      const data: PhaseData = {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
        percent_complete: percentComplete,
        is_critical_path: isCriticalPath,
      };
      if (predecessorIds.length > 0) data.predecessor_ids = predecessorIds;
      if (assignedCrewId) data.assigned_crew_id = assignedCrewId;
      await onSubmit(data);
      reset(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create phase');
    } finally { setSubmitting(false); }
  };

  const progressColor = percentComplete === 100
    ? colors.statusApproved
    : percentComplete > 0
    ? colors.primaryOrange
    : colors.borderDefault;

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="add-phase-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: zIndex.popover, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing['4'], backdropFilter: 'blur(4px)',
      }}
    >
      <form onSubmit={handleSubmit} style={{
        backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 32px 64px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['5']} ${spacing['5']} ${spacing['4']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          position: 'sticky', top: 0, backgroundColor: colors.surfaceRaised,
          zIndex: 1, borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`,
        }}>
          <div>
            <h2 id="add-phase-title" style={{
              fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary, margin: 0,
            }}>
              {isMilestone ? 'New Milestone' : 'New Phase'}
            </h2>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `4px 0 0` }}>
              {activeProject?.name ?? 'Project'}
            </p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textTertiary, display: 'flex', borderRadius: borderRadius.base,
            width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
            transition: `color ${transitions.instant}`,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: `${spacing['4']} ${spacing['5']}`, display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>

          {/* ── Name ── */}
          <div>
            <label style={labelBase}>Phase Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Foundation, Structural Steel, MEP Rough-In"
              disabled={submitting} required autoFocus
              style={inputBase}
              onFocus={focusHandler} onBlur={blurHandler}
            />
          </div>

          {/* ── Dates ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={labelBase}>
                <Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Start *
              </label>
              <input
                type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (isMilestone) setEndDate(e.target.value); }}
                disabled={submitting} required style={inputBase}
                onFocus={focusHandler} onBlur={blurHandler}
              />
            </div>
            {!isMilestone && (
            <div>
              <label style={labelBase}>
                <Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />End *
              </label>
              <input
                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                disabled={submitting} required style={inputBase}
                onFocus={focusHandler} onBlur={blurHandler}
              />
            </div>
            )}
          </div>

          {/* Duration chip */}
          {durationDays !== null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
              padding: `6px ${spacing['2.5']}`, alignSelf: 'flex-start',
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full,
              fontSize: typography.fontSize.sm, color: colors.textSecondary,
            }}>
              <Clock size={12} />
              <span>{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
            </div>
          )}

          {/* ── Status + Progress ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], alignItems: 'end' }}>
            <div>
              <label style={labelBase}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} disabled={submitting} style={selectBase}
                onFocus={focusHandler as unknown as React.FocusEventHandler<HTMLSelectElement>}
                onBlur={blurHandler as unknown as React.FocusEventHandler<HTMLSelectElement>}
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label style={labelBase}>Progress</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={percentComplete} onChange={e => setPercentComplete(Number(e.target.value))}
                    disabled={submitting}
                    style={{ width: '100%', accentColor: progressColor, cursor: 'pointer' }}
                  />
                </div>
                <span style={{
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold,
                  color: progressColor, minWidth: 36, textAlign: 'right',
                }}>
                  {percentComplete}%
                </span>
              </div>
            </div>
          </div>

          {/* ── Milestone toggle ── */}
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              type="button"
              onClick={() => {
                const next = !isMilestone;
                setIsMilestone(next);
                if (next && startDate) setEndDate(startDate);
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                padding: `${spacing['2.5']} ${spacing['3']}`,
                backgroundColor: isMilestone ? `${colors.primaryOrange}12` : colors.surfaceInset,
                border: `1.5px solid ${isMilestone ? colors.primaryOrange : colors.borderSubtle}`,
                borderRadius: borderRadius.lg, cursor: 'pointer',
                fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm,
                color: isMilestone ? colors.primaryOrange : colors.textSecondary,
                fontWeight: typography.fontWeight.medium,
                transition: 'all 150ms',
              }}
            >
              <span style={{ fontSize: '16px' }}>◆</span>
              Milestone
              <div style={{
                marginLeft: 'auto', width: 36, height: 20, borderRadius: 10,
                backgroundColor: isMilestone ? colors.primaryOrange : colors.borderDefault,
                position: 'relative', transition: 'background-color 150ms',
              }}>
                <div style={{
                  position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: colors.white, transition: 'left 150ms',
                  left: isMilestone ? 18 : 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </button>
            {/* ── Critical Path toggle ── */}
            <button
              type="button"
              onClick={() => setIsCriticalPath(!isCriticalPath)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                padding: `${spacing['2.5']} ${spacing['3']}`,
                backgroundColor: isCriticalPath ? `${colors.statusCritical}12` : colors.surfaceInset,
                border: `1.5px solid ${isCriticalPath ? colors.statusCritical : colors.borderSubtle}`,
                borderRadius: borderRadius.lg, cursor: 'pointer',
                fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm,
                color: isCriticalPath ? colors.statusCritical : colors.textSecondary,
                fontWeight: typography.fontWeight.medium,
                transition: 'all 150ms',
              }}
            >
              <AlertTriangle size={14} />
              Critical Path
              <div style={{
                marginLeft: 'auto', width: 36, height: 20, borderRadius: 10,
                backgroundColor: isCriticalPath ? colors.statusCritical : colors.borderDefault,
                position: 'relative', transition: 'background-color 150ms',
              }}>
                <div style={{
                  position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: colors.white, transition: 'left 150ms',
                  left: isCriticalPath ? 18 : 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </button>
          </div>

          {/* ── Crew ── */}
          {crews.length > 0 && (
            <div>
              <label style={labelBase}>
                <Users size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Assigned Crew
              </label>
              <select value={assignedCrewId ?? ''} onChange={e => setAssignedCrewId(e.target.value || null)} disabled={submitting} style={selectBase}
                onFocus={focusHandler as unknown as React.FocusEventHandler<HTMLSelectElement>}
                onBlur={blurHandler as unknown as React.FocusEventHandler<HTMLSelectElement>}
              >
                <option value="">None</option>
                {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* ── Dependencies toggle ── */}
          {existingPhases.length > 0 && (
            <>
              <button
                type="button" onClick={() => setShowDeps(!showDeps)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} 0`, background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: typography.fontFamily,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  color: colors.primaryOrange,
                }}
              >
                <Link2 size={14} />
                {showDeps ? 'Hide' : 'Link'} Predecessors
                {predecessorIds.length > 0 && (
                  <span style={{
                    backgroundColor: colors.primaryOrange, color: colors.white,
                    borderRadius: borderRadius.full, fontSize: '10px',
                    fontWeight: typography.fontWeight.bold,
                    width: 18, height: 18, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {predecessorIds.length}
                  </span>
                )}
              </button>

              {showDeps && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: spacing['1.5'],
                  padding: spacing['3'], backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`,
                  maxHeight: 180, overflowY: 'auto',
                }}>
                  {existingPhases.map(phase => {
                    const selected = predecessorIds.includes(phase.id);
                    return (
                      <button
                        key={phase.id} type="button"
                        onClick={() => togglePredecessor(phase.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `8px ${spacing['3']}`,
                          backgroundColor: selected ? colors.orangeSubtle : colors.surfaceRaised,
                          border: `1.5px solid ${selected ? colors.primaryOrange : colors.borderSubtle}`,
                          borderRadius: borderRadius.md, cursor: 'pointer',
                          fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm,
                          color: selected ? colors.primaryOrange : colors.textPrimary,
                          fontWeight: selected ? typography.fontWeight.medium : typography.fontWeight.normal,
                          textAlign: 'left', width: '100%', transition: 'all 120ms',
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                          border: `1.5px solid ${selected ? colors.primaryOrange : colors.borderDefault}`,
                          backgroundColor: selected ? colors.primaryOrange : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        {phase.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Error ── */}
          {error && (
            <div role="alert" style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              fontSize: typography.fontSize.sm, color: colors.statusCritical,
              padding: `${spacing['2.5']} ${spacing['3']}`,
              backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md,
            }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['5']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          justifyContent: 'flex-end',
          position: 'sticky', bottom: 0,
          backgroundColor: colors.surfaceRaised,
          borderRadius: `0 0 ${borderRadius.xl} ${borderRadius.xl}`,
        }}>
          <Btn variant="secondary" onClick={handleClose} disabled={submitting} type="button">Cancel</Btn>
          <Btn type="submit" disabled={submitting || !name.trim() || !startDate || !endDate}>
            {submitting ? 'Creating...' : 'Create Phase'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

export default AddPhaseModal;
