import React from 'react';
import { Database, FileText, DollarSign, Calendar, Search, ClipboardList, CheckCircle, AlertTriangle } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import type { ToolResult } from '../../hooks/useProjectAI';

const toolIcons: Record<string, React.ReactNode> = {
  query_rfis: <FileText size={13} />,
  query_submittals: <ClipboardList size={13} />,
  query_tasks: <CheckCircle size={13} />,
  query_budget: <DollarSign size={13} />,
  query_schedule: <Calendar size={13} />,
  query_daily_logs: <Calendar size={13} />,
  get_project_health: <AlertTriangle size={13} />,
  search_everything: <Search size={13} />,
  create_rfi: <FileText size={13} />,
  create_task: <CheckCircle size={13} />,
  update_status: <Database size={13} />,
};

const toolLabels: Record<string, string> = {
  query_rfis: 'Queried RFIs',
  query_submittals: 'Queried Submittals',
  query_tasks: 'Queried Tasks',
  query_budget: 'Queried Budget',
  query_schedule: 'Queried Schedule',
  query_daily_logs: 'Queried Daily Logs',
  get_project_health: 'Analyzed Project Health',
  search_everything: 'Searched Project',
  create_rfi: 'Created RFI',
  create_task: 'Created Task',
  update_status: 'Updated Status',
};

interface ToolResultCardProps {
  result: ToolResult;
}

export const ToolResultCard: React.FC<ToolResultCardProps> = ({ result }) => {
  const icon = toolIcons[result.tool] || <Database size={13} />;
  const label = toolLabels[result.tool] || result.tool;
  const data = result.result as Record<string, unknown>;

  // Determine summary text based on tool
  let summary = '';
  if (data.count !== undefined) {
    summary = `${data.count} results found`;
  } else if (data.created) {
    summary = 'Successfully created';
  } else if (data.updated) {
    summary = `Status changed to ${data.new_status}`;
  } else if (data.overall_health !== undefined) {
    summary = `Health score: ${data.overall_health}/100`;
  } else if (data.total !== undefined) {
    summary = `${data.total} results found`;
  } else if (data.error) {
    summary = `Error: ${data.error}`;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `${spacing['1']} ${spacing['3']}`,
      backgroundColor: 'rgba(124, 93, 199, 0.06)',
      borderRadius: borderRadius.sm,
      borderLeft: `2px solid ${colors.statusReview}`,
    }}>
      <span style={{ color: colors.statusReview, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.statusReview }}>{label}</span>
      {summary && (
        <>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>·</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{summary}</span>
        </>
      )}
    </div>
  );
};
