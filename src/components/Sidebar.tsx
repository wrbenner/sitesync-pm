import React from 'react';
import {
  Home, LayoutGrid, Calendar, DollarSign,
  HelpCircle, ClipboardList, FileText,
  BookOpen, Briefcase, CheckSquare,
  Users, Zap, Search, ListChecks,
  Activity, Clock, Heart,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, layout } from '../styles/theme';
import { ProgressBar } from './Primitives';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const sections = [
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
      { id: 'time-machine', label: 'Time Machine', icon: Clock },
      { id: 'lookahead', label: 'Lookahead', icon: ListChecks },
    ],
  },
  {
    label: 'Project',
    items: [
      { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'budget', label: 'Budget', icon: DollarSign },
      { id: 'drawings', label: 'Drawings', icon: FileText },
      { id: 'rfis', label: 'RFIs', icon: HelpCircle },
      { id: 'submittals', label: 'Submittals', icon: ClipboardList },
    ],
  },
  {
    label: 'Field',
    items: [
      { id: 'field-capture', label: 'Field Capture', icon: Briefcase },
      { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
      { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
      { id: 'crews', label: 'Crews', icon: Users },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { id: 'activity', label: 'Activity Feed', icon: Activity },
      { id: 'meetings', label: 'Meetings', icon: Calendar },
      { id: 'directory', label: 'Directory', icon: Users },
    ],
  },
  {
    label: 'Documents',
    items: [
      { id: 'files', label: 'Files', icon: FileText },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: layout.sidebarWidth,
        backgroundColor: colors.surfaceSidebar,
        borderRight: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
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
            fontSize: '14px',
            fontWeight: 600,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          S
        </div>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight }}>
          SiteSync
        </span>
        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, marginTop: '-6px', marginLeft: '-2px' }}>
          AI
        </span>
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
            backgroundColor: 'rgba(0, 0, 0, 0.06)',
            border: 'none',
            borderRadius: borderRadius.base,
            cursor: 'pointer',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            color: colors.textTertiary,
            transition: `background-color ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0, 0, 0, 0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0, 0, 0, 0.06)'; }}
        >
          <Search size={14} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
          <kbd style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: borderRadius.sm, fontFamily: 'monospace' }}>⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: `0 ${spacing['2']}` }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: spacing['4'] }}>
            {section.label && (
              <p style={{
                fontSize: '10.5px',
                fontWeight: typography.fontWeight.semibold,
                color: '#9C9590',
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.widest,
                padding: `0 ${spacing['3']}`,
                margin: `${spacing['2']} 0 ${spacing['1']} 0`,
              }}>
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    padding: `8px ${spacing['3']}`,
                    margin: `1px 0`,
                    backgroundColor: isActive ? colors.orangeSubtle : 'transparent',
                    color: isActive ? colors.primaryOrange : colors.textSecondary,
                    border: 'none',
                    borderRadius: borderRadius.base,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                    letterSpacing: typography.letterSpacing.normal,
                    transition: `background-color ${transitions.instant}`,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0, 0, 0, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
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
        <div>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>Walker Benner</p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Project Manager</p>
        </div>
      </div>
    </aside>
  );
};
