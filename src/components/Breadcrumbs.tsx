import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { colors, spacing, typography, transitions } from '../styles/theme';

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
          borderRadius: '4px',
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
                  borderRadius: '4px',
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
