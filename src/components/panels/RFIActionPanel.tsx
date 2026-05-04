/**
 * RFIActionPanel — Slide-over panel for RFI actions from The Conversation.
 *
 * Shows RFI detail + response form + status actions without navigating away.
 * The GC can read the question, type a response, and close it — all in one flow.
 */

import React, { useState, useCallback } from 'react';
import {
  Send, _Clock, _User, _MessageSquare, _AlertTriangle, _CheckCircle,
} from 'lucide-react';
import { SlideOverPanel, PanelSection, PanelField, StatusBadge } from '../SlideOverPanel';
import type { SlideOverAction } from '../SlideOverPanel';
import { useUpdateRFI, useCreateRFIResponse } from '../../hooks/mutations/rfis';
import { useProjectId } from '../../hooks/useProjectId';
import { useProfileNames, displayName } from '../../hooks/queries/profiles';
import { colors, typography, transitions } from '../../styles/theme';

// ── Types ─────────────────────────────────────────────────

interface RFIData {
  id: string;
  number?: number;
  subject?: string;
  title?: string;
  status?: string;
  question?: string;
  description?: string;
  assigned_to?: string;
  ball_in_court?: string;
  due_date?: string;
  created_at?: string;
  created_by?: string;
  cost_impact?: string;
  schedule_impact?: string;
  priority?: string;
  spec_section?: string;
  [key: string]: unknown;
}

interface RFIActionPanelProps {
  open: boolean;
  onClose: () => void;
  rfi: RFIData;
}

// ── Component ─────────────────────────────────────────────

export const RFIActionPanel: React.FC<RFIActionPanelProps> = ({ open, onClose, rfi }) => {
  const projectId = useProjectId();
  const updateRFI = useUpdateRFI();
  const createResponse = useCreateRFIResponse();
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = rfi.status ?? 'open';
  const title = rfi.subject ?? rfi.title ?? 'RFI';
  const question = rfi.question ?? rfi.description ?? '';

  // Resolve user UUIDs (assigned_to / ball_in_court / created_by) to names so
  // the panel never renders a raw "a0000001-..." string. Falsy resolution
  // (no live profile + no synthetic-overlay match) returns '' and the field
  // is hidden so the panel never renders a raw UUID.
  const { data: profileMap } = useProfileNames([rfi.assigned_to, rfi.ball_in_court, rfi.created_by]);
  const assignedName = displayName(profileMap, rfi.assigned_to, '');
  const ballInCourtName = displayName(profileMap, rfi.ball_in_court, '');

  // ── Actions ────────────────────────────────────────────
  const handleRespond = useCallback(async () => {
    if (!responseText.trim() || !projectId) return;
    setIsSubmitting(true);
    try {
      await createResponse.mutateAsync({
        data: {
          rfi_id: rfi.id,
          response_text: responseText.trim(),
          project_id: projectId,
        },
        rfiId: rfi.id,
        projectId,
      });
      setResponseText('');
      // If RFI is open, move to answered
      if (status === 'open' || status === 'under_review') {
        await updateRFI.mutateAsync({
          id: rfi.id,
          updates: { status: 'answered' },
          projectId,
        });
      }
    } catch (e) {
      console.error('Failed to respond to RFI:', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [responseText, projectId, rfi.id, status, createResponse, updateRFI]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!projectId) return;
    try {
      await updateRFI.mutateAsync({
        id: rfi.id,
        updates: { status: newStatus },
        projectId,
      });
    } catch (e) {
      console.error('Failed to update RFI status:', e);
    }
  }, [projectId, rfi.id, updateRFI]);

  // ── Build action bar ───────────────────────────────────
  const actions: SlideOverAction[] = [];

  if (status === 'open' || status === 'under_review') {
    actions.push({
      label: 'Close RFI',
      variant: 'secondary',
      onClick: () => handleStatusChange('closed'),
    });
  }
  if (status === 'answered') {
    actions.push({
      label: 'Reopen',
      variant: 'ghost',
      onClick: () => handleStatusChange('open'),
    });
    actions.push({
      label: 'Close',
      variant: 'primary',
      onClick: () => handleStatusChange('closed'),
    });
  }
  if (status === 'closed') {
    actions.push({
      label: 'Reopen',
      variant: 'ghost',
      onClick: () => handleStatusChange('open'),
    });
  }

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={title}
      subtitle={`RFI #${rfi.number ?? ''}`}
      badge={<StatusBadge status={status} />}
      actions={actions}
      detailHref={`#/rfis/${rfi.id}`}
    >
      {/* ── The Question ────────────────────────── */}
      {question && (
        <PanelSection label="Question">
          <p style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '15px',
            lineHeight: '1.6',
            color: colors.ink,
            margin: 0,
            fontStyle: 'italic',
          }}>
            {question}
          </p>
        </PanelSection>
      )}

      {/* ── Key Details ─────────────────────────── */}
      <PanelSection label="Details">
        <PanelField label="Status" value={<StatusBadge status={status} />} />
        {assignedName && (
          <PanelField label="Assigned to" value={assignedName} />
        )}
        {ballInCourtName && (
          <PanelField label="Ball in court" value={ballInCourtName} />
        )}
        {rfi.due_date && (
          <PanelField
            label="Due date"
            value={
              <span style={{ color: isOverdue(rfi.due_date, status) ? '#DC2626' : colors.ink }}>
                {formatShortDate(rfi.due_date)}
                {isOverdue(rfi.due_date, status) && ' — overdue'}
              </span>
            }
          />
        )}
        {rfi.spec_section && <PanelField label="Spec section" value={rfi.spec_section} />}
        {rfi.cost_impact && <PanelField label="Cost impact" value={rfi.cost_impact} />}
        {rfi.schedule_impact && <PanelField label="Schedule impact" value={rfi.schedule_impact} />}
        {rfi.created_at && <PanelField label="Created" value={formatShortDate(rfi.created_at)} />}
      </PanelSection>

      {/* ── Response Form ───────────────────────── */}
      {status !== 'closed' && (
        <PanelSection label="Respond">
          <div style={{ position: 'relative' }}>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Type your response..."
              rows={4}
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
            <button
              onClick={handleRespond}
              disabled={!responseText.trim() || isSubmitting}
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: responseText.trim() ? colors.primaryOrange : colors.parchment3,
                color: responseText.trim() ? colors.white : colors.ink4,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                fontWeight: 600,
                cursor: responseText.trim() ? 'pointer' : 'not-allowed',
                transition: transitions.quick,
              }}
            >
              <Send size={12} />
              {isSubmitting ? 'Sending...' : 'Respond'}
            </button>
          </div>
        </PanelSection>
      )}
    </SlideOverPanel>
  );
};

// ── Helpers ─────────────────────────────────────────────────

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'closed' || status === 'answered') return false;
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

export default RFIActionPanel;
