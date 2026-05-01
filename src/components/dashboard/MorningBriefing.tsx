import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, CloudSun, Moon, AlertTriangle, Clock,
  TrendingUp, HardHat, Wind,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { duration, easingArray } from '../../styles/animations';
import { useAuth } from '../../hooks/useAuth';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject } from '../../hooks/queries';
import { useProfileNames, displayName } from '../../hooks/queries/profiles';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useEntityStore } from '../../stores/entityStore';
import type { RFI } from '../../types/database';
import { useScheduleStore } from '../../stores/scheduleStore';
import { fetchWeatherForProject } from '../../lib/weather';
import type { WeatherSnapshot } from '../../lib/weather';
import { interpretWeather, getWeatherIcon } from '../../lib/weatherIntelligence';
import type { ConstructionWeather } from '../../lib/weatherIntelligence';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

// ── Time Helpers ────────────────────────────────────────

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingIcon(hour: number) {
  if (hour < 12) return <Sun size={20} color={colors.brand400} />;
  if (hour < 17) return <CloudSun size={20} color={colors.brand400} />;
  return <Moon size={20} color={colors.brand400} />;
}

function getFirstName(user: { user_metadata?: { full_name?: string }; email?: string } | null): string {
  const fullName = user?.user_metadata?.full_name;
  if (fullName) return fullName.split(' ')[0];
  const email = user?.email;
  if (email) return email.split('@')[0];
  return 'there';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ── Animation Variants ──────────────────────────────────

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const cardTransition = { duration: duration.smooth / 1000, ease: easingArray.apple };

// ── Watch Item Types ────────────────────────────────────

interface WatchItem {
  id: string;
  severity: 'red' | 'yellow';
  icon: string;
  text: string;
}

// ── Trades Mock Data ────────────────────────────────────
// Maps schedule phase names to trade info for display purposes

interface TradeWork {
  icon: string;
  trade: string;
  crew: number;
  location: string;
}

function mapPhasesToTrades(
  phases: { name: string; status?: string | null; percent_complete?: number | null; location?: string | null }[],
): TradeWork[] {
  const tradeMap: Record<string, { icon: string; crew: number }> = {
    electrical: { icon: '\u26A1', crew: 8 },
    mechanical: { icon: '\uD83D\uDD27', crew: 6 },
    concrete: { icon: '\uD83E\uDDF1', crew: 15 },
    structural: { icon: '\uD83C\uDFD7\uFE0F', crew: 12 },
    foundation: { icon: '\uD83C\uDFD7\uFE0F', crew: 14 },
    excavation: { icon: '\uD83D\uDE9C', crew: 8 },
    utilities: { icon: '\uD83D\uDD33', crew: 6 },
    facade: { icon: '\uD83C\uDFE2', crew: 10 },
    finishes: { icon: '\uD83C\uDFA8', crew: 8 },
    commissioning: { icon: '\u2705', crew: 4 },
    mobilization: { icon: '\uD83D\uDE9A', crew: 6 },
    roofing: { icon: '\uD83C\uDFE0', crew: 7 },
  };

  const active = phases.filter(
    (p) => p.status === 'in_progress' || ((p.percent_complete ?? 0) > 0 && (p.percent_complete ?? 0) < 100),
  );

  return active.slice(0, 4).map((phase) => {
    const nameLower = phase.name.toLowerCase();
    const matched = Object.entries(tradeMap).find(([key]) => nameLower.includes(key));
    const info = matched ? matched[1] : { icon: '\uD83D\uDC77', crew: 5 };
    return {
      icon: info.icon,
      trade: phase.name,
      crew: info.crew,
      location: phase.location || '',
    };
  });
}

// ── Compact Dollar Format ───────────────────────────────

function compactDollars(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
}

// ── Main Component ──────────────────────────────────────

export const MorningBriefing: React.FC = () => {
  const { user } = useAuth();
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const reducedMotion = useReducedMotion();

  // Stores — migrated to entityStore (key: "rfis")
  const { items: _rfiItems, loading: rfiLoading } = useEntityStore('rfis');
  const rfis = _rfiItems as RFI[];
  const phases = useScheduleStore((s) => s.phases);
  const scheduleMetrics = useScheduleStore((s) => s.metrics);

  // Weather
  const { data: weatherSnapshot } = useQuery<WeatherSnapshot>({
    queryKey: ['weather_briefing', projectId],
    queryFn: () => fetchWeatherForProject(
      projectId!,
      project?.latitude ?? undefined,
      project?.longitude ?? undefined,
    ),
    enabled: !!projectId,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Submittals count
  const { data: submittalData } = useQuery({
    queryKey: ['submittals_briefing', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submittals')
        .select('id, status, due_date')
        .eq('project_id', projectId!);
      if (error) return { pending: 0, overdue: 0 };
      const rows = data ?? [];
      const today = new Date().toISOString().split('T')[0];
      const pending = rows.filter((s) => s.status === 'submitted' || s.status === 'in_review').length;
      const overdue = rows.filter((s) =>
        (s.status === 'submitted' || s.status === 'in_review') && s.due_date && s.due_date < today,
      ).length;
      return { pending, overdue };
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  // Budget
  const { data: budgetData } = useQuery({
    queryKey: ['budget_briefing', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('original_amount, actual_amount')
        .eq('project_id', projectId!);
      if (error) return { total: 0, spent: 0 };
      const rows = data ?? [];
      return {
        total: rows.reduce((sum, b) => sum + (b.original_amount ?? 0), 0),
        spent: rows.reduce((sum, b) => sum + (b.actual_amount ?? 0), 0),
      };
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived Data ──────────────────────────────────────

  // Capture current time once on mount — avoids Date.now() calls during render
  const [mountTime] = useState(() => Date.now());

  const now = new Date(mountTime);
  const hour = now.getHours();
  const greeting = getGreeting(hour);
  const firstName = getFirstName(user);
  const dateStr = formatDate();

  const constructionWeather = useMemo<ConstructionWeather | null>(() => {
    if (!weatherSnapshot) return null;
    return interpretWeather(weatherSnapshot);
  }, [weatherSnapshot]);

  const todaysTrades = useMemo(() => mapPhasesToTrades(phases), [phases]);
  const totalWorkers = useMemo(() => todaysTrades.reduce((sum, t) => sum + t.crew, 0), [todaysTrades]);

  // Day number
  const startDate = project?.start_date ?? null;
  const targetCompletion = project?.target_completion ?? null;

  const dayNumber = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const elapsed = mountTime - start.getTime();
    return Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24)));
  }, [startDate, mountTime]);

  const totalDays = useMemo(() => {
    if (!startDate || !targetCompletion) return null;
    const start = new Date(startDate);
    const end = new Date(targetCompletion);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [startDate, targetCompletion]);

  // Watch items
  const todayStr = useMemo(() => new Date(mountTime).toISOString().split('T')[0], [mountTime]);

  // Resolve ball_in_court UUIDs to names so the briefing reads
  // "3d with Sarah Garcia" instead of "3d with a0000001-…".
  const { data: bicProfileMap } = useProfileNames(rfis.map((r) => r.ball_in_court ?? null))

  const watchItems = useMemo<WatchItem[]>(() => {
    const items: WatchItem[] = [];

    if (!rfiLoading) {
      // Overdue RFIs
      const overdueRfis = rfis.filter(
        (r) => (r.status === 'open' || r.status === 'under_review') && r.due_date && r.due_date < todayStr,
      );
      for (const rfi of overdueRfis.slice(0, 3)) {
        const daysOverdue = Math.ceil(
          (mountTime - new Date(rfi.due_date!).getTime()) / (1000 * 60 * 60 * 24),
        );
        items.push({
          id: `rfi-overdue-${rfi.id}`,
          severity: 'red',
          icon: '\uD83D\uDD34',
          text: `RFI #${rfi.number} \u2014 ${rfi.title} \u2014 ${daysOverdue}d overdue`,
        });
      }

      // Long ball-in-court RFIs (> 7 days since last update)
      const longBic = rfis.filter((r) => {
        if (r.status !== 'open' && r.status !== 'under_review') return false;
        if (!r.updated_at) return false;
        const daysSince = Math.ceil(
          (mountTime - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysSince > 7;
      });
      for (const rfi of longBic.slice(0, 2)) {
        if (items.some((i) => i.id === `rfi-overdue-${rfi.id}`)) continue;
        const daysSince = Math.ceil(
          (mountTime - new Date(rfi.updated_at!).getTime()) / (1000 * 60 * 60 * 24),
        );
        items.push({
          id: `rfi-bic-${rfi.id}`,
          severity: 'red',
          icon: '\uD83D\uDD34',
          text: `RFI #${rfi.number} \u2014 ${rfi.title} \u2014 ${daysSince}d with ${displayName(bicProfileMap, rfi.ball_in_court, 'reviewer')}`,
        });
      }
    }

    // Schedule slippage
    const slippingPhases = phases.filter((p) => p.slippageDays > 3 && !p.completed);
    for (const phase of slippingPhases.slice(0, 2)) {
      items.push({
        id: `schedule-slip-${phase.id}`,
        severity: 'yellow',
        icon: '\uD83D\uDFE1',
        text: `${phase.name} \u2014 ${phase.slippageDays}d behind baseline`,
      });
    }

    return items.slice(0, 5);
  }, [rfis, rfiLoading, phases, mountTime, todayStr, bicProfileMap]);

  // Pulse metrics
  const scheduleLabel = useMemo(() => {
    const d = scheduleMetrics.daysBeforeSchedule;
    if (d > 0) return `${d} days ahead`;
    if (d < 0) return `${Math.abs(d)} days behind`;
    return 'On track';
  }, [scheduleMetrics.daysBeforeSchedule]);

  const budgetPct = useMemo(() => {
    if (!budgetData || budgetData.total === 0) return 0;
    return Math.round((budgetData.spent / budgetData.total) * 100 * 10) / 10;
  }, [budgetData]);

  const rfiOpen = useMemo(
    () => rfis.filter((r) => r.status === 'open' || r.status === 'under_review').length,
    [rfis],
  );
  const rfiOverdue = useMemo(() => {
    return rfis.filter(
      (r) => (r.status === 'open' || r.status === 'under_review') && r.due_date && r.due_date < todayStr,
    ).length;
  }, [rfis, todayStr]);

  if (!projectId) return null;

  const motionProps = reducedMotion
    ? {}
    : { variants: containerVariants, initial: 'initial' as const, animate: 'animate' as const };

  const cardMotion = reducedMotion ? {} : { variants: cardVariants, transition: cardTransition };

  // ── Shared Card Style ─────────────────────────────────

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.xl,
    boxShadow: shadows.card,
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
  };

  return (
    <motion.div {...motionProps} style={{ marginBottom: spacing['5'] }}>
      {/* ── Greeting Header ──────────────────────────────── */}
      <motion.div
        {...cardMotion}
        style={{
          ...cardStyle,
          padding: `${spacing['5']} ${spacing['6']}`,
          marginBottom: spacing['3'],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: spacing['3'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {getGreetingIcon(hour)}
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: typography.fontSize.large,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
                letterSpacing: typography.letterSpacing.tight,
                lineHeight: typography.lineHeight.tight,
              }}
            >
              {greeting}, {firstName}
            </h2>
            <p
              style={{
                margin: 0,
                marginTop: spacing['0.5'],
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                lineHeight: typography.lineHeight.normal,
              }}
            >
              {project?.name ?? 'Project Dashboard'}
              {dayNumber && totalDays ? ` \u2014 Day ${dayNumber} of ${totalDays}` : ''}
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            fontWeight: typography.fontWeight.medium,
          }}
        >
          {dateStr}
        </span>
      </motion.div>

      {/* ── Weather Intelligence ─────────────────────────── */}
      {constructionWeather && (
        <motion.div
          {...cardMotion}
          style={{
            ...cardStyle,
            padding: `${spacing['4']} ${spacing['6']}`,
            marginBottom: spacing['3'],
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['4'],
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 28, lineHeight: '1' }}>
              {getWeatherIcon(constructionWeather.conditions)}
            </span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                }}
              >
                {constructionWeather.temperature}\u00B0F {constructionWeather.conditions}
                {constructionWeather.temperatureLow !== constructionWeather.temperature &&
                  ` \u2192 ${constructionWeather.temperatureLow}\u00B0F`}
              </p>
              <p
                style={{
                  margin: 0,
                  marginTop: spacing['1'],
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: constructionWeather.pourDay ? colors.statusActive : colors.statusPending,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  flexWrap: 'wrap',
                }}
              >
                {constructionWeather.constructionSummary.split(' \u00B7 ').map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <span style={{ color: colors.textTertiary, fontWeight: typography.fontWeight.normal }}>
                        \u00B7
                      </span>
                    )}
                    <span
                      style={{
                        color: part.includes('No pour') || part.includes('Wind hold') || part.includes('Freeze risk \u2014') || part.includes('Heat')
                          ? colors.statusCritical
                          : part.includes('Good pour') || part.includes('No wind') || part.includes('Freeze risk 0%')
                            ? colors.statusActive
                            : colors.statusPending,
                      }}
                    >
                      {part}
                    </span>
                  </React.Fragment>
                ))}
              </p>
            </div>
            {constructionWeather.windSpeed > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <Wind size={14} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {constructionWeather.windSpeed} mph
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Two Column: Today's Work + Watch Items ────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: spacing['3'],
          marginBottom: spacing['3'],
        }}
      >
        {/* Today's Work */}
        <motion.div {...cardMotion} style={cardStyle}>
          <div
            style={{
              padding: `${spacing['3']} ${spacing['5']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
            }}
          >
            <HardHat size={14} color={colors.brand400} />
            <span
              style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
              }}
            >
              Today&apos;s Work
            </span>
          </div>
          <div style={{ padding: `${spacing['2']} ${spacing['4']}` }}>
            {todaysTrades.length > 0 ? (
              todaysTrades.map((trade) => (
                <div
                  key={trade.trade}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `${spacing['2.5']} ${spacing['1']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{trade.icon}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textPrimary,
                    }}
                  >
                    {trade.trade}
                  </span>
                  <span
                    style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {trade.crew} crew
                  </span>
                  {trade.location && (
                    <span
                      style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {trade.location}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p style={{ margin: 0, padding: spacing['3'], fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                No active phases scheduled
              </p>
            )}
            {todaysTrades.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  padding: `${spacing['3']} ${spacing['1']} ${spacing['2']}`,
                }}
              >
                <TrendingUp size={13} color={colors.textTertiary} />
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.textSecondary,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {totalWorkers} workers expected &middot; {todaysTrades.length} trade{todaysTrades.length !== 1 ? 's' : ''} active
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Watch Items */}
        <motion.div {...cardMotion} style={cardStyle}>
          <div
            style={{
              padding: `${spacing['3']} ${spacing['5']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
            }}
          >
            <AlertTriangle size={14} color={colors.statusPending} />
            <span
              style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
              }}
            >
              Watch Items
            </span>
            {watchItems.length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.white,
                  backgroundColor: colors.statusCritical,
                  borderRadius: borderRadius.full,
                  padding: `1px ${spacing['2']}`,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {watchItems.length}
              </span>
            )}
          </div>
          <div style={{ padding: `${spacing['2']} ${spacing['4']}` }}>
            {watchItems.length > 0 ? (
              watchItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['2.5'],
                    padding: `${spacing['2.5']} ${spacing['1']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span style={{ fontSize: 12, marginTop: 2, flexShrink: 0 }}>{item.icon}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: typography.fontSize.sm,
                      color: item.severity === 'red' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: item.severity === 'red' ? typography.fontWeight.semibold : typography.fontWeight.normal,
                      lineHeight: typography.lineHeight.snug,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  padding: spacing['3'],
                }}
              >
                <span style={{ fontSize: 14 }}>{'\u2705'}</span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>
                  All clear — no items need attention
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Project Pulse ────────────────────────────────── */}
      <motion.div {...cardMotion} style={cardStyle}>
        <div
          style={{
            padding: `${spacing['3']} ${spacing['5']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
          }}
        >
          <Clock size={14} color={colors.brand400} />
          <span
            style={{
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
            }}
          >
            Project Pulse
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 0,
          }}
        >
          <PulseMetric
            label="Schedule"
            value={scheduleLabel}
            sub={`${scheduleMetrics.milestonesHit}/${scheduleMetrics.milestoneTotal} milestones`}
            positive={scheduleMetrics.daysBeforeSchedule >= 0}
          />
          <PulseMetric
            label="Budget"
            value={budgetData ? compactDollars(budgetData.spent) : '$0'}
            sub={budgetData && budgetData.total > 0 ? `${budgetPct}% of ${compactDollars(budgetData.total)}` : 'No budget set'}
            positive={budgetPct < 90}
          />
          <PulseMetric
            label="Open RFIs"
            value={String(rfiOpen)}
            sub={rfiOverdue > 0 ? `${rfiOverdue} overdue` : 'None overdue'}
            positive={rfiOverdue === 0}
          />
          <PulseMetric
            label="Submittals"
            value={`${submittalData?.pending ?? 0} pending`}
            sub={submittalData && submittalData.overdue > 0 ? `${submittalData.overdue} overdue` : 'None overdue'}
            positive={!submittalData?.overdue}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Pulse Metric Cell ──────────────────────────────────

const PulseMetric: React.FC<{
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}> = ({ label, value, sub, positive }) => (
  <div
    style={{
      padding: `${spacing['4']} ${spacing['5']}`,
      borderRight: `1px solid ${colors.borderSubtle}`,
    }}
  >
    <p
      style={{
        margin: 0,
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: 0,
        marginTop: spacing['1'],
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.bold,
        color: colors.textPrimary,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: typography.lineHeight.tight,
      }}
    >
      {value}
    </p>
    <p
      style={{
        margin: 0,
        marginTop: spacing['0.5'],
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.medium,
        color: positive ? colors.statusActive : colors.statusCritical,
      }}
    >
      {sub}
    </p>
  </div>
);
