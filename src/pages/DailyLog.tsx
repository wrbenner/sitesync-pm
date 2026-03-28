import React, { useState, useEffect } from 'react';
import { Users, Clock, ShieldCheck, Cloud, ChevronRight, Camera, Send, BarChart3, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, SectionHeader, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useDailyLogStore } from '../stores/dailyLogStore';
import { useProjectContext } from '../stores/projectContextStore';
import { AutoNarrative } from '../components/dailylog/AutoNarrative';
import { DayComparison } from '../components/dailylog/DayComparison';
import { SignaturePad } from '../components/dailylog/SignaturePad';

export const DailyLog: React.FC = () => {
  const { addToast } = useToast();
  const { logs, entries, loading, loadLogs, signAndSubmit } = useDailyLogStore();
  const { activeProject } = useProjectContext();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signed, setSigned] = useState(false);
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<'yesterday' | 'lastweek' | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject?.id) {
      loadLogs(activeProject.id);
    }
  }, [activeProject?.id, loadLogs]);

  if (loading || logs.length === 0) {
    return (
      <PageContainer title="Daily Log">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          <Card padding={spacing['5']}>
            <Skeleton width="240px" height="24px" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginTop: spacing['4'] }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="72px" />)}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const today = logs[0];
  const yesterday = logs[1];
  const lastWeek = logs[4];
  const previousDays = logs.slice(1);

  const todayDate = new Date(today.date + 'T12:00:00');
  const todayFormatted = todayDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Get manpower and equipment entries for today's log
  const todayManpower = entries.filter((e) => e.daily_log_id === today.id && e.entry_type === 'manpower');
  const todayEquipment = entries.filter((e) => e.daily_log_id === today.id && e.entry_type === 'equipment');
  const todayMetrics = [
    { icon: <Users size={16} style={{ color: colors.textTertiary }} />, label: 'Workers', value: today.workers.toString(), valueColor: colors.textPrimary },
    { icon: <Clock size={16} style={{ color: colors.textTertiary }} />, label: 'Hours', value: today.manHours.toLocaleString(), valueColor: colors.textPrimary },
    { icon: <ShieldCheck size={16} style={{ color: colors.textTertiary }} />, label: 'Incidents', value: today.incidents.toString(), valueColor: today.incidents === 0 ? colors.statusActive : colors.statusCritical },
    { icon: <Cloud size={16} style={{ color: colors.textTertiary }} />, label: 'Weather', value: today.weather, valueColor: colors.textPrimary },
  ];

  const todayPhotos = [
    { id: 1, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: 'Steel Connection' },
    { id: 2, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', label: 'Safety Gear' },
    { id: 3, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: 'Drywall Progress' },
    { id: 4, gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', label: 'MEP Routing' },
    { id: 5, gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: 'Curtain Wall' },
    { id: 6, gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', label: 'Concrete Check' },
  ];

  const manpowerColors: Record<string, string> = {
    Concrete: colors.statusInfo,
    Electrical: colors.statusPending,
    Mechanical: colors.statusActive,
    Steel: colors.primaryOrange,
    Plumbing: colors.statusReview,
    Carpentry: '#8B5E3C',
    'General Labor': colors.textTertiary,
  };

  const equipmentStatusColors: Record<string, string> = {
    Operating: colors.statusActive,
    Active: colors.statusActive,
    Standby: colors.statusPending,
  };

  return (
    <PageContainer title="Daily Log" subtitle={todayFormatted} actions={
      <div style={{ display: 'flex', gap: spacing['2'] }}>
        <div style={{ position: 'relative' }}>
          <Btn variant="secondary" size="sm" icon={<BarChart3 size={14} />} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}>
            Compare Days
          </Btn>
          {compareDropdownOpen && (
            <>
              <div onClick={() => setCompareDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 999, overflow: 'hidden', minWidth: '180px' }}>
                {[
                  { label: 'vs Yesterday', mode: 'yesterday' as const },
                  { label: 'vs Same Day Last Week', mode: 'lastweek' as const },
                ].map(opt => (
                  <button key={opt.mode} onClick={() => { setCompareMode(opt.mode); setShowComparison(true); setCompareDropdownOpen(false); }} style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, textAlign: 'left' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span title="Send daily report to project owner and architect">
          <Btn size="sm" icon={<Send size={14} />} onClick={() => setShowSignature(!showSignature)}>
            {signed ? 'Sent' : 'Approve & Send'}
          </Btn>
        </span>
      </div>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
          <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
            Productivity trending 8% above baseline this week. Concrete crew efficiency highest in project history.
          </p>
        </div>

        {/* Today's metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
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

        {/* Manpower by Trade */}
        <Card>
          <SectionHeader title="Manpower by Trade" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {todayManpower.length > 0 ? todayManpower.map((entry) => {
              const data = entry.data as { trade: string; count: number };
              const maxCount = Math.max(...todayManpower.map((e) => (e.data as { count: number }).count));
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: '100px' }}>{data.trade}</span>
                  <div style={{ flex: 1, height: 8, backgroundColor: colors.surfaceInset, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(data.count / maxCount) * 100}%`, height: '100%', backgroundColor: manpowerColors[data.trade] || colors.statusInfo, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: '24px', textAlign: 'right' }}>{data.count}</span>
                </div>
              );
            }) : (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No manpower entries recorded yet</p>
            )}
          </div>
        </Card>

        {/* Equipment on Site */}
        <Card>
          <SectionHeader title="Equipment on Site" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 100px', gap: 1 }}>
            {['Equipment', 'Qty', 'Location', 'Status'].map(h => (
              <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
            ))}
            {todayEquipment.length > 0 ? todayEquipment.map((entry) => {
              const data = entry.data as { name: string; qty: number; location: string; status: string };
              return (
                <React.Fragment key={entry.id}>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{data.name}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{data.qty}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{data.location}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: equipmentStatusColors[data.status] || colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{data.status}</span>
                </React.Fragment>
              );
            }) : (
              <span style={{ gridColumn: '1 / -1', padding: spacing['3'], fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No equipment entries recorded yet</span>
            )}
          </div>
        </Card>

        {/* AI Auto Narrative */}
        <AutoNarrative
          workers={today.workers}
          hours={today.manHours}
          incidents={today.incidents}
          weather={today.weather}
          summary={today.summary}
        />

        {/* Day Comparison */}
        {showComparison && yesterday && lastWeek && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <SectionHeader title={compareMode === 'lastweek' ? 'vs Same Day Last Week' : 'vs Yesterday'} />
              <button onClick={() => setShowComparison(false)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}>Close</button>
            </div>
            <DayComparison
              today={{ label: 'Today', workers: today.workers, hours: today.manHours, incidents: today.incidents }}
              yesterday={compareMode === 'lastweek' && lastWeek
                ? { label: 'Last Week', workers: lastWeek.workers, hours: lastWeek.manHours, incidents: lastWeek.incidents }
                : { label: 'Yesterday', workers: yesterday.workers, hours: yesterday.manHours, incidents: yesterday.incidents }
              }
              lastWeek={{ label: 'Last Week', workers: lastWeek.workers, hours: lastWeek.manHours, incidents: lastWeek.incidents }}
            />
          </Card>
        )}

        {/* Photo Mosaic */}
        <div>
          <SectionHeader title="Today's Photos" action={
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{todayPhotos.length} captures
            </span>
          } />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: spacing['2'] }}>
            {todayPhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  aspectRatio: '1', background: photo.gradient, borderRadius: borderRadius.md,
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: `transform ${transitions.instant}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
              >
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', padding: `${spacing['3']} ${spacing['1']} ${spacing['1']}` }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.9)', fontWeight: typography.fontWeight.medium }}>{photo.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signature */}
        {showSignature && !signed && (
          <SignaturePad
            signerName="Walker Benner"
            signerTitle="Project Manager"
            onSign={() => {
              signAndSubmit(today.id, 'signature-data');
              setSigned(true);
              setShowSignature(false);
              addToast('success', 'Daily log approved and sent to distribution list');
            }}
          />
        )}

        {signed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: `${colors.statusActive}08`,
            borderRadius: borderRadius.md, border: `1px solid ${colors.statusActive}20`,
          }}>
            <ShieldCheck size={16} color={colors.statusActive} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>
              Log approved and sent at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Previous Days */}
        <div>
          <SectionHeader title="Previous Days" />
          <Card padding="0">
            {previousDays.map((log, index) => {
              const logDate = new Date(log.date + 'T12:00:00');
              const formatted = logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const isHovered = hoveredRow === index;
              const isLast = index === previousDays.length - 1;
              const logIncidents = entries.filter((e) => e.daily_log_id === log.id && e.entry_type === 'incident');

              return (
                <div
                  key={log.id}
                  onClick={() => addToast('info', `Viewing details for ${formatted}`)}
                  onMouseEnter={() => setHoveredRow(index)}
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
                  <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, minWidth: '120px', flexShrink: 0 }}>{formatted}</span>
                  <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.summary}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flexShrink: 0 }}>
                    <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{log.workers} workers</span>
                    <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{log.manHours.toLocaleString()} hrs</span>
                    {log.incidents > 0 && (
                      <div>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedIncident(expandedIncident === log.id ? null : log.id); }} style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, fontWeight: typography.fontWeight.medium, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily, textDecoration: 'underline', padding: 0 }}>
                          {log.incidents} incident{log.incidents > 1 ? 's' : ''}
                        </button>
                        {expandedIncident === log.id && logIncidents.length > 0 && (
                          <div style={{ marginTop: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: `${colors.statusCritical}06`, borderRadius: borderRadius.sm, borderLeft: `3px solid ${colors.statusCritical}`, animation: 'slideInUp 200ms ease-out' }}>
                            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{(logIncidents[0].data as { description: string }).description}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <ChevronRight size={14} style={{ color: colors.textTertiary, opacity: isHovered ? 1 : 0, transition: `opacity ${transitions.quick}` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};
