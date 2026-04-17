import React from 'react';
import { MetricBox } from '../../components/Primitives';
import { Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { STATUS_COLORS } from './types';

type Alert = { id: string | number } & Record<string, unknown>;

interface PunchListFiltersProps {
  isMobile: boolean;
  pageAlerts: Alert[];
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

export const PunchListFilters: React.FC<PunchListFiltersProps> = ({
  isMobile,
  pageAlerts,
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
  return (
    <>
      {/* Predictive Alert Banners */}
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert as never} />
      ))}

      {/* AI Insight Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>AI Analysis: 2 punch items trending overdue based on current response times. Completion rate at {completionPct}%. Floor 8 has the highest concentration of open items.</p>
          <button onClick={() => setAtRiskFilter(true)} style={{ marginTop: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.statusReview, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}>View At Risk Items</button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? '8px' : spacing['3'], marginBottom: spacing['4'] }}>
        <MetricBox label="Total Items" value={totalCount} />
        <MetricBox label="Open" value={openCount} colorOverride={openCount > 0 ? 'warning' : undefined} />
        <MetricBox label="In Progress" value={inProgressCount} />
        <MetricBox
          label="Awaiting Verification"
          value={subCompleteCount}
          bgColorOverride={subCompleteCount > 0 ? 'rgba(139, 92, 246, 0.07)' : undefined}
          valueColorOverride={subCompleteCount > 0 ? colors.statusReview : undefined}
        />
        <MetricBox label="Verified" value={verifiedCount} colorOverride={verifiedCount > 0 ? 'success' : undefined} />
        <MetricBox label="Overdue" value={overdueCount} colorOverride={overdueCount > 0 ? 'danger' : undefined} />
      </div>

      {/* Completion Progress Bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: spacing['4'] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
              {verifiedCount} of {totalCount} items verified ({completionPct}%)
            </span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{completionPct}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${completionPct}%`,
                backgroundColor: colors.statusActive,
                borderRadius: borderRadius.full,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' as const }}>
        {[
          { value: 'all', label: 'All', count: totalCount, color: colors.textSecondary, activeBg: `${colors.primaryOrange}15`, activeColor: colors.primaryOrange },
          { value: 'open', label: 'Open', count: openCount, color: STATUS_COLORS.open, activeBg: colors.statusPendingSubtle, activeColor: STATUS_COLORS.open },
          { value: 'in_progress', label: 'In Progress', count: inProgressCount, color: STATUS_COLORS.in_progress, activeBg: colors.statusInfoSubtle, activeColor: STATUS_COLORS.in_progress },
          { value: 'sub_complete', label: 'Awaiting Verification', count: subCompleteCount, color: STATUS_COLORS.sub_complete, activeBg: colors.statusReviewSubtle, activeColor: STATUS_COLORS.sub_complete },
          { value: 'verified', label: 'Verified', count: verifiedCount, color: STATUS_COLORS.verified, activeBg: `${STATUS_COLORS.verified}20`, activeColor: STATUS_COLORS.verified },
          { value: 'overdue', label: 'Overdue', count: overdueCount, color: STATUS_COLORS.rejected, activeBg: `${STATUS_COLORS.rejected}15`, activeColor: STATUS_COLORS.rejected },
        ].map(tab => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setAtRiskFilter(false); }}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                backgroundColor: isActive ? tab.activeBg : 'transparent',
                color: isActive ? tab.activeColor : colors.textSecondary,
                border: `1px solid ${isActive ? tab.activeColor : colors.borderDefault}`,
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                transition: 'all 0.1s',
              }}
            >
              {tab.label}
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, opacity: 0.8 }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Area/Floor Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Filter by Area:</label>
        <select
          value={areaFilter}
          onChange={(e) => { setAreaFilter(e.target.value); setAtRiskFilter(false); }}
          style={{
            padding: `${spacing['1']} ${spacing['3']}`,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.base,
            backgroundColor: colors.white,
            color: colors.textPrimary,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {uniqueAreas.map(area => (
            <option key={area} value={area}>{area === 'all' ? 'All Areas' : area}</option>
          ))}
        </select>
        {atRiskFilter && (
          <button
            onClick={() => setAtRiskFilter(false)}
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              backgroundColor: colors.statusCriticalSubtle,
              color: colors.statusCritical,
              border: `1px solid ${colors.statusCritical}`,
              borderRadius: borderRadius.full,
              cursor: 'pointer',
            }}
          >
            Showing At Risk Items \u00d7
          </button>
        )}
      </div>
    </>
  );
};
