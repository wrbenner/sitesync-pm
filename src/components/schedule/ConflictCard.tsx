import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, ChevronDown, ChevronUp, CheckCircle, Users, ArrowRight, History } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { tradeColors } from '../../styles/theme';
import { duration, easingArray, easing } from '../../styles/animations';
import type { TradeConflict, ConflictUrgency } from '../../services/coordinationService';
import { getTradeLabel } from '../../services/coordinationService';

// ── Urgency Config ──────────────────────────────────────

const URGENCY_CONFIG: Record<ConflictUrgency, { label: string; bg: string; border: string; text: string }> = {
  critical: {
    label: 'Critical',
    bg: colors.statusCriticalSubtle,
    border: colors.statusCritical,
    text: colors.statusCritical,
  },
  high: {
    label: 'High',
    bg: colors.statusPendingSubtle,
    border: colors.statusPending,
    text: colors.statusPending,
  },
  medium: {
    label: 'Medium',
    bg: colors.statusPendingSubtle,
    border: '#D97706',
    text: '#D97706',
  },
  low: {
    label: 'Low',
    bg: colors.statusInfoSubtle,
    border: colors.statusInfo,
    text: colors.statusInfo,
  },
};

// ── Overlap Bars ────────────────────────────────────────

const OverlapBars: React.FC<{ tradeA: string; tradeB: string }> = ({ tradeA, tradeB }) => {
  const colorA = tradeColors[tradeA] ?? colors.primaryOrange;
  const colorB = tradeColors[tradeB] ?? colors.statusInfo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 48, flexShrink: 0 }}>
      <div style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colorA,
        width: '100%',
      }} />
      <div style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colorB,
        width: '100%',
        marginLeft: 8,
      }} />
      {/* Overlap indicator */}
      <div style={{
        height: 3,
        borderRadius: 2,
        background: `linear-gradient(90deg, ${colorA} 0%, ${colorB} 100%)`,
        width: '75%',
        marginLeft: 4,
        opacity: 0.6,
      }} />
    </div>
  );
};

// ── ConflictCard ────────────────────────────────────────

interface ConflictCardProps {
  conflict: TradeConflict;
  onResolve: (conflictId: string, chosenOrder: 'A' | 'B') => void;
}

export const ConflictCard: React.FC<ConflictCardProps> = React.memo(({ conflict, onResolve }) => {
  const [expanded, setExpanded] = useState(false);
  const urgencyConfig = URGENCY_CONFIG[conflict.urgency];
  const tradeA = getTradeLabel(conflict.phaseA);
  const tradeB = getTradeLabel(conflict.phaseB);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (conflict.resolved) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: duration.smooth / 1000 }}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          padding: spacing['4'],
          border: `1px solid ${colors.borderSubtle}`,
          opacity: 0.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <CheckCircle size={18} color={colors.statusActive} />
          <span style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            textDecoration: 'line-through',
          }}>
            {conflict.phaseA.name} vs {conflict.phaseB.name} — Resolved
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: duration.smooth / 1000, ease: easingArray.apple }}
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${urgencyConfig.border}30`,
        borderLeft: `3px solid ${urgencyConfig.border}`,
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}
    >
      {/* Card Header — always visible */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${conflict.phaseA.name} and ${conflict.phaseB.name} conflict, ${urgencyConfig.label} urgency. ${expanded ? 'Collapse' : 'Expand'} for details.`}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); }
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing['3'],
          padding: spacing['4'],
          cursor: 'pointer',
          transition: `background-color ${duration.fast}ms ${easing.standard}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
      >
        {/* Visual overlap bars */}
        <OverlapBars tradeA={tradeA} tradeB={tradeB} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Trade names */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap', marginBottom: spacing['1'] }}>
            <span style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              {conflict.phaseA.name}
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>vs</span>
            <span style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              {conflict.phaseB.name}
            </span>
          </div>

          {/* Meta row: location + overlap period */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <MapPin size={12} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                {conflict.location}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <Clock size={12} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                {formatDate(conflict.overlapStart)} – {formatDate(conflict.overlapEnd)} ({conflict.overlapDays}d overlap)
              </span>
            </div>
          </div>
        </div>

        {/* Urgency badge + expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1'],
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.bold,
            color: urgencyConfig.text,
            backgroundColor: urgencyConfig.bg,
            padding: `2px ${spacing['2']}`,
            borderRadius: borderRadius.full,
            whiteSpace: 'nowrap',
          }}>
            <AlertTriangle size={10} />
            {urgencyConfig.label}
          </span>
          {expanded
            ? <ChevronUp size={16} color={colors.textTertiary} />
            : <ChevronDown size={16} color={colors.textTertiary} />
          }
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.smooth / 1000, ease: easingArray.apple }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: `0 ${spacing['4']} ${spacing['4']}`,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['3'],
              borderTop: `1px solid ${colors.borderSubtle}`,
              paddingTop: spacing['3'],
            }}>
              {/* Schedule Impact Analysis */}
              <div>
                <p style={{
                  margin: `0 0 ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Schedule Impact
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {/* Option A first */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: conflict.suggestedOrder === 'A' ? `${colors.statusActive}08` : colors.surfaceInset,
                    borderRadius: borderRadius.md,
                    border: conflict.suggestedOrder === 'A' ? `1px solid ${colors.statusActive}30` : `1px solid ${colors.borderSubtle}`,
                  }}>
                    <ArrowRight size={14} color={conflict.suggestedOrder === 'A' ? colors.statusActive : colors.textTertiary} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                        {conflict.phaseA.name} first
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginLeft: spacing['2'] }}>
                        +{conflict.impactIfAFirst} day{conflict.impactIfAFirst !== 1 ? 's' : ''} impact
                      </span>
                    </div>
                    {conflict.suggestedOrder === 'A' && (
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.statusActive,
                      }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  {/* Option B first */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: conflict.suggestedOrder === 'B' ? `${colors.statusActive}08` : colors.surfaceInset,
                    borderRadius: borderRadius.md,
                    border: conflict.suggestedOrder === 'B' ? `1px solid ${colors.statusActive}30` : `1px solid ${colors.borderSubtle}`,
                  }}>
                    <ArrowRight size={14} color={conflict.suggestedOrder === 'B' ? colors.statusActive : colors.textTertiary} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                        {conflict.phaseB.name} first
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginLeft: spacing['2'] }}>
                        +{conflict.impactIfBFirst} day{conflict.impactIfBFirst !== 1 ? 's' : ''} impact
                      </span>
                    </div>
                    {conflict.suggestedOrder === 'B' && (
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.statusActive,
                      }}>
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Historical Data */}
              {conflict.historicalNote && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: `${colors.primaryOrange}06`,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.primaryOrange}20`,
                }}>
                  <History size={14} color={colors.primaryOrange} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{
                    margin: 0,
                    fontSize: typography.fontSize.caption,
                    color: colors.textSecondary,
                    lineHeight: typography.lineHeight.relaxed,
                  }}>
                    {conflict.historicalNote}
                  </p>
                </div>
              )}

              {/* Suggested Resolution */}
              <div style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                <p style={{
                  margin: 0,
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  lineHeight: typography.lineHeight.relaxed,
                }}>
                  {conflict.suggestedResolution}
                </p>
              </div>

              {/* Resolution Buttons */}
              <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onResolve(conflict.id, conflict.suggestedOrder); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['4']}`,
                    minHeight: 48,
                    backgroundColor: colors.primaryOrange,
                    color: '#fff',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    transition: `transform ${duration.fast}ms ${easing.standard}, box-shadow ${duration.fast}ms ${easing.standard}`,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'translateY(-1px)';
                    el.style.boxShadow = `0 4px 12px ${colors.primaryOrange}40`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                  aria-label={`Resolve conflict: apply suggested resolution for ${conflict.phaseA.name} and ${conflict.phaseB.name}`}
                >
                  <Users size={14} />
                  Resolve & Notify Foremen
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const altOrder = conflict.suggestedOrder === 'A' ? 'B' : 'A';
                    onResolve(conflict.id, altOrder);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['4']}`,
                    minHeight: 48,
                    backgroundColor: 'transparent',
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    transition: `background-color ${duration.fast}ms ${easing.standard}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                  aria-label={`Use alternate resolution order for ${conflict.phaseA.name} and ${conflict.phaseB.name}`}
                >
                  Use Alternate Order
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

ConflictCard.displayName = 'ConflictCard';
