import React from 'react';
import { motion } from 'framer-motion';
import { colors, spacing, typography, transitions } from '../styles/theme';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: spacing['6'],
        borderBottom: `1px solid ${colors.borderSubtle}`,
        position: 'relative',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: `${spacing['3']} 0`,
              border: 'none',
              backgroundColor: 'transparent',
              color: isActive ? colors.orangeText : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
              cursor: 'pointer',
              transition: `color ${transitions.instant}`,
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium,
                  color: isActive ? colors.orangeText : colors.textTertiary,
                  backgroundColor: isActive ? colors.orangeSubtle : colors.surfaceInset,
                  padding: `1px ${spacing['2']}`,
                  borderRadius: '9999px',
                  minWidth: '20px',
                  textAlign: 'center',
                  transition: `all ${transitions.instant}`,
                }}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: colors.primaryOrange,
                  borderRadius: '1px 1px 0 0',
                }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
