import React, { useState } from 'react';
import {
  LayoutDashboard,
  Eye,
  ScanLine,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Camera,
  CheckSquare2,
  Users2,
  BookUser,
  MessageSquareWarning,
  Package,
  UsersRound,
  FolderOpen,
  Sparkles,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, layout } from '../styles/theme';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const navItems = [
  {
    section: null,
    items: [
      { id: 'dashboard', label: 'Command', icon: LayoutDashboard },
      { id: 'vision', label: 'Vision', icon: Eye },
      { id: 'copilot', label: 'Intelligence', icon: Sparkles, accent: true },
    ],
  },
  {
    section: 'Project',
    items: [
      { id: 'drawings', label: 'Drawings', icon: ScanLine },
      { id: 'schedule', label: 'Schedule', icon: CalendarDays },
      { id: 'budget', label: 'Cost', icon: CircleDollarSign },
    ],
  },
  {
    section: 'Field',
    items: [
      { id: 'daily-log', label: 'Daily Log', icon: ClipboardCheck },
      { id: 'field-capture', label: 'Capture', icon: Camera },
      { id: 'punch-list', label: 'Punch List', icon: CheckSquare2 },
    ],
  },
  {
    section: 'Documents',
    items: [
      { id: 'rfis', label: 'RFIs', icon: MessageSquareWarning, badge: 23 },
      { id: 'submittals', label: 'Submittals', icon: Package },
      { id: 'meetings', label: 'Meetings', icon: UsersRound },
      { id: 'files', label: 'Files', icon: FolderOpen },
    ],
  },
  {
    section: 'People',
    items: [
      { id: 'crews', label: 'Crews', icon: Users2 },
      { id: 'directory', label: 'Directory', icon: BookUser },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="sidebar-mobile-toggle"
        style={{
          position: 'fixed',
          top: spacing['4'],
          left: spacing['4'],
          zIndex: 1001,
          background: colors.surfaceElevated,
          border: `1px solid ${colors.borderSubtle}`,
          color: colors.textSecondary,
          padding: spacing['2'],
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: isOpen ? layout.sidebarWidth : '0',
          background: colors.surface,
          borderRight: `1px solid ${colors.borderFaint}`,
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: `width ${transitions.base}`,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        } as React.CSSProperties}
      >
        {/* Wordmark */}
        <div
          style={{
            padding: `20px ${spacing['6']}`,
            borderBottom: `1px solid ${colors.borderFaint}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            flexShrink: 0,
          }}
        >
          {/* Mark */}
          <div
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="6" fill={colors.signal} fillOpacity="0.12"/>
              <path d="M7 10L14 7L21 10V18L14 21L7 18V10Z" stroke={colors.signal} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
              <circle cx="14" cy="14" r="2.5" fill={colors.signal}/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                letterSpacing: typography.letterSpacing.tight,
                margin: 0,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              SiteSync
            </p>
            <p
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.signal,
                margin: 0,
                letterSpacing: typography.letterSpacing.wider,
                textTransform: 'uppercase',
                fontWeight: typography.fontWeight.medium,
              }}
            >
              AI
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: `${spacing['3']} 0`,
            overflowY: 'auto',
          }}
        >
          {navItems.map((group, gi) => (
            <div
              key={gi}
              style={{
                marginBottom: gi < navItems.length - 1 ? spacing['5'] : 0,
              }}
            >
              {group.section && (
                <p
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.textTertiary,
                    letterSpacing: typography.letterSpacing.widest,
                    textTransform: 'uppercase',
                    padding: `0 ${spacing['6']}`,
                    marginBottom: spacing['1'],
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.section}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['3'],
                      padding: `7px ${spacing['6']}`,
                      background: active ? colors.signalDim : 'transparent',
                      border: 'none',
                      color: active
                        ? colors.signal
                        : item.accent
                        ? colors.purple
                        : colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.base,
                      fontFamily: typography.fontFamily,
                      fontWeight: active ? typography.fontWeight.medium : typography.fontWeight.normal,
                      transition: `all ${transitions.fast}`,
                      borderLeft: active
                        ? `2px solid ${colors.signal}`
                        : '2px solid transparent',
                      paddingLeft: active ? `calc(${spacing['6']} - 2px)` : spacing['6'],
                      whiteSpace: 'nowrap',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = colors.surfaceHover;
                        el.style.color = colors.textPrimary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = 'transparent';
                        el.style.color = item.accent ? colors.purple : colors.textSecondary;
                      }
                    }}
                  >
                    <Icon size={15} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.badge && (
                      <span
                        style={{
                          background: colors.critical,
                          color: colors.white,
                          fontSize: '10px',
                          fontWeight: typography.fontWeight.semibold,
                          padding: '1px 5px',
                          borderRadius: borderRadius.full,
                          lineHeight: 1.6,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Active Project Switcher */}
        <div
          style={{
            padding: spacing['4'],
            borderTop: `1px solid ${colors.borderFaint}`,
            flexShrink: 0,
          }}
        >
          <button
            style={{
              width: '100%',
              background: colors.surfaceElevated,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.lg,
              padding: `${spacing['3']} ${spacing['3']}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['3'],
              transition: `all ${transitions.fast}`,
              color: 'inherit',
              fontFamily: typography.fontFamily,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = colors.borderModerate;
              el.style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = colors.borderSubtle;
              el.style.background = colors.surfaceElevated;
            }}
          >
            {/* Progress ring mini */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: borderRadius.base,
                background: colors.signalDim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: typography.fontSize.xs,
                fontWeight: typography.fontWeight.bold,
                color: colors.signal,
                letterSpacing: '-0.02em',
              }}
            >
              MT
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Meridian Tower
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: '2px' }}>
                <div
                  style={{
                    height: '2px',
                    width: '40px',
                    background: colors.borderSubtle,
                    borderRadius: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '62%',
                      background: colors.positive,
                      borderRadius: '1px',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    color: colors.textTertiary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  62%
                </span>
              </div>
            </div>
            <ChevronRight size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 99,
            display: 'none',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}
    </>
  );
};
