import React, { useMemo, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { colors, typography, spacing } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';
import {
  scheduleRange,
  isMilestone,
  isBehind,
  daysBehind,
  tradeFor,
} from './ScheduleHelpers';
import { BehindDot } from './ScheduleStatusChip';

interface ScheduleTimelineProps {
  phases: SchedulePhase[];
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  onPhaseClick: (phase: SchedulePhase) => void;
  onIrisClick: (phase: SchedulePhase) => void;
}

const ROW_HEIGHT = 36;
const NAME_RAIL_WIDTH = 300;
const HEADER_HEIGHT = 32;

function pctOfRange(time: number, start: number, span: number): number {
  return Math.max(0, Math.min(100, ((time - start) / span) * 100));
}

function isIrisRisk(phase: SchedulePhase): boolean {
  if (!phase.is_critical_path) return false;
  if (phase.status === 'delayed') return true;
  const float = Number(phase.float_days ?? 0);
  if (float >= 0 && float < 3) return true;
  return false;
}

interface MonthTick {
  position: number;
  label: string;
}

function monthTicks(start: number, end: number): MonthTick[] {
  const ticks: MonthTick[] = [];
  const span = end - start;
  if (span <= 0) return ticks;
  const cursor = new Date(start);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < end) {
    ticks.push({
      position: ((cursor.getTime() - start) / span) * 100,
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
  phases,
  focusedId,
  onFocusChange,
  onPhaseClick,
  onIrisClick,
}) => {
  const range = useMemo(() => scheduleRange(phases), [phases]);
  const ticks = useMemo(
    () => (range ? monthTicks(range.start, range.end) : []),
    [range],
  );
  const focusedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusedRef.current) {
      focusedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedId]);

  if (!range) {
    return (
      <div
        style={{
          padding: spacing[8],
          textAlign: 'center',
          color: colors.textTertiary,
          fontFamily: typography.fontFamily,
          fontSize: 13,
        }}
      >
        Activities are missing start or end dates.
      </div>
    );
  }

  const todayPct = pctOfRange(Date.now(), range.start, range.spanMs);

  return (
    <div
      role="grid"
      aria-label="Schedule timeline"
      aria-rowcount={phases.length}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Header axis */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${NAME_RAIL_WIDTH}px 1fr`,
          height: HEADER_HEIGHT,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          background: '#FCFCFA',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: spacing[4],
            fontFamily: typography.fontFamily,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: colors.textTertiary,
          }}
        >
          Activity
        </div>
        <div style={{ position: 'relative' }}>
          {ticks.map((t, i) => (
            <div
              key={`${t.label}-${i}`}
              style={{
                position: 'absolute',
                left: `${t.position}%`,
                top: 0,
                bottom: 0,
                paddingLeft: 4,
                fontFamily: typography.fontFamily,
                fontSize: 11,
                fontWeight: 500,
                color: colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                borderLeft: `1px solid ${colors.borderSubtle}`,
              }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Body rows */}
      <div style={{ position: 'relative' }}>
        {/* Today line */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `calc(${NAME_RAIL_WIDTH}px + (100% - ${NAME_RAIL_WIDTH}px) * ${todayPct / 100})`,
              top: 0,
              bottom: 0,
              width: 1,
              background: colors.primaryOrange,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}

        {phases.map((phase, idx) => {
          const start = phase.start_date ? new Date(phase.start_date).getTime() : null;
          const end = phase.end_date ? new Date(phase.end_date).getTime() : null;
          if (!start || !end) return null;

          const baselineStart = phase.baselineStartDate
            ? new Date(phase.baselineStartDate).getTime()
            : null;
          const baselineEnd = phase.baselineEndDate
            ? new Date(phase.baselineEndDate).getTime()
            : null;

          const milestone = isMilestone(phase);
          const startPct = pctOfRange(start, range.start, range.spanMs);
          const endPct = pctOfRange(end, range.start, range.spanMs);
          const widthPct = Math.max(milestone ? 0 : 1.2, endPct - startPct);

          const baselineBar =
            baselineStart && baselineEnd
              ? {
                  startPct: pctOfRange(baselineStart, range.start, range.spanMs),
                  endPct: pctOfRange(baselineEnd, range.start, range.spanMs),
                }
              : null;

          const behind = isBehind(phase);
          const lagDays = behind ? daysBehind(phase) : 0;
          const irisRisk = isIrisRisk(phase);
          const isFocused = focusedId === phase.id;

          const barColor = phase.is_critical_path
            ? colors.rust
            : behind
              ? '#9A2929'
              : '#3F4754';
          const barFill = phase.is_critical_path
            ? colors.rust
            : behind
              ? '#9A2929'
              : '#5C6371';

          const progress = Math.max(0, Math.min(100, Number(phase.percent_complete ?? 0)));

          return (
            <div
              key={phase.id}
              role="row"
              aria-rowindex={idx + 1}
              aria-selected={isFocused}
              data-phase-id={phase.id}
              ref={isFocused ? focusedRef : undefined}
              onClick={() => {
                onFocusChange(phase.id);
                onPhaseClick(phase);
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: `${NAME_RAIL_WIDTH}px 1fr`,
                height: ROW_HEIGHT,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                background: isFocused ? '#F4F2EF' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {/* Name rail */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingLeft: spacing[4],
                  paddingRight: spacing[3],
                  borderRight: `1px solid ${colors.borderSubtle}`,
                  minWidth: 0,
                }}
              >
                {behind && <BehindDot daysBehind={lagDays} />}
                <span
                  title={phase.name}
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: 13,
                    fontWeight: 500,
                    color: colors.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}
                >
                  {phase.name}
                </span>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: 11,
                    color: colors.textTertiary,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tradeFor(phase)}
                </span>
              </div>

              {/* Bar lane */}
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                }}
              >
                {/* Baseline shadow */}
                {baselineBar && !milestone && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${baselineBar.startPct}%`,
                      width: `${Math.max(0.5, baselineBar.endPct - baselineBar.startPct)}%`,
                      transform: 'translateY(2px)',
                      height: 4,
                      background: 'rgba(26, 22, 19, 0.10)',
                      borderRadius: 2,
                    }}
                  />
                )}

                {/* Activity bar / milestone */}
                {milestone ? (
                  <div
                    aria-label="Milestone"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${startPct}%`,
                      width: 12,
                      height: 12,
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      background: barColor,
                      border: `1px solid ${barColor}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                      transform: 'translateY(-50%)',
                      height: 14,
                      background: 'rgba(26, 22, 19, 0.06)',
                      border: `1px solid ${barColor}`,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: barFill,
                      }}
                    />
                  </div>
                )}

                {/* Iris risk pill */}
                {irisRisk && !milestone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIrisClick(phase);
                    }}
                    aria-label="Iris detected risk on this activity"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `calc(${endPct}% + 6px)`,
                      transform: 'translateY(-50%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#EEEDFB',
                      border: 'none',
                      color: colors.indigo,
                      fontFamily: typography.fontFamily,
                      fontSize: 10,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={10} aria-hidden="true" />
                    Iris detected risk
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleTimeline;
