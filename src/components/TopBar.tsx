import React, { useState, useEffect } from 'react';
import { Search, Sun, Moon, Monitor } from 'lucide-react';
import { colors, darkColors, spacing, typography, borderRadius, shadows, transitions, layout, colorVars, zIndex } from '../styles/theme';
import { Dot, useSidebar } from './Primitives';
import { NotificationBell, NotificationPanel } from './notifications/NotificationCenter';
import { ConnectionStatusDot } from './ui/ConnectionStatus';
import { PresenceBar } from './collaboration/PresenceBar';
import { useUiStore } from '../stores';
import { useTheme } from '../hooks/useTheme';

interface TopBarProps {
  activeView: string;
  onSearch?: (query: string) => void;
}

const pageNames: Record<string, string> = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  drawings: 'Drawings',
  rfis: 'RFIs',
  submittals: 'Submittals',
  schedule: 'Schedule',
  budget: 'Budget',
  'daily-log': 'Daily Log',
  'field-capture': 'Field Capture',
  'punch-list': 'Punch List',
  crews: 'Crews',
  directory: 'Directory',
  meetings: 'Meetings',
  files: 'Files',
  copilot: 'AI Copilot',
  vision: 'Vision',
};

export const TopBar: React.FC<TopBarProps> = ({ activeView, onSearch }) => {
  const { collapsed } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const sidebarW = collapsed ? layout.sidebarCollapsed : layout.sidebarWidth;
  const { isDark } = useTheme();
  const { themeMode, setThemeMode } = useUiStore();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) onSearch(searchValue);
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing.xl}`,
        backgroundColor: scrolled
          ? (isDark ? colors.topbarDark : colors.topbarLight)
          : (isDark ? colorVars.surfaceRaised : colors.white),
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        height: layout.topbarHeight,
        boxShadow: scrolled ? shadows.base : shadows.sm,
        marginLeft: sidebarW,
        transition: `margin-left ${transitions.slow}, background-color ${transitions.base}, box-shadow ${transitions.base}, backdrop-filter ${transitions.base}`,
        zIndex: zIndex.sticky,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Page Title + Presence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
        <h2
          style={{
            fontSize: typography.fontSize['2xl'],
            fontWeight: typography.fontWeight.semibold,
            color: colorVars.textPrimary,
            margin: 0,
            letterSpacing: typography.letterSpacing.tight,
          }}
        >
          {pageNames[activeView] || 'Dashboard'}
        </h2>
        <PresenceBar page={activeView} />
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
        {/* Search */}
        {searchOpen ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: layout.searchWidth,
              backgroundColor: colors.surfaceFlat,
              padding: `${spacing.sm} ${spacing.lg}`,
              borderRadius: borderRadius.full,
            }}
          >
            <Search size={15} color={colors.textTertiary} />
            <input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              onBlur={() => setSearchOpen(false)}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: typography.fontSize.base,
                fontFamily: typography.fontFamily,
                color: colors.textPrimary,
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.lg}`,
              backgroundColor: colors.surfaceFlat,
              border: 'none',
              borderRadius: borderRadius.full,
              cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
              transition: `background-color ${transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.borderLight;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
            }}
          >
            <Search size={15} />
            <span>Search</span>
            <span
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textTertiary,
                backgroundColor: colors.surfaceInset,
                padding: `${spacing['0.5']} ${spacing['1.5']}`,
                borderRadius: borderRadius.sm,
                fontFamily: typography.fontFamilyMono,
              }}
            >
              ⌘K
            </span>
          </button>
        )}

        {/* Workers on Site */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Dot color={colors.tealSuccess} pulse size={7} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            187 on site
          </span>
        </div>

        {/* Connection Status */}
        <ConnectionStatusDot />

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <NotificationBell onClick={() => setNotificationsOpen(!notificationsOpen)} isOpen={notificationsOpen} />
          {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
        </div>

        {/* Theme Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            aria-label="Toggle theme"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              border: `1px solid ${colorVars.borderSubtle}`,
              borderRadius: borderRadius.md,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: colorVars.textSecondary,
              transition: `background-color ${transitions.fast}, color ${transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? colors.darkHoverBg : colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            {themeMode === 'dark' ? <Moon size={16} /> : themeMode === 'system' ? <Monitor size={16} /> : <Sun size={16} />}
          </button>
          {themeMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: zIndex.dropdown }}
                onClick={() => setThemeMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: spacing.sm,
                  backgroundColor: isDark ? darkColors.surfaceRaised : colors.white,
                  border: `1px solid ${isDark ? colors.darkBorder : colors.borderDefault}`,
                  borderRadius: borderRadius.lg,
                  boxShadow: shadows.dropdown,
                  padding: spacing.xs,
                  zIndex: zIndex.dropdown,
                  minWidth: '140px',
                }}
              >
                {([
                  { mode: 'light' as const, icon: <Sun size={14} />, label: 'Light' },
                  { mode: 'dark' as const, icon: <Moon size={14} />, label: 'Dark' },
                  { mode: 'system' as const, icon: <Monitor size={14} />, label: 'System' },
                ]).map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { setThemeMode(mode); setThemeMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      width: '100%',
                      padding: `${spacing.sm} ${spacing.md}`,
                      border: 'none',
                      borderRadius: borderRadius.base,
                      backgroundColor: themeMode === mode
                        ? (isDark ? colors.orangeLight : colors.orangeSubtle)
                        : 'transparent',
                      color: themeMode === mode
                        ? colors.primaryOrange
                        : (isDark ? colors.overlayWhiteBold : colors.textSecondary),
                      cursor: 'pointer',
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamily,
                      fontWeight: themeMode === mode ? typography.fontWeight.medium : typography.fontWeight.normal,
                      transition: `background-color ${transitions.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      if (themeMode !== mode) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? colors.darkHoverBg : colors.surfaceHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (themeMode !== mode) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* User Avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
            border: 'none',
            borderRadius: borderRadius.full,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          WB
        </div>
      </div>
    </header>
  );
};
