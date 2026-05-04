/**
 * Crews — refined per DESIGN-RESET.md.
 *
 * Sticky header, dense list, detail slide-over. Active / Archived toggle.
 * Existing CRUD + schedule-assignment flows preserved (AddCrewModal,
 * useDeleteCrew, useCreateCrewSchedule, useDeleteCrewSchedule).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ProjectGate } from '../components/ProjectGate';
import { PermissionGate } from '../components/auth/PermissionGate';
import { useConfirm } from '../components/ConfirmDialog';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries'
import { useEntityStore, useEntityActions } from '../stores/entityStore';
import type { Crew } from '../types/database';
import { useProjectStore } from '../stores/projectStore';
import { useDeleteCrew } from '../hooks/mutations';
import { useCrewSchedules, useSchedulePhasesForAssignment } from '../hooks/queries/crew-schedules';
import { useCreateCrewSchedule, useDeleteCrewSchedule } from '../hooks/mutations/crew-schedules';
import { useTimesheets } from '../hooks/queries/timesheets';

// ── Types ──────────────────────────────────────────────────────

interface CrewRow {
  id: string;
  name: string;
  trade: string | null;
  lead_id: string | null;
  lead_name?: string | null;
  size: number | null;
  status: string | null;
  current_task: string | null;
  productivity_score: number | null;
}

type ViewKey = 'active' | 'archived';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
];

// ── Add Crew Modal (preserved API) ─────────────────────────────

interface AddCrewModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: () => void;
}

function AddCrewModal({ open, onClose, projectId, onCreated }: AddCrewModalProps) {
  const [form, setForm] = useState({ name: '', trade: '', size: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm({ name: '', trade: '', size: '' });
      setErr(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr('Name required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { error } = await (fromTable('crews') as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: Error | null }>
      }).insert({
        project_id: projectId,
        name: form.name,
        trade: form.trade || null,
        lead_id: null,
        size: form.size ? parseInt(form.size, 10) : 0,
        status: 'active',
      });
      if (error) throw error;
      toast.success('Crew added');
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: colors.surfaceRaised,
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.40)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 460,
          maxWidth: '92vw',
          background: colors.surfaceRaised,
          borderRadius: 8,
          padding: spacing[6],
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>New Crew</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: spacing[3] }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
            <div>
              <label style={labelStyle}>Trade</label>
              <input style={inputStyle} value={form.trade} onChange={(e) => setForm((p) => ({ ...p, trade: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Size</label>
              <input style={inputStyle} type="number" value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))} />
            </div>
          </div>
          {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[5] }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: 6, fontSize: 13, fontWeight: 500, color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 14px', background: colors.primaryOrange, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: typography.fontFamily }}>
            {saving ? 'Saving…' : 'Add Crew'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Status chip ────────────────────────────────────────────────

function CrewStatusChip({ status }: { status: string | null }) {
  const key = (status ?? 'active').toLowerCase();
  const tokens = key === 'archived' || key === 'inactive'
    ? { fg: '#5C5550', bg: '#F1ECE2', label: 'Archived' }
    : key === 'standby'
      ? { fg: '#7A5C12', bg: '#FCF2DE', label: 'Standby' }
      : key === 'off_site' || key === 'off-site'
        ? { fg: '#3F4754', bg: '#EEF0F4', label: 'Off site' }
        : { fg: '#1F6F4F', bg: '#E5F2EC', label: 'Active' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        background: tokens.bg,
        color: tokens.fg,
        fontFamily: typography.fontFamily,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tokens.fg, flexShrink: 0 }} />
      {tokens.label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────

export const Crews: React.FC = () => {
  // ─── Migrated from crewStore to entityStore on Day 9 ───────────────────
  const { items: crews, loading, error: crewError } = useEntityStore<Crew>('crews');
  const { loadItems: loadCrews } = useEntityActions<Crew>('crews');
  const { activeProject } = useProjectStore();
  const projectId = activeProject?.id;
  const deleteCrew = useDeleteCrew();
  const { confirm: confirmDeleteCrew, dialog: deleteCrewDialog } = useConfirm();

  const { data: crewSchedules = [] } = useCrewSchedules(projectId);
  const { data: phasesForAssignment = [] } = useSchedulePhasesForAssignment(projectId);
  const { data: projectTimesheets = [] } = useTimesheets(projectId);
  const createCrewSchedule = useCreateCrewSchedule();
  const deleteCrewSchedule = useDeleteCrewSchedule();

  const [view, setView] = useState<ViewKey>('active');
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [editingCrew, setEditingCrew] = useState<CrewRow | null>(null);
  const [editCrewForm, setEditCrewForm] = useState({ name: '', trade: '', size: '', status: 'active' });

  useEffect(() => {
    if (projectId) loadCrews(projectId);
  }, [projectId, loadCrews]);

  const updateCrewMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await (fromTable('crews') as unknown as {
        update: (u: Record<string, unknown>) => {
          eq: (col: string, v: string) => {
            select: () => { single: () => Promise<{ data: unknown; error: Error | null }> }
          }
        }
      }).update(updates as never).eq('id' as never, id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Crew updated');
      setEditingCrew(null);
      if (projectId) loadCrews(projectId);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update crew');
    },
  });

  const openEditCrew = (crew: CrewRow) => {
    setEditCrewForm({
      name: crew.name ?? '',
      trade: crew.trade ?? '',
      size: String(crew.size ?? ''),
      status: crew.status ?? 'active',
    });
    setEditingCrew(crew);
  };

  const handleEditCrewSave = () => {
    if (!editingCrew) return;
    updateCrewMutation.mutate({
      id: editingCrew.id,
      updates: {
        name: editCrewForm.name || null,
        trade: editCrewForm.trade || null,
        size: editCrewForm.size ? parseInt(editCrewForm.size, 10) : 0,
        status: editCrewForm.status,
      },
    });
  };

  const handleDeleteCrew = useCallback(
    async (crew: CrewRow) => {
      if (!projectId) return;
      const ok = await confirmDeleteCrew({
        title: 'Delete crew?',
        description: `"${crew.name}" — schedule assignments and historical timesheets remain attached to the project for payroll integrity.`,
        destructiveLabel: 'Delete crew',
      });
      if (!ok) return;
      try {
        await deleteCrew.mutateAsync({ id: crew.id, projectId });
        toast.success('Crew deleted');
        loadCrews(projectId);
        setSelectedCrewId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete crew');
      }
    },
    [projectId, confirmDeleteCrew, deleteCrew, loadCrews],
  );

  // ── Derived data ──
  const visibleCrews = useMemo<CrewRow[]>(() => {
    const all = (crews as CrewRow[]) ?? [];
    if (view === 'archived') return all.filter((c) => (c.status ?? '').toLowerCase() === 'archived');
    return all.filter((c) => (c.status ?? '').toLowerCase() !== 'archived');
  }, [crews, view]);

  // Hours this week per crew, derived from timesheets matching crew name
  const hoursWeekByCrew = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const map = new Map<string, number>();
    for (const t of projectTimesheets) {
      const tDate = (t as { date?: string }).date ?? '';
      if (tDate < weekStartIso) continue;
      const crewName = ((t as { crew_name?: string | null }).crew_name ?? '').trim();
      if (!crewName) continue;
      map.set(crewName, (map.get(crewName) ?? 0) + Number((t as { hours?: number }).hours ?? 0));
    }
    return map;
  }, [projectTimesheets]);

  const selectedCrew = visibleCrews.find((c) => c.id === selectedCrewId)
    ?? (crews as CrewRow[]).find((c) => c.id === selectedCrewId)
    ?? null;
  const selectedCrewSchedules = useMemo(
    () => (selectedCrew ? crewSchedules.filter((s) => s.crew_name === selectedCrew.name) : []),
    [crewSchedules, selectedCrew],
  );

  const totalsHeaderCount = visibleCrews.length;
  const totalsHeaderHeadcount = visibleCrews.reduce((acc, c) => acc + Number(c.size ?? 0), 0);

  if (!projectId) return <ProjectGate />;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#FCFCFA',
        fontFamily: typography.fontFamily,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[4],
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4],
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.01em' }}>Crews</h1>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 999,
            background: '#F1ECE2',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ fontWeight: 600, color: colors.textPrimary }}>{totalsHeaderCount}</span>
          {totalsHeaderCount === 1 ? 'crew' : 'crews'}
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{totalsHeaderHeadcount}</span>
          headcount
        </span>

        <div role="tablist" aria-label="Crew views" style={{ display: 'inline-flex', background: '#F1ECE2', borderRadius: 6, padding: 2 }}>
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setView(v.key)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: 4,
                  background: active ? colors.surfaceRaised : 'transparent',
                  color: active ? colors.textPrimary : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(26,22,19,0.04)' : 'none',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <PermissionGate permission="crews.manage">
          <button
            type="button"
            onClick={() => setShowAddCrew(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: colors.primaryOrange,
              border: 'none',
              borderRadius: 6,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} aria-hidden="true" />
            New Crew
          </button>
        </PermissionGate>
      </header>

      <main style={{ paddingLeft: spacing[6], paddingRight: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[8] }}>
        {crewError && (
          <div role="alert" style={{ padding: spacing[3], marginBottom: spacing[4], background: '#FCE7E7', border: '1px solid rgba(201,59,59,0.20)', borderRadius: 6, color: '#9A2929', fontSize: 13 }}>
            Failed to load crews: {String(crewError)}
          </div>
        )}

        {loading && visibleCrews.length === 0 ? (
          <div role="status" style={{ padding: spacing[8], textAlign: 'center', color: colors.textTertiary, fontSize: 13 }}>Loading crews…</div>
        ) : (
          <CrewTable
            crews={visibleCrews}
            hoursWeekByCrew={hoursWeekByCrew}
            selectedId={selectedCrewId}
            onSelect={setSelectedCrewId}
          />
        )}
      </main>

      <CrewDetailPanel
        crew={selectedCrew}
        crewSchedules={selectedCrewSchedules}
        phasesForAssignment={phasesForAssignment}
        hoursWeek={selectedCrew ? hoursWeekByCrew.get(selectedCrew.name) ?? 0 : 0}
        onClose={() => setSelectedCrewId(null)}
        onEdit={() => selectedCrew && openEditCrew(selectedCrew)}
        onDelete={() => selectedCrew && handleDeleteCrew(selectedCrew)}
        onAssignPhase={async (phaseId, headcount, start, end) => {
          if (!selectedCrew) return;
          try {
            await createCrewSchedule.mutateAsync({
              project_id: projectId,
              phase_id: phaseId || null,
              crew_name: selectedCrew.name,
              start_date: start,
              end_date: end,
              headcount,
            });
            toast.success('Phase assigned');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to assign');
          }
        }}
        onRemoveAssignment={async (id) => {
          try {
            await deleteCrewSchedule.mutateAsync({ id, project_id: projectId });
            toast.success('Assignment removed');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove');
          }
        }}
      />

      <AddCrewModal
        open={showAddCrew}
        onClose={() => setShowAddCrew(false)}
        projectId={projectId}
        onCreated={() => loadCrews(projectId)}
      />

      {editingCrew && (
        <EditCrewModal
          open={!!editingCrew}
          form={editCrewForm}
          setForm={setEditCrewForm}
          onClose={() => setEditingCrew(null)}
          onSave={handleEditCrewSave}
          saving={updateCrewMutation.isPending}
        />
      )}

      {deleteCrewDialog}
    </div>
  );
};

// ── Dense crew table ───────────────────────────────────────────

interface CrewTableProps {
  crews: CrewRow[];
  hoursWeekByCrew: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function CrewTable({ crews, hoursWeekByCrew, selectedId, onSelect }: CrewTableProps) {
  const grid = 'minmax(200px, 2fr) minmax(140px, 1.5fr) 100px minmax(120px, 1fr) minmax(180px, 2fr) 100px 120px';
  const headers = ['Crew', 'Foreman', 'Members', 'Trade', "Today's activity", 'Hours week', 'Status'];
  const aligns: Array<'left' | 'right'> = ['left', 'left', 'right', 'left', 'left', 'right', 'left'];

  return (
    <div role="grid" aria-label="Crews" style={{ background: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`, borderRadius: 6, overflow: 'hidden' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, height: 36, alignItems: 'center', background: '#FCFCFA', borderBottom: `1px solid ${colors.borderSubtle}`, position: 'sticky', top: 0, zIndex: 1 }}>
        {headers.map((h, i) => (
          <div key={h} role="columnheader" style={{ padding: `0 ${spacing[3]}`, textAlign: aligns[i], fontFamily: typography.fontFamily, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>{h}</div>
        ))}
      </div>

      {crews.length === 0 ? (
        <div style={{ padding: spacing[6], textAlign: 'center', color: colors.textTertiary, fontFamily: typography.fontFamily, fontSize: 13 }}>No crews in this view.</div>
      ) : (
        crews.map((c) => {
          const focused = selectedId === c.id;
          const hours = hoursWeekByCrew.get(c.name) ?? 0;
          return (
            <div key={c.id} role="row" data-crew-id={c.id} onClick={() => onSelect(c.id)} style={{ display: 'grid', gridTemplateColumns: grid, height: 36, alignItems: 'center', borderBottom: `1px solid ${colors.borderSubtle}`, background: focused ? '#F4F2EF' : 'transparent', cursor: 'pointer' }}>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: 500, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_name || '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, textAlign: 'right', fontFamily: typography.fontFamily, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: colors.textSecondary }}>{c.size ?? 0}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.trade || '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.current_task || ''}>{c.current_task || '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, textAlign: 'right', fontFamily: typography.fontFamily, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: hours > 0 ? colors.textSecondary : colors.textTertiary }}>{hours > 0 ? `${hours.toFixed(1)}h` : '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}` }}><CrewStatusChip status={c.status} /></div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Detail panel (slide-over) ──────────────────────────────────

interface CrewDetailPanelProps {
  crew: CrewRow | null;
  crewSchedules: Array<{ id: string; phase_id: string | null; phase_name?: string | null; start_date: string; end_date: string; headcount: number }>;
  phasesForAssignment: Array<{ id: string; name: string }>;
  hoursWeek: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignPhase: (phaseId: string | null, headcount: number, start: string, end: string) => Promise<void>;
  onRemoveAssignment: (id: string) => Promise<void>;
}

function CrewDetailPanel({
  crew,
  crewSchedules,
  phasesForAssignment,
  hoursWeek,
  onClose,
  onEdit,
  onDelete,
  onAssignPhase,
  onRemoveAssignment,
}: CrewDetailPanelProps) {
  const [phaseId, setPhaseId] = useState('');
  const [headcount, setHeadcount] = useState('4');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });

  if (!crew) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hc = Number(headcount);
    if (!Number.isFinite(hc) || hc < 0) {
      toast.error('Invalid headcount');
      return;
    }
    if (end < start) {
      toast.error('End must be ≥ start');
      return;
    }
    await onAssignPhase(phaseId || null, hc, start, end);
    setPhaseId('');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: colors.surfaceRaised,
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 2,
    display: 'block',
  };

  return (
    <div role="dialog" aria-label={`${crew.name} detail`} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <aside style={{ position: 'relative', width: 420, maxWidth: '92vw', height: '100%', background: colors.surfaceRaised, borderLeft: `1px solid ${colors.borderSubtle}`, boxShadow: '-8px 0 32px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: `${spacing[5]} ${spacing[5]} ${spacing[3]}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crew.name}</h2>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary, fontFamily: typography.fontFamily }}>
                {crew.trade ?? '—'} · {crew.size ?? 0} members · {hoursWeek > 0 ? `${hoursWeek.toFixed(1)}h this week` : 'No hours logged this week'}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ marginTop: spacing[3], display: 'flex', gap: spacing[2] }}>
            <PermissionGate permission="crews.manage">
              <button type="button" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: 4, color: colors.textSecondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: typography.fontFamily }}>
                <Pencil size={12} aria-hidden="true" />
                Edit
              </button>
              <button type="button" onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: 4, color: colors.statusCritical, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: typography.fontFamily }}>
                <Trash2 size={12} aria-hidden="true" />
                Delete
              </button>
            </PermissionGate>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: spacing[5] }}>
          <section>
            <h3 style={{ margin: 0, marginBottom: spacing[2], fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>Phase assignments</h3>
            {crewSchedules.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textTertiary, padding: spacing[2] }}>No phases assigned.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {crewSchedules.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], padding: `${spacing[2]} ${spacing[3]}`, background: '#FCFCFA', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.phase_name ?? phasesForAssignment.find((p) => p.id === s.phase_id)?.name ?? '(unassigned)'}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                        {s.start_date} → {s.end_date} · {s.headcount} headcount
                      </div>
                    </div>
                    <button type="button" onClick={() => onRemoveAssignment(s.id)} aria-label="Remove assignment" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PermissionGate permission="crews.manage">
            <section style={{ marginTop: spacing[5] }}>
              <h3 style={{ margin: 0, marginBottom: spacing[2], fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>Assign to phase</h3>
              <form onSubmit={submit} style={{ display: 'grid', gap: spacing[3] }}>
                <div>
                  <label style={labelStyle}>Phase</label>
                  <select style={inputStyle} value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {phasesForAssignment.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: spacing[2] }}>
                  <div>
                    <label style={labelStyle}>Start</label>
                    <input style={inputStyle} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>End</label>
                    <input style={inputStyle} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>HC</label>
                    <input style={inputStyle} type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
                  </div>
                </div>
                <button type="submit" style={{ padding: '6px 12px', background: colors.ink, border: 'none', borderRadius: 6, color: colors.parchment, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: typography.fontFamily, justifySelf: 'start' }}>Assign</button>
              </form>
            </section>
          </PermissionGate>
        </div>
      </aside>
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────

interface EditCrewModalProps {
  open: boolean;
  form: { name: string; trade: string; size: string; status: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; trade: string; size: string; status: string }>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

function EditCrewModal({ open, form, setForm, onClose, onSave, saving }: EditCrewModalProps) {
  if (!open) return null;
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: colors.surfaceRaised,
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 4,
    display: 'block',
  };
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.40)' }}>
      <div style={{ width: 460, maxWidth: '92vw', background: colors.surfaceRaised, borderRadius: 8, padding: spacing[6], boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Edit Crew</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: spacing[3] }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
            <div>
              <label style={labelStyle}>Trade</label>
              <input style={inputStyle} value={form.trade} onChange={(e) => setForm((p) => ({ ...p, trade: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Size</label>
              <input style={inputStyle} type="number" value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="standby">Standby</option>
              <option value="off_site">Off Site</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[5] }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: 6, fontSize: 13, fontWeight: 500, color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily }}>Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} style={{ padding: '8px 14px', background: colors.primaryOrange, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: typography.fontFamily }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const CrewsPage: React.FC = () => (
  <ErrorBoundary>
    <Crews />
  </ErrorBoundary>
);

export default CrewsPage;
