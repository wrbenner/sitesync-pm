import React, { useMemo } from 'react';
import {
  Sparkles, Sun, CloudRain, Cloud, CloudSnow, Wind, Thermometer,
  Users, ShieldAlert, FileQuestion, ClipboardCheck, Truck, Search,
  AlertTriangle, CheckCircle2, XCircle, Clock, ChevronRight,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

// ── Types ────────────────────────────────────────────────────

export interface AIDailySummaryProps {
  projectName: string;
  date: string; // ISO date string
  weather?: { condition: string; highTemp: number; lowTemp: number; precipitation?: string };
  dailyLogEntries?: Array<{ category: string; description: string; author: string }>;
  crewCounts?: { total: number; byTrade: Record<string, number> };
  safetyIncidents?: Array<{ type: string; description: string; severity: string }>;
  rfiActivity?: Array<{ number: string; title: string; action: string }>; // action: 'created' | 'responded' | 'closed'
  deliveries?: Array<{ item: string; vendor: string }>;
  inspections?: Array<{ type: string; result: 'pass' | 'fail' | 'pending' }>;
  punchItemActivity?: { created: number; completed: number; total: number };
}

// ── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

const WeatherIconDisplay: React.FC<{ condition?: string | null; size: number; style?: React.CSSProperties }> = ({
  condition,
  size,
  style,
}) => {
  const c = condition?.toLowerCase() ?? '';
  if (c.includes('rain') || c.includes('storm')) return <CloudRain size={size} style={style} />;
  if (c.includes('snow') || c.includes('sleet')) return <CloudSnow size={size} style={style} />;
  if (c.includes('wind')) return <Wind size={size} style={style} />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud size={size} style={style} />;
  return <Sun size={size} style={style} />;
};

function isRainy(condition: string): boolean {
  const c = condition.toLowerCase();
  return c.includes('rain') || c.includes('storm') || c.includes('thunder');
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function severityColor(severity: string): { fg: string; bg: string } {
  switch (severity.toLowerCase()) {
    case 'critical': return { fg: '#DC2626', bg: '#FEF2F2' };
    case 'high': return { fg: '#EA580C', bg: '#FFF7ED' };
    case 'medium': return { fg: '#CA8A04', bg: '#FEFCE8' };
    case 'low': return { fg: '#2563EB', bg: '#EFF6FF' };
    default: return { fg: '#6B7280', bg: '#F9FAFB' };
  }
}

function rfiActionLabel(action: string): { label: string; color: string } {
  switch (action) {
    case 'created': return { label: 'Created', color: '#2563EB' };
    case 'responded': return { label: 'Responded', color: '#CA8A04' };
    case 'closed': return { label: 'Closed', color: '#16A34A' };
    default: return { label: action, color: '#6B7280' };
  }
}

function inspectionResultStyle(result: string): { label: string; color: string; bg: string; Icon: React.FC<any> } {
  switch (result) {
    case 'pass': return { label: 'Pass', color: '#16A34A', bg: '#F0FDF4', Icon: CheckCircle2 };
    case 'fail': return { label: 'Fail', color: '#DC2626', bg: '#FEF2F2', Icon: XCircle };
    default: return { label: 'Pending', color: '#CA8A04', bg: '#FEFCE8', Icon: Clock };
  }
}

// ── Executive Summary Generator ──────────────────────────────

function generateExecutiveSummary(props: AIDailySummaryProps): string {
  const sentences: string[] = [];

  // Crew sentence
  if (props.crewCounts && props.crewCounts.total > 0) {
    const trades = Object.keys(props.crewCounts.byTrade);
    const topTrades = trades
      .sort((a, b) => props.crewCounts!.byTrade[b] - props.crewCounts!.byTrade[a])
      .slice(0, 3);
    sentences.push(
      `A total of ${props.crewCounts.total} crew members were on site today across ${trades.length} trade${trades.length !== 1 ? 's' : ''}, with ${topTrades.join(', ')} leading the workforce.`
    );
  }

  // Work activity sentence
  if (props.dailyLogEntries && props.dailyLogEntries.length > 0) {
    const categories = [...new Set(props.dailyLogEntries.map(e => e.category))];
    sentences.push(
      `${props.dailyLogEntries.length} work activit${props.dailyLogEntries.length !== 1 ? 'ies' : 'y'} ${props.dailyLogEntries.length !== 1 ? 'were' : 'was'} logged spanning ${categories.join(', ')}.`
    );
  }

  // Safety sentence
  if (props.safetyIncidents && props.safetyIncidents.length > 0) {
    const critical = props.safetyIncidents.filter(i => i.severity.toLowerCase() === 'critical').length;
    if (critical > 0) {
      sentences.push(`${props.safetyIncidents.length} safety incident${props.safetyIncidents.length !== 1 ? 's' : ''} ${props.safetyIncidents.length !== 1 ? 'were' : 'was'} reported, including ${critical} critical — immediate review required.`);
    } else {
      sentences.push(`${props.safetyIncidents.length} safety incident${props.safetyIncidents.length !== 1 ? 's' : ''} ${props.safetyIncidents.length !== 1 ? 'were' : 'was'} reported, all non-critical.`);
    }
  } else {
    sentences.push('No safety incidents were reported today.');
  }

  // Weather impact
  if (props.weather && isRainy(props.weather.condition)) {
    sentences.push(`Weather conditions (${props.weather.condition.toLowerCase()}) may have impacted outdoor work activities.`);
  }

  // Punch items
  if (props.punchItemActivity) {
    const { created, completed, total } = props.punchItemActivity;
    if (created > completed) {
      sentences.push(`Punch list grew by ${created - completed} items (${created} created, ${completed} completed), bringing the total to ${total}.`);
    } else if (completed > 0) {
      sentences.push(`Good progress on punch list items with ${completed} completed and ${created} new, leaving ${total} total open.`);
    }
  }

  return sentences.slice(0, 3).join(' ');
}

// ── Concern/Alert Generator ──────────────────────────────────

interface Alert {
  type: 'warning' | 'info' | 'critical';
  message: string;
}

function generateAlerts(props: AIDailySummaryProps): Alert[] {
  const alerts: Alert[] = [];

  if (props.safetyIncidents && props.safetyIncidents.length > 0) {
    const critical = props.safetyIncidents.filter(i => i.severity.toLowerCase() === 'critical');
    if (critical.length > 0) {
      alerts.push({ type: 'critical', message: `${critical.length} critical safety incident${critical.length !== 1 ? 's' : ''} require${critical.length === 1 ? 's' : ''} immediate investigation and corrective action.` });
    } else {
      alerts.push({ type: 'warning', message: `${props.safetyIncidents.length} safety incident${props.safetyIncidents.length !== 1 ? 's' : ''} logged today. Review and ensure proper documentation.` });
    }
  }

  if (props.weather && isRainy(props.weather.condition)) {
    alerts.push({ type: 'warning', message: `${props.weather.condition} conditions reported. Verify exterior work areas are secured and drainage is adequate.` });
  }

  if (props.punchItemActivity) {
    const { created, completed, total } = props.punchItemActivity;
    if (created > completed && total > 20) {
      alerts.push({ type: 'warning', message: `Punch list is growing (${total} total). Consider allocating additional resources to close out items.` });
    }
  }

  if (props.inspections) {
    const failures = props.inspections.filter(i => i.result === 'fail');
    if (failures.length > 0) {
      alerts.push({ type: 'critical', message: `${failures.length} inspection${failures.length !== 1 ? 's' : ''} failed: ${failures.map(f => f.type).join(', ')}. Schedule re-inspection.` });
    }
  }

  const rfisCreated = (props.rfiActivity || []).filter(r => r.action === 'created').length;
  if (rfisCreated >= 3) {
    alerts.push({ type: 'info', message: `${rfisCreated} new RFIs created today. Monitor response timelines to avoid schedule impact.` });
  }

  return alerts;
}

// ── Styles ───────────────────────────────────────────────────

const printStyles = `
@media print {
  .ai-daily-summary { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
  .no-print { display: none !important; }
}
`;

const sectionTitle: React.CSSProperties = {
  fontSize: typography.fontSize.title,
  fontWeight: typography.fontWeight.semibold,
  color: '#1F2937',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: spacing['2'],
};

const sectionDivider: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: `${spacing['5']} 0`,
};

// ── Component ────────────────────────────────────────────────

export const AIDailySummary: React.FC<AIDailySummaryProps> = (props) => {
  const {
    projectName, date, weather, dailyLogEntries, crewCounts,
    safetyIncidents, rfiActivity, deliveries, inspections, punchItemActivity,
  } = props;

  const executiveSummary = useMemo(() => generateExecutiveSummary(props), [props]);
  const alerts = useMemo(() => generateAlerts(props), [props]);
  const groupedEntries = useMemo(
    () => dailyLogEntries ? groupBy(dailyLogEntries, e => e.category) : {},
    [dailyLogEntries],
  );


  const hasWorkActivity = dailyLogEntries && dailyLogEntries.length > 0;
  const hasSafety = safetyIncidents && safetyIncidents.length > 0;
  const hasRFIs = rfiActivity && rfiActivity.length > 0;
  const hasDeliveries = deliveries && deliveries.length > 0;
  const hasInspections = inspections && inspections.length > 0;

  return (
    <>
      <style>{printStyles}</style>
      <div
        className="ai-daily-summary"
        style={{
          fontFamily: typography.fontFamily,
          background: '#FFFFFF',
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          borderLeft: `4px solid ${colors.brand400}`,
          overflow: 'hidden',
          maxWidth: '900px',
          lineHeight: typography.lineHeight.normal,
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          padding: `${spacing['6']} ${spacing['6']} ${spacing['4']}`,
          borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing['3'] }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: typography.fontSize.large,
                fontWeight: typography.fontWeight.bold,
                color: '#111827',
                letterSpacing: typography.letterSpacing.tight,
              }}>
                Daily Summary
              </h1>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.body, color: '#6B7280' }}>
                {projectName} &middot; {formatDate(date)}
              </p>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['1.5'],
              padding: `${spacing['1']} ${spacing['3']}`,
              background: '#F0F0FF',
              borderRadius: borderRadius.full,
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.medium,
              color: '#6366F1',
            }}>
              <Sparkles size={13} />
              Generated by SiteSync PM
            </div>
          </div>
        </div>

        {/* ── Weather Banner ─────────────────────────────── */}
        {weather && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['4'],
            padding: `${spacing['3']} ${spacing['6']}`,
            background: '#F9FAFB',
            borderBottom: '1px solid #F3F4F6',
          }}>
            <WeatherIconDisplay condition={weather.condition} size={20} style={{ color: '#6B7280', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['4'], fontSize: typography.fontSize.sm, color: '#374151' }}>
              <span style={{ fontWeight: typography.fontWeight.medium }}>{weather.condition}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <Thermometer size={13} style={{ color: '#9CA3AF' }} />
                {weather.highTemp}&deg;F / {weather.lowTemp}&deg;F
              </span>
              {weather.precipitation && (
                <span style={{ color: '#6B7280' }}>
                  Precip: {weather.precipitation}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Executive Summary ──────────────────────────── */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}` }}>
          <h2 style={{ ...sectionTitle, marginBottom: spacing['3'] }}>
            <Sparkles size={16} style={{ color: '#6366F1' }} />
            Executive Summary
          </h2>
          <p style={{
            margin: 0,
            fontSize: typography.fontSize.body,
            color: '#374151',
            lineHeight: typography.lineHeight.relaxed,
            background: '#FAFAFA',
            padding: spacing['4'],
            borderRadius: borderRadius.md,
            borderLeft: `3px solid #6366F1`,
          }}>
            {executiveSummary || 'No significant activity recorded for this date.'}
          </p>
        </div>

        <hr style={sectionDivider} />

        {/* ── Key Metrics ────────────────────────────────── */}
        <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: spacing['3'],
          }}>
            <MetricCard
              icon={<Users size={18} />}
              label="Total Crew"
              value={crewCounts?.total ?? 0}
              color="#2563EB"
            />
            <MetricCard
              icon={<ShieldAlert size={18} />}
              label="Safety Incidents"
              value={safetyIncidents?.length ?? 0}
              color={(safetyIncidents?.length ?? 0) > 0 ? '#DC2626' : '#16A34A'}
            />
            <MetricCard
              icon={<FileQuestion size={18} />}
              label="RFI Activity"
              value={rfiActivity?.length ?? 0}
              color="#7C3AED"
            />
            <MetricCard
              icon={<ClipboardCheck size={18} />}
              label="Punch Items"
              value={punchItemActivity?.total ?? 0}
              subtitle={punchItemActivity ? `+${punchItemActivity.created} / -${punchItemActivity.completed}` : undefined}
              color="#EA580C"
            />
          </div>
        </div>

        {/* ── Work Activity ──────────────────────────────── */}
        {hasWorkActivity && (
          <>
            <hr style={sectionDivider} />
            <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
              <h2 style={{ ...sectionTitle, marginBottom: spacing['3'] }}>
                <ClipboardCheck size={16} style={{ color: '#2563EB' }} />
                Work Activity
              </h2>
              {Object.entries(groupedEntries).map(([category, entries]) => (
                <div key={category} style={{ marginBottom: spacing['3'] }}>
                  <h3 style={{
                    margin: `0 0 ${spacing['2']}`,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                  }}>
                    {category}
                  </h3>
                  {entries.map((entry, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      gap: spacing['2'],
                      padding: `${spacing['2']} 0`,
                      borderBottom: idx < entries.length - 1 ? '1px solid #F3F4F6' : 'none',
                      fontSize: typography.fontSize.sm,
                    }}>
                      <ChevronRight size={14} style={{ color: '#D1D5DB', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <span style={{ color: '#374151' }}>{entry.description}</span>
                        <span style={{ color: '#9CA3AF', marginLeft: spacing['2'], fontSize: typography.fontSize.label }}>
                          -- {entry.author}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Safety ─────────────────────────────────────── */}
        {hasSafety && (
          <>
            <hr style={sectionDivider} />
            <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
              <h2 style={{ ...sectionTitle, marginBottom: spacing['3'] }}>
                <ShieldAlert size={16} style={{ color: '#DC2626' }} />
                Safety Incidents
              </h2>
              {safetyIncidents!.map((incident, idx) => {
                const sc = severityColor(incident.severity);
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['3'],
                    padding: spacing['3'],
                    marginBottom: spacing['2'],
                    background: sc.bg,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${sc.bg}`,
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: `${spacing['0.5']} ${spacing['2']}`,
                      borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: sc.fg,
                      background: '#FFFFFF',
                      border: `1px solid ${sc.fg}20`,
                      textTransform: 'uppercase',
                      letterSpacing: typography.letterSpacing.wider,
                      flexShrink: 0,
                    }}>
                      {incident.severity}
                    </span>
                    <div>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: '#1F2937' }}>
                        {incident.type}
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, color: '#6B7280', marginTop: spacing['0.5'] }}>
                        {incident.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── RFI Activity ───────────────────────────────── */}
        {hasRFIs && (
          <>
            <hr style={sectionDivider} />
            <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
              <h2 style={{ ...sectionTitle, marginBottom: spacing['3'] }}>
                <FileQuestion size={16} style={{ color: '#7C3AED' }} />
                RFI Activity
              </h2>
              <div style={{
                display: 'grid',
                gap: spacing['2'],
              }}>
                {rfiActivity!.map((rfi, idx) => {
                  const actionStyle = rfiActionLabel(rfi.action);
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['3'],
                      padding: `${spacing['2']} ${spacing['3']}`,
                      background: '#F9FAFB',
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.sm,
                    }}>
                      <span style={{
                        fontWeight: typography.fontWeight.semibold,
                        color: '#374151',
                        flexShrink: 0,
                        fontFamily: typography.fontFamilyMono,
                        fontSize: typography.fontSize.label,
                      }}>
                        {rfi.number}
                      </span>
                      <span style={{ color: '#374151', flex: 1 }}>{rfi.title}</span>
                      <span style={{
                        padding: `${spacing['0.5']} ${spacing['2']}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        color: actionStyle.color,
                        background: `${actionStyle.color}10`,
                      }}>
                        {actionStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Deliveries & Inspections ───────────────────── */}
        {(hasDeliveries || hasInspections) && (
          <>
            <hr style={sectionDivider} />
            <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: hasDeliveries && hasInspections ? '1fr 1fr' : '1fr',
                gap: spacing['6'],
              }}>
                {hasDeliveries && (
                  <div>
                    <h2 style={{ ...sectionTitle, marginBottom: spacing['3'], fontSize: typography.fontSize.body }}>
                      <Truck size={15} style={{ color: '#EA580C' }} />
                      Deliveries
                    </h2>
                    {deliveries!.map((d, idx) => (
                      <div key={idx} style={{
                        padding: `${spacing['2']} 0`,
                        borderBottom: idx < deliveries!.length - 1 ? '1px solid #F3F4F6' : 'none',
                        fontSize: typography.fontSize.sm,
                      }}>
                        <div style={{ color: '#374151', fontWeight: typography.fontWeight.medium }}>{d.item}</div>
                        <div style={{ color: '#9CA3AF', fontSize: typography.fontSize.label }}>{d.vendor}</div>
                      </div>
                    ))}
                  </div>
                )}
                {hasInspections && (
                  <div>
                    <h2 style={{ ...sectionTitle, marginBottom: spacing['3'], fontSize: typography.fontSize.body }}>
                      <Search size={15} style={{ color: '#7C3AED' }} />
                      Inspections
                    </h2>
                    {inspections!.map((insp, idx) => {
                      const rs = inspectionResultStyle(insp.result);
                      const ResultIcon = rs.Icon;
                      return (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing['2'],
                          padding: `${spacing['2']} 0`,
                          borderBottom: idx < inspections!.length - 1 ? '1px solid #F3F4F6' : 'none',
                          fontSize: typography.fontSize.sm,
                        }}>
                          <ResultIcon size={14} style={{ color: rs.color, flexShrink: 0 }} />
                          <span style={{ color: '#374151', flex: 1 }}>{insp.type}</span>
                          <span style={{
                            fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium,
                            color: rs.color,
                            padding: `${spacing['0.5']} ${spacing['2']}`,
                            borderRadius: borderRadius.full,
                            background: rs.bg,
                          }}>
                            {rs.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Concerns & Action Items ────────────────────── */}
        {alerts.length > 0 && (
          <>
            <hr style={sectionDivider} />
            <div style={{ padding: `0 ${spacing['6']} ${spacing['5']}` }}>
              <h2 style={{ ...sectionTitle, marginBottom: spacing['3'] }}>
                <AlertTriangle size={16} style={{ color: '#CA8A04' }} />
                Concerns &amp; Action Items
              </h2>
              <div style={{ display: 'grid', gap: spacing['2'] }}>
                {alerts.map((alert, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['3'],
                    padding: spacing['3'],
                    borderRadius: borderRadius.md,
                    background: alert.type === 'critical' ? '#FEF2F2' : alert.type === 'warning' ? '#FFFBEB' : '#EFF6FF',
                    border: `1px solid ${alert.type === 'critical' ? '#FECACA' : alert.type === 'warning' ? '#FDE68A' : '#BFDBFE'}`,
                  }}>
                    <AlertTriangle size={14} style={{
                      color: alert.type === 'critical' ? '#DC2626' : alert.type === 'warning' ? '#CA8A04' : '#2563EB',
                      flexShrink: 0,
                      marginTop: '2px',
                    }} />
                    <span style={{ fontSize: typography.fontSize.sm, color: '#374151', lineHeight: typography.lineHeight.normal }}>
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Footer ─────────────────────────────────────── */}
        <div style={{
          padding: `${spacing['3']} ${spacing['6']}`,
          borderTop: '1px solid #F3F4F6',
          background: '#FAFAFA',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: typography.fontSize.label,
          color: '#9CA3AF',
        }}>
          <span>
            Auto-generated on {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
          <span>
            This summary was produced by template-based analysis and may not reflect all project conditions.
          </span>
        </div>
      </div>
    </>
  );
};

// ── Metric Card Sub-Component ────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle?: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, subtitle, color }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: spacing['3'],
    padding: spacing['4'],
    background: '#F9FAFB',
    borderRadius: borderRadius.md,
    border: '1px solid #F3F4F6',
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: borderRadius.md,
      background: `${color}10`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{
        fontSize: typography.fontSize.large,
        fontWeight: typography.fontWeight.bold,
        color: '#111827',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: typography.fontSize.label,
        color: '#6B7280',
        marginTop: spacing['0.5'],
      }}>
        {label}
      </div>
      {subtitle && (
        <div style={{
          fontSize: typography.fontSize.caption,
          color: '#9CA3AF',
          marginTop: spacing['0.5'],
        }}>
          {subtitle}
        </div>
      )}
    </div>
  </div>
);

export default AIDailySummary;
