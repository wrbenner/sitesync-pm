import React, { useState } from 'react';
import { Search, Bell, Cloud, Droplets } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { Dot } from './Primitives';

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearch }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchValue);
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing.lg} ${spacing.xl}`,
        backgroundColor: colors.white,
        borderBottom: `1px solid ${colors.border}`,
        height: '64px',
        boxShadow: shadows.xs,
        marginLeft: '260px',
        transition: 'margin-left 200ms ease-in-out',
      }}
    >
      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
        {searchOpen ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              width: '100%',
              backgroundColor: colors.lightBackground,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Search size={16} color={colors.textTertiary} />
            <input
              type="text"
              placeholder="Search Cmd+K"
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
              gap: spacing.md,
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: colors.lightBackground,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              fontSize: typography.fontSize.base,
              color: colors.textSecondary,
              fontFamily: typography.fontFamily,
              transition: `all ${spacing.md}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.border;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.lightBackground;
            }}
          >
            <Search size={16} />
            <span>Search</span>
            <kbd
              style={{
                marginLeft: 'auto',
                fontSize: typography.fontSize.xs,
                padding: `2px 4px`,
                backgroundColor: colors.white,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.sm,
                color: colors.textTertiary,
              }}
            >
              Cmd+K
            </kbd>
          </button>
        )}
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xl, marginLeft: spacing.xl }}>
        {/* Workers on Site */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            backgroundColor: colors.lightBackground,
            borderRadius: borderRadius.md,
          }}
        >
          <Dot color={colors.tealSuccess} pulse size={8} />
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
            }}
          >
            187 on site
          </span>
        </div>

        {/* Weather */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            backgroundColor: colors.lightBackground,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
          }}
        >
          <Cloud size={16} />
          <span>78F Clear</span>
          <Droplets size={14} color={colors.blue} />
          <span>Rain Thu</span>
        </div>

        {/* Notifications */}
        <button
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            backgroundColor: colors.lightBackground,
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `background-color ${spacing.md}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.border;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.lightBackground;
          }}
        >
          <Bell size={18} color={colors.textPrimary} />
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: colors.red,
              borderRadius: '50%',
            }}
          />
        </button>

        {/* User Avatar */}
        <button
          style={{
            width: 36,
            height: 36,
            backgroundColor: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`,
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.white,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            transition: `transform 150ms ease-in-out`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          WB
        </button>
      </div>
    </header>
  );
};
