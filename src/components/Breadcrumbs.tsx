import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, FolderOpen } from 'lucide-react';
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
};

// ── FolderBreadcrumbs ──────────────────────────────────
// Prop-driven breadcrumb for folder-depth navigation inside pages like Files.
// `stack` is the current folder path; `onNavigate(-1)` returns to root.

interface FolderBreadcrumbsProps {
  stack: Array<{ id: string; name: string }>;
  onNavigate: (index: number) => void;
}

const crumbButtonStyle: React.CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: spacing['1'],
  padding: `${spacing['1']} ${spacing['2']}`,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  color: colors.textTertiary,
  transition: `color ${transitions.instant}, background-color ${transitions.instant}`,
};

export const FolderBreadcrumbs: React.FC<FolderBreadcrumbsProps> = ({ stack, onNavigate }) => {
  if (stack.length === 0) return null;

  return (
    <nav
      aria-label="Folder navigation"
      style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['3'], flexWrap: 'wrap' }}
    >
      {/* Root */}
      <button
        onClick={() => onNavigate(-1)}
        style={crumbButtonStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeSubtle;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <Home size={13} />
        <span>All Files</span>
      </button>

      {stack.map((segment, i) => {
        const isLast = i === stack.length - 1;
        return (
          <React.Fragment key={segment.id}>
            <ChevronRight size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
            {isLast ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
              }}>
                <FolderOpen size={13} color={colors.primaryOrange} />
                {segment.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(i)}
                style={crumbButtonStyle}
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
          </React.Fragment>
        );
      })}
    </nav>
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['1'],
        marginBottom: spacing['4'],
      }}
    >
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          border: 'none',
          backgroundColor: 'transparent',
          color: colors.textTertiary,
          cursor: 'pointer',
          padding: `${spacing['1']} ${spacing['1']}`,
          borderRadius: borderRadius.sm,
          transition: `color ${transitions.instant}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
        }}
      >
        <Home size={14} />
      </button>

      {pathSegments.map((segment, i) => {
        const isLast = i === pathSegments.length - 1;
        const label = routeLabels[segment] || segment;
        const path = '/' + pathSegments.slice(0, i + 1).join('/');

        return (
          <React.Fragment key={segment}>
            <ChevronRight size={12} style={{ color: colors.textTertiary }} />
            {isLast ? (
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
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
          </React.Fragment>
        );
      })}
    </nav>
  );
};
