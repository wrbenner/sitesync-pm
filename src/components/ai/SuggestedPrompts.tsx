import React from 'react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

const pageContextPrompts: Record<string, string[]> = {
  dashboard: [
    'What needs my attention today?',
    'Summarize project health in one paragraph',
    'What are the top 3 risks right now?',
    'Prepare a status update for the owner',
  ],
  schedule: [
    'What is causing the MEP delay?',
    'Show me critical path changes this week',
    'When will we hit the next milestone?',
    'What tasks can run in parallel?',
  ],
  budget: [
    'Which divisions are trending over budget?',
    'What is the projected cost at completion?',
    'Show change order impact analysis',
    'Where can we value engineer?',
  ],
  rfis: [
    'Which RFIs are blocking work?',
    'What is the average RFI response time?',
    'Are there any RFI patterns by trade?',
    'Draft a follow up for overdue RFIs',
  ],
  tasks: [
    'What tasks are at risk this week?',
    'Show me blocked tasks and their dependencies',
    'Who has the highest workload right now?',
    'What should I prioritize today?',
  ],
  crews: [
    'Which crews need reallocation?',
    'Show productivity trends by crew',
    'Any resource conflicts this week?',
    'How can we improve utilization?',
  ],
  submittals: [
    'Which submittals are overdue for review?',
    'What is our first pass approval rate?',
    'Show submittal dependencies on procurement',
    'Draft a review reminder email',
  ],
  default: [
    'How is the project doing overall?',
    'What are the biggest risks right now?',
    'Summarize this week for the OAC meeting',
    'When will we hit the next milestone?',
  ],
};

export function getPromptsForPage(page: string): string[] {
  return pageContextPrompts[page] || pageContextPrompts.default;
}

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ prompts, onSelect }) => {
  return (
    <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(prompt)}
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: 'transparent',
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.full,
            cursor: 'pointer',
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            fontFamily: typography.fontFamily,
            transition: `all ${transitions.instant}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.statusReview;
            (e.currentTarget as HTMLButtonElement).style.color = colors.statusReview;
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${colors.statusReview}08`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderDefault;
            (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
};
