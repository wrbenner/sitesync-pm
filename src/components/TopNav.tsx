import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Bell, ChevronDown,
  Home, LayoutGrid, FileText, Calendar, DollarSign,
  HelpCircle, ClipboardList, CheckSquare, Users,
  BookOpen, Briefcase, Zap, Eye,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { Dot, ProgressBar } from './Primitives';

interface TopNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

// Primary nav items — the ones people use all day
const primaryNav = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle },
  { id: 'drawings', label: 'Drawings', icon: FileText },
];

// "More" dropdown items
const moreNav = [
  { id: 'submittals', label: 'Submittals', icon: ClipboardList },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
  { id: 'crews', label: 'Crews', icon: Users },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
  { id: 'field-capture', label: 'Field Capture', icon: Briefcase },
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'copilot', label: 'AI Copilot', icon: Zap },
  { id: 'vision', label: 'Vision', icon: Eye },
];

export const TopNav: React.FC<TopNavProps> = ({ activeView, onNavigate }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isInMore = moreNav.some((item) => item.id === activeView);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.85)' : colors.white,
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled ? shadows.base : shadows.sm,
        transition: `background-color ${transitions.base}, box-shadow ${transitions.base}`,
      }}
    >
      {/* Main bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '56px',
          padding: `0 ${spacing.xl}`,
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => onNavigate('dashboard')}
          aria-label="SiteSync AI, go to dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            cursor: 'pointer',
            marginRight: spacing['2xl'],
            flexShrink: 0,
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: typography.fontFamily,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
              borderRadius: borderRadius.base,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: 700,
              color: colors.white,
            }}
          >
            S
          </div>
          <span style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, letterSpacing: '-0.5px' }}>
            SiteSync
          </span>
          <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, marginTop: '-8px' }}>
            AI
          </span>
        </button>

        {/* Primary nav */}
        <nav aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
          {primaryNav.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: `${spacing.sm} ${spacing.lg}`,
                  fontSize: typography.fontSize.base,
                  fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  color: isActive ? colors.orangeText : colors.textSecondary,
                  backgroundColor: isActive ? colors.orangeLight : 'transparent',
                  border: 'none',
                  borderRadius: borderRadius.full,
                  cursor: 'pointer',
                  transition: `all ${transitions.fast}`,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            );
          })}

          {/* More dropdown */}
          <div ref={moreRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.fontSize.base,
                fontWeight: isInMore ? typography.fontWeight.semibold : typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                color: isInMore ? colors.orangeText : colors.textSecondary,
                backgroundColor: isInMore ? colors.orangeLight : 'transparent',
                border: 'none',
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                transition: `all ${transitions.fast}`,
              }}
              onMouseEnter={(e) => {
                if (!isInMore) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
              }}
              onMouseLeave={(e) => {
                if (!isInMore) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              More
              <ChevronDown size={14} style={{ transform: moreOpen ? 'rotate(180deg)' : 'rotate(0)', transition: `transform ${transitions.fast}` }} />
            </button>

            {moreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: spacing.sm,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.lg,
                  boxShadow: shadows.lg,
                  padding: spacing.sm,
                  minWidth: '220px',
                  animation: 'scaleIn 150ms ease-out',
                  zIndex: 1000,
                }}
              >
                {moreNav.map((item) => {
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setMoreOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.md,
                        padding: `${spacing.md} ${spacing.lg}`,
                        fontSize: typography.fontSize.base,
                        fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                        fontFamily: typography.fontFamily,
                        color: isActive ? colors.orangeText : colors.textPrimary,
                        backgroundColor: isActive ? colors.orangeLight : 'transparent',
                        border: 'none',
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: `background-color ${transitions.fast}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <item.icon size={16} color={isActive ? colors.orangeText : colors.textTertiary} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexShrink: 0 }}>
          {/* Search */}
          {searchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, width: '240px', backgroundColor: colors.surfaceFlat, padding: `6px ${spacing.md}`, borderRadius: borderRadius.full }}>
              <Search size={14} color={colors.textTertiary} />
              <input
                type="text" placeholder="Search..." value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onBlur={() => { setSearchOpen(false); setSearchValue(''); }}
                autoFocus
                aria-label="Search"
                style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary }}
              />
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.sm,
                padding: `6px ${spacing.md}`, backgroundColor: colors.surfaceFlat,
                border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
                fontSize: typography.fontSize.sm, color: colors.textTertiary, fontFamily: typography.fontFamily,
                transition: `background-color ${transitions.fast}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceInset; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
            >
              <Search size={14} />
              <span style={{ color: colors.textTertiary }}>Search</span>
              <kbd style={{ fontSize: '10px', color: colors.textTertiary, backgroundColor: colors.surfaceInset, padding: '1px 4px', borderRadius: borderRadius.sm, fontFamily: 'monospace' }}>⌘K</kbd>
            </button>
          )}

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `4px ${spacing.md}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.full }}>
            <Dot color={colors.tealSuccess} pulse size={6} />
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>187 on site</span>
          </div>

          {/* Notifications */}
          <button
            aria-label="Notifications"
            style={{
              position: 'relative', width: 34, height: 34,
              backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.full,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: `background-color ${transitions.fast}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceFlat; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <Bell size={17} color={colors.textSecondary} />
            <span style={{ position: 'absolute', top: '5px', right: '5px', width: '6px', height: '6px', backgroundColor: colors.primaryOrange, borderRadius: '50%' }} />
          </button>

          {/* User avatar */}
          <div
            style={{
              width: 34, height: 34,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
              borderRadius: borderRadius.full, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
            }}
          >
            WB
          </div>
        </div>
      </div>

      {/* Project context bar */}
      <div
        style={{
          borderTop: `1px solid ${colors.borderLight}`,
          padding: `${spacing.sm} ${spacing.xl}`,
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Meridian Tower
          </span>
          <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
            Dallas, TX
          </span>
          <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>·</span>
          <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
            154 days remaining
          </span>
          <div style={{ width: '80px' }}>
            <ProgressBar value={62} height={4} color={colors.tealSuccess} />
          </div>
          <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.tealSuccess }}>
            62%
          </span>
        </div>
      </div>
    </header>
  );
};
