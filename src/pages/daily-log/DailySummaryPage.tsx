import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Calendar, Sparkles } from 'lucide-react';
import { PageContainer, Btn } from '../../components/Primitives';
import { AIDailySummary } from '../../components/ai/AIDailySummary';
import type { AIDailySummaryProps } from '../../components/ai/AIDailySummary';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useDailyLogs, useDailyLogEntries, useProject } from '../../hooks/queries';
import type { ExtendedDailyLog } from './types';

// ── Helpers ──────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function formatShort(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Page Component ───────────────────────────────────────────

const DailySummaryPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);

  // Date state — defaults to today
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));

  const goToPrev = useCallback(() => setSelectedDate(d => addDays(d, -1)), []);
  const goToNext = useCallback(() => setSelectedDate(d => addDays(d, 1)), []);

  // Fetch daily logs for the project
  const { data: dailyLogData, isPending: logsLoading } = useDailyLogs(projectId);

  // Find the log for the selected date
  const dailyLog = useMemo(() => {
    if (!dailyLogData?.data) return null;
    return (dailyLogData.data as ExtendedDailyLog[]).find((log) => log.log_date === selectedDate) ?? null;
  }, [dailyLogData, selectedDate]);

  // Fetch entries for that log
  const { data: entriesRaw } = useDailyLogEntries(dailyLog?.id);

  // Map data into AIDailySummaryProps shape
  const summaryProps: AIDailySummaryProps = useMemo(() => {
    const log = dailyLog as ExtendedDailyLog | null;

    // Weather
    let weather: AIDailySummaryProps['weather'] | undefined;
    if (log?.weather) {
      weather = {
        condition: log.weather ?? 'Clear',
        highTemp: Number(log.temperature_high ?? 75),
        lowTemp: Number(log.temperature_low ?? 55),
        precipitation: log.precipitation ?? undefined,
      };
    }

    // Crew counts
    let crewCounts: AIDailySummaryProps['crewCounts'] | undefined;
    const totalWorkers = Number(log?.workers_onsite ?? 0);
    if (totalWorkers > 0) {
      // Try to build trade breakdown from manpower or crew_hours fields
      const byTrade: Record<string, number> = {};
      if (log?.crew_entries && Array.isArray(log.crew_entries)) {
        for (const m of log.crew_entries) {
          const trade = m.trade ?? 'General';
          byTrade[trade] = (byTrade[trade] ?? 0) + Number(m.headcount ?? 1);
        }
      }
      if (Object.keys(byTrade).length === 0) {
        byTrade['General Labor'] = totalWorkers;
      }
      crewCounts = { total: totalWorkers, byTrade };
    }

    // Safety incidents
    const incidentCount = Number(log?.incidents ?? 0);
    let safetyIncidents: AIDailySummaryProps['safetyIncidents'] | undefined;
    if (incidentCount > 0) {
      // Generate placeholder incidents from count since we don't have detailed data
      safetyIncidents = Array.from({ length: incidentCount }, (_, i) => ({
        type: 'Incident',
        description: `Safety incident #${i + 1} reported on site`,
        severity: i === 0 ? 'high' : 'medium',
      }));
    }

    // Daily log entries
    let dailyLogEntries: AIDailySummaryProps['dailyLogEntries'] | undefined;
    if (entriesRaw && Array.isArray(entriesRaw) && entriesRaw.length > 0) {
      dailyLogEntries = entriesRaw.map((e: any) => ({
        category: e.category ?? e.entry_type ?? 'General',
        description: e.description ?? e.notes ?? e.content ?? '',
        author: e.author ?? e.created_by ?? 'Field Staff',
      }));
    } else if (log?.summary || log?.work_performed) {
      // Fall back to log-level summary
      dailyLogEntries = [{
        category: 'General',
        description: String(log.summary ?? log.work_performed ?? ''),
        author: 'Daily Log',
      }];
    }

    return {
      projectName: project?.name ?? 'Project',
      date: selectedDate,
      weather,
      dailyLogEntries,
      crewCounts,
      safetyIncidents,
      // RFI, deliveries, inspections, and punch items would come from
      // separate queries in a full implementation. Leaving undefined so
      // AIDailySummary gracefully hides those sections.
      rfiActivity: undefined,
      deliveries: undefined,
      inspections: undefined,
      punchItemActivity: undefined,
    };
  }, [dailyLog, entriesRaw, selectedDate, project]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const isToday = selectedDate === toISODate(new Date());

  return (
    <PageContainer>
      {/* ── Top Bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: spacing['3'],
        marginBottom: spacing['6'],
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <Sparkles size={20} style={{ color: '#6366F1' }} />
          <h1 style={{
            margin: 0,
            fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
          }}>
            AI Daily Summary
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {/* Date Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            padding: `${spacing['1']} ${spacing['2']}`,
          }}>
            <button
              onClick={goToPrev}
              aria-label="Previous day"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'transparent',
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
                color: colors.textSecondary,
                transition: transitions.quick,
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = colors.surfaceHover; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `0 ${spacing['2']}`,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              minWidth: '120px',
              justifyContent: 'center',
            }}>
              <Calendar size={14} style={{ color: colors.textTertiary }} />
              {formatShort(selectedDate)}
            </div>

            <button
              onClick={goToNext}
              disabled={isToday}
              aria-label="Next day"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'transparent',
                borderRadius: borderRadius.sm,
                cursor: isToday ? 'default' : 'pointer',
                color: isToday ? colors.textDisabled : colors.textSecondary,
                transition: transitions.quick,
              }}
              onMouseEnter={e => { if (!isToday) (e.target as HTMLElement).style.background = colors.surfaceHover; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Print Button */}
          <Btn
            variant="secondary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}
            className="no-print"
          >
            <Printer size={14} />
            Print Summary
          </Btn>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      {logsLoading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['16'],
          color: colors.textTertiary,
          fontSize: typography.fontSize.body,
        }}>
          Loading daily summary...
        </div>
      ) : !dailyLog ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['16'],
          gap: spacing['3'],
          color: colors.textTertiary,
        }}>
          <Calendar size={40} style={{ opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: typography.fontSize.body }}>
            No daily log found for {formatShort(selectedDate)}.
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Try navigating to a date with recorded activity.
          </p>
        </div>
      ) : (
        <AIDailySummary {...summaryProps} />
      )}

      {/* ── Print-only styles ───────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </PageContainer>
  );
};

export default DailySummaryPage;
