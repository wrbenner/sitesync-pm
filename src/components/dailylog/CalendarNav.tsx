import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface CalendarNavProps {
  /** Dates with fully approved logs (green) */
  approvedDates?: Set<string>;
  /** Dates with submitted but not yet approved logs (yellow) */
  submittedDates?: Set<string>;
  /** @deprecated Use approvedDates + submittedDates. Kept for backward compat. */
  loggedDates?: Set<string>;
  /** Dates that have a draft log (orange) */
  draftDates: Set<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isWeekday(year: number, month: number, day: number): boolean {
  const d = new Date(year, month, day).getDay();
  return d !== 0 && d !== 6;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarNav: React.FC<CalendarNavProps> = React.memo(({ approvedDates, submittedDates, loggedDates, draftDates, selectedDate, onSelectDate }) => {
  // Merge legacy loggedDates into approvedDates/submittedDates sets for display
  const effectiveApproved = approvedDates ?? loggedDates ?? new Set<string>();
  const effectiveSubmitted = submittedDates ?? new Set<string>();
  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  // Count missing workday logs this month up to today
  const missingCount = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(viewYear, viewMonth, d);
      if (dateStr > todayStr) break;
      if (
        isWeekday(viewYear, viewMonth, d) &&
        !effectiveApproved.has(dateStr) &&
        !effectiveSubmitted.has(dateStr) &&
        !draftDates.has(dateStr)
      ) {
        count++;
      }
    }
    return count;
  }, [viewYear, viewMonth, daysInMonth, effectiveApproved, effectiveSubmitted, draftDates, todayStr]);

  const cells: React.ReactNode[] = [];
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(viewYear, viewMonth, d);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const isWeekdayDate = isWeekday(viewYear, viewMonth, d);
    const isFuture = dateStr > todayStr;
    const isApproved = effectiveApproved.has(dateStr);
    const isSubmitted = effectiveSubmitted.has(dateStr);
    const hasDraft = draftDates.has(dateStr);
    const isMissing = isWeekdayDate && !isFuture && !isApproved && !isSubmitted && !hasDraft;
    const dotColor = isApproved
      ? colors.statusActive      // green
      : isSubmitted
      ? colors.statusPending     // yellow/amber
      : hasDraft
      ? colors.primaryOrange     // orange
      : colors.statusCritical;  // red (missing)

    cells.push(
      <button
        key={d}
        onClick={() => !isFuture && onSelectDate(dateStr)}
        style={{
          width: '100%', aspectRatio: '1', border: 'none',
          borderRadius: borderRadius.md,
          backgroundColor: isSelected ? colors.primaryOrange : isToday ? colors.orangeSubtle : 'transparent',
          color: isSelected ? colors.white : isFuture ? colors.textTertiary : colors.textPrimary,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          fontWeight: isToday ? typography.fontWeight.semibold : typography.fontWeight.normal,
          cursor: isFuture ? 'default' : 'pointer',
          opacity: isFuture ? 0.4 : 1,
          position: 'relative',
          transition: `background-color ${transitions.quick}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {d}
        {/* Status dot */}
        {!isSelected && (isApproved || isSubmitted || hasDraft || isMissing) && (
          <div style={{
            position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
            width: 5, height: 5, borderRadius: borderRadius.full,
            backgroundColor: dotColor,
          }} />
        )}
      </button>
    );
  }

  return (
    <div>
      {/* Missing logs alert */}
      {missingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
          backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={14} color={colors.statusCritical} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
            {missingCount} workday{missingCount > 1 ? 's' : ''} missing a daily log this month
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <button onClick={prevMonth} style={{ padding: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: borderRadius.sm, color: colors.textSecondary }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ padding: spacing['2'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: borderRadius.sm, color: colors.textSecondary }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: spacing['1'] }}>
        {DAY_NAMES.map(d => (
          <span key={d} style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center', fontWeight: typography.fontWeight.medium, padding: `${spacing['1']} 0` }}>{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${spacing['2']} ${spacing['3']}`, marginTop: spacing['3'], justifyContent: 'center' }}>
        {[
          { color: colors.statusActive, label: 'Approved' },
          { color: colors.statusPending, label: 'Submitted' },
          { color: colors.primaryOrange, label: 'Draft' },
          { color: colors.statusCritical, label: 'Missing' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 6, height: 6, borderRadius: borderRadius.full, backgroundColor: item.color }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
CalendarNav.displayName = 'CalendarNav';
