/**
 * RiskTable — sortable table of risk-ranked projects. Single hairline
 * row dividers, no boxed cards.
 */

import React from 'react';
import { Eyebrow, OrangeDot } from '../atoms';
import { colors, typography } from '../../styles/theme';
import type { RiskRankedProject } from '../../types/portfolio';

interface RiskTableProps {
  projects: RiskRankedProject[];
  onProjectClick?: (projectId: string) => void;
}

export const RiskTable: React.FC<RiskTableProps> = ({ projects, onProjectClick }) => {
  if (projects.length === 0) {
    return (
      <div
        style={{
          padding: '32px 0',
          fontFamily: typography.fontFamily,
          fontStyle: 'italic',
          color: colors.textTertiary,
        }}
      >
        No projects to rank yet.
      </div>
    );
  }
  return (
    <div role="table" aria-label="Project risk table">
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 2fr 1fr 80px 2fr',
          gap: 16,
          padding: '12px 0',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <span />
        <Eyebrow>Project</Eyebrow>
        <Eyebrow>Risk level</Eyebrow>
        <Eyebrow>Score</Eyebrow>
        <Eyebrow>Why</Eyebrow>
      </div>
      {projects.map((p) => (
        <div
          key={p.project_id}
          role="row"
          onClick={() => onProjectClick?.(p.project_id)}
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 2fr 1fr 80px 2fr',
            gap: 16,
            padding: '14px 0',
            borderBottom: '1px solid var(--hairline)',
            cursor: onProjectClick ? 'pointer' : 'default',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {p.riskLevel === 'red' && <OrangeDot size={8} haloSpread={3} />}
          </span>
          <span style={{ fontFamily: typography.fontFamily, fontSize: 14 }}>
            {p.project_name}
          </span>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color:
                p.riskLevel === 'red'
                  ? colors.primaryOrange
                  : p.riskLevel === 'yellow'
                    ? colors.statusReview
                    : colors.statusActive,
            }}
          >
            {p.riskLevel}
          </span>
          <span style={{ fontFamily: typography.fontFamily, fontSize: 16 }}>
            {p.riskScore}
          </span>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontStyle: 'italic',
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {p.riskFactors.slice(0, 2).join(' · ')}
          </span>
        </div>
      ))}
    </div>
  );
};
