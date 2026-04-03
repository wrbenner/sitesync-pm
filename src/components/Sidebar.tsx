import React, { useState, useEffect } from 'react';
import {
  Home, LayoutGrid, Calendar, DollarSign,
  HelpCircle, FileText,
  BookOpen, Briefcase, CheckSquare,
  Users, Zap, Search, ListChecks,
  Activity, Clock, Heart, Shield,
  Calculator, ShieldCheck, Package, Truck,
  Sun, Moon, Bot, ClipboardCheck,
  Plug, BarChart3, Leaf, ScrollText, Code, Globe, Store,
  TrendingUp, FileDiff, Send, HardHat, Repeat2,
  Receipt, Milestone, ChevronDown, ChevronRight,
  Bell, Settings, LogOut, X, MoreHorizontal,
} from 'lucide-react';
import { useUiStore } from '../stores';
import { motion } from 'framer-motion';
import { colors, spacing, typography, borderRadius, transitions, layout, zIndex } from '../styles/theme';
import { duration, easing, motion as motionTokens } from '../styles/animations';
import { ProgressBar } from './Primitives';
import { usePermissions } from '../hooks/usePermissions';
import { SidebarPresenceDot } from './collaboration/PresenceBar';
import { AgentStatusBadge } from './ai/agentStream';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  /** When true, renders as a non-fixed overlay panel (position: relative) */
  mode?: 'overlay';
  /** If provided, a close button is shown and calls this when clicked */
  onClose?: () => void;
}

const sections = [
  {
    label: 'Portfolio',
    items: [
      { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    ],
  },
  {
    label: 'Command',
    items: [
      { id: 'dashboard', label: 'Command Center', icon: Home },
      { id: 'project-health', label: 'Project Health', icon: Heart },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'copilot', label: 'AI Copilot', icon: Zap },
      { id: 'ai-agents', label: 'AI Agents', icon: Bot },
      { id: 'time-machine', label: 'Time Machine', icon: Clock },
      { id: 'lookahead', label: 'Lookahead', icon: Milestone },
    ],
  },
  {
    label: 'Project',
    items: [
      { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'budget', label: 'Budget', icon: DollarSign },
      { id: 'change-orders', label: 'Change Orders', icon: FileDiff },
      { id: 'financials', label: 'Financials', icon: TrendingUp },
      { id: 'pay-apps', label: 'Pay Apps', icon: Receipt },
      { id: 'drawings', label: 'Drawings', icon: FileText },
      { id: 'rfis', label: 'RFIs', icon: HelpCircle },
      { id: 'submittals', label: 'Submittals', icon: Send },
      { id: 'estimating', label: 'Estimating', icon: Calculator },
      { id: 'procurement', label: 'Procurement', icon: Package },
      { id: 'equipment', label: 'Equipment', icon: Truck },
      { id: 'permits', label: 'Permits', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Field',
    items: [
      { id: 'field-capture', label: 'Field Capture', icon: HardHat },
      { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
      { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
      { id: 'crews', label: 'Crews', icon: Users },
      { id: 'workforce', label: 'Workforce', icon: HardHat },
      { id: 'safety', label: 'Safety', icon: Shield },
      { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { id: 'activity', label: 'Activity Feed', icon: Activity },
      { id: 'meetings', label: 'Meetings', icon: Repeat2 },
      { id: 'directory', label: 'Directory', icon: Users },
    ],
  },
  {
    label: 'Documents',
    items: [
      { id: 'files', label: 'Files', icon: FileText },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      { id: 'audit-trail', label: 'Audit Trail', icon: ScrollText },
      { id: 'integrations', label: 'Integrations', icon: Plug },
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'developers', label: 'Developers', icon: Code },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'benchmarks', label: 'Benchmarks', icon: Globe },
      { id: 'sustainability', label: 'Sustainability', icon: Leaf },
      { id: 'warranties', label: 'Warranties', icon: ShieldCheck },
    ],
  },
];

const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
];

const BOTTOM_NAV_IDS = new Set(BOTTOM_NAV_ITEMS.map(i => i.id));

const PAGE_PREFETCH_MAP: Record<string, () => void> = {
  portfolio:      () => import('../pages/Portfolio').catch(() => {}),
  dashboard:      () => import('../pages/Dashboard').catch(() => {}),
  'project-health': () => import('../pages/ProjectHealth').catch(() => {}),
  copilot:        () => import('../pages/AICopilot').catch(() => {}),
  'ai-agents':    () => import('../pages/AIAgents').catch(() => {}),
  'time-machine': () => import('../pages/TimeMachine').catch(() => {}),
  lookahead:      () => import('../pages/Lookahead').catch(() => {}),
  tasks:          () => import('../pages/Tasks').catch(() => {}),
  schedule:       () => import('../pages/Schedule').catch(() => {}),
  budget:         () => import('../pages/Budget').catch(() => {}),
  'change-orders': () => import('../pages/ChangeOrders').catch(() => {}),
  financials:     () => import('../pages/Financials').catch(() => {}),
  'pay-apps':     () => import('../pages/PaymentApplications').catch(() => {}),
  drawings:       () => import('../pages/Drawings').catch(() => {}),
  rfis:           () => import('../pages/RFIs').catch(() => {}),
  submittals:     () => import('../pages/Submittals').catch(() => {}),
  estimating:     () => import('../pages/Estimating').catch(() => {}),
  procurement:    () => import('../pages/Procurement').catch(() => {}),
  equipment:      () => import('../pages/Equipment').catch(() => {}),
  permits:        () => import('../pages/Permits').catch(() => {}),
  'field-capture': () => import('../pages/FieldCapture').catch(() => {}),
  'daily-log':    () => import('../pages/DailyLog').catch(() => {}),
  'punch-list':   () => import('../pages/PunchList').catch(() => {}),
  crews:          () => import('../pages/Crews').catch(() => {}),
  workforce:      () => import('../pages/Workforce').catch(() => {}),
  safety:         () => import('../pages/Safety').catch(() => {}),
  insurance:      () => import('../pages/Insurance').catch(() => {}),
  activity:       () => import('../pages/Activity').catch(() => {}),
  meetings:       () => import('../pages/Meetings').catch(() => {}),
  directory:      () => import('../pages/Directory').catch(() => {}),
  files:          () => import('../pages/Files').catch(() => {}),
  'audit-trail':  () => import('../pages/AuditTrail').catch(() => {}),
  integrations:   () => import('../pages/Integrations').catch(() => {}),
  marketplace:    () => import('../pages/Marketplace').catch(() => {}),
  developers:     () => import('../pages/Developers').catch(() => {}),
  reports:        () => import('../pages/Reports').catch(() => {}),
  benchmarks:     () => import('../pages/Benchmarks').catch(() => {}),
  sustainability: () => import('../pages/Sustainability').catch(() => {}),
  warranties:     () => import('../pages/Warranties').catch(() => {}),
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, mode, onClose }) => {
  const { themeMode, setThemeMode } = useUiStore();
  const toggleTheme = () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  const { canAccessModule, role } = usePermissions();
  const isOverlay = mode === 'overlay';

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isMobile) {
    const allMoreItems = sections.flatMap(s => s.items).filter(item => !BOTTOM_NAV_IDS.has(item.id) && canAccessModule(item.id));

    return (
      <>
        {/* Bottom tab bar */}
        <nav
          aria-label="Main navigation"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            zIndex: 1000,
            backgroundColor: colors.surfaceSidebar,
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {BOTTOM_NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                onMouseEnter={() => PAGE_PREFETCH_MAP[item.id]?.()}
                onFocus={() => PAGE_PREFETCH_MAP[item.id]?.()}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  minWidth: '44px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isActive ? colors.primaryOrange : colors.textOnDarkMuted,
                  gap: 3,
                  padding: 0,
                  transition: `color ${transitions.instant}`,
                }}
              >
                <Icon size={16} />
                <span style={{ fontSize: '10px', fontFamily: typography.fontFamily, fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal, lineHeight: 1 }}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMoreSheet(true)}
            aria-label="More navigation items"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              minWidth: '44px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textOnDarkMuted,
              gap: 3,
              padding: 0,
            }}
          >
            <MoreHorizontal size={16} />
            <span style={{ fontSize: '10px', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.normal, lineHeight: 1 }}>More</span>
          </button>
        </nav>

        {/* Slide-up sheet overlay */}
        {showMoreSheet && (
          <div
            role="dialog"
            aria-label="More navigation"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            {/* Scrim */}
            <div
              onClick={() => setShowMoreSheet(false)}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: colors.overlayScrim,
              }}
            />
            {/* Sheet panel */}
            <div
              style={{
                position: 'relative',
                backgroundColor: colors.surfaceSidebar,
                borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
                paddingBottom: 80,
                paddingTop: spacing['4'],
                maxHeight: '75vh',
                overflowY: 'auto',
              }}
            >
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing['4'] }}>
                <div style={{ width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.borderDefault }} />
              </div>
              {/* Close */}
              <button
                onClick={() => setShowMoreSheet(false)}
                aria-label="Close menu"
                style={{
                  position: 'absolute',
                  top: spacing['4'],
                  right: spacing['4'],
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.overlayBlackLight,
                  border: 'none',
                  borderRadius: borderRadius.base,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                <X size={16} />
              </button>
              {/* Items grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['2'], padding: `0 ${spacing['4']}` }}>
                {allMoreItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setShowMoreSheet(false); }}
                      onMouseEnter={() => PAGE_PREFETCH_MAP[item.id]?.()}
                      onFocus={() => PAGE_PREFETCH_MAP[item.id]?.()}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        minWidth: '44px',
                        gap: spacing['1.5'],
                        padding: `${spacing['3']} ${spacing['2']}`,
                        backgroundColor: isActive ? colors.orangeSubtle : colors.overlayBlackLight,
                        border: isActive ? `1px solid ${colors.primaryOrange}` : '1px solid transparent',
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        color: isActive ? colors.primaryOrange : colors.textSecondary,
                      }}
                    >
                      <Icon size={16} />
                      <span style={{ fontSize: '10px', fontFamily: typography.fontFamily, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        ...(isOverlay
          ? { position: 'relative', height: '100%' }
          : { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: zIndex.sticky }),
        width: layout.sidebarWidth,
        backgroundColor: colors.surfaceSidebar,
        borderRight: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo row — includes close button when in overlay mode */}
      <div style={{ padding: `${spacing['5']} ${spacing['5']}`, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <div
          style={{
            width: 28,
            height: 28,
            background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
            borderRadius: borderRadius.base,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          S
        </div>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight }}>
          SiteSync
        </span>
        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, marginTop: `-${spacing['1.5']}`, marginLeft: `-${spacing['0.5']}` }}>
          AI
        </span>
        {isOverlay && onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            style={{
              marginLeft: 'auto',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.overlayBlackLight,
              border: 'none',
              borderRadius: borderRadius.base,
              cursor: 'pointer',
              color: colors.textSecondary,
              flexShrink: 0,
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search trigger */}
      <div style={{ padding: `0 ${spacing['3']}`, marginBottom: spacing['4'] }}>
        <button
          onClick={() => {
            // Trigger Cmd+K
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: colors.overlayBlackLight,
            border: 'none',
            borderRadius: borderRadius.base,
            cursor: 'pointer',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            color: colors.textTertiary,
            transition: `background-color ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
        >
          <Search size={14} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
          <kbd style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, backgroundColor: colors.overlayBlackThin, padding: `${spacing['0.5']} ${spacing['1.5']}`, borderRadius: borderRadius.sm, fontFamily: typography.fontFamilyMono }}>⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: `0 ${spacing['2']}` }}>
        {sections.map((section, si) => {
          // Filter items the user has permission to access
          const visibleItems = section.items.filter(item => canAccessModule(item.id));
          if (visibleItems.length === 0) return null;

          return (
          <div key={si} style={{ marginBottom: spacing['4'] }}>
            {section.label && (
              <p style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.widest,
                padding: `0 ${spacing['3']}`,
                margin: `${spacing['2']} 0 ${spacing['1']} 0`,
              }}>
                {section.label}
              </p>
            )}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    margin: `${spacing.px} 0`,
                    backgroundColor: 'transparent',
                    color: isActive ? colors.orangeText : colors.textSecondary,
                    border: 'none',
                    borderRadius: borderRadius.base,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                    letterSpacing: typography.letterSpacing.normal,
                    transition: `background-color ${duration.instant}ms ${easing.standard}, color ${duration.instant}ms ${easing.standard}`,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    PAGE_PREFETCH_MAP[item.id]?.();
                    if (!isActive) {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = colors.overlayBlackLight;
                      el.style.color = colors.textPrimary;
                    }
                  }}
                  onFocus={() => PAGE_PREFETCH_MAP[item.id]?.()}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = 'transparent';
                      el.style.color = colors.textSecondary;
                    }
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: colors.orangeSubtle,
                        borderRadius: borderRadius.md,
                        borderLeft: `2px solid ${colors.primaryOrange}`,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={16} style={{ position: 'relative', zIndex: 1 }} />
                  <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
                  <SidebarPresenceDot page={item.id} />
                </button>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Project context */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: spacing['4'] }}>
        <div
          style={{
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: `${spacing['3']} ${spacing['4']}`,
          }}
        >
          <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
            Meridian Tower
          </p>
          <ProgressBar value={62} height={3} color={colors.statusActive} bgColor={colors.borderDefault} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>62% complete</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>154d left</span>
          </div>
        </div>
      </div>

      {/* Active Agents (shown only when agents are running) */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: `${spacing['3']} ${spacing['4']}` }}>
        <AgentStatusBadge agents={[]} compact={false} />
      </div>

      {/* User */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: `${spacing['3']} ${spacing['4']}`, display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
            borderRadius: borderRadius.full,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.semibold,
            flexShrink: 0,
          }}
        >
          WB
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>Walker Benner</p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'capitalize' }}>{role ? role.replace('_', ' ') : 'Project Manager'}</p>
        </div>
        <button
          onClick={toggleTheme}
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.overlayBlackLight,
            border: 'none',
            borderRadius: borderRadius.base,
            cursor: 'pointer',
            color: colors.textSecondary,
            flexShrink: 0,
            transition: `background-color ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
        >
          {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </nav>
  );
};
