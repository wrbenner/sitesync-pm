import React, { useState, useEffect } from 'react';
import { Search, Bell } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, layout } from '../styles/theme';
import { Dot, useSidebar } from './Primitives';

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
  const sidebarW = collapsed ? layout.sidebarCollapsed : layout.sidebarWidth;

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
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.72)' : colors.white,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        height: layout.topbarHeight,
        boxShadow: scrolled ? shadows.base : shadows.sm,
        marginLeft: sidebarW,
        transition: `margin-left ${transitions.slow}, background-color ${transitions.base}, box-shadow ${transitions.base}, backdrop-filter ${transitions.base}`,
        zIndex: 50,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Page Title */}
      <h2
        style={{
          fontSize: typography.fontSize['2xl'],
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: 0,
          letterSpacing: '-0.3px',
        }}
      >
        {pageNames[activeView] || 'Dashboard'}
      </h2>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
        {/* Search */}
        {searchOpen ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: '280px',
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
                padding: '1px 5px',
                borderRadius: borderRadius.sm,
                fontFamily: 'monospace',
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

        {/* Notifications */}
        <button
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `background-color ${transitions.fast}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <Bell size={18} color={colors.textSecondary} />
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '7px',
              height: '7px',
              backgroundColor: colors.primaryOrange,
              borderRadius: '50%',
            }}
          />
        </button>

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
