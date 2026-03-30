import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Home, ClipboardList, Camera, BookOpen, MoreHorizontal, X, Search,
  ChevronRight, ArrowLeft, Bell, QrCode, Mic } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useHaptics } from '../../hooks/useMobileCapture';

// ── Tab Configuration ────────────────────────────────────

const tabs = [
  { id: 'dashboard', label: 'Home', icon: Home, route: '/dashboard' },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: '/tasks' },
  { id: 'capture', label: 'Capture', icon: Camera, route: '/field-capture', isCapture: true },
  { id: 'daily-log', label: 'Logs', icon: BookOpen, route: '/daily-log' },
  { id: 'more', label: 'More', icon: MoreHorizontal, route: '' },
];

const moreItems = [
  { id: 'rfis', label: 'RFIs', route: '/rfis', group: 'Project' },
  { id: 'submittals', label: 'Submittals', route: '/submittals', group: 'Project' },
  { id: 'punch-list', label: 'Punch List', route: '/punch-list', group: 'Project' },
  { id: 'schedule', label: 'Schedule', route: '/schedule', group: 'Project' },
  { id: 'lookahead', label: 'Lookahead', route: '/lookahead', group: 'Project' },
  { id: 'budget', label: 'Budget', route: '/budget', group: 'Finance' },
  { id: 'change-orders', label: 'Change Orders', route: '/change-orders', group: 'Finance' },
  { id: 'drawings', label: 'Drawings', route: '/drawings', group: 'Docs' },
  { id: 'crews', label: 'Crews', route: '/crews', group: 'People' },
  { id: 'directory', label: 'Directory', route: '/directory', group: 'People' },
  { id: 'meetings', label: 'Meetings', route: '/meetings', group: 'People' },
  { id: 'files', label: 'Files', route: '/files', group: 'Docs' },
  { id: 'activity', label: 'Activity', route: '/activity', group: 'Docs' },
  { id: 'copilot', label: 'AI Copilot', route: '/copilot', group: 'AI' },
  { id: 'safety', label: 'Safety', route: '/safety', group: 'Project' },
  { id: 'project-health', label: 'Project Health', route: '/project-health', group: 'AI' },
];

const MORE_GROUPS = ['Project', 'Finance', 'People', 'Docs', 'AI'];

// ── Touch Constants ──────────────────────────────────────

const SWIPE_THRESHOLD = 60;
const PULL_THRESHOLD = 80;
const TAB_BAR_HEIGHT = 68;

// ── Component ────────────────────────────────────────────

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { impact } = useHaptics();

  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Swipe state
  const touchStart = useRef({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);

  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const handleTabPress = useCallback((tab: typeof tabs[0]) => {
    impact('light');
    if (tab.id === 'more') {
      setMoreOpen(!moreOpen);
      return;
    }
    setMoreOpen(false);
    navigate(tab.route);
  }, [navigate, moreOpen, impact]);

  // ── Pull-to-Refresh ────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    isPulling.current = (contentRef.current?.scrollTop || 0) <= 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const deltaY = e.touches[0].clientY - touchStart.current.y;
    if (deltaY > 0 && (contentRef.current?.scrollTop || 0) <= 0) {
      setPullDistance(Math.min(deltaY * 0.5, 120));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    // Pull-to-refresh
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      impact('medium');
      queryClient.invalidateQueries().then(() => {
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 600);
      });
    } else {
      setPullDistance(0);
    }

    // Swipe-right for back navigation
    if (isHorizontal && deltaX > SWIPE_THRESHOLD && touchStart.current.x < 40) {
      impact('light');
      navigate(-1);
    }

    isPulling.current = false;
  }, [pullDistance, impact, queryClient, navigate]);

  // Close more menu on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.surfacePage, overflow: 'hidden' }}>
      {/* ── Top Header ──────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${spacing['4']}`, height: '56px', backgroundColor: colors.surfaceRaised,
        boxShadow: shadows.sm, flexShrink: 0, zIndex: 10,
      }}>
        {/* Logo + back button logic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {location.pathname !== '/dashboard' && location.pathname !== '/' ? (
            <button
              onClick={() => navigate(-1)}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 }}
              aria-label="Go back"
            >
              <ArrowLeft size={20} color={colors.textSecondary} />
            </button>
          ) : (
            <div style={{
              width: 28, height: 28,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`,
              borderRadius: borderRadius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: 'white',
            }}>S</div>
          )}
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight }}>
            SiteSync
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Search"
          >
            <Search size={20} color={colors.textSecondary} />
          </button>
          <button
            onClick={() => navigate('/activity')}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' }}
            aria-label="Notifications"
          >
            <Bell size={20} color={colors.textSecondary} />
            <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusCritical, border: `2px solid ${colors.surfaceRaised}` }} />
          </button>
        </div>
      </header>

      {/* ── Search Bar ──────────────────────────────── */}
      {searchOpen && (
        <div style={{ padding: `${spacing['2']} ${spacing['4']}`, backgroundColor: colors.surfaceRaised, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, people, drawings..."
            style={{
              width: '100%', padding: '12px 16px', fontSize: '16px',
              fontFamily: typography.fontFamily, border: 'none',
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              outline: 'none', boxSizing: 'border-box', minHeight: '48px',
            }}
          />
        </div>
      )}

      {/* ── Pull-to-Refresh Indicator ───────────────── */}
      <div style={{
        height: refreshing ? 48 : Math.max(0, pullDistance),
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: refreshing ? 'none' : `height ${transitions.quick}`,
        flexShrink: 0,
      }}>
        {(pullDistance > 20 || refreshing) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <div style={{
              width: 20, height: 20,
              border: `2px solid ${colors.primaryOrange}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
              transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)`,
            }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
              {refreshing ? 'Refreshing...' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        )}
      </div>

      {/* ── Content Area ────────────────────────────── */}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1, overflow: 'auto',
          paddingBottom: `${TAB_BAR_HEIGHT + 16}px`,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>

      {/* ── More Menu Sheet ─────────────────────────── */}
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: zIndex.dropdown as number }}
          />
          <div style={{
            position: 'fixed', bottom: `${TAB_BAR_HEIGHT}px`, left: 0, right: 0,
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'],
            boxShadow: shadows.panel, zIndex: (zIndex.dropdown as number) + 1,
            padding: `${spacing['2']} 0`, maxHeight: '60vh', overflowY: 'auto',
            animation: 'slideInUp 200ms ease-out',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: `${spacing['2']} 0 ${spacing['3']}` }}>
              <div style={{ width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.borderDefault }} />
            </div>

            {MORE_GROUPS.map((group) => {
              const items = moreItems.filter((i) => i.group === group);
              return (
                <div key={group}>
                  <div style={{
                    padding: `${spacing['2']} ${spacing['5']}`,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    color: colors.textTertiary, textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                  }}>
                    {group}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { impact('light'); navigate(item.route); setMoreOpen(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: `${spacing['3']} ${spacing['5']}`, minHeight: '48px',
                        backgroundColor: activeTab === item.id ? colors.orangeSubtle : 'transparent',
                        color: activeTab === item.id ? colors.primaryOrange : colors.textPrimary,
                        border: 'none', cursor: 'pointer',
                        fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                        fontWeight: activeTab === item.id ? typography.fontWeight.medium : typography.fontWeight.normal,
                        textAlign: 'left',
                      }}
                    >
                      {item.label}
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Bottom Tab Bar ──────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: `${TAB_BAR_HEIGHT}px`,
        backgroundColor: colors.surfaceRaised,
        borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: zIndex.fixed as number,
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === 'more' ? moreOpen : activeTab === tab.id || (tab.id === 'capture' && activeTab === 'field-capture');

          // Capture button gets special treatment
          if (tab.isCapture) {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 2, padding: 0, backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                  position: 'relative', bottom: 8,
                }}
                aria-label="Capture"
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: shadows.glow,
                }}>
                  <Camera size={24} color="white" />
                </div>
                <span style={{ fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, marginTop: 2 }}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                color: isActive ? colors.primaryOrange : colors.textTertiary,
                transition: `color ${transitions.instant}`,
                minWidth: 56, minHeight: 48,
              }}
              aria-label={tab.label}
            >
              <Icon size={22} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
