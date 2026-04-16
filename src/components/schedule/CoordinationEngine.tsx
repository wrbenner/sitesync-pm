import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { duration, easingArray } from '../../styles/animations';
import { useScheduleStore } from '../../stores/scheduleStore';
import { detectConflicts, resolveConflict as applyResolution } from '../../services/coordinationService';
import type { TradeConflict, ConflictResolution } from '../../services/coordinationService';
import { ConflictCard } from './ConflictCard';
import { toast } from 'sonner';

// ── Stagger Variants ────────────────────────────────────

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const itemTransition = { duration: duration.smooth / 1000, ease: easingArray.apple };

// ── CoordinationEngine ──────────────────────────────────

interface CoordinationEngineProps {
  /** When true, render in compact mode for the Dashboard embed */
  compact?: boolean;
  /** Maximum number of conflicts to show in compact mode */
  maxItems?: number;
}

export const CoordinationEngine: React.FC<CoordinationEngineProps> = React.memo(({
  compact = false,
  maxItems,
}) => {
  const phases = useScheduleStore((s) => s.phases);
  const [resolvedConflicts, setResolvedConflicts] = useState<TradeConflict[]>([]);

  // Detect conflicts from current schedule phases
  const detectedConflicts = useMemo(() => detectConflicts(phases), [phases]);

  // Merge resolved state into detected conflicts
  const conflicts = useMemo(() => {
    const resolvedIds = new Set(resolvedConflicts.map((c) => c.id));
    return detectedConflicts.map((c) =>
      resolvedIds.has(c.id)
        ? { ...c, resolved: true, resolvedAt: resolvedConflicts.find((r) => r.id === c.id)?.resolvedAt ?? null }
        : c,
    );
  }, [detectedConflicts, resolvedConflicts]);

  const unresolvedCount = conflicts.filter((c) => !c.resolved).length;
  const criticalCount = conflicts.filter((c) => !c.resolved && (c.urgency === 'critical' || c.urgency === 'high')).length;

  const handleResolve = useCallback((conflictId: string, chosenOrder: 'A' | 'B') => {
    const resolution: ConflictResolution = {
      conflictId,
      chosenOrder,
      notifyForemen: true,
      updateLookahead: true,
    };
    const updated = applyResolution(conflicts, resolution);
    const resolved = updated.find((c) => c.id === conflictId);
    if (resolved) {
      setResolvedConflicts((prev) => [...prev, resolved]);

      const tradeFirst = chosenOrder === 'A' ? resolved.phaseA.name : resolved.phaseB.name;
      toast.success(`Conflict resolved: ${tradeFirst} goes first. Foremen notified.`);
    }
  }, [conflicts]);

  // In compact mode, only show unresolved and limit items
  const visibleConflicts = compact
    ? conflicts.filter((c) => !c.resolved).slice(0, maxItems ?? 3)
    : conflicts;

  // Hide entirely if no conflicts
  if (conflicts.length === 0) return null;

  // If all resolved and compact mode, hide
  if (compact && unresolvedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={itemTransition}
      style={{
        backgroundColor: compact ? 'transparent' : colors.surfaceRaised,
        borderRadius: compact ? 0 : borderRadius.xl,
        boxShadow: compact ? 'none' : shadows.card,
        border: compact ? 'none' : `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {!compact && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: borderRadius.md,
              backgroundColor: criticalCount > 0 ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Shield size={16} color={criticalCount > 0 ? colors.statusCritical : colors.statusPending} />
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: typography.fontSize.subtitle,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}>
                Trade Coordination
              </h2>
              <p style={{
                margin: 0,
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
              }}>
                {unresolvedCount > 0
                  ? `${unresolvedCount} conflict${unresolvedCount !== 1 ? 's' : ''} detected${criticalCount > 0 ? ` · ${criticalCount} critical` : ''}`
                  : 'All conflicts resolved'
                }
              </p>
            </div>
          </div>

          {unresolvedCount === 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: `${colors.statusActive}12`,
              borderRadius: borderRadius.full,
            }}>
              <CheckCircle size={14} color={colors.statusActive} />
              <span style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.statusActive,
              }}>
                All Clear
              </span>
            </div>
          )}
        </div>
      )}

      {/* Compact Header (Dashboard embed) */}
      {compact && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          marginBottom: spacing['3'],
        }}>
          <AlertTriangle size={16} color={criticalCount > 0 ? colors.statusCritical : colors.statusPending} />
          <span style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}>
            Coordination Alerts
          </span>
          <span style={{
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.bold,
            color: criticalCount > 0 ? colors.statusCritical : colors.statusPending,
            backgroundColor: criticalCount > 0 ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
            padding: `1px ${spacing['2']}`,
            borderRadius: borderRadius.full,
          }}>
            {unresolvedCount}
          </span>
        </div>
      )}

      {/* Conflict List */}
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? spacing['2'] : spacing['3'],
          padding: compact ? 0 : `${spacing['4']} ${spacing['5']}`,
        }}
      >
        <AnimatePresence mode="popLayout">
          {visibleConflicts.map((conflict) => (
            <motion.div
              key={conflict.id}
              variants={itemVariants}
              transition={itemTransition}
            >
              <ConflictCard
                conflict={conflict}
                onResolve={handleResolve}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Show remaining count in compact mode */}
        {compact && unresolvedCount > (maxItems ?? 3) && (
          <p style={{
            margin: 0,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            textAlign: 'center',
            paddingTop: spacing['1'],
          }}>
            +{unresolvedCount - (maxItems ?? 3)} more conflict{unresolvedCount - (maxItems ?? 3) !== 1 ? 's' : ''}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
});

CoordinationEngine.displayName = 'CoordinationEngine';
