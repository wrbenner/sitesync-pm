/**
 * SubmittalActionPanel — Slide-over panel for Submittal actions from The Conversation.
 *
 * One-click approve/reject/resubmit without navigating away.
 * Shows submittal details, status history hint, and action buttons.
 */

import React, { useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, RotateCcw, FileText, Clock,
} from 'lucide-react';
import { SlideOverPanel, PanelSection, PanelField, StatusBadge } from '../SlideOverPanel';
import type { SlideOverAction } from '../SlideOverPanel';
import { useUpdateSubmittal } from '../../hooks/mutations/submittals';
import { useProjectId } from '../../hooks/useProjectId';
import { useProfileNames, displayName } from '../../hooks/queries/profiles';
import { colors, typography, transitions } from '../../styles/theme';

// ── Types ─────────────────────────────────────────────────

interface SubmittalData {
  id: string;
  number?: number;
  title?: string;
  description?: string;
  status?: string;
  spec_section?: string;
  subcontractor?: string;
  assigned_to?: string;
  responsible_contractor?: string;
  due_date?: string;
  required_onsite_date?: string;
  submit_by_date?: string;
  lead_time_weeks?: number;
  revision_number?: number;
  type?: string;
  stamp?: string;
  created_at?: string;
  submitted_date?: string;
  approved_date?: string;
  [key: string]: unknown;
}

interface SubmittalActionPanelProps {
  open: boolean;
  onClose: () => void;
  submittal: SubmittalData;
}

// ── Component ─────────────────────────────────────────────

export const SubmittalActionPanel: React.FC<SubmittalActionPanelProps> = ({ open, onClose, submittal }) => {
  const projectId = useProjectId();
  const updateSubmittal = useUpdateSubmittal();
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = submittal.status ?? 'pending';
  const title = submittal.title ?? submittal.description ?? 'Submittal';

  // Resolve assigned_to UUID to a name so the panel never renders a raw
  // UUID. Falsy resolution (no live profile + no synthetic-overlay match)
  // returns '' and the field is hidden.
  const { data: profileMap } = useProfileNames([submittal.assigned_to]);
  const assignedName = displayName(profileMap, submittal.assigned_to, '');

  // ── Status Change Handler ──────────────────────────────
  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!projectId) return;
    setIsSubmitting(true);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'approved') {
        updates.approved_date = new Date().toISOString();
        updates.stamp = 'approved';
      }
      if (newStatus === 'rejected') {
        updates.stamp = 'rejected';
      }
      if (newStatus === 'resubmit') {
        updates.stamp = 'revise_resubmit';
        updates.revision_number = (submittal.revision_number ?? 0) + 1;
      }
      await updateSubmittal.mutateAsync({
        id: submittal.id,
        updates,
        projectId,
      });
    } catch (e) {
      console.error('Failed to update submittal:', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [projectId, submittal.id, submittal.revision_number, updateSubmittal]);

  // ── Build action bar ───────────────────────────────────
  const actions: SlideOverAction[] = [];

  if (status === 'pending' || status === 'under_review' || status === 'submitted' || status === 'pending_review' || status === 'in_review') {
    actions.push({
      label: 'Approve',
      variant: 'primary',
      icon: <CheckCircle size={14} />,
      onClick: () => handleStatusChange('approved'),
      loading: isSubmitting,
    });
    actions.push({
      label: 'Reject',
      variant: 'danger',
      icon: <XCircle size={14} />,
      onClick: () => handleStatusChange('rejected'),
      disabled: isSubmitting,
    });
    actions.push({
      label: 'Revise & Resubmit',
      variant: 'secondary',
      icon: <RotateCcw size={14} />,
      onClick: () => handleStatusChange('resubmit'),
      disabled: isSubmitting,
    });
  }

  if (status === 'rejected' || status === 'resubmit' || status === 'revise_resubmit') {
    actions.push({
      label: 'Move to Review',
      variant: 'primary',
      onClick: () => handleStatusChange('under_review'),
      loading: isSubmitting,
    });
  }

  if (status === 'approved') {
    actions.push({
      label: 'Reopen for Review',
      variant: 'ghost',
      onClick: () => handleStatusChange('under_review'),
    });
  }

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={title}
      subtitle={`SUB #${submittal.number ?? submittal.spec_section ?? ''}`}
      badge={<StatusBadge status={status} />}
      actions={actions}
      detailHref={`#/submittals/${submittal.id}`}
    >
      {/* ── Description ─────────────────────────── */}
      {submittal.description && submittal.description !== title && (
        <PanelSection label="Description">
          <p style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '15px',
            lineHeight: '1.6',
            color: colors.ink,
            margin: 0,
          }}>
            {submittal.description}
          </p>
        </PanelSection>
      )}

      {/* ── Key Details ─────────────────────────── */}
      <PanelSection label="Details">
        <PanelField label="Status" value={<StatusBadge status={status} />} />
        {submittal.spec_section && <PanelField label="Spec section" value={submittal.spec_section} />}
        {submittal.type && <PanelField label="Type" value={submittal.type} />}
        {submittal.subcontractor && <PanelField label="Subcontractor" value={submittal.subcontractor} />}
        {assignedName && (
          <PanelField label="Assigned to" value={assignedName} />
        )}
        {submittal.responsible_contractor && (
          <PanelField label="Responsible contractor" value={submittal.responsible_contractor} />
        )}
        {submittal.revision_number != null && submittal.revision_number > 0 && (
          <PanelField label="Revision" value={`Rev ${submittal.revision_number}`} />
        )}
        {submittal.stamp && (
          <PanelField label="Stamp" value={<StatusBadge status={submittal.stamp} />} />
        )}
      </PanelSection>

      {/* ── Dates ───────────────────────────────── */}
      <PanelSection label="Timeline">
        {submittal.due_date && (
          <PanelField
            label="Due date"
            value={
              <span style={{ color: isOverdue(submittal.due_date, status) ? '#DC2626' : colors.ink }}>
                {formatShortDate(submittal.due_date)}
                {isOverdue(submittal.due_date, status) && ' — overdue'}
              </span>
            }
          />
        )}
        {submittal.required_onsite_date && (
          <PanelField label="Required on-site" value={formatShortDate(submittal.required_onsite_date)} />
        )}
        {submittal.submit_by_date && (
          <PanelField label="Submit by" value={formatShortDate(submittal.submit_by_date)} />
        )}
        {submittal.lead_time_weeks && (
          <PanelField label="Lead time" value={`${submittal.lead_time_weeks} weeks`} />
        )}
        {submittal.submitted_date && (
          <PanelField label="Submitted" value={formatShortDate(submittal.submitted_date)} />
        )}
        {submittal.approved_date && (
          <PanelField label="Approved" value={formatShortDate(submittal.approved_date)} />
        )}
        {submittal.created_at && (
          <PanelField label="Created" value={formatShortDate(submittal.created_at)} />
        )}
      </PanelSection>

      {/* ── Review Note (optional) ──────────────── */}
      {(status === 'pending' || status === 'under_review' || status === 'submitted' || status === 'pending_review' || status === 'in_review') && (
        <PanelSection label="Review Note (optional)">
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Add a note with your decision..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: `1px solid ${colors.hairline2}`,
              borderRadius: '10px',
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              lineHeight: '1.5',
              color: colors.ink,
              backgroundColor: colors.parchment2,
              resize: 'vertical',
              outline: 'none',
              transition: transitions.quick,
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = colors.hairline2; }}
          />
        </PanelSection>
      )}
    </SlideOverPanel>
  );
};

// ── Helpers ─────────────────────────────────────────────────

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'approved' || status === 'closed') return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDate.split('T')[0] < today;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default SubmittalActionPanel;
