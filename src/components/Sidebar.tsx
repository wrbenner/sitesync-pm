import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Home, Calendar, DollarSign, FileText, BookOpen,
  CheckSquare, Users, Search,
  Shield, Calculator, Package, Truck,
  Sun, Moon, ClipboardCheck, BarChart3,
  FileDiff, Send, HardHat,
  Receipt, Clock, X, MoreHorizontal,
  ChevronRight, CheckCircle2,
  FileSignature,
  Pin, PinOff, Box,
  HelpCircle,
  Repeat2, Grid3X3, ChevronDown, Plus, Sparkles,
  History, Star, Settings, Bell, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useUiStore, useAuthStore } from '../stores';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, transitions, layout, zIndex } from '../styles/theme';
import { duration, easing } from '../styles/animations';
import { usePermissions } from '../hooks/usePermissions';
import { SidebarPresenceDot } from './collaboration/PresenceBar';
import { AgentStatusBadge } from './ai/agentStream';
import { useProjects } from '../hooks/queries';
import { useProjectContext } from '../stores/projectContextStore';
import { CreateProjectModal } from './forms/CreateProjectModal';

// ── Types ─────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  mode?: 'overlay';
  onClose?: () => void;
}

// ── Complete item registry ────────────────────────────────
// Every navigable page in the app. This is the single source of truth.

const ALL_ITEMS: NavItem[] = [
  // ── Core 10 (always in primary nav) ──
  { id: 'dashboard', label: 'Home', icon: Home, description: 'Project overview & KPIs' },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen, description: 'Daily reports & logs' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, description: 'Project schedule & Gantt' },
  { id: 'budget', label: 'Budget', icon: DollarSign, description: 'Budget tracking & cash flow' },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle, description: 'Requests for information' },
  { id: 'submittals', label: 'Submittals', icon: Send, description: 'Submittal tracking' },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare, description: 'QC deficiency tracking' },
  { id: 'drawings', label: 'Drawings', icon: FileText, description: 'Drawing sets & markup' },
  { id: 'change-orders', label: 'Change Orders', icon: FileDiff, description: 'Cost change management' },
  { id: 'safety', label: 'Safety', icon: Shield, description: 'OSHA, inspections, incidents' },
  // ── People & Labor ──
  { id: 'workforce', label: 'Workforce', icon: HardHat, description: 'Roster, credentials, dispatch' },
  { id: 'crews', label: 'Crews', icon: Users, description: 'Crew assignments & productivity' },
  { id: 'time-tracking', label: 'Time Tracking', icon: Clock, description: 'WH-347, Davis-Bacon, payroll' },
  { id: 'directory', label: 'Directory', icon: Users, description: 'Team & sub contacts' },
  { id: 'meetings', label: 'Meetings', icon: Repeat2, description: 'OAC, sub coordination, safety' },
  // ── Financial ──
  { id: 'pay-apps', label: 'Pay Apps', icon: Receipt, description: 'Payment applications & lien waivers' },
  { id: 'contracts', label: 'Contracts', icon: FileSignature, description: 'Sub agreements & compliance' },
  { id: 'estimating', label: 'Estimating', icon: Calculator, description: 'Preconstruction estimates' },
  // ── Field Operations ──
  { id: 'equipment', label: 'Equipment', icon: Truck, description: 'Fleet tracking & maintenance' },
  { id: 'procurement', label: 'Procurement', icon: Package, description: 'Material ordering & deliveries' },
  { id: 'permits', label: 'Permits', icon: ClipboardCheck, description: 'Permit tracking & inspections' },
  // ── Documents & Closeout ──
  { id: 'files', label: 'Files', icon: FileText, description: 'Document storage & sharing' },
  { id: 'reports', label: 'Reports', icon: BarChart3, description: 'Cross-project reporting' },
  { id: 'closeout', label: 'Closeout', icon: CheckCircle2, description: 'As-builts, O&M, warranties' },
  { id: 'bim', label: 'BIM', icon: Box, description: '3D model coordination' },
  // ── Intelligence ──
  { id: 'ai', label: 'Iris', icon: Sparkles, description: 'Project intelligence — ask anything' },
];

const ITEM_MAP = new Map(ALL_ITEMS.map((i) => [i.id, i]));

// ── Core navigation (the 10 essentials a GC touches daily) ──
// Steve Jobs: "People think focus means saying yes to the thing you've
// got to focus on. It means saying no to the hundred other good ideas."

const CORE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle },
  { id: 'submittals', label: 'Submittals', icon: Send },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
  { id: 'drawings', label: 'Drawings', icon: FileText },
  { id: 'change-orders', label: 'Change Orders', icon: FileDiff },
  { id: 'safety', label: 'Safety', icon: Shield },
];

const CORE_NAV_IDS = new Set(CORE_NAV.map((i) => i.id));

// ── Default favorites for a GC ──────────────────────────
const DEFAULT_PINS = ['time-tracking', 'workforce', 'crews', 'pay-apps', 'contracts'];

// ── All Tools categories (for the browse panel) ──────────
const TOOL_CATEGORIES: NavGroup[] = [
  {
    id: 'people-labor',
    label: 'People & Labor',
    icon: HardHat,
    items: [
      { id: 'workforce', label: 'Workforce', icon: HardHat, description: 'Roster, credentials, dispatch' },
      { id: 'crews', label: 'Crews', icon: Users, description: 'Crew assignments & productivity' },
      { id: 'time-tracking', label: 'Time Tracking', icon: Clock, description: 'WH-347, Davis-Bacon, payroll' },
      { id: 'directory', label: 'Directory', icon: Users, description: 'Team & sub contacts' },
      { id: 'meetings', label: 'Meetings', icon: Repeat2, description: 'OAC, sub coordination, safety' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: DollarSign,
    items: [
      { id: 'budget', label: 'Budget', icon: DollarSign, description: 'Budget tracking & cash flow' },
      { id: 'pay-apps', label: 'Pay Apps', icon: Receipt, description: 'Payment applications & lien waivers' },
      { id: 'change-orders', label: 'Change Orders', icon: FileDiff, description: 'Cost change management' },
      { id: 'contracts', label: 'Contracts', icon: FileSignature, description: 'Sub agreements & compliance' },
      { id: 'estimating', label: 'Estimating', icon: Calculator, description: 'Preconstruction estimates' },
    ],
  },
  {
    id: 'field-ops',
    label: 'Field Operations',
    icon: Shield,
    items: [
      { id: 'daily-log', label: 'Daily Log', icon: BookOpen, description: 'Daily reports & logs' },
      { id: 'punch-list', label: 'Punch List', icon: CheckSquare, description: 'QC deficiency tracking' },
      { id: 'safety', label: 'Safety', icon: Shield, description: 'OSHA, inspections, incidents' },
      { id: 'equipment', label: 'Equipment', icon: Truck, description: 'Fleet tracking & maintenance' },
      { id: 'procurement', label: 'Procurement', icon: Package, description: 'Material ordering & deliveries' },
      { id: 'permits', label: 'Permits', icon: ClipboardCheck, description: 'Permit tracking & inspections' },
    ],
  },
  {
    id: 'docs-closeout',
    label: 'Documents & Closeout',
    icon: FileText,
    items: [
      { id: 'rfis', label: 'RFIs', icon: HelpCircle, description: 'Requests for information' },
      { id: 'submittals', label: 'Submittals', icon: Send, description: 'Submittal tracking' },
      { id: 'drawings', label: 'Drawings', icon: FileText, description: 'Drawing sets & markup' },
      { id: 'files', label: 'Files', icon: FileText, description: 'Document storage & sharing' },
      { id: 'reports', label: 'Reports', icon: BarChart3, description: 'Cross-project reporting' },
      { id: 'closeout', label: 'Closeout', icon: CheckCircle2, description: 'As-builts, O&M, warranties' },
      { id: 'bim', label: 'BIM', icon: Box, description: '3D model coordination' },
    ],
  },
];

// ── Prefetch map ──────────────────────────────────────────

const PAGE_PREFETCH_MAP: Record<string, () => void> = {
  // ── Core 10 ──
  dashboard:       () => import('../pages/dashboard').catch(() => {}),
  'daily-log':     () => import('../pages/daily-log').catch(() => {}),
  schedule:        () => import('../pages/schedule').catch(() => {}),
  budget:          () => import('../pages/Budget').catch(() => {}),
  rfis:            () => import('../pages/RFIs').catch(() => {}),
  submittals:      () => import('../pages/submittals').catch(() => {}),
  'punch-list':    () => import('../pages/punch-list').catch(() => {}),
  drawings:        () => import('../pages/drawings/index').catch(() => {}),
  'change-orders': () => import('../pages/ChangeOrders').catch(() => {}),
  safety:          () => import('../pages/Safety').catch(() => {}),
  // ── People & Labor ──
  workforce:       () => import('../pages/Workforce').catch(() => {}),
  crews:           () => import('../pages/Crews').catch(() => {}),
  'time-tracking': () => import('../pages/TimeTracking').catch(() => {}),
  directory:       () => import('../pages/Directory').catch(() => {}),
  meetings:        () => import('../pages/Meetings').catch(() => {}),
  // ── Financial ──
  'pay-apps':      () => import('../pages/payment-applications').catch(() => {}),
  contracts:       () => import('../pages/Contracts').catch(() => {}),
  estimating:      () => import('../pages/Estimating').catch(() => {}),
  // ── Field Ops ──
  equipment:       () => import('../pages/Equipment').catch(() => {}),
  procurement:     () => import('../pages/Procurement').catch(() => {}),
  permits:         () => import('../pages/Permits').catch(() => {}),
  // ── Documents & Closeout ──
  files:           () => import('../pages/Files').catch(() => {}),
  reports:         () => import('../pages/Reports').catch(() => {}),
  closeout:        () => import('../pages/Closeout').catch(() => {}),
  bim:             () => import('../pages/bim/BIMViewerPage').catch(() => {}),
  // ── Intelligence ──
  ai:              () => import('../pages/AIAssistant').catch(() => {}),
};

// ── Mobile bottom nav ─────────────────────────────────────

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
];
const BOTTOM_NAV_IDS = new Set(BOTTOM_NAV_ITEMS.map((i) => i.id));

// ── localStorage helpers ──────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Storage full — non-critical */ }
}

const PINS_KEY = 'sitesync-pinned-nav';
const RECENTS_KEY = 'sitesync-recent-nav';

// ── Project Switcher (compact) ───────────────────────────

const ProjectSwitcher: React.FC = () => {
  const { data: projects } = useProjects();
  const activeProjectId = useProjectContext((s) => s.activeProjectId);
  const setActiveProject = useProjectContext((s) => s.setActiveProject);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const activeProject = projects?.find((p) => p.id === activeProjectId);
  const hasProjects = projects && projects.length > 0;

  return (
    <div style={{ padding: `0 ${spacing['3']}`, marginBottom: spacing['3'], position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['1.5']} ${spacing['2.5']}`,
          minHeight: 34,
          backgroundColor: !hasProjects ? colors.orangeSubtle : colors.overlayBlackLight,
          border: `1px solid ${open ? colors.primaryOrange : !hasProjects ? colors.primaryOrange : 'transparent'}`,
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          transition: `all 150ms ease`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = !hasProjects ? colors.orangeSubtle : colors.overlayBlackMedium;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = !hasProjects ? colors.orangeSubtle : colors.overlayBlackLight;
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: borderRadius.sm, flexShrink: 0,
          background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: typography.fontWeight.bold, color: colors.white,
        }}>
          {activeProject ? activeProject.name[0].toUpperCase() : '+'}
        </div>
        <span style={{
          flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontSize: typography.fontSize.sm,
        }}>
          {activeProject?.name ?? 'Select Project'}
        </span>
        <ChevronDown
          size={12}
          color={colors.textTertiary}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div
            role="listbox"
            style={{
              position: 'absolute', top: '100%', left: spacing['3'], right: spacing['3'],
              marginTop: spacing['1'], backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100,
              maxHeight: 280, overflowY: 'auto', padding: spacing['1'],
            }}
          >
            <button
              onClick={() => { setOpen(false); setCreateOpen(true); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['1.5']} ${spacing['2.5']}`, minHeight: 34,
                backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base,
                cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                color: colors.primaryOrange, textAlign: 'left', transition: `background-color 80ms ease`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeSubtle; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: borderRadius.sm, flexShrink: 0,
                backgroundColor: colors.primaryOrange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={10} color={colors.white} />
              </div>
              <span style={{ fontWeight: typography.fontWeight.medium }}>New Project</span>
            </button>

            {hasProjects && (
              <div style={{ height: 1, backgroundColor: colors.borderSubtle, margin: `${spacing['1']} ${spacing['2']}`, opacity: 0.5 }} />
            )}

            {projects?.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setActiveProject(p.id); setOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                    padding: `${spacing['1.5']} ${spacing['2.5']}`, minHeight: 34,
                    backgroundColor: isActive ? colors.overlayBlackLight : 'transparent',
                    border: 'none', borderRadius: borderRadius.base, cursor: 'pointer',
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: isActive ? colors.primaryOrange : colors.textPrimary,
                    textAlign: 'left', transition: `background-color 80ms ease`,
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackThin; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = isActive ? colors.overlayBlackLight : 'transparent'; }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: borderRadius.sm, flexShrink: 0,
                    backgroundColor: isActive ? colors.primaryOrange : colors.textTertiary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: typography.fontWeight.bold, color: colors.white,
                  }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    {(p.city || p.state) && (
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[p.city, p.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

// ── Nav item button (refined) ────────────────────────────

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  onNavigate: (id: string) => void;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  showPin?: boolean;
  compact?: boolean;
}

const NavItemButton: React.FC<NavItemButtonProps> = ({
  item, isActive, onNavigate, isPinned, onTogglePin, showPin = false, compact = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <button
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => { setHovered(true); PAGE_PREFETCH_MAP[item.id]?.(); }}
      onFocus={() => PAGE_PREFETCH_MAP[item.id]?.()}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2.5'],
        padding: compact ? `5px ${spacing['2.5']}` : `6px ${spacing['2.5']}`,
        minHeight: compact ? 30 : 32,
        margin: '1px 0',
        backgroundColor: isActive ? colors.orangeSubtle : hovered ? colors.overlayBlackLight : 'transparent',
        color: isActive ? colors.orangeText : hovered ? colors.textPrimary : colors.textSecondary,
        border: 'none',
        borderRadius: borderRadius.base,
        cursor: 'pointer',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
        letterSpacing: typography.letterSpacing.normal,
        transition: `background-color 80ms ease, color 80ms ease`,
        textAlign: 'left',
      }}
    >
      {isActive && (
        <motion.div
          layoutId="activeNav"
          style={{
            position: 'absolute',
            left: 0, top: '20%', bottom: '20%',
            width: 2,
            backgroundColor: colors.primaryOrange,
            borderRadius: '0 2px 2px 0',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
      <SidebarPresenceDot page={item.id} />

      {showPin && hovered && onTogglePin && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onTogglePin(item.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTogglePin(item.id); } }}
          aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
            cursor: 'pointer', color: isPinned ? colors.primaryOrange : colors.textTertiary, padding: 0,
          }}
        >
          {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
        </span>
      )}
    </button>
  );
};

// ── Section label ────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div style={{
    padding: `${spacing['2']} ${spacing['2.5']} ${spacing['1']}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}>
    <span style={{
      fontSize: '10px',
      fontWeight: typography.fontWeight.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontFamily: typography.fontFamily,
    }}>
      {children}
    </span>
    {action}
  </div>
);

// ── All Tools Panel (the "App Library" experience) ───────

interface AllToolsPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  activeView: string;
  canAccessModule: (id: string) => boolean;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
}

const AllToolsPanel: React.FC<AllToolsPanelProps> = ({
  open, onClose, onNavigate, activeView, canAccessModule, pinnedIds, onTogglePin,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveCategory(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Filter items by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return TOOL_CATEGORIES;
    const q = search.toLowerCase();
    return TOOL_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        const fullItem = ITEM_MAP.get(item.id);
        return (
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          fullItem?.description?.toLowerCase().includes(q)
        );
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 1040,
              backgroundColor: colors.overlayScrim,
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed',
              left: 252,
              top: 0,
              bottom: 0,
              width: 340,
              backgroundColor: colors.surfaceRaised,
              borderRight: `1px solid ${colors.borderSubtle}`,
              boxShadow: '8px 0 32px rgba(0,0,0,0.15)',
              zIndex: 1041,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: `${spacing['4']} ${spacing['4']} ${spacing['3']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                <h2 style={{
                  margin: 0, fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary, fontFamily: typography.fontFamily,
                }}>
                  All Tools
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.overlayBlackLight, border: 'none',
                    borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textSecondary,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.overlayBlackLight,
                borderRadius: borderRadius.md,
                border: `1px solid transparent`,
              }}>
                <Search size={14} color={colors.textTertiary} />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter tools..."
                  style={{
                    flex: 1, border: 'none', background: 'none', outline: 'none',
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, padding: 0,
                  }}
                />
              </div>

              {/* Category pills */}
              {!search && (
                <div style={{
                  display: 'flex', gap: spacing['1'], flexWrap: 'wrap',
                  marginTop: spacing['3'],
                }}>
                  {TOOL_CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(isActive ? null : cat.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['1'],
                          padding: `${spacing['1']} ${spacing['2']}`,
                          backgroundColor: isActive ? colors.orangeSubtle : colors.overlayBlackLight,
                          color: isActive ? colors.orangeText : colors.textSecondary,
                          border: `1px solid ${isActive ? colors.primaryOrange : 'transparent'}`,
                          borderRadius: borderRadius.full,
                          cursor: 'pointer', fontSize: '11px',
                          fontFamily: typography.fontFamily,
                          fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                          transition: 'all 80ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium;
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight;
                        }}
                      >
                        <CatIcon size={11} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tools list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing['2']} ${spacing['3']}` }}>
              {(activeCategory
                ? filteredCategories.filter((c) => c.id === activeCategory)
                : filteredCategories
              ).map((cat) => {
                const visibleItems = cat.items.filter((item) => canAccessModule(item.id));
                if (visibleItems.length === 0) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: spacing['4'] }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                      padding: `${spacing['1']} ${spacing['1']}`,
                      marginBottom: spacing['1'],
                    }}>
                      <cat.icon size={12} style={{ color: colors.textTertiary, opacity: 0.7 }} />
                      <span style={{
                        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                        color: colors.textTertiary, textTransform: 'uppercase',
                        letterSpacing: '0.06em', fontFamily: typography.fontFamily,
                      }}>
                        {cat.label}
                      </span>
                    </div>
                    {visibleItems.map((item) => {
                      const fullItem = ITEM_MAP.get(item.id);
                      const Icon = item.icon;
                      const isItemActive = activeView === item.id;
                      const isItemPinned = pinnedIds.has(item.id);

                      return (
                        <ToolCard
                          key={item.id}
                          item={item}
                          description={fullItem?.description}
                          isActive={isItemActive}
                          isPinned={isItemPinned}
                          onNavigate={(id) => { onNavigate(id); onClose(); }}
                          onTogglePin={onTogglePin}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {filteredCategories.length === 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: `${spacing['8']} ${spacing['4']}`,
                  color: colors.textTertiary, textAlign: 'center',
                }}>
                  <Search size={24} style={{ marginBottom: spacing['2'], opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
                    No tools match "{search}"
                  </p>
                  <p style={{ margin: `${spacing['1']} 0 0`, fontSize: '11px', fontFamily: typography.fontFamily, opacity: 0.7 }}>
                    Try a different search term
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Tool card (for the All Tools panel) ─────────────────

interface ToolCardProps {
  item: NavItem;
  description?: string;
  isActive: boolean;
  isPinned: boolean;
  onNavigate: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({
  item, description, isActive, isPinned, onNavigate, onTogglePin,
}) => {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <button
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => { setHovered(true); PAGE_PREFETCH_MAP[item.id]?.(); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2.5'],
        padding: `${spacing['2']} ${spacing['2.5']}`,
        backgroundColor: isActive ? colors.orangeSubtle : hovered ? colors.overlayBlackLight : 'transparent',
        border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
        textAlign: 'left', transition: 'background-color 80ms ease',
        marginBottom: '1px',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: borderRadius.md, flexShrink: 0,
        backgroundColor: isActive ? colors.primaryOrange : colors.overlayBlackLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background-color 80ms ease',
      }}>
        <Icon size={14} color={isActive ? colors.white : colors.textSecondary} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
          fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
          color: isActive ? colors.orangeText : colors.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.label}
        </div>
        {description && (
          <div style={{
            fontSize: '11px', color: colors.textTertiary, fontFamily: typography.fontFamily,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: '1px',
          }}>
            {description}
          </div>
        )}
      </div>

      {/* Pin toggle */}
      {hovered && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onTogglePin(item.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onTogglePin(item.id); } }}
          aria-label={isPinned ? `Unpin ${item.label}` : `Pin to sidebar`}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isPinned ? colors.orangeSubtle : colors.overlayBlackLight,
            border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', flexShrink: 0,
            color: isPinned ? colors.primaryOrange : colors.textTertiary,
            transition: 'all 80ms ease',
          }}
        >
          {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
        </span>
      )}
      {!hovered && isPinned && (
        <Pin size={10} color={colors.primaryOrange} style={{ flexShrink: 0, opacity: 0.6 }} />
      )}
    </button>
  );
};

// ── Sidebar (Desktop) ─────────────────────────────────────
// Design philosophy: Show 5 essentials + user's favorites + recents.
// Everything else is one click away in All Tools.
// "Simplicity is the ultimate sophistication." — Leonardo da Vinci (Jobs' favorite quote)

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, mode, onClose }) => {
  const { themeMode, setThemeMode } = useUiStore();
  const toggleTheme = () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  const { canAccessModule, role, loading: permissionsLoading } = usePermissions();
  const authProfile = useAuthStore((s) => s.profile);
  const authUser = useAuthStore((s) => s.user);
  const displayName = authProfile?.full_name || authUser?.email || '';
  const displayInitials = (displayName.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '?';
  const isOverlay = mode === 'overlay';

  // ── Mobile detection ──
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

  // ── Pinned items ──
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(
    () => new Set(readJSON<string[]>(PINS_KEY, DEFAULT_PINS))
  );

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeJSON(PINS_KEY, [...next]);
      return next;
    });
  }, []);

  const pinnedItems = useMemo(() => {
    return [...pinnedIds]
      .map((id) => ITEM_MAP.get(id))
      .filter((item): item is NavItem => !!item && !CORE_NAV_IDS.has(item.id) && canAccessModule(item.id));
  }, [pinnedIds, canAccessModule]);

  // ── Recents ──
  const [recentIds, setRecentIds] = useState<string[]>(
    () => readJSON<string[]>(RECENTS_KEY, [])
  );

  // Track navigation for recents
  useEffect(() => {
    if (!activeView || activeView === 'dashboard') return;
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== activeView);
      const next = [activeView, ...filtered].slice(0, 5);
      writeJSON(RECENTS_KEY, next);
      return next;
    });
  }, [activeView]);

  const recentItems = useMemo(() => {
    return recentIds
      .filter((id) => !CORE_NAV_IDS.has(id) && !pinnedIds.has(id))
      .map((id) => ITEM_MAP.get(id))
      .filter((item): item is NavItem => !!item && canAccessModule(item.id))
      .slice(0, 3);
  }, [recentIds, pinnedIds, canAccessModule]);

  // ── All Tools panel ──
  const [allToolsOpen, setAllToolsOpen] = useState(false);

  // Close All Tools on Escape
  useEffect(() => {
    if (!allToolsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllToolsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allToolsOpen]);

  // ── Mobile render ──
  if (isMobile) {
    const allMoreItems = ALL_ITEMS.filter(
      (item) => !BOTTOM_NAV_IDS.has(item.id) && canAccessModule(item.id)
    );

    return (
      <>
        {/* Bottom tab bar */}
        <nav
          aria-label="Mobile navigation"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
            zIndex: 1000, backgroundColor: colors.surfaceSidebar,
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'stretch',
          }}
        >
          {BOTTOM_NAV_ITEMS.map((item) => {
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
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  minHeight: '44px', minWidth: '44px',
                  backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                  color: isActive ? colors.primaryOrange : colors.textOnDarkMuted,
                  gap: 3, padding: 0, transition: `color 80ms ease`,
                }}
              >
                <Icon size={16} />
                <span style={{
                  fontSize: '10px', fontFamily: typography.fontFamily,
                  fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  lineHeight: 1,
                }}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    style={{
                      position: 'absolute', top: 0, width: 24, height: 2,
                      backgroundColor: colors.primaryOrange, borderRadius: '0 0 2px 2px',
                    }}
                  />
                )}
              </button>
            );
          })}
          <button
            onClick={() => setShowMoreSheet(true)}
            aria-label="More navigation items"
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: '44px', minWidth: '44px',
              backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
              color: colors.textOnDarkMuted, gap: 3, padding: 0,
            }}
          >
            <MoreHorizontal size={16} />
            <span style={{ fontSize: '10px', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.normal, lineHeight: 1 }}>More</span>
          </button>
        </nav>

        {/* Slide-up sheet */}
        <AnimatePresence>
          {showMoreSheet && (
            <div
              role="dialog"
              aria-label="More navigation"
              aria-modal="true"
              style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMoreSheet(false)}
                style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayScrim }}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{
                  position: 'relative', backgroundColor: colors.surfaceSidebar,
                  borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
                  paddingBottom: 80, paddingTop: spacing['4'],
                  maxHeight: '75vh', overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing['4'] }}>
                  <div style={{ width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.borderDefault }} />
                </div>
                <button
                  onClick={() => setShowMoreSheet(false)}
                  aria-label="Close menu"
                  style={{
                    position: 'absolute', top: spacing['4'], right: spacing['4'],
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.overlayBlackLight, border: 'none',
                    borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textSecondary,
                  }}
                >
                  <X size={16} />
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['2'], padding: `0 ${spacing['4']}` }}>
                  {allMoreItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { onNavigate(item.id); setShowMoreSheet(false); }}
                        onMouseEnter={() => PAGE_PREFETCH_MAP[item.id]?.()}
                        onFocus={() => PAGE_PREFETCH_MAP[item.id]?.()}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          minHeight: '44px', minWidth: '44px', gap: spacing['1.5'],
                          padding: `${spacing['3']} ${spacing['2']}`,
                          backgroundColor: isActive ? colors.orangeSubtle : colors.overlayBlackLight,
                          border: isActive ? `1px solid ${colors.primaryOrange}` : '1px solid transparent',
                          borderRadius: borderRadius.md, cursor: 'pointer',
                          color: isActive ? colors.primaryOrange : colors.textSecondary,
                        }}
                      >
                        <Icon size={16} />
                        <span style={{ fontSize: '10px', fontFamily: typography.fontFamily, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Desktop render ──
  return (
    <>
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
        {/* ── Logo ── */}
        <div style={{
          padding: `${spacing['4']} ${spacing['4']} ${spacing['2']}`,
          display: 'flex', alignItems: 'center', gap: spacing['2.5'],
        }}>
          <img
            src={`${import.meta.env.BASE_URL}logos/sitesync-symbol.png`}
            alt=""
            style={{
              height: 32, width: 'auto', objectFit: 'contain', flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: typography.fontSize.lg, fontWeight: 800,
            color: colors.textPrimary, letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            SiteSync
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: colors.primaryOrange,
            backgroundColor: colors.orangeSubtle,
            padding: '2px 6px',
            borderRadius: borderRadius.sm,
            letterSpacing: '0.08em',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}>
            PM
          </span>
          {isOverlay && onClose && (
            <button
              onClick={onClose}
              aria-label="Close navigation menu"
              style={{
                marginLeft: 'auto', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.overlayBlackLight, border: 'none',
                borderRadius: borderRadius.base, cursor: 'pointer',
                color: colors.textSecondary, flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Search ── */}
        <div style={{ padding: `0 ${spacing['3']}`, marginBottom: spacing['2'] }}>
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['1.5']} ${spacing['2.5']}`, minHeight: 34,
              backgroundColor: colors.overlayBlackLight, border: 'none',
              borderRadius: borderRadius.md, cursor: 'pointer',
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              color: colors.textTertiary, transition: `background-color 80ms ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
          >
            <Search size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
            <kbd style={{
              fontSize: '10px', color: colors.textTertiary,
              backgroundColor: colors.overlayBlackThin,
              padding: `1px ${spacing['1']}`, borderRadius: borderRadius.sm,
              fontFamily: typography.fontFamilyMono,
            }}>⌘K</kbd>
          </button>
        </div>

        {/* ── Project Switcher ── */}
        <ProjectSwitcher />

        {/* ── Navigation ── */}
        <div style={{ flex: 1, padding: `0 ${spacing['2']}`, overflowY: 'auto' }}>
          {permissionsLoading && (
            <div style={{ padding: `0 ${spacing['2']}` }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  height: 28, marginBottom: 3, borderRadius: borderRadius.base,
                  backgroundColor: colors.overlayBlackLight, opacity: 1 - i * 0.15,
                }} />
              ))}
            </div>
          )}

          {!permissionsLoading && (
            <>
              {/* ── Core: The 5 essentials ── */}
              <div style={{ marginBottom: spacing['2'] }}>
                {CORE_NAV.filter((item) => canAccessModule(item.id)).map((item) => (
                  <NavItemButton
                    key={item.id}
                    item={item}
                    isActive={activeView === item.id}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              {/* ── Separator ── */}
              <div style={{
                height: 1, backgroundColor: colors.borderSubtle,
                margin: `${spacing['1']} ${spacing['2.5']} ${spacing['1.5']}`,
                opacity: 0.5,
              }} />

              {/* ── Favorites ── */}
              {pinnedItems.length > 0 && (
                <div style={{ marginBottom: spacing['2'] }}>
                  <SectionLabel>
                    Favorites
                  </SectionLabel>
                  {pinnedItems.map((item) => (
                    <NavItemButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      onNavigate={onNavigate}
                      isPinned
                      onTogglePin={togglePin}
                      showPin
                    />
                  ))}
                </div>
              )}

              {/* ── Recents ── */}
              {recentItems.length > 0 && (
                <div style={{ marginBottom: spacing['2'] }}>
                  <SectionLabel>
                    Recent
                  </SectionLabel>
                  {recentItems.map((item) => (
                    <NavItemButton
                      key={item.id}
                      item={item}
                      isActive={activeView === item.id}
                      onNavigate={onNavigate}
                      onTogglePin={togglePin}
                      showPin
                      compact
                    />
                  ))}
                </div>
              )}

              {/* ── Separator ── */}
              <div style={{
                height: 1, backgroundColor: colors.borderSubtle,
                margin: `${spacing['1']} ${spacing['2.5']} ${spacing['1.5']}`,
                opacity: 0.5,
              }} />

              {/* ── All Tools button ── */}
              <div style={{ padding: `0 ${spacing['0.5']}` }}>
                <button
                  onClick={() => setAllToolsOpen(true)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                    padding: `6px ${spacing['2.5']}`, minHeight: 32,
                    backgroundColor: 'transparent', border: 'none',
                    borderRadius: borderRadius.base, cursor: 'pointer',
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textTertiary, textAlign: 'left',
                    transition: `all 80ms ease`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight;
                    (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
                  }}
                >
                  <Grid3X3 size={15} style={{ opacity: 0.65 }} />
                  <span style={{ flex: 1 }}>All Tools</span>
                  <ChevronRight size={12} style={{ opacity: 0.5 }} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Active Agents ── */}
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: `${spacing['2']} ${spacing['3']}` }}>
          <AgentStatusBadge agents={[]} compact={false} />
        </div>

        {/* ── User footer ── */}
        <div style={{
          borderTop: `1px solid ${colors.borderSubtle}`,
          padding: `${spacing['2.5']} ${spacing['3']}`,
          display: 'flex', alignItems: 'center', gap: spacing['2.5'],
        }}>
          <button
            onClick={() => onNavigate('profile')}
            title="My Profile"
            style={{
              width: 28, height: 28,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
              borderRadius: borderRadius.full,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: colors.white, fontSize: '11px',
              fontWeight: typography.fontWeight.semibold, flexShrink: 0,
              border: 'none', cursor: 'pointer',
              transition: 'transform 120ms ease, box-shadow 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primaryOrange}40`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {displayInitials}
          </button>
          <button
            onClick={() => onNavigate('profile')}
            title="My Profile"
            style={{
              flex: 1, overflow: 'hidden', border: 'none', background: 'none',
              cursor: 'pointer', padding: 0, textAlign: 'left',
              borderRadius: borderRadius.sm,
            }}
          >
            <p style={{
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName || '\u2014'}
            </p>
            <p style={{ fontSize: '10px', color: colors.textTertiary, margin: 0, textTransform: 'capitalize' }}>
              {role ? role.replace('_', ' ') : ''}
            </p>
          </button>
          <button
            onClick={() => onNavigate('settings')}
            aria-label="Project Settings"
            title="Settings"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.overlayBlackLight, border: 'none',
              borderRadius: borderRadius.base, cursor: 'pointer',
              color: colors.textSecondary, flexShrink: 0,
              transition: `background-color 80ms ease, transform 120ms ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(30deg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(0deg)'; }}
          >
            <Settings size={14} />
          </button>
          <button
            onClick={toggleTheme}
            aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.overlayBlackLight, border: 'none',
              borderRadius: borderRadius.base, cursor: 'pointer',
              color: colors.textSecondary, flexShrink: 0,
              transition: `background-color 80ms ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackMedium; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.overlayBlackLight; }}
          >
            {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </nav>

      {/* All Tools panel — slides out adjacent to sidebar */}
      <AllToolsPanel
        open={allToolsOpen}
        onClose={() => setAllToolsOpen(false)}
        onNavigate={onNavigate}
        activeView={activeView}
        canAccessModule={canAccessModule}
        pinnedIds={pinnedIds}
        onTogglePin={togglePin}
      />
    </>
  );
};
