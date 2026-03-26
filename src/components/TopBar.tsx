import React, { useState, useEffect } from 'react';
import { Search, Bell, Cloud, Droplets } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, layout } from '../styles/theme';

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearch }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [cmdPressed, setCmdPressed] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchValue('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchValue);
    }
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: layout.sidebarWidth,
        right: 0,
        height: layout.topbarHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing['6']}`,
        background: `${colors.canvas}E0`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${colors.borderFaint}`,
        zIndex: 50,
        transition: `left ${transitions.base}`,
      } as React.CSSProperties}
    >
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, maxWidth: '380px' }}>
        {searchOpen ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              width: '100%',
              background: colors.surfaceElevated,
              padding: `6px ${spacing['3']}`,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.signal}`,
              boxShadow: `0 0 0 3px ${colors.signalDim}`,
            }}
          >
            <Search size={13} color={colors.textTertiary} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              onBlur={() => { setSearchOpen(false); setSearchValue(''); }}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: typography.fontSize.base,
                fontFamily: typography.fontFamily,
                color: colors.textPrimary,
              }}
            />
            <kbd
              style={{
                fontSize: '10px',
                padding: '2px 5px',
                background: colors.surfaceBorder,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
                color: colors.textTertiary,
                fontFamily: typography.fontFamilyMono,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              esc
            </kbd>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `6px ${spacing['3']}`,
              background: colors.surfaceElevated,
              border: `1px solid ${colors.borderFaint}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              fontSize: typography.fontSize.base,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
              transition: `all ${transitions.fast}`,
              width: '220px',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = colors.borderModerate;
              el.style.color = colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = colors.borderFaint;
              el.style.color = colors.textTertiary;
            }}
          >
            <Search size={13} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <kbd
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                background: colors.surfaceBorder,
                border: `1px solid ${colors.borderFaint}`,
                borderRadius: borderRadius.sm,
                color: colors.textTertiary,
                fontFamily: typography.fontFamilyMono,
                flexShrink: 0,
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>

        {/* Live site signal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `5px ${spacing['3']}`,
            background: colors.surfaceElevated,
            border: `1px solid ${colors.borderFaint}`,
            borderRadius: borderRadius.full,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: colors.positive,
              display: 'block',
              animation: 'pulse-dot 2.5s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
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
            gap: spacing['1'],
            fontSize: typography.fontSize.xs,
            color: colors.textTertiary,
          }}
        >
          <Cloud size={13} />
          <span>78°</span>
          <span style={{ color: colors.borderModerate, margin: `0 2px` }}>·</span>
          <Droplets size={12} color={colors.info} />
          <span style={{ color: colors.info }}>Rain Thu</span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: colors.borderFaint,
          }}
        />

        {/* Notifications */}
        <button
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            background: 'transparent',
            border: `1px solid ${colors.borderFaint}`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `all ${transitions.fast}`,
            color: colors.textTertiary,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = colors.surfaceElevated;
            el.style.borderColor = colors.borderSubtle;
            el.style.color = colors.textSecondary;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'transparent';
            el.style.borderColor = colors.borderFaint;
            el.style.color = colors.textTertiary;
          }}
        >
          <Bell size={14} />
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '5px',
              height: '5px',
              background: colors.signal,
              borderRadius: '50%',
              border: `1.5px solid ${colors.canvas}`,
            }}
          />
        </button>

        {/* Avatar */}
        <button
          style={{
            width: 28,
            height: 28,
            background: colors.signalDim,
            border: `1px solid rgba(232,128,74,0.3)`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.signal,
            fontSize: '10px',
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            letterSpacing: '0.02em',
            transition: `all ${transitions.fast}`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'rgba(232,128,74,0.2)';
            el.style.borderColor = colors.signal;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = colors.signalDim;
            el.style.borderColor = 'rgba(232,128,74,0.3)';
          }}
        >
          WB
        </button>
      </div>
    </header>
  );
};
