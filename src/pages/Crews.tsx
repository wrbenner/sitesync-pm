import React, { useState, useEffect } from 'react';
import { BarChart3, MapPin, Award, AlertTriangle } from 'lucide-react';
import { PageContainer, Card, ProgressBar, Skeleton, SectionHeader } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useCrewStore } from '../stores/crewStore';
import { useProjectContext } from '../stores/projectContextStore';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';

const crewColors: Record<string, string> = {
  'crew-1': colors.statusInfo,
  'crew-2': colors.statusActive,
  'crew-3': colors.statusPending,
  'crew-4': colors.statusReview,
  'crew-5': colors.primaryOrange,
  'crew-6': colors.statusNeutral,
};

const crewPositions: Record<string, { x: number; y: number }> = {
  'crew-1': { x: 72, y: 22 },
  'crew-2': { x: 35, y: 48 },
  'crew-3': { x: 55, y: 72 },
  'crew-4': { x: 88, y: 55 },
  'crew-5': { x: 25, y: 28 },
  'crew-6': { x: 48, y: 85 },
};

const certifications = [
  { crew: 'Steel Crew A', cert: 'Crane Operation', expires: '2025-06-15', status: 'current' },
  { crew: 'Steel Crew A', cert: 'Welding AWS D1.1', expires: '2025-04-20', status: 'expiring' },
  { crew: 'MEP Crew B', cert: 'HVAC EPA 608', expires: '2025-12-01', status: 'current' },
  { crew: 'Electrical Crew C', cert: 'Licensed Electrician', expires: '2026-01-15', status: 'current' },
  { crew: 'Exterior Crew D', cert: 'Fall Protection', expires: '2025-04-01', status: 'expiring' },
];

const crewTaskOverrides: Record<string, string[]> = {
  'crew-1': ['Level 9 concrete pour', 'Formwork Floor 10'],
  'crew-2': ['Ductwork installation floors 6 through 8', 'VAV box connections Floor 5'],
  'crew-3': ['Electrical rough in floors 3 through 5', 'Panel installation Floor 2'],
  'crew-4': ['Curtain wall installation floors 4 through 6'],
  'crew-5': ['Steel erection floors 9 through 10', 'Connections Floor 8'],
  'crew-6': ['Drywall taping Floor 2', 'Primer coat Lobby'],
};

const crewForemen: Record<string, string> = {
  'crew-1': 'Mike Torres',
  'crew-2': 'Sarah Chen',
  'crew-3': 'Ray Johnson',
  'crew-4': 'Carlos Mendez',
  'crew-5': 'Dave Williams',
  'crew-6': 'Lisa Park',
};

const crewCerts: Record<string, { label: string; color: string }[]> = {
  'crew-1': [{ label: 'OSHA 30', color: colors.statusActive }, { label: 'First Aid', color: colors.statusInfo }],
  'crew-2': [{ label: 'OSHA 30', color: colors.statusActive }],
  'crew-3': [{ label: 'OSHA 30', color: colors.statusActive }, { label: 'First Aid', color: colors.statusInfo }],
  'crew-4': [{ label: 'Training Due', color: colors.statusPending }],
  'crew-5': [{ label: 'OSHA 30', color: colors.statusActive }],
  'crew-6': [{ label: 'Training Due', color: colors.statusPending }],
};

export const Crews: React.FC = () => {
  const { crews, loading, loadCrews } = useCrewStore();
  const { activeProject } = useProjectContext();
  const [activeTab, setActiveTab] = useState<'map' | 'cards' | 'performance'>('cards');
  const [dotPositions, setDotPositions] = useState(crewPositions);
  const [hoveredCrew, setHoveredCrew] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject?.id) {
      loadCrews(activeProject.id);
    }
  }, [activeProject?.id]);

  // Simulated movement for map dots
  useEffect(() => {
    if (activeTab !== 'map') return;
    const interval = setInterval(() => {
      setDotPositions((prev) => {
        const next: Record<string, { x: number; y: number }> = {};
        for (const key of Object.keys(prev)) {
          next[key] = {
            x: Math.max(8, Math.min(92, prev[key].x + (Math.random() - 0.5) * 3)),
            y: Math.max(8, Math.min(92, prev[key].y + (Math.random() - 0.5) * 3)),
          };
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  if (loading || crews.length === 0) {
    return (
      <PageContainer title="Crews" subtitle="Loading crews...">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              padding: `${spacing.sm} ${spacing.lg}`,
              borderRadius: borderRadius.full,
              border: 'none',
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              fontWeight: activeTab === tab.key ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: activeTab === tab.key ? colors.textPrimary : colors.textTertiary,
              backgroundColor: activeTab === tab.key ? colors.surfaceRaised : 'transparent',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: transitions.quick,
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
              const dotColor = crewColors[crew.id] || colors.statusNeutral;
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
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: crewColors[crew.id] || colors.statusNeutral }} />
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
                    borderLeft: isBehind ? '4px solid #E05252' : '4px solid transparent',
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
                        color: isBehind ? '#E05252' : colors.textSecondary,
                        fontWeight: typography.fontWeight.medium,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isBehind && <AlertTriangle size={12} color="#E05252" style={{ marginRight: 4 }} />}
                      {crew.eta}
                    </p>

                    {/* Crew Tasks */}
                    {(crewTaskOverrides[crew.id] || []).length > 0 && (
                      <div style={{ marginTop: spacing.md, borderTop: `1px solid ${colors.borderLight}`, paddingTop: spacing.sm }}>
                        {(crewTaskOverrides[crew.id] || []).map((taskDesc) => (
                          <p
                            key={taskDesc}
                            style={{
                              fontSize: '13px',
                              color: colors.textSecondary,
                              margin: 0,
                              padding: `${spacing.xs} ${spacing.sm}`,
                            }}
                          >
                            {taskDesc}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Foreman */}
                    {crewForemen[crew.id] && (
                      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
                        Lead: {crewForemen[crew.id]}
                      </p>
                    )}

                    {/* Certification Badges */}
                    <div style={{ display: 'flex', gap: spacing['1'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
                      {(crewCerts[crew.id] || []).map(cert => (
                        <span key={cert.label} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: cert.color, backgroundColor: `${cert.color}12`, padding: '1px 6px', borderRadius: borderRadius.full }}>{cert.label}</span>
                      ))}
                    </div>
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

          {/* Certifications Table */}
          <Card padding={spacing.xl}>
            <SectionHeader title="Certifications" action={
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <Award size={14} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{certifications.filter(c => c.status === 'expiring').length} expiring soon</span>
              </span>
            } />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr>
                    {['Crew', 'Certification', 'Expires', 'Status'].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: 'left',
                          padding: `${spacing.sm} ${spacing.md}`,
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textTertiary,
                          textTransform: 'uppercase',
                          letterSpacing: typography.letterSpacing.wider,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((cert, i) => (
                    <tr
                      key={i}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = colors.surfaceHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {cert.crew}
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {cert.cert}
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {cert.expires}
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.md}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: spacing.xs,
                            padding: `2px ${spacing.sm}`,
                            borderRadius: borderRadius.full,
                            fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium,
                            color: cert.status === 'current' ? colors.statusActive : colors.statusPending,
                            backgroundColor: cert.status === 'current' ? colors.statusActiveSubtle : colors.statusPendingSubtle,
                          }}
                        >
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cert.status === 'current' ? colors.statusActive : colors.statusPending }} />
                          {cert.status === 'current' ? 'Current' : 'Expiring Soon'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
};
