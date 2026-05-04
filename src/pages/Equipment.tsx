/**
 * Equipment — refined per DESIGN-RESET.md.
 *
 * Sticky header with filter chips (All / On Site / In Yard / Down). Dense
 * table: Type / ID / Status / Location / Operator / Hours today / Hours total
 * / Maintenance due. Side panel for edit + delete + maintenance read-out.
 * Add / edit / delete flows preserved.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Pencil, Trash2, Wrench } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ProjectGate } from '../components/ProjectGate';
import { PermissionGate } from '../components/auth/PermissionGate';
import { useConfirm } from '../components/ConfirmDialog';
import { colors, spacing, typography } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';

import { fromTable } from '../lib/db/queries'
import { useEntityStore, useEntityActions } from '../stores/entityStore';
import type { Equipment } from '../services/equipmentService';
import { useEquipmentMaintenance } from '../hooks/queries/equipment';
import { useMeterReadingsByProject } from '../hooks/queries/meter-readings';

// ── Types ──────────────────────────────────────────────────────

type FilterKey = 'all' | 'on_site' | 'in_yard' | 'down';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'on_site', label: 'On Site' },
  { key: 'in_yard', label: 'In Yard' },
  { key: 'down', label: 'Down' },
];

// ── Helpers ────────────────────────────────────────────────────

function statusBucket(eq: Equipment): FilterKey | 'other' {
  const s = (eq.status ?? '').toLowerCase();
  if (s === 'maintenance') return 'down';
  if (s === 'idle') return 'in_yard';
  if (s === 'active' || s === 'transit') return 'on_site';
  return 'other';
}

function StatusChip({ status }: { status: string | null }) {
  const key = (status ?? 'idle').toLowerCase();
  const tokens = key === 'maintenance'
    ? { fg: '#9A2929', bg: '#FCE7E7', label: 'Maintenance' }
    : key === 'active'
      ? { fg: '#1F6F4F', bg: '#E5F2EC', label: 'Active' }
      : key === 'transit'
        ? { fg: '#3A5BC8', bg: '#E6EBFA', label: 'In transit' }
        : key === 'off_site'
          ? { fg: '#5C5550', bg: '#F1ECE2', label: 'Off site' }
          : key === 'retired'
            ? { fg: '#3F4754', bg: '#EEF0F4', label: 'Retired' }
            : { fg: '#7A5C12', bg: '#FCF2DE', label: 'Idle' };
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

function maintenanceColor(dueIso: string | null): string {
  if (!dueIso) return colors.textTertiary;
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return colors.textTertiary;
  const days = Math.floor((due - Date.now()) / 86_400_000);
  if (days < 0) return colors.statusCritical;
  if (days <= 14) return '#7A5C12';
  return colors.textSecondary;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ── Page ───────────────────────────────────────────────────────

export const EquipmentPage: React.FC = () => {
  const projectId = useProjectId();
  // ─── Migrated from equipmentStore to entityStore on Day 9 ─────────────
  const { items: equipment, loading, error } = useEntityStore<Equipment>('equipment');
  const { loadItems: loadEquipment } = useEntityActions<Equipment>('equipment');

  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    serial_number: '',
    status: 'idle',
    make: '',
    model: '',
    current_location: '',
  });

  useEffect(() => {
    if (projectId) loadEquipment(projectId);
  }, [projectId, loadEquipment]);

  const { data: maintenance = [] } = useEquipmentMaintenance(projectId);
  const { data: meterReadings = [] } = useMeterReadingsByProject(projectId);

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      // Cast through unknown — Supabase generated types lag the actual schema
      // shape this page expects; runtime is correct, RLS gates the boundary.
      const { data, error: updErr } = await (fromTable('equipment') as unknown as {
        update: (u: Record<string, unknown>) => {
          eq: (col: string, v: string) => {
            select: () => { single: () => Promise<{ data: unknown; error: Error | null }> }
          }
        }
      }).update(updates as never).eq('id' as never, id).select().single();
      if (updErr) throw updErr;
      return data;
    },
    onSuccess: () => {
      toast.success('Equipment updated');
      setEditing(null);
      if (projectId) loadEquipment(projectId);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update equipment'),
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: delErr } = await (fromTable('equipment') as unknown as {
        delete: () => { eq: (col: string, v: string) => Promise<{ error: Error | null }> }
      }).delete().eq('id' as never, id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      toast.success('Equipment deleted');
      setSelectedId(null);
      if (projectId) loadEquipment(projectId);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete equipment'),
  });

  const { confirm: confirmDelete, dialog: deleteDialog } = useConfirm();

  const handleDelete = async (eq: Equipment) => {
    const ok = await confirmDelete({
      title: 'Delete equipment?',
      description: `"${eq.name}" — maintenance history and meter readings will remain as orphaned records for audit.`,
      destructiveLabel: 'Delete equipment',
    });
    if (!ok) return;
    deleteEquipmentMutation.mutate(eq.id);
  };

  const openEdit = (eq: Equipment) => {
    setEditForm({
      name: eq.name ?? '',
      type: eq.type ?? '',
      serial_number: eq.serial_number ?? '',
      status: eq.status ?? 'idle',
      make: eq.make ?? '',
      model: eq.model ?? '',
      current_location: eq.current_location ?? '',
    });
    setEditing(eq);
  };

  const handleEditSave = () => {
    if (!editing) return;
    updateEquipmentMutation.mutate({
      id: editing.id,
      updates: {
        name: editForm.name || null,
        type: editForm.type || null,
        serial_number: editForm.serial_number || null,
        status: editForm.status,
        make: editForm.make || null,
        model: editForm.model || null,
        current_location: editForm.current_location || null,
      },
    });
  };

  // ── Hours today derivation: latest meter reading today minus the latest before today ──
  const hoursTodayByEquipment = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    interface MeterRowShape {
      equipment_id?: string;
      reading_value?: number | null;
      meter_name?: string | null;
      reading_date?: string | null;
      created_at?: string | null;
    }
    const byEq = new Map<string, MeterRowShape[]>();
    for (const m of meterReadings as MeterRowShape[]) {
      if ((m.meter_name ?? 'hours') !== 'hours') continue;
      const id = m.equipment_id;
      if (!id) continue;
      const list = byEq.get(id) ?? [];
      list.push(m);
      byEq.set(id, list);
    }
    const out = new Map<string, number>();
    for (const [id, rows] of byEq) {
      rows.sort((a, b) => {
        const aTs = (a.reading_date ?? a.created_at ?? '');
        const bTs = (b.reading_date ?? b.created_at ?? '');
        return aTs.localeCompare(bTs);
      });
      let lastBeforeToday: number | null = null;
      let latestToday: number | null = null;
      for (const r of rows) {
        const ts = (r.reading_date ?? r.created_at ?? '').slice(0, 10);
        const v = Number(r.reading_value ?? 0);
        if (!Number.isFinite(v)) continue;
        if (ts < todayIso) lastBeforeToday = v;
        else if (ts === todayIso) latestToday = v;
      }
      if (latestToday != null && lastBeforeToday != null) {
        out.set(id, Math.max(0, latestToday - lastBeforeToday));
      } else if (latestToday != null && lastBeforeToday == null) {
        out.set(id, 0);
      }
    }
    return out;
  }, [meterReadings]);

  // ── Maintenance due lookup ──
  const nextMaintenanceByEquipment = useMemo(() => {
    interface MaintShape { equipment_id?: string; scheduled_date?: string | null; status?: string | null; description?: string | null }
    const out = new Map<string, MaintShape>();
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const m of maintenance as MaintShape[]) {
      if ((m.status ?? '').toLowerCase() === 'completed') continue;
      const id = m.equipment_id;
      if (!id) continue;
      const sched = m.scheduled_date ?? '';
      if (sched < todayIso && (m.status ?? '').toLowerCase() !== 'in_progress') {
        // overdue still surfaces
      }
      const existing = out.get(id);
      if (!existing || (sched && (existing.scheduled_date ?? '') > sched)) {
        out.set(id, m);
      }
    }
    return out;
  }, [maintenance]);

  // ── Filtered list ──
  const filtered = useMemo<Equipment[]>(() => {
    const all = (equipment as Equipment[]) ?? [];
    if (filter === 'all') return all;
    return all.filter((eq) => statusBucket(eq) === filter);
  }, [equipment, filter]);

  const counts = useMemo(() => {
    const all = (equipment as Equipment[]) ?? [];
    const by = { all: all.length, on_site: 0, in_yard: 0, down: 0 };
    for (const eq of all) {
      const b = statusBucket(eq);
      if (b === 'on_site') by.on_site += 1;
      if (b === 'in_yard') by.in_yard += 1;
      if (b === 'down') by.down += 1;
    }
    return by;
  }, [equipment]);

  const selectedEquipment = (equipment as Equipment[]).find((e) => e.id === selectedId) ?? null;

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
          paddingBottom: spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4], flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textPrimary, letterSpacing: '-0.01em' }}>Equipment</h1>
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
            <span style={{ fontWeight: 600, color: colors.textPrimary }}>{counts.all}</span>
            total
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: '#1F6F4F' }}>{counts.on_site}</span> on site
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: '#9A2929' }}>{counts.down}</span> down
          </span>

          <div style={{ flex: 1 }} />

          <PermissionGate
            permission="procurement.view"
            fallback={
              <button
                type="button"
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: colors.surfaceInset,
                  border: 'none',
                  borderRadius: 6,
                  color: colors.textTertiary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                }}
              >
                <Plus size={14} aria-hidden="true" />
                Add Equipment
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setShowAdd(true)}
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
              Add Equipment
            </button>
          </PermissionGate>
        </div>

        {/* Filter chips */}
        <div role="tablist" aria-label="Equipment filters" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === 'all' ? counts.all : f.key === 'on_site' ? counts.on_site : f.key === 'in_yard' ? counts.in_yard : counts.down;
            return (
              <button
                key={f.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: active ? colors.textPrimary : 'transparent',
                  color: active ? '#FFFFFF' : colors.textSecondary,
                  border: active ? 'none' : `1px solid ${colors.borderSubtle}`,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
                <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ paddingLeft: spacing[6], paddingRight: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[8] }}>
        {error && (
          <div role="alert" style={{ padding: spacing[3], marginBottom: spacing[4], background: '#FCE7E7', border: '1px solid rgba(201,59,59,0.20)', borderRadius: 6, color: '#9A2929', fontSize: 13 }}>
            Failed to load equipment: {String(error)}
          </div>
        )}

        {loading && filtered.length === 0 ? (
          <div role="status" style={{ padding: spacing[8], textAlign: 'center', color: colors.textTertiary, fontSize: 13 }}>Loading equipment…</div>
        ) : (
          <EquipmentTable
            rows={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hoursToday={hoursTodayByEquipment}
            nextMaintenance={nextMaintenanceByEquipment}
          />
        )}
      </main>

      <EquipmentDetailPanel
        equipment={selectedEquipment}
        nextMaintenance={selectedEquipment ? nextMaintenanceByEquipment.get(selectedEquipment.id) ?? null : null}
        hoursToday={selectedEquipment ? hoursTodayByEquipment.get(selectedEquipment.id) ?? null : null}
        onClose={() => setSelectedId(null)}
        onEdit={() => selectedEquipment && openEdit(selectedEquipment)}
        onDelete={() => selectedEquipment && handleDelete(selectedEquipment)}
      />

      {showAdd && (
        <AddEquipmentModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onCreated={() => loadEquipment(projectId)}
        />
      )}

      {editing && (
        <EditEquipmentModal
          form={editForm}
          setForm={setEditForm}
          onClose={() => setEditing(null)}
          onSave={handleEditSave}
          saving={updateEquipmentMutation.isPending}
        />
      )}

      {deleteDialog}
    </div>
  );
};

// ── Dense equipment table ──────────────────────────────────────

interface TableProps {
  rows: Equipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hoursToday: Map<string, number>;
  nextMaintenance: Map<string, { scheduled_date?: string | null; description?: string | null; status?: string | null }>;
}

function EquipmentTable({ rows, selectedId, onSelect, hoursToday, nextMaintenance }: TableProps) {
  const grid = '120px minmax(140px, 1.5fr) 130px minmax(150px, 1.5fr) minmax(120px, 1fr) 100px 100px 130px';
  const headers = ['Type', 'ID', 'Status', 'Location', 'Operator', 'Hours today', 'Hours total', 'Maintenance due'];
  const aligns: Array<'left' | 'right'> = ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'left'];

  return (
    <div role="grid" aria-label="Equipment" style={{ background: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`, borderRadius: 6, overflow: 'hidden' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, height: 36, alignItems: 'center', background: '#FCFCFA', borderBottom: `1px solid ${colors.borderSubtle}`, position: 'sticky', top: 0, zIndex: 1 }}>
        {headers.map((h, i) => (
          <div key={h} role="columnheader" style={{ padding: `0 ${spacing[3]}`, textAlign: aligns[i], fontFamily: typography.fontFamily, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>
            {h}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: spacing[6], textAlign: 'center', color: colors.textTertiary, fontFamily: typography.fontFamily, fontSize: 13 }}>No equipment matches this filter.</div>
      ) : (
        rows.map((eq) => {
          const focused = selectedId === eq.id;
          const ht = hoursToday.get(eq.id);
          const m = nextMaintenance.get(eq.id);
          return (
            <div key={eq.id} role="row" data-equipment-id={eq.id} onClick={() => onSelect(eq.id)} style={{ display: 'grid', gridTemplateColumns: grid, height: 36, alignItems: 'center', borderBottom: `1px solid ${colors.borderSubtle}`, background: focused ? '#F4F2EF' : 'transparent', cursor: 'pointer' }}>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.type ?? '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: 500, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={eq.name}>{eq.name}</div>
              <div style={{ padding: `0 ${spacing[3]}` }}><StatusChip status={eq.status} /></div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.current_location || '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.assigned_to || '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, textAlign: 'right', fontFamily: typography.fontFamily, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: ht && ht > 0 ? colors.textSecondary : colors.textTertiary }}>{ht != null ? `${ht.toFixed(1)}h` : '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, textAlign: 'right', fontFamily: typography.fontFamily, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: colors.textSecondary }}>{eq.hours_meter != null ? `${Number(eq.hours_meter).toFixed(0)}h` : '—'}</div>
              <div style={{ padding: `0 ${spacing[3]}`, fontFamily: typography.fontFamily, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: maintenanceColor(m?.scheduled_date ?? null), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatShortDate(m?.scheduled_date ?? null)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────

interface DetailPanelProps {
  equipment: Equipment | null;
  nextMaintenance: { scheduled_date?: string | null; description?: string | null; status?: string | null } | null;
  hoursToday: number | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EquipmentDetailPanel({ equipment, nextMaintenance, hoursToday, onClose, onEdit, onDelete }: DetailPanelProps) {
  if (!equipment) return null;
  return (
    <div role="dialog" aria-label={`${equipment.name} detail`} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <aside style={{ position: 'relative', width: 420, maxWidth: '92vw', height: '100%', background: colors.surfaceRaised, borderLeft: `1px solid ${colors.borderSubtle}`, boxShadow: '-8px 0 32px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: `${spacing[5]} ${spacing[5]} ${spacing[3]}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 4 }}>{equipment.type ?? 'Equipment'}</div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{equipment.name}</h2>
              <div style={{ marginTop: spacing[2] }}><StatusChip status={equipment.status} /></div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ marginTop: spacing[3], display: 'flex', gap: spacing[2] }}>
            <PermissionGate permission="procurement.view">
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
          <DetailRow label="Make / Model" value={[equipment.make, equipment.model].filter(Boolean).join(' ') || '—'} />
          <DetailRow label="Serial" value={equipment.serial_number ?? '—'} mono />
          <DetailRow label="Location" value={equipment.current_location ?? '—'} />
          <DetailRow label="Operator" value={equipment.assigned_to ?? '—'} mono />
          <DetailRow label="Hours today" value={hoursToday != null ? `${hoursToday.toFixed(1)}h` : '—'} num />
          <DetailRow label="Hours total" value={equipment.hours_meter != null ? `${Number(equipment.hours_meter).toFixed(0)}h` : '—'} num />
          <DetailRow label="Last service" value={formatShortDate(equipment.last_service_date)} />
          <DetailRow label="Next service" value={formatShortDate(equipment.next_service_due)} />

          {nextMaintenance && (
            <div style={{ marginTop: spacing[5], padding: spacing[3], background: '#FCFCFA', border: `1px solid ${colors.borderSubtle}`, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: spacing[2], fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>
                <Wrench size={11} aria-hidden="true" />
                Upcoming maintenance
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>
                {nextMaintenance.description ?? 'Service due'}
              </div>
              <div style={{ fontSize: 12, color: maintenanceColor(nextMaintenance.scheduled_date ?? null), fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                {formatShortDate(nextMaintenance.scheduled_date ?? null)} · {(nextMaintenance.status ?? 'scheduled').replace(/_/g, ' ')}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value, mono = false, num = false }: { label: string; value: string; mono?: boolean; num?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], padding: `${spacing[2]} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
      <span style={{ fontFamily: typography.fontFamily, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textTertiary }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? typography.fontFamilyMono : typography.fontFamily,
          fontSize: 13,
          color: colors.textPrimary,
          fontVariantNumeric: num ? 'tabular-nums' : undefined,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 240,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Add / Edit modals ─────────────────────────────────────────

interface AddEquipmentModalProps { projectId: string; onClose: () => void; onCreated: () => void }
function AddEquipmentModal({ projectId, onClose, onCreated }: AddEquipmentModalProps) {
  const [form, setForm] = useState({ name: '', type: '', serial_number: '', status: 'idle' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr('Name required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { error } = await (fromTable('equipment') as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: Error | null }>
      }).insert({
        project_id: projectId,
        name: form.name,
        type: form.type || null,
        serial_number: form.serial_number || null,
        status: form.status,
      });
      if (error) throw error;
      toast.success('Equipment added');
      onCreated();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };
  return <FormModal title="Add Equipment" form={form} setForm={setForm as React.Dispatch<React.SetStateAction<{ name: string; type: string; serial_number: string; status: string }>>} err={err} saving={saving} onClose={onClose} onSubmit={submit} submitLabel="Add" />;
}

interface EditEquipmentModalProps {
  form: { name: string; type: string; serial_number: string; status: string; make?: string; model?: string; current_location?: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; type: string; serial_number: string; status: string; make: string; model: string; current_location: string }>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}
function EditEquipmentModal({ form, setForm, onClose, onSave, saving }: EditEquipmentModalProps) {
  return (
    <FormModal
      title="Edit Equipment"
      form={form}
      setForm={setForm as unknown as React.Dispatch<React.SetStateAction<{ name: string; type: string; serial_number: string; status: string }>>}
      err={null}
      saving={saving}
      onClose={onClose}
      onSubmit={(e) => { e.preventDefault(); onSave(); }}
      submitLabel="Save"
      extraFields
    />
  );
}

interface FormModalProps {
  title: string;
  form: { name: string; type: string; serial_number: string; status: string; make?: string; model?: string; current_location?: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; type: string; serial_number: string; status: string }>>;
  err: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  extraFields?: boolean;
}

function FormModal({ title, form, setForm, err, saving, onClose, onSubmit, submitLabel, extraFields }: FormModalProps) {
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
      <form onSubmit={onSubmit} style={{ width: 480, maxWidth: '92vw', background: colors.surfaceRaised, borderRadius: 8, padding: spacing[6], boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>{title}</h2>
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
              <label style={labelStyle}>Type</label>
              <input style={inputStyle} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} placeholder="crane, excavator" />
            </div>
            <div>
              <label style={labelStyle}>Serial</label>
              <input style={inputStyle} value={form.serial_number} onChange={(e) => setForm((p) => ({ ...p, serial_number: e.target.value }))} />
            </div>
          </div>
          {extraFields && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
                <div>
                  <label style={labelStyle}>Make</label>
                  <input style={inputStyle} value={form.make ?? ''} onChange={(e) => setForm((p) => ({ ...p, make: e.target.value } as typeof p))} />
                </div>
                <div>
                  <label style={labelStyle}>Model</label>
                  <input style={inputStyle} value={form.model ?? ''} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value } as typeof p))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={form.current_location ?? ''} onChange={(e) => setForm((p) => ({ ...p, current_location: e.target.value } as typeof p))} />
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="idle">Idle</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="transit">In transit</option>
              <option value="off_site">Off site</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[5] }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: 6, fontSize: 13, fontWeight: 500, color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 14px', background: colors.primaryOrange, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: typography.fontFamily }}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

const Equipment: React.FC = () => (
  <ErrorBoundary>
    <EquipmentPage />
  </ErrorBoundary>
);

export default Equipment;
