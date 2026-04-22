import React from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, HelpCircle, Users,
  ArrowRight, Scale, AlertCircle,
  ClipboardList, Circle, Sparkles,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { duration, easing, easingArray } from '../../styles/animations';
import { ProgressRing } from './DashboardMetrics';
import { staggerTransition } from './types';

// ── Hero ────────────────────────────────────────────────

interface HeroProps {
  projectName: string;
  projectAddress: string;
  dayNumber: number;
  totalDays: number;
  daysRemaining: number;
  animProgress: number;
  reducedMotion: boolean;
}

export const DashboardHero: React.FC<HeroProps> = ({
  projectName,
  projectAddress,
  dayNumber,
  totalDays,
  daysRemaining,
  animProgress,
  reducedMotion,
}) => {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reducedMotion ? undefined : staggerTransition}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing['6'],
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.card,
        marginBottom: spacing['5'],
        border: `1px solid ${colors.borderSubtle}`,
        borderLeft: `3px solid ${colors.primaryOrange}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['1'] }}>
          <p
            style={{
              fontSize: typography.fontSize.label,
              color: colors.primaryOrange,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            Active Project
          </p>
          <span style={{
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            fontWeight: typography.fontWeight.medium,
          }}>
            ·
          </span>
          <span style={{
            fontSize: typography.fontSize.caption,
            color: colors.textSecondary,
            fontWeight: typography.fontWeight.medium,
          }}>
            {dayName}, {dateStr}
          </span>
        </div>
        <h1
          style={{
            fontSize: typography.fontSize.display,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: typography.letterSpacing.tighter,
            lineHeight: typography.lineHeight.tight,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {projectName}
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            margin: 0,
            marginTop: spacing['1'],
          }}
        >
          {projectAddress}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['6'], flexShrink: 0, marginLeft: spacing['6'] }}>
        <div style={{ textAlign: 'right' }}>
          <p
            style={{
              fontSize: typography.fontSize.label,
              color: colors.textTertiary,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            Timeline
          </p>
          <p
            style={{
              fontSize: typography.fontSize.display,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              marginTop: spacing['0.5'],
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: typography.letterSpacing.tighter,
            }}
          >
            Day {dayNumber}
          </p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['0.5'] }}>
            of {totalDays} · {daysRemaining}d remaining
          </p>
        </div>
        <ProgressRing value={animProgress} size={80} />
      </div>
    </motion.div>
  );
};

// ── Owner Report Quick Access ───────────────────────────

export const OwnerReportCard: React.FC<{ navigate: (path: string) => void; reducedMotion: boolean }> = ({ navigate, reducedMotion }) => (
  <motion.div
    initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
    transition={reducedMotion ? undefined : { ...staggerTransition, delay: 0.15 }}
    role="button"
    tabIndex={0}
    onClick={() => navigate('/reports/owner')}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/reports/owner'); } }}
    aria-label="Generate Owner Report"
    whileHover={{ y: -1, boxShadow: shadows.cardHover, transition: { duration: duration.normal / 1000, ease: easingArray.standard } }}
    whileTap={{ scale: 0.995, transition: { duration: duration.fast / 1000 } }}
    style={{
      display: 'flex', alignItems: 'center', gap: spacing['4'],
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
      borderLeft: `3px solid ${colors.primaryOrange}`,
      borderRadius: borderRadius.lg,
      marginBottom: spacing['5'],
      boxShadow: shadows.card,
      cursor: 'pointer',
    }}
  >
    <div style={{
      width: 36, height: 36, borderRadius: borderRadius.base, flexShrink: 0,
      background: `linear-gradient(135deg, ${colors.brand400}, ${colors.orangeGradientEnd})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Sparkles size={16} color={colors.white} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{
        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary, margin: 0,
      }}>
        Owner Report Ready
      </p>
      <p style={{
        fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1,
      }}>
        AI-generated progress narrative, schedule and budget dashboards for your next OAC meeting
      </p>
    </div>
    <ArrowRight size={16} color={colors.textTertiary} />
  </motion.div>
);

// ── Missing Waivers Action Item ─────────────────────────

export const MissingWaiversAlert: React.FC<{ count: number; navigate: (path: string) => void; reducedMotion: boolean }> = ({ count, navigate, reducedMotion }) => {
  if (count === 0) return null;
  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reducedMotion ? undefined : { ...staggerTransition, delay: 0.2 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
        padding: spacing['4'],
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderLeft: `3px solid ${colors.statusCritical}`,
        borderRadius: borderRadius.lg,
        marginBottom: spacing['5'],
        boxShadow: shadows.card,
        cursor: 'pointer',
      }}
      onClick={() => navigate('/payment-applications')}
    >
      <div style={{
        width: 36, height: 36, borderRadius: borderRadius.base, flexShrink: 0,
        backgroundColor: colors.statusCriticalSubtle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Scale size={16} color={colors.statusCritical} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Lien Waivers Missing
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 20, height: 20, padding: `0 ${spacing['1']}`,
            backgroundColor: colors.statusCritical, color: colors.white,
            borderRadius: borderRadius.full, fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.bold,
          }}>
            {count}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
          {count} approved pay app{count !== 1 ? 's have' : ' has'} no lien waiver on file. Collect before releasing payment.
        </p>
      </div>
      <AlertCircle size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />
    </motion.div>
  );
};

// ── Onboarding Checklist (empty project) ────────────────

export const OnboardingChecklist: React.FC<{ navigate: (path: string) => void; reducedMotion: boolean }> = ({ navigate, reducedMotion }) => (
  <motion.div
    initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
    transition={reducedMotion ? undefined : { ...staggerTransition, delay: 0.15 }}
    style={{
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.xl,
      padding: spacing['6'],
      marginBottom: spacing['5'],
      boxShadow: shadows.card,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: borderRadius.base,
        backgroundColor: colors.orangeSubtle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.primaryOrange,
        flexShrink: 0,
      }}>
        <Sparkles size={14} />
      </div>
      <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        Get started with your project
      </p>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {[
        { label: 'Add schedule phases', path: '/schedule', icon: <Calendar size={14} /> },
        { label: 'Set project budget', path: '/budget', icon: <DollarSign size={14} /> },
        { label: 'Invite team members', path: '/directory', icon: <Users size={14} /> },
        { label: 'Create first RFI', path: '/rfis', icon: <HelpCircle size={14} /> },
        { label: 'Start punch list', path: '/punch-list', icon: <ClipboardList size={14} /> },
      ].map((item, i) => (
        <motion.div
          key={item.path}
          role="button"
          tabIndex={0}
          onClick={() => navigate(item.path)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.path); } }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35, delay: i * 0.05 }}
          whileHover={{ x: 3, transition: { type: 'spring', stiffness: 500, damping: 28 } }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceInset; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            minHeight: spacing['12'],
            borderRadius: borderRadius.base,
            cursor: 'pointer',
            transition: `background-color ${duration.fast}ms ${easing.standard}`,
          }}
        >
          <Circle size={16} color={colors.borderDefault} />
          <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            {item.label}
          </span>
          <ArrowRight size={14} color={colors.textTertiary} />
        </motion.div>
      ))}
    </div>
  </motion.div>
);
