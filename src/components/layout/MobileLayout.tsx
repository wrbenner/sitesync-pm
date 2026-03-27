import React, { useState, useRef, useCallback } from 'react';
import { Home, Camera, BookOpen, CheckSquare, Menu, X, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

const tabs = [
  { id: 'dashboard', label: 'Command', icon: Home, route: '/dashboard' },
  { id: 'field-capture', label: 'Capture', icon: Camera, route: '/field-capture' },
  { id: 'daily-log', label: 'Log', icon: BookOpen, route: '/daily-log' },
  { id: 'punch-list', label: 'Punch', icon: CheckSquare, route: '/punch-list' },
  { id: 'more', label: 'More', icon: Menu, route: '' },
];

const moreItems = [
  { id: 'tasks', label: 'Tasks', route: '/tasks' },
  { id: 'rfis', label: 'RFIs', route: '/rfis' },
  { id: 'submittals', label: 'Submittals', route: '/submittals' },
  { id: 'schedule', label: 'Schedule', route: '/schedule' },
  { id: 'lookahead', label: 'Lookahead', route: '/lookahead' },
  { id: 'budget', label: 'Budget', route: '/budget' },
  { id: 'crews', label: 'Crews', route: '/crews' },
  { id: 'drawings', label: 'Drawings', route: '/drawings' },
  { id: 'directory', label: 'Directory', route: '/directory' },
  { id: 'meetings', label: 'Meetings', route: '/meetings' },
  { id: 'files', label: 'Files', route: '/files' },
  { id: 'activity', label: 'Activity', route: '/activity' },
  { id: 'copilot', label: 'AI Copilot', route: '/copilot' },
];

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const handleTabPress = (tab: typeof tabs[0]) => {
    if (tab.id === 'more') {
      setMoreOpen(!moreOpen);
      return;
    }
    setMoreOpen(false);
    navigate(tab.route);
  };

  // Pull to refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const scrollTop = contentRef.current?.scrollTop || 0;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80 && scrollTop <= 0) {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1500);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.surfacePage }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${spacing['4']}`, height: '56px', backgroundColor: colors.surfaceRaised,
        boxShadow: shadows.sm, flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div style={{
            width: 24, height: 24,
            background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`,
            borderRadius: borderRadius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 600, color: 'white',
          }}>S</div>
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>SiteSync</span>
        </div>
        <button style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
        }}>
          <Search size={20} color={colors.textSecondary} />
        </button>
      </header>

      {/* Pull to refresh indicator */}
      {refreshing && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: spacing['3'], backgroundColor: colors.orangeSubtle,
        }}>
          <div style={{
            width: 20, height: 20, border: `2px solid ${colors.primaryOrange}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'pulse 1s linear infinite',
          }} />
          <span style={{ marginLeft: spacing['2'], fontSize: typography.fontSize.sm, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>Refreshing...</span>
        </div>
      )}

      {/* Content area */}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, overflow: 'auto', paddingBottom: '72px' }}
      >
        {children}
      </div>

      {/* More menu overlay */}
      {moreOpen && (
        <>
          <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 90 }} />
          <div style={{
            position: 'fixed', bottom: '68px', left: spacing['3'], right: spacing['3'],
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
            boxShadow: shadows.panel, zIndex: 91, padding: spacing['2'],
            animation: 'slideInUp 200ms ease-out', maxHeight: '60vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['1'] }}>
              <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>All Pages</span>
              <button onClick={() => setMoreOpen(false)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary }}><X size={16} /></button>
            </div>
            {moreItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { navigate(item.route); setMoreOpen(false); }}
                style={{
                  width: '100%', padding: `${spacing['3']} ${spacing['4']}`,
                  backgroundColor: activeTab === item.id ? colors.orangeSubtle : 'transparent',
                  color: activeTab === item.id ? colors.primaryOrange : colors.textPrimary,
                  border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
                  fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                  fontWeight: activeTab === item.id ? typography.fontWeight.medium : typography.fontWeight.normal,
                  textAlign: 'left', transition: `background-color ${transitions.instant}`,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '68px',
        backgroundColor: colors.surfaceRaised, borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100,
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === 'more' ? moreOpen : activeTab === tab.id;
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
              }}
            >
              <Icon size={22} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
