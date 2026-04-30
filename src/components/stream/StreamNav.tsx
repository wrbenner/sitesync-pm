import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Zap,
  MessageCircle,
  FileCheck,
  Calendar,
  DollarSign,
  Layers,
  BookOpen,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { Hairline, OrangeDot } from '../atoms';
import { colors, spacing, typography, transitions } from '../../styles/theme';
import type { StreamItem, StreamItemType, StreamRole } from '../../types/stream';

interface NavEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  route: string;
  triggerType: StreamItemType | null; // type that lights up the dot
  roles: StreamRole[];
}

const NAV_ITEMS: NavEntry[] = [
  {
    id: 'day',
    label: 'Command',
    icon: Zap,
    route: '/day',
    triggerType: null,
    roles: ['pm', 'superintendent', 'owner', 'subcontractor', 'architect', 'executive'],
  },
  {
    id: 'rfis',
    label: 'RFIs',
    icon: MessageCircle,
    route: '/rfis',
    triggerType: 'rfi',
    roles: ['pm', 'subcontractor', 'architect'],
  },
  {
    id: 'submittals',
    label: 'Submittals',
    icon: FileCheck,
    route: '/submittals',
    triggerType: 'submittal',
    roles: ['pm', 'subcontractor', 'architect'],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: Calendar,
    route: '/schedule',
    triggerType: 'schedule',
    roles: ['pm', 'superintendent', 'owner', 'subcontractor'],
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: DollarSign,
    route: '/budget',
    triggerType: 'change_order',
    roles: ['pm', 'owner'],
  },
  {
    id: 'drawings',
    label: 'Drawings',
    icon: Layers,
    route: '/drawings',
    triggerType: null,
    roles: ['pm', 'superintendent', 'architect'],
  },
  {
    id: 'daily-log',
    label: 'Daily Log',
    icon: BookOpen,
    route: '/daily-log',
    triggerType: 'daily_log',
    roles: ['pm', 'superintendent'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    route: '/reports',
    triggerType: null,
    roles: ['pm', 'owner', 'executive'],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen,
    route: '/files',
    triggerType: null,
    roles: ['pm', 'subcontractor'],
  },
];

interface StreamNavProps {
  role: StreamRole;
  items: StreamItem[];
}

export const StreamNav: React.FC<StreamNavProps> = ({ role, items }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const typesInStream = new Set<StreamItemType>(items.map((i) => i.type));
  const visible = NAV_ITEMS.filter((entry) => entry.roles.includes(role));

  return (
    <div>
      <Hairline weight={2} spacing="tight" style={{ margin: 0 }} />
      <Tooltip.Provider delayDuration={300}>
        <div
          role="navigation"
          aria-label="Stream navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: visible.length > 6 ? 'flex-start' : 'space-between',
            gap: spacing[4],
            paddingTop: spacing[6],
            paddingBottom: spacing[6],
            paddingLeft: spacing[5],
            paddingRight: spacing[5],
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {visible.map((entry) => {
            const isActive = location.pathname === entry.route;
            const hasDot = entry.triggerType ? typesInStream.has(entry.triggerType) : false;
            const Icon = entry.icon;
            const color = isActive ? colors.primaryOrange : colors.ink4;

            const button = (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(entry.route)}
                aria-label={entry.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  position: 'relative',
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color,
                  transition: transitions.quick,
                }}
              >
                <Icon size={24} color={color} strokeWidth={1.75} />
                {hasDot && (
                  <OrangeDot
                    size={6}
                    haloSpread={2}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                    }}
                  />
                )}
              </button>
            );

            return (
              <Tooltip.Root key={entry.id}>
                <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    sideOffset={6}
                    style={{
                      background: colors.ink,
                      color: colors.parchment,
                      fontFamily: typography.fontFamily,
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '6px 10px',
                      borderRadius: 6,
                      zIndex: 1060,
                    }}
                  >
                    {entry.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>
      </Tooltip.Provider>
    </div>
  );
};

export default StreamNav;
