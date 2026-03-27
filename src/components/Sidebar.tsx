import React from 'react';
import {
  Home, LayoutGrid, Calendar, DollarSign,
  HelpCircle, ClipboardList, FileText,
  BookOpen, Briefcase, CheckSquare,
  Users, Zap, Search, ListChecks,
  Activity, Clock, Heart,
  Settings, UserCog, ChevronDown, LogOut, FolderKanban,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, layout } from '../styles/theme';
import { ProgressBar } from './Primitives';
import { useAuthStore } from '../stores/authStore';
import { useProjectContext } from '../stores/projectContextStore';

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
  const { profile, company, signOut } = useAuthStore();
  const { activeProject, projects, setActiveProject } = useProjectContext();
  const [showProjectPicker, setShowProjectPicker] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const userName = profile ? `${profile.first_name} ${profile.last_name}` : 'User';
  const userInitials = profile ? `${profile.first_name[0]}${profile.last_name[0]}` : 'U';
  const userRole = profile?.role?.replace('_', ' ') ?? 'Member';
  const projectName = activeProject?.name ?? 'No Project';
  const projectProgress = activeProject?.completion_percentage ?? 0;

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

      {/* Admin section */}
      <div style={{ padding: `0 ${spacing['2']}`, marginBottom: spacing['2'] }}>
        <p style={{
          fontSize: '10.5px',
          fontWeight: typography.fontWeight.semibold,
          color: '#9C9590',
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.widest,
          padding: `0 ${spacing['3']}`,
          margin: `${spacing['2']} 0 ${spacing['1']} 0`,
        }}>
          Admin
        </p>
        {[
          { id: 'admin/team', label: 'Team Members', icon: UserCog },
          { id: 'admin/project-settings', label: 'Project Settings', icon: Settings },
        ].map((item) => {
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
                margin: '1px 0',
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

      {/* Project context with switcher */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: spacing['4'], position: 'relative' }}>
        <button
          onClick={() => setShowProjectPicker(!showProjectPicker)}
          style={{
            width: '100%',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: `${spacing['3']} ${spacing['4']}`,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: typography.fontFamily,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
            <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              {projectName}
            </p>
            <ChevronDown size={14} color={colors.textTertiary} style={{ transform: showProjectPicker ? 'rotate(180deg)' : 'none', transition: `transform ${transitions.quick}` }} />
          </div>
          <ProgressBar value={projectProgress} height={3} color={colors.statusActive} bgColor={colors.borderDefault} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{projectProgress}% complete</span>
          </div>
        </button>

        {/* Project picker dropdown */}
        {showProjectPicker && projects.length > 1 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: spacing['4'],
            right: spacing['4'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.borderDefault}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: spacing['2'],
            marginBottom: spacing['2'],
            zIndex: 200,
          }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActiveProject(p.id); setShowProjectPicker(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: p.id === activeProject?.id ? colors.orangeSubtle : 'transparent',
                  color: p.id === activeProject?.id ? colors.primaryOrange : colors.textPrimary,
                  border: 'none',
                  borderRadius: borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  textAlign: 'left',
                }}
              >
                <FolderKanban size={14} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User section with menu */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: `${spacing['3']} ${spacing['4']}`, position: 'relative' }}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: typography.fontFamily,
            textAlign: 'left',
          }}
        >
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
            {userInitials}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{userName}</p>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'capitalize' }}>{userRole}</p>
          </div>
        </button>

        {/* User menu dropdown */}
        {showUserMenu && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: spacing['4'],
            right: spacing['4'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.borderDefault}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: spacing['1'],
            marginBottom: spacing['2'],
            zIndex: 200,
          }}>
            <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, marginBottom: spacing['1'] }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{userName}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{profile?.email}</p>
              {company && <p style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, margin: `${spacing['1']} 0 0` }}>{company.name}</p>}
            </div>
            <button
              onClick={() => { onNavigate('admin/team'); setShowUserMenu(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent',
                color: colors.textSecondary, border: 'none', borderRadius: borderRadius.sm,
                cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <UserCog size={14} /> Team Members
            </button>
            <button
              onClick={() => { onNavigate('admin/project-settings'); setShowUserMenu(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent',
                color: colors.textSecondary, border: 'none', borderRadius: borderRadius.sm,
                cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Settings size={14} /> Project Settings
            </button>
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, margin: `${spacing['1']} 0` }} />
            <button
              onClick={() => { signOut(); setShowUserMenu(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent',
                color: colors.statusCritical, border: 'none', borderRadius: borderRadius.sm,
                cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.statusCriticalSubtle}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
