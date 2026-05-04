/**
 * The Set — "What does the building look like?"
 *
 * Shape: Map — a place you can explore.
 * Drawings organized by discipline, sortable by recency.
 * The orange dot marks the drawing that changed last.
 *
 * This is how the field understands the building.
 */

import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useDrawings } from '../../hooks/queries';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Hairline,
  Eyebrow,
  SectionHeading,
} from '../../components/atoms';
import {

  ChevronRight,
  FileText,
  Layers,

  Clock,

} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

interface Drawing {
  id: string;
  title: string;
  sheet_number?: string | null;
  discipline?: string | null;
  revision?: string | null;
  status?: string | null;
  updated_at?: string | null;
  total_pages?: number | null;
}

// ── Helpers ──────────────────────────────────────────────

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function disciplineColor(discipline: string | null | undefined): string {
  if (!discipline) return colors.ink4;
  const d = discipline.toLowerCase();
  if (d.includes('arch')) return '#3A7BC8';
  if (d.includes('struct')) return '#7C5DC7';
  if (d.includes('mep') || d.includes('mech') || d.includes('elec') || d.includes('plum')) return '#2A9D8F';
  if (d.includes('civil') || d.includes('site')) return '#E76F51';
  if (d.includes('land')) return '#57A77A';
  return colors.ink4;
}

function disciplineBg(discipline: string | null | undefined): string {
  if (!discipline) return 'rgba(0,0,0,0.04)';
  const d = discipline.toLowerCase();
  if (d.includes('arch')) return 'rgba(58, 123, 200, 0.08)';
  if (d.includes('struct')) return 'rgba(124, 93, 199, 0.08)';
  if (d.includes('mep') || d.includes('mech') || d.includes('elec') || d.includes('plum')) return 'rgba(42, 157, 143, 0.08)';
  if (d.includes('civil') || d.includes('site')) return 'rgba(231, 111, 81, 0.08)';
  if (d.includes('land')) return 'rgba(87, 167, 122, 0.08)';
  return 'rgba(0,0,0,0.04)';
}

function statusColor(status: string | null | undefined): string {
  if (!status) return colors.ink4;
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'issued') return colors.statusActive;
  if (s === 'in_review' || s === 'pending') return colors.statusPending;
  if (s === 'superseded' || s === 'void') return colors.statusCritical;
  return colors.ink4;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return d >= sevenDaysAgo;
}

// ── The Set Page ─────────────────────────────────────────

const SetPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();

  useEffect(() => { setPageContext('set'); }, [setPageContext]);

  // ── Data ────────────────────────────────────────────────
  const { data: drawingData, isPending: drawingsLoading } = useDrawings(projectId);
  const drawings = useMemo(
    () => (drawingData?.data ?? []) as unknown as Drawing[],
    [drawingData],
  );

  // ── Derived data ────────────────────────────────────────

  // Count by discipline
  const byDiscipline = useMemo(() => {
    const map = new Map<string, Drawing[]>();
    for (const d of drawings) {
      const key = d.discipline ?? 'Unclassified';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort by count desc
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([discipline, items]) => {
        const latestUpdated = items
          .map((i) => i.updated_at ?? '')
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null;
        return { discipline, count: items.length, latestUpdated };
      });
  }, [drawings]);

  // Recently updated (last 7 days), sorted by updated_at desc, up to 10
  const recentlyUpdated = useMemo(() => {
    return [...drawings]
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, 10);
  }, [drawings]);

  const recentCount = useMemo(
    () => drawings.filter((d) => isRecentlyUpdated(d.updated_at)).length,
    [drawings],
  );

  // No project selected
  if (!projectId) return <ProjectGate />;

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: colors.parchment,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          }}
        >
          {/* ── Compact Header ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                The Set
              </span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                {project?.name ?? 'Project'}
              </span>
            </div>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {!isOnline ? 'Offline' : 'Drawings'}
            </span>
          </div>

          {/* ── Count Strip ──────────────────────────── */}
          {drawingsLoading ? (
            <PageState status="loading" />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 12 : 28,
                  flexWrap: 'wrap',
                  marginTop: 20,
                  marginBottom: 28,
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--hairline)',
                  borderRadius: 10,
                }}
              >
                {/* Total drawings */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={16} style={{ color: colors.ink4, flexShrink: 0 }} />
                  <div>
                    <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Total Sheets</Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '28px',
                        fontWeight: 400,
                        color: colors.ink,
                        lineHeight: 1,
                      }}
                    >
                      {drawings.length}
                    </span>
                  </div>
                </div>

                {byDiscipline.length > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 40,
                      backgroundColor: 'var(--hairline)',
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Discipline counts — show up to 4 */}
                {byDiscipline.slice(0, 4).map(({ discipline, count }) => (
                  <div key={discipline} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: disciplineColor(discipline),
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <Eyebrow style={{ display: 'block', marginBottom: 2 }}>
                        {discipline}
                      </Eyebrow>
                      <span
                        style={{
                          fontFamily: typography.fontFamilySerif,
                          fontSize: '18px',
                          fontWeight: 400,
                          color: colors.ink,
                          lineHeight: 1,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                ))}

                {recentCount > 0 && (
                  <>
                    <div
                      style={{
                        width: 1,
                        height: 40,
                        backgroundColor: 'var(--hairline)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <OrangeDot size={7} haloSpread={3} />
                      <div>
                        <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Updated This Week</Eyebrow>
                        <span
                          style={{
                            fontFamily: typography.fontFamilySerif,
                            fontSize: '18px',
                            fontWeight: 400,
                            color: colors.primaryOrange,
                            lineHeight: 1,
                          }}
                        >
                          {recentCount}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── By Discipline ─────────────────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  By <em>Discipline</em>
                </SectionHeading>

                {byDiscipline.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No drawings uploaded yet.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                      gap: 12,
                    }}
                  >
                    {byDiscipline.map(({ discipline, count, latestUpdated }) => (
                      <DisciplineCard
                        key={discipline}
                        discipline={discipline}
                        count={count}
                        latestUpdated={latestUpdated}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={1} spacing="tight" />

              {/* ── Recently Updated ──────────────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  Recently <em>Updated</em>
                  <span
                    style={{
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: colors.ink4,
                      marginLeft: 12,
                      letterSpacing: 0,
                    }}
                  >
                    last 10 sheets
                  </span>
                </SectionHeading>

                {recentlyUpdated.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No drawings to show.
                    </span>
                  </div>
                ) : (
                  <div>
                    {recentlyUpdated.map((drawing) => (
                      <DrawingRow key={drawing.id} drawing={drawing} />
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── Quick Links ───────────────────────────── */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, marginBottom: 48 }}>
                {[
                  { href: '#/drawings', label: 'Drawings' },
                  { href: '#/bim', label: 'BIM Viewer' },
                ].map(({ href, label }) => (
                  <a key={href} href={href} style={{
                    fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500,
                    color: colors.ink3, textDecoration: 'none', padding: '6px 14px',
                    borderRadius: 100, border: '1px solid var(--hairline)',
                    transition: transitions.quick,
                  }}>{label}</a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// ── Discipline Card ─────────────────────────────────────

const DisciplineCard: React.FC<{
  discipline: string;
  count: number;
  latestUpdated: string | null;
}> = ({ discipline, count, latestUpdated }) => (
  <a
    href="#/drawings"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '16px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: 10,
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 100,
          backgroundColor: disciplineBg(discipline),
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: disciplineColor(discipline),
            flexShrink: 0,
          }}
        />
        <Eyebrow style={{ color: disciplineColor(discipline) }}>
          {discipline}
        </Eyebrow>
      </div>
      <ChevronRight size={13} style={{ color: colors.ink4, flexShrink: 0 }} />
    </div>
    <div
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: '32px',
        fontWeight: 400,
        color: colors.ink,
        lineHeight: 1.1,
      }}
    >
      {count}
    </div>
    {latestUpdated && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={10} style={{ color: colors.ink4 }} />
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            color: colors.ink4,
          }}
        >
          {formatShortDate(latestUpdated)}
        </span>
      </div>
    )}
  </a>
);

// ── Drawing Row ─────────────────────────────────────────

const DrawingRow: React.FC<{ drawing: Drawing }> = ({ drawing }) => {
  const isRecent = isRecentlyUpdated(drawing.updated_at);
  return (
    <a
      href="#/drawings"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--hairline-2)',
        textDecoration: 'none',
        color: 'inherit',
        transition: transitions.quick,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: disciplineBg(drawing.discipline),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        }}
      >
        <Layers size={14} style={{ color: disciplineColor(drawing.discipline) }} />
        {isRecent && (
          <OrangeDot size={6} haloSpread={2} style={{ position: 'absolute', top: -2, right: -2 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          {drawing.discipline && (
            <Eyebrow style={{ flexShrink: 0 }}>
              {drawing.discipline}
            </Eyebrow>
          )}
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 500,
              color: colors.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {drawing.sheet_number ? `${drawing.sheet_number} — ` : ''}
            {drawing.title}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {drawing.revision && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: colors.ink3,
              }}
            >
              Rev {drawing.revision}
            </span>
          )}
          {drawing.status && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '10px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: statusColor(drawing.status),
              }}
            >
              {statusLabel(drawing.status)}
            </span>
          )}
          {drawing.updated_at && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: isRecent ? colors.primaryOrange : colors.ink4,
              }}
            >
              <Clock size={10} />
              {formatShortDate(drawing.updated_at)}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0, marginTop: 8 }} />
    </a>
  );
};

// ── Export ──────────────────────────────────────────────

export default SetPage;
