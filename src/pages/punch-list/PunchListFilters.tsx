import React, { useMemo } from 'react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { STATUS_COLORS } from './types';

interface PunchListFiltersProps {
  isMobile: boolean;
  pageAlerts: Array<{ id: string | number } & Record<string, unknown>>;
  completionPct: number;
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  subCompleteCount: number;
  verifiedCount: number;
  overdueCount: number;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  atRiskFilter: boolean;
  setAtRiskFilter: (v: boolean) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;
  uniqueAreas: string[];
}

// ── Donut Chart ─────────────────────────────────────────
const MiniDonut: React.FC<{ pct: number; size?: number }> = ({ pct, size = 44 }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={colors.surfaceInset} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={colors.statusActive} strokeWidth={5}
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </svg>
  );
};

// ── Status Pill ─────────────────────────────────────────
const StatusPill: React.FC<{
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: '100px',
      border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
      backgroundColor: active ? `${color}12` : 'transparent',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      fontFamily: 'inherit',
      color: active ? color : colors.textSecondary,
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      backgroundColor: color,
      opacity: active ? 1 : 0.6,
      flexShrink: 0,
    }} />
    {label}
    <span style={{
      fontSize: 12,
      fontWeight: 700,
      color: active ? color : colors.textTertiary,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {count}
    </span>
  </button>
);

export const PunchListFilters: React.FC<PunchListFiltersProps> = ({
  isMobile,
  completionPct,
  totalCount,
  openCount,
  inProgressCount,
  subCompleteCount,
  verifiedCount,
  overdueCount,
  statusFilter,
  setStatusFilter,
  atRiskFilter,
  setAtRiskFilter,
  areaFilter,
  setAreaFilter,
  uniqueAreas,
}) => {
  // Filter tabs config
  const tabs = useMemo(() => [
    { value: 'all', label: 'All', count: totalCount, color: colors.textSecondary },
    { value: 'open', label: 'Open', count: openCount, color: STATUS_COLORS.open },
    { value: 'in_progress', label: 'In Progress', count: inProgressCount, color: STATUS_COLORS.in_progress },
    { value: 'sub_complete', label: 'Pending Verify', count: subCompleteCount, color: STATUS_COLORS.sub_complete },
    { value: 'verified', label: 'Closed', count: verifiedCount, color: STATUS_COLORS.verified },
    ...(overdueCount > 0 ? [{ value: 'overdue', label: 'Overdue', count: overdueCount, color: STATUS_COLORS.rejected }] : []),
  ], [totalCount, openCount, inProgressCount, subCompleteCount, verifiedCount, overdueCount]);

  return (
    <div style={{ marginBottom: spacing['4'] }}>
      {/* Summary Bar — compact, information-dense, beautiful */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? spacing['3'] : spacing['5'],
        padding: `${spacing['4']} ${spacing['5']}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: '16px',
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing['3'],
      }}>
        {/* Donut + headline stat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <MiniDonut pct={completionPct} />
            <span style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              color: colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {completionPct}%
            </span>
          </div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: colors.textPrimary,
              lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
            }}>
              {verifiedCount}<span style={{ fontSize: 14, fontWeight: 500, color: colors.textTertiary }}>/{totalCount}</span>
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              items closed
            </div>
          </div>
        </div>

        {/* Separator */}
        {!isMobile && (
          <div style={{ width: 1, height: 36, backgroundColor: colors.borderSubtle, flexShrink: 0 }} />
        )}

        {/* Status filter pills — scrollable on mobile */}
        <div style={{
          display: 'flex',
          gap: 4,
          flex: 1,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 2,
        }}>
          {tabs.map(tab => (
            <StatusPill
              key={tab.value}
              label={tab.label}
              count={tab.count}
              color={tab.color}
              active={statusFilter === tab.value && !atRiskFilter}
              onClick={() => { setStatusFilter(tab.value); setAtRiskFilter(false); }}
            />
          ))}
        </div>

        {/* Area filter — compact dropdown */}
        {uniqueAreas.length > 2 && (
          <div style={{ flexShrink: 0 }}>
            <select
              value={areaFilter}
              onChange={(e) => { setAreaFilter(e.target.value); setAtRiskFilter(false); }}
              style={{
                padding: '6px 28px 6px 12px',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: 500,
                border: `1.5px solid ${areaFilter !== 'all' ? colors.primaryOrange : colors.borderDefault}`,
                borderRadius: '100px',
                backgroundColor: areaFilter !== 'all' ? colors.orangeSubtle : 'transparent',
                color: areaFilter !== 'all' ? colors.primaryOrange : colors.textSecondary,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              {uniqueAreas.map(area => (
                <option key={area} value={area}>{area === 'all' ? 'All Areas' : area}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* At-risk banner — only shows when active */}
      {atRiskFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: colors.statusCriticalSubtle,
          borderRadius: '12px',
          border: `1px solid ${colors.statusCritical}30`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.statusCritical }}>
            Showing at-risk items (high/critical priority, still open)
          </span>
          <button
            onClick={() => setAtRiskFilter(false)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              backgroundColor: colors.statusCritical,
              color: colors.white,
              border: 'none',
              borderRadius: '100px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
