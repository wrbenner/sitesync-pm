import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, MapPin, Award, AlertTriangle, RefreshCw, Users, Plus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { PageContainer, Card, Btn, ProgressBar, Skeleton, SectionHeader, EmptyState, Modal, InputField } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useCrewStore } from '../stores/crewStore';
import { useProjectContext } from '../stores/projectContextStore';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useDeleteCrew } from '../hooks/mutations';

interface AddCrewModalProps { onClose: () => void; projectId: string; onCreated: () => void }
const AddCrewModal: React.FC<AddCrewModalProps> = ({ onClose, projectId, onCreated }) => {
  const [form, setForm] = useState({ name: '', trade: '', size: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!form.name.trim()) { setErr('Name required'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('crews').insert({
        project_id: projectId,
        name: form.name,
        trade: form.trade || null,
        lead_id: null,
        size: form.size ? parseInt(form.size, 10) : 0,
        status: 'active',
      });
      if (error) throw error;
      toast.success('Crew added');
      onCreated(); onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  };
  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: spacing.md, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.xl, width: '100%', maxWidth: 480 }}>
        <h2 style={{ margin: 0, marginBottom: spacing.lg, fontSize: 18 }}>Add Crew</h2>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Name *</label>
        <input style={input} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Trade</label>
        <input style={input} value={form.trade} onChange={(e) => setForm(p => ({ ...p, trade: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Size</label>
        <input style={input} type="number" value={form.size} onChange={(e) => setForm(p => ({ ...p, size: e.target.value }))} />
        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Add Crew'}</Btn>
        </div>
      </div>
    </div>
  );
};

// Rotating palette for crew dot colors on map
const CREW_COLOR_PALETTE = [
  colors.statusInfo,
  colors.statusActive,
  colors.statusPending,
  colors.statusReview,
  colors.primaryOrange,
  colors.statusNeutral,
];

export const Crews: React.FC = () => {
  const { crews, loading, error: crewError, loadCrews } = useCrewStore();
  const { activeProject } = useProjectContext();
  const deleteCrew = useDeleteCrew();

  const handleDeleteCrew = async (crew: { id: string; name: string }) => {
    if (!activeProject?.id) return;
    if (!window.confirm(`Delete crew "${crew.name}"? This cannot be undone.`)) return;
    try {
      await deleteCrew.mutateAsync({ id: crew.id, projectId: activeProject.id });
      toast.success('Crew deleted');
      loadCrews(activeProject.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete crew');
    }
  };
  const [activeTab, setActiveTab] = useState<'map' | 'cards' | 'performance'>('cards');
  const [hoveredCrew, setHoveredCrew] = useState<string | null>(null);
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [editingCrew, setEditingCrew] = useState<any | null>(null);
  const [editCrewForm, setEditCrewForm] = useState({ name: '', trade: '', size: '', lead_name: '', status: 'active' });

  const updateCrewMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('crews').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Crew updated');
      setEditingCrew(null);
      if (activeProject?.id) loadCrews(activeProject.id);
    },
    onError: (err: Error) => { toast.error(err.message || 'Failed to update crew'); },
  });

  const openEditCrew = (crew: any) => {
    setEditCrewForm({
      name: crew.name ?? '',
      trade: crew.trade ?? '',
      size: String(crew.size ?? ''),
      lead_name: crew.lead_name ?? '',
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

  useEffect(() => {
    // REACT-04 FIX: include loadCrews in deps.
    if (activeProject?.id) {
      loadCrews(activeProject.id);
    }
  }, [activeProject?.id, loadCrews]);

  // Derive color per crew from palette
  const getCrewColor = useMemo(() => {
    const map = new Map<string, string>();
    crews.forEach((c, i) => map.set(c.id, CREW_COLOR_PALETTE[i % CREW_COLOR_PALETTE.length]));
    return (id: string) => map.get(id) || colors.statusNeutral;
  }, [crews]);

  // Placeholder layout (circle). No real GPS yet — positions are cosmetic.
  const initialPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    crews.forEach((c, i) => {
      const angle = (i / Math.max(crews.length, 1)) * 2 * Math.PI;
      pos[c.id] = { x: 50 + 30 * Math.cos(angle), y: 50 + 30 * Math.sin(angle) };
    });
    return pos;
  }, [crews]);

  const [dotPositions, setDotPositions] = useState(initialPositions);

  // Sync positions when crews change
  useEffect(() => {
    setDotPositions(initialPositions);
  }, [initialPositions]);

  // Subscribe to crew_locations changes for live GPS updates.
  useEffect(() => {
    const pid = activeProject?.id;
    if (!pid) return;
    const channel = supabase
      .channel(`crew-locations-${pid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_locations', filter: `project_id=eq.${pid}` },
        () => {
          loadCrews(pid);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject?.id, loadCrews]);

  if (loading) {
    return (
      <PageContainer title="Crews" subtitle="Loading crews...">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="60%" height="18px" />
              <div style={{ marginTop: spacing.sm }}><Skeleton width="80%" height="14px" /></div>
              <div style={{ marginTop: spacing.lg }}><Skeleton width="100%" height="8px" /></div>
              <div style={{ marginTop: spacing.md }}><Skeleton width="40%" height="14px" /></div>
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (crewError) {
    return (
      <PageContainer title="Crews" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load crews</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{crewError}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => activeProject?.id && loadCrews(activeProject.id)}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (crews.length === 0) {
    return (
      <PageContainer title="Crews" subtitle="No crews">
        <EmptyState
          icon={<Users size={40} color={colors.textTertiary} />}
          title="No crews yet"
          description="Add crews to track workforce, productivity, and certifications across the project."
          actionLabel="Add Crew"
          onAction={() => setShowAddCrew(true)}
        />
        {showAddCrew && activeProject?.id && (
          <AddCrewModal projectId={activeProject.id} onClose={() => setShowAddCrew(false)} onCreated={() => activeProject?.id && loadCrews(activeProject.id)} />
        )}
      </PageContainer>
    );
  }

  const pageAlerts = getPredictiveAlertsForPage('crews');

  const activeCrews = crews.filter((c) => c.status === 'active');
  const totalWorkers = crews.reduce((sum, c) => sum + c.size, 0);

  const getProductivityColor = (p: number) => {
    if (p >= 90) return colors.statusActive;
    if (p >= 75) return colors.statusInfo;
    return colors.primaryOrange;
  };

  const tabs: { key: 'cards' | 'map' | 'performance'; label: string; icon: React.ReactNode }[] = [
    { key: 'cards', label: 'Cards', icon: null },
    { key: 'map', label: 'Map', icon: <MapPin size={14} /> },
    { key: 'performance', label: 'Performance', icon: <BarChart3 size={14} /> },
  ];

  const sortedByProductivity = [...crews].sort((a, b) => b.productivity - a.productivity);

  return (
    <PageContainer
      title="Crews"
      subtitle={`${activeCrews.length} active crews \u00B7 ${totalWorkers} workers on site`}
      actions={<PermissionGate permission="crews.manage" fallback={<span title="Your role doesn't allow adding crews. Request access from your admin."><Btn variant="primary" icon={<Plus size={14} />} disabled>Add Crew</Btn></span>}><Btn variant="primary" icon={<Plus size={14} />} onClick={() => setShowAddCrew(true)} data-testid="create-crew-button">Add Crew</Btn></PermissionGate>}
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {/* Tab Toggle */}
      <div
        style={{
          display: 'inline-flex',
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
          padding: '3px',
          marginBottom: spacing.xl,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              padding: `${spacing.md} ${spacing.lg}`,
              borderRadius: borderRadius.full,
              border: 'none',
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              fontWeight: activeTab === tab.key ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary,
              backgroundColor: activeTab === tab.key ? colors.surfaceRaised : 'transparent',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: transitions.quick,
              minHeight: '56px',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Map View ─── */}
      {activeTab === 'map' && (
        <Card padding={spacing.xl}>
          <SectionHeader title="Live Site Map" action={
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusActive, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{totalWorkers}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>on site</span>
            </span>
          } />
          <div
            style={{
              position: 'relative',
              aspectRatio: '16 / 9',
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md,
              overflow: 'hidden',
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {/* Grid lines */}
            {[25, 50, 75].map((p) => (
              <React.Fragment key={p}>
                <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, backgroundColor: colors.borderSubtle, opacity: 0.5 }} />
                <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, backgroundColor: colors.borderSubtle, opacity: 0.5 }} />
              </React.Fragment>
            ))}

            {/* Building outline */}
            <div style={{ position: 'absolute', left: '15%', top: '10%', width: '70%', height: '80%', border: `1.5px dashed ${colors.borderDefault}`, borderRadius: borderRadius.sm }} />

            {/* Floor labels */}
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: '16%', top: `${12 + i * 5.8}%`,
                fontSize: '8px', color: colors.textTertiary, opacity: 0.5,
              }}>
                F{12 - i}
              </span>
            ))}

            {/* Crew dots */}
            {crews.map((crew) => {
              const pos = dotPositions[crew.id] || { x: 50, y: 50 };
              const dotColor = getCrewColor(crew.id);
              const isActive = crew.status === 'active';
              return (
                <div
                  key={crew.id}
                  onMouseEnter={() => setHoveredCrew(crew.id)}
                  onMouseLeave={() => setHoveredCrew(null)}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 2s ease-in-out, top 2s ease-in-out',
                    cursor: 'pointer',
                    zIndex: hoveredCrew === crew.id ? 10 : 1,
                  }}
                >
                  <div
                    style={{
                      width: isActive ? 14 : 10,
                      height: isActive ? 14 : 10,
                      borderRadius: '50%',
                      backgroundColor: dotColor,
                      border: `2px solid ${colors.surfaceRaised}`,
                      boxShadow: `0 0 0 ${isActive ? '3px' : '0'} ${dotColor}33`,
                      animation: isActive ? 'pulse 3s infinite' : 'none',
                    }}
                  />
                  {hoveredCrew === crew.id && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: 4,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        backgroundColor: colors.surfaceRaised,
                        borderRadius: borderRadius.sm,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        whiteSpace: 'nowrap',
                        fontSize: typography.fontSize.caption,
                        zIndex: 20,
                      }}
                    >
                      <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{crew.name}</div>
                      <div style={{ color: colors.textTertiary, marginTop: 1 }}>{crew.size} workers, {crew.task}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: spacing.lg,
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTop: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {crews.map((crew) => (
              <div key={crew.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getCrewColor(crew.id) }} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{crew.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Cards View ─── */}
      {activeTab === 'cards' && (
        <>
          {/* Productivity Legend */}
          <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'] }}>
            {[
              { color: colors.tealSuccess, label: 'Above target (90%+)' },
              { color: colors.amber, label: 'On target (75% to 89%)' },
              { color: colors.red, label: 'Below target' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: l.color }} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: spacing.lg,
            }}
          >
            {crews.map((crew) => {
              const isBehind = crew.eta.toLowerCase().includes('behind');
              return (
                <Card key={crew.id} padding={spacing.xl}>
                  <div style={{
                    opacity: crew.status === 'standby' ? 0.6 : 1,
                    borderLeft: isBehind ? `4px solid ${colors.chartRed}` : '4px solid transparent',
                    marginLeft: `-${spacing.xl}`,
                    paddingLeft: `calc(${spacing.xl} - 4px)`,
                  }}>
                    {/* Name and task */}
                    <div style={{ marginBottom: spacing.lg }}>
                      <p
                        style={{
                          fontSize: typography.fontSize.base,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                          margin: 0,
                          lineHeight: typography.lineHeight.tight,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        {crew.name}
                        {crew.status === 'standby' && (
                          <span style={{
                            fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.statusNeutral,
                            backgroundColor: colors.statusNeutralSubtle,
                            padding: '1px 6px',
                            borderRadius: borderRadius.full,
                          }}>
                            Standby
                          </span>
                        )}
                        {getAnnotationsForEntity('crew', crew.id).map((ann) => (
                          <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                        ))}
                      </p>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textTertiary,
                          margin: 0,
                          marginTop: '2px',
                        }}
                      >
                        {crew.task}
                      </p>
                    </div>

                    {/* Details row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: spacing.xl,
                        marginBottom: spacing.lg,
                        fontSize: typography.fontSize.sm,
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, color: colors.textTertiary, marginBottom: '2px' }}>Location</p>
                        <p style={{ margin: 0, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {crew.location}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, color: colors.textTertiary, marginBottom: '2px' }}>Size</p>
                        <p style={{ margin: 0, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {crew.size}
                        </p>
                      </div>
                    </div>

                    {/* Productivity */}
                    <div style={{ marginBottom: spacing.lg }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: spacing.sm,
                        }}
                      >
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                          Productivity
                        </span>
                        <span
                          style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.semibold,
                            color: getProductivityColor(crew.productivity),
                          }}
                        >
                          {crew.productivity}%
                        </span>
                      </div>
                      <ProgressBar
                        value={crew.productivity}
                        color={getProductivityColor(crew.productivity)}
                      />
                    </div>

                    {/* ETA */}
                    <p
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: isBehind ? colors.chartRed : colors.textSecondary,
                        fontWeight: typography.fontWeight.medium,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isBehind && <AlertTriangle size={12} color={colors.chartRed} style={{ marginRight: 4 }} />}
                      {crew.eta}
                    </p>

                    {/* Crew Task */}
                    {crew.task && crew.task !== 'Unassigned' && (
                      <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.borderLight}`, paddingTop: spacing.sm }}>
                        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, padding: `${spacing.xs} ${spacing.sm}` }}>
                          {crew.task}
                        </p>
                      </div>
                    )}

                    <PermissionGate permission="crews.manage">
                      <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'flex-end', gap: spacing['1'] }}>
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditCrew(crew)}
                        >
                          Edit
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCrew(crew)}
                          disabled={deleteCrew.isPending}
                          aria-label={`Delete crew ${crew.name}`}
                          data-testid="delete-crew-button"
                        >
                          {deleteCrew.isPending ? 'Deleting…' : 'Delete'}
                        </Btn>
                      </div>
                    </PermissionGate>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ─── Performance View ─── */}
      {activeTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          {/* Productivity Bar Chart */}
          <Card padding={spacing.xl}>
            <SectionHeader title="Crew Productivity" action={
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <BarChart3 size={14} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Sorted by output</span>
              </span>
            } />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {sortedByProductivity.map((crew) => {
                const barColor = getProductivityColor(crew.productivity);
                return (
                  <div key={crew.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
                    {/* Crew name */}
                    <div style={{ width: 140, flexShrink: 0 }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        {crew.name}
                      </span>
                    </div>
                    {/* Bar */}
                    <div style={{ flex: 1, position: 'relative', height: 28, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${crew.productivity}%`,
                          backgroundColor: barColor,
                          borderRadius: borderRadius.sm,
                          opacity: 0.85,
                          transition: transitions.smooth,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: `${crew.productivity}%`,
                          top: '50%',
                          transform: 'translate(8px, -50%)',
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          color: barColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {crew.productivity}%
                      </div>
                    </div>
                    {/* Worker count */}
                    <div style={{ width: 70, flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{crew.size} workers</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Certifications (placeholder for future certification tracking) */}
          <Card padding={spacing.xl}>
            <SectionHeader title="Certifications" action={
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <Award size={14} color={colors.textTertiary} />
              </span>
            } />
            <div style={{ padding: spacing.lg, textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Certification tracking will be available when crew certification data is configured.</p>
            </div>
          </Card>
        </div>
      )}
      {showAddCrew && activeProject?.id && (
        <AddCrewModal projectId={activeProject.id} onClose={() => setShowAddCrew(false)} onCreated={() => activeProject?.id && loadCrews(activeProject.id)} />
      )}

      <Modal open={!!editingCrew} onClose={() => setEditingCrew(null)} title="Edit Crew">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Name" value={editCrewForm.name} onChange={(v) => setEditCrewForm({ ...editCrewForm, name: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Trade" value={editCrewForm.trade} onChange={(v) => setEditCrewForm({ ...editCrewForm, trade: v })} />
            <InputField label="Size" value={editCrewForm.size} onChange={(v) => setEditCrewForm({ ...editCrewForm, size: v })} type="number" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Status</label>
            <select value={editCrewForm.status} onChange={(e) => setEditCrewForm({ ...editCrewForm, status: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
              <option value="active">Active</option>
              <option value="standby">Standby</option>
              <option value="off_site">Off Site</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEditingCrew(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditCrewSave} loading={updateCrewMutation.isPending}>{updateCrewMutation.isPending ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
