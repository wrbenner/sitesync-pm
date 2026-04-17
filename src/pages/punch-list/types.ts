// Shared types and constants for the punch list domain
import { colors } from '../../styles/theme';

export interface PunchItem {
  id: number;
  itemNumber: string;
  area: string;
  description: string;
  assigned: string;
  priority: string;
  status: string;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  sub_completed_at: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  rejection_reason: string | null;
  hasPhoto: boolean;
  photoCount?: number;
  dueDate: string;
  createdDate: string;
  reportedBy: string;
  responsible: string;
  trade: string;
  location: string;
}

export interface Comment {
  author: string;
  initials: string;
  time: string;
  text: string;
}

export const statusMap: Record<string, 'pending' | 'active' | 'complete'> = {
  open: 'pending',
  in_progress: 'active',
  sub_complete: 'active',
  verified: 'complete',
  rejected: 'pending',
};

export const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  sub_complete: 'Sub Complete',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
  open: colors.statusPending,
  in_progress: colors.statusInfo,
  sub_complete: colors.statusReview,
  verified: colors.statusActive,
  rejected: colors.statusCritical,
};

export const responsibleColors: Record<string, { bg: string; text: string }> = {
  subcontractor: { bg: 'rgba(58, 123, 200, 0.10)', text: colors.statusInfo },
  gc: { bg: 'rgba(244, 120, 32, 0.10)', text: colors.primaryOrange },
  owner: { bg: 'rgba(124, 93, 199, 0.10)', text: colors.statusReview },
};

export const responsibleLabel: Record<string, string> = {
  subcontractor: 'Subcontractor',
  gc: 'General Contractor',
  owner: 'Owner',
};

export function getDaysRemaining(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
}

export function getDueDateColor(dueDate: string): string {
  const days = getDaysRemaining(dueDate);
  if (days <= 0) return colors.statusCritical;
  if (days <= 4) return colors.statusPending;
  return colors.statusActive;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}
