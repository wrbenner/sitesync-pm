import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Home, FolderOpen } from 'lucide-react'; // Home used by route Breadcrumbs below
import { colors, spacing, typography, transitions, borderRadius } from '../styles/theme';

const routeLabels: Record<string, string> = {
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
  safety: 'Safety',
  'change-orders': 'Change Orders',
  'pay-apps': 'Payment Applications',
  settings: 'Settings',
  portal: 'Owner Portal',
  reports: 'Reports',
  integrations: 'Integrations',
  closeout: 'Closeout',
  transmittals: 'Transmittals',
  permits: 'Permits',
  insurance: 'Insurance',
  sustainability: 'Sustainability',
  bim: 'BIM',
  warranties: 'Warranties',
  equipment: 'Equipment',
  portfolio: 'Portfolio',
  photos: 'Photos',
  'prevailing-wage': 'Prevailing Wage',
  workforce: 'Workforce',
  deliveries: 'Deliveries',
  notifications: 'Notifications',
  profile: 'Profile',
};

// ── FolderBreadcrumbs ──────────────────────────────────
// Prop-driven breadcrumb for folder-depth navigation inside pages like Files.
// `stack` is the current folder path; `onNavigate(-1)` returns to root.

interface FolderBreadcrumbsProps {
  stack: Array<{ id: string; name: string }>;
  onNavigate: (index: number) => void;
}

const crumbButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: spacing['1'],
  padding: `${spacing['2']} ${spacing['3']}`,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  color: colors.textTertiary,
  transition: `color ${transitions.instant}, background-color ${transitions.instant}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minHeight: '44px',
  minWidth: '44px',
};

export const FolderBreadcrumbs: React.FC<FolderBreadcrumbsProps> = ({ stack, onNavigate }) => {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const ellipsisRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (!mobile) setDropdownOpen(false);
      }, 200);
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      clearTimeout(timeoutId);
    };
  }, []);

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  if (stack.length === 0) return null;

  // Mobile: show only a back arrow + the current (last) segment
  if (isMobile) {
    const current = stack[stack.length - 1];
    const prevIndex = stack.length >= 2 ? stack.length - 2 : -1;
    return (
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '375px' }}>
        <nav aria-label="Breadcrumb">
          <ol style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], margin: 0, padding: 0, listStyle: 'none', flexWrap: 'nowrap', minWidth: 0 }}>
            <li>
              <button
                onClick={() => onNavigate(prevIndex)}
                style={{ ...crumbButtonStyle, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}
                aria-label="Go back"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeSubtle;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <ChevronLeft size={16} />
              </button>
            </li>
            <li>
              <span
                aria-current="page"
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  maxWidth: '240px',
                  minHeight: '44px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <FolderOpen size={13} color={colors.primaryOrange} />
                {current.name}
              </span>
            </li>
          </ol>
        </nav>
      </div>
    );
  }

  const maxWidth = '160px';
  const dynCrumbStyle: React.CSSProperties = { ...crumbButtonStyle, maxWidth };

  const showEllipsis = false;

  const renderSegment = (segment: { id: string; name: string }, fullIndex: number) => {
    const isLast = fullIndex === stack.length - 1;
    return (
      <React.Fragment key={segment.id}>
        <li aria-hidden="true">
          <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', minWidth: '24px', minHeight: '44px', justifyContent: 'center' }}>
            <ChevronRight size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          </span>
        </li>
        <li>
          {isLast ? (
            <span
              aria-current="page"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                maxWidth,
                minHeight: '44px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <FolderOpen size={13} color={colors.primaryOrange} />
              {segment.name}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(fullIndex)}
              style={dynCrumbStyle}
              title={segment.name}
              aria-label={`Navigate to ${segment.name}`}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeSubtle;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <FolderOpen size={13} />
              {segment.name}
            </button>
          )}
        </li>
      </React.Fragment>
    );
  };

  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      <nav aria-label="Breadcrumb">
        <ol
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            margin: 0,
            padding: 0,
            listStyle: 'none',
            flexWrap: 'nowrap',
            minWidth: 0,
          }}
        >
          {/* Root */}
          <li>
            <button
              onClick={() => onNavigate(-1)}
              style={{ ...dynCrumbStyle, color: colors.textSecondary }}
              aria-label="Navigate to All Files"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <FolderOpen size={13} />
              <span>All Files</span>
            </button>
          </li>

          {showEllipsis ? (
            <React.Fragment>
              <li aria-hidden="true">
                <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', minWidth: '24px', minHeight: '44px', justifyContent: 'center' }}>
                  <ChevronRight size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                </span>
              </li>
              <li style={{ position: 'relative' }}>
                <button
                  ref={ellipsisRef}
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{ ...dynCrumbStyle, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Show full path"
                  aria-expanded={dropdownOpen}
                  title="Show full path"
                >
                  ...
                </button>
                {dropdownOpen && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 100,
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.md,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      minWidth: '160px',
                      padding: '4px 0',
                    }}
                  >
                    {stack.slice(0, -1).map((seg, i) => (
                      <button
                        key={seg.id}
                        onClick={() => { onNavigate(i); setDropdownOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing['1'],
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: `${spacing['2']} ${spacing['3']}`,
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamily,
                          color: colors.textSecondary,
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        aria-label={`Navigate to ${seg.name}`}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover;
                          (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                        }}
                      >
                        <FolderOpen size={13} />
                        {seg.name}
                      </button>
                    ))}
                  </div>
                )}
              </li>
              {renderSegment(stack[stack.length - 1], stack.length - 1)}
            </React.Fragment>
          ) : (
            stack.map((segment, i) => renderSegment(segment, i))
          )}
        </ol>
      </nav>
    </div>
  );
};

// ── Route Breadcrumbs ──────────────────────────────────

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard')) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        marginBottom: spacing['4'],
        overflowX: 'auto',
        maxWidth: '100%',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          listStyle: 'none',
          margin: 0,
          padding: 0,
          flexWrap: 'nowrap',
        }}
      >
        <li>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              cursor: 'pointer',
              padding: `${spacing['1']} ${spacing['1']}`,
              borderRadius: borderRadius.sm,
              transition: `color ${transitions.instant}`,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
            }}
          >
            <Home size={14} />
          </button>
        </li>

        {pathSegments.map((segment, i) => {
          const isUuidOrId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || /^\d+$/.test(segment);
          if (isUuidOrId) return null;
          const isLast = i === pathSegments.length - 1;
          const label = routeLabels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const path = '/' + pathSegments.slice(0, i + 1).join('/');

          return (
            <React.Fragment key={segment}>
              <li aria-hidden="true">
                <ChevronRight size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
              </li>
              <li>
                {isLast ? (
                  <span
                    aria-current="page"
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textPrimary,
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(path)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: colors.textTertiary,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamily,
                      padding: `${spacing['1']} ${spacing['1']}`,
                      borderRadius: borderRadius.sm,
                      transition: `color ${transitions.instant}`,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
                    }}
                  >
                    {label}
                  </button>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

// ── Skeleton ──────────────────────────────────────────
// Standardized loading placeholder with pulse animation.

const SKELETON_STYLE_ID = 'sitesync-skeleton-keyframes';

function injectSkeletonKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SKELETON_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SKELETON_STYLE_ID;
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(style);
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'text' | 'card' | 'circle' | 'rectangle';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height,
  borderRadius,
  variant = 'rectangle',
}) => {
  React.useEffect(() => {
    injectSkeletonKeyframes();
  }, []);

  let resolvedHeight = height;
  let resolvedBorderRadius = borderRadius;

  if (resolvedHeight === undefined) {
    if (variant === 'card') resolvedHeight = 120;
    else if (variant === 'text') resolvedHeight = 14;
    else resolvedHeight = 20;
  }

  if (variant === 'circle') {
    resolvedBorderRadius = '50%';
  } else if (resolvedBorderRadius === undefined) {
    resolvedBorderRadius = variant === 'card' ? 12 : 8;
  }

  return (
    <div
      style={{
        width,
        height: resolvedHeight,
        borderRadius: resolvedBorderRadius,
        backgroundColor: colors.surfaceInset,
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }}
    />
  );
};

interface SkeletonGroupProps {
  count: number;
  gap?: number;
  skeletonProps?: SkeletonProps;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({ count, gap = 8, skeletonProps }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} {...skeletonProps} />
      ))}
    </div>
  );
};
