import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { colors, typography, spacing } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';
import {
  tradeFor,
  isBehind,
  daysBehind,
  formatShortDate,
  isMilestone,
} from './ScheduleHelpers';
import { ScheduleStatusChip, BehindDot } from './ScheduleStatusChip';

interface ScheduleListProps {
  phases: SchedulePhase[];
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  onEditPhase: (phase: SchedulePhase) => void;
  onIrisClick: (phase: SchedulePhase) => void;
}

type SortKey = 'name' | 'trade' | 'start' | 'end' | 'progress' | 'float' | 'status';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey;
  label: string;
  width: string;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Activity', width: 'minmax(280px, 2fr)' },
  { key: 'trade', label: 'Trade', width: '120px' },
  { key: 'start', label: 'Start', width: '108px' },
  { key: 'end', label: 'End', width: '108px' },
  { key: 'progress', label: '% Complete', width: '128px', align: 'right' },
  { key: 'float', label: 'Float', width: '88px', align: 'right' },
  { key: 'status', label: 'Status', width: '140px' },
];

function sortPhases(
  phases: SchedulePhase[],
  key: SortKey,
  dir: SortDir,
): SchedulePhase[] {
  const mult = dir === 'asc' ? 1 : -1;
  const arr = [...phases];
  arr.sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (key) {
      case 'name':
        av = (a.name ?? '').toLowerCase();
        bv = (b.name ?? '').toLowerCase();
        break;
      case 'trade':
        av = tradeFor(a);
        bv = tradeFor(b);
        break;
      case 'start':
        av = a.start_date ?? '';
        bv = b.start_date ?? '';
        break;
      case 'end':
        av = a.end_date ?? '';
        bv = b.end_date ?? '';
        break;
      case 'progress':
        av = Number(a.percent_complete ?? 0);
        bv = Number(b.percent_complete ?? 0);
        break;
      case 'float':
        av = Number(a.float_days ?? 0);
        bv = Number(b.float_days ?? 0);
        break;
      case 'status':
        av = a.status ?? '';
        bv = b.status ?? '';
        break;
    }
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
  return arr;
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        justifyContent: 'flex-end',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 64,
          height: 6,
          background: '#EFE9DD',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: clamped >= 100 ? colors.moss : colors.textSecondary,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 12,
          fontWeight: 500,
          color: colors.textSecondary,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {clamped}%
      </span>
    </div>
  );
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  phases,
  focusedId,
  onFocusChange,
  onEditPhase,
  onIrisClick,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('start');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const focusedRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => sortPhases(phases, sortKey, sortDir), [phases, sortKey, sortDir]);

  useEffect(() => {
    if (focusedRef.current) {
      focusedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedId]);

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const gridTemplate = `${COLUMNS.map((c) => c.width).join(' ')} 56px 80px`;

  return (
    <div
      role="grid"
      aria-label="Schedule activities"
      aria-rowcount={sorted.length}
      style={{
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          height: 36,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {COLUMNS.map((col) => {
          const active = sortKey === col.key;
          return (
            <button
              key={col.key}
              type="button"
              role="columnheader"
              aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              onClick={() => onHeaderClick(col.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                padding: `0 ${spacing[3]}`,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: typography.fontFamily,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: active ? colors.textPrimary : colors.textTertiary,
                height: '100%',
              }}
            >
              {col.label}
              {active &&
                (sortDir === 'asc' ? (
                  <ChevronUp size={11} aria-hidden="true" />
                ) : (
                  <ChevronDown size={11} aria-hidden="true" />
                ))}
            </button>
          );
        })}
        <div
          role="columnheader"
          style={{
            paddingLeft: spacing[3],
            fontFamily: typography.fontFamily,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: colors.textTertiary,
          }}
        >
          CP
        </div>
        <div
          role="columnheader"
          style={{
            paddingLeft: spacing[3],
            fontFamily: typography.fontFamily,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: colors.textTertiary,
          }}
        >
          Iris
        </div>
      </div>

      {/* Body */}
      <div>
        {sorted.map((phase, idx) => {
          const behind = isBehind(phase);
          const lagDays = behind ? daysBehind(phase) : 0;
          const focused = focusedId === phase.id;
          const irisRisk =
            phase.is_critical_path === true &&
            (phase.status === 'delayed' || Number(phase.float_days ?? 99) < 3);
          const milestone = isMilestone(phase);
          const float = Number(phase.float_days ?? 0);

          return (
            <div
              key={phase.id}
              role="row"
              aria-rowindex={idx + 1}
              aria-selected={focused}
              data-phase-id={phase.id}
              ref={focused ? focusedRef : undefined}
              tabIndex={focused ? 0 : -1}
              onClick={() => onFocusChange(phase.id)}
              onDoubleClick={() => onEditPhase(phase)}
              style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                alignItems: 'center',
                height: 36,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                background: focused ? '#F4F2EF' : 'transparent',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {/* Activity */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `0 ${spacing[3]}`,
                  minWidth: 0,
                }}
              >
                {behind && <BehindDot daysBehind={lagDays} />}
                {milestone && (
                  <span
                    aria-label="Milestone"
                    style={{
                      width: 8,
                      height: 8,
                      transform: 'rotate(45deg)',
                      background: colors.textSecondary,
                      flexShrink: 0,
                    }}
                  />
                )}
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
                  }}
                >
                  {phase.name}
                </span>
              </div>

              {/* Trade */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tradeFor(phase)}
              </div>

              {/* Start */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatShortDate(phase.start_date)}
              </div>

              {/* End */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatShortDate(phase.end_date)}
              </div>

              {/* % Complete */}
              <div style={{ padding: `0 ${spacing[3]}` }}>
                <ProgressBar value={Number(phase.percent_complete ?? 0)} />
              </div>

              {/* Float */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  textAlign: 'right',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  color: float < 3 ? colors.rust : colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: float < 3 ? 600 : 400,
                }}
              >
                {phase.float_days != null ? `${float}d` : '—'}
              </div>

              {/* Status */}
              <div style={{ padding: `0 ${spacing[3]}` }}>
                <ScheduleStatusChip status={phase.status} />
              </div>

              {/* Critical-path badge */}
              <div
                style={{
                  padding: `0 ${spacing[3]}`,
                  textAlign: 'left',
                }}
              >
                {phase.is_critical_path && (
                  <span
                    title="On critical path"
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(184, 71, 46, 0.10)',
                      color: colors.rust,
                      fontFamily: typography.fontFamily,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                    }}
                  >
                    CP
                  </span>
                )}
              </div>

              {/* Iris pill */}
              <div style={{ padding: `0 ${spacing[3]}` }}>
                {irisRisk && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIrisClick(phase);
                    }}
                    aria-label="Iris detected risk"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#EEEDFB',
                      color: colors.indigo,
                      border: 'none',
                      fontFamily: typography.fontFamily,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Sparkles size={10} aria-hidden="true" />
                    Risk
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

export default ScheduleList;
