/**
 * TransmittalModal — Modal for creating a transmittal when issuing a drawing set.
 *
 * A transmittal is a formal record of drawings sent to a recipient (owner, GC, sub).
 * It captures:
 *  - Recipient info (name, company, email)
 *  - Purpose of issue (for construction, for review, for record, etc.)
 *  - Description / remarks
 *  - List of drawings included with revision numbers
 *  - Date issued
 *
 * This modal is opened when the user clicks "Issue" on a drawing set.
 */

import React, { useState, useCallback } from 'react';
import {
  X, Send, FileText, User, Building2, Mail, MessageSquare,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { Btn } from '../Primitives';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TransmittalData {
  /** Set being issued */
  set_id: string;
  /** Recipient name */
  recipient_name: string;
  /** Recipient company */
  recipient_company: string;
  /** Recipient email */
  recipient_email: string;
  /** Purpose of issue */
  purpose: TransmittalPurpose;
  /** Additional remarks */
  remarks: string;
  /** Drawing IDs included */
  drawing_ids: string[];
}

export type TransmittalPurpose =
  | 'for_construction'
  | 'for_review'
  | 'for_approval'
  | 'for_record'
  | 'for_information'
  | 'as_requested';

interface DrawingRef {
  id: string;
  setNumber: string;
  title: string;
  revision: string;
}

interface TransmittalModalProps {
  setName: string;
  drawings: DrawingRef[];
  setId: string;
  onClose: () => void;
  onSubmit: (data: TransmittalData) => void;
  isSubmitting?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PURPOSE_OPTIONS: { value: TransmittalPurpose; label: string }[] = [
  { value: 'for_construction', label: 'Issued for Construction' },
  { value: 'for_review', label: 'Issued for Review' },
  { value: 'for_approval', label: 'Issued for Approval' },
  { value: 'for_record', label: 'Issued for Record' },
  { value: 'for_information', label: 'For Information Only' },
  { value: 'as_requested', label: 'As Requested' },
];

const MODAL_WIDTH = 560;

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4'],
  } as React.CSSProperties,

  backdrop: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)',
  } as React.CSSProperties,

  modal: {
    position: 'relative' as const,
    width: MODAL_WIDTH,
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 64px)',
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.xl,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.xl,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing['4']} ${spacing['5']}`,
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  } as React.CSSProperties,

  headerTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    margin: 0,
  } as React.CSSProperties,

  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: spacing['5'],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing['4'],
  } as React.CSSProperties,

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing['1'],
  } as React.CSSProperties,

  label: {
    ...typography.caption,
    fontWeight: 600,
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfacePage,
    color: colors.textPrimary,
    outline: 'none',
    transition: `border-color ${transitions.fast}`,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfacePage,
    color: colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfacePage,
    color: colors.textPrimary,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  drawingList: {
    maxHeight: 160,
    overflowY: 'auto' as const,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfacePage,
  } as React.CSSProperties,

  drawingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 13,
  } as React.CSSProperties,

  drawingSheet: {
    fontWeight: 600,
    color: colors.textPrimary,
    minWidth: 60,
  } as React.CSSProperties,

  drawingTitle: {
    flex: 1,
    color: colors.textSecondary,
    marginLeft: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  drawingRev: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: 8,
  } as React.CSSProperties,

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing['2'],
    padding: `${spacing['3']} ${spacing['5']}`,
    borderTop: `1px solid ${colors.border}`,
    flexShrink: 0,
  } as React.CSSProperties,

  sectionLabel: {
    ...typography.caption,
    fontWeight: 600,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: 4,
  } as React.CSSProperties,

  row: {
    display: 'flex',
    gap: spacing['3'],
  } as React.CSSProperties,
};

// ── Component ─────────────────────────────────────────────────────────────

export const TransmittalModal: React.FC<TransmittalModalProps> = ({
  setName,
  drawings,
  setId,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [purpose, setPurpose] = useState<TransmittalPurpose>('for_construction');
  const [remarks, setRemarks] = useState('');

  const isValid = recipientName.trim().length > 0 && recipientCompany.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onSubmit({
      set_id: setId,
      recipient_name: recipientName.trim(),
      recipient_company: recipientCompany.trim(),
      recipient_email: recipientEmail.trim(),
      purpose,
      remarks: remarks.trim(),
      drawing_ids: drawings.map((d) => d.id),
    });
  }, [isValid, setId, recipientName, recipientCompany, recipientEmail, purpose, remarks, drawings, onSubmit]);

  // Submit on Enter in text fields
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && isValid && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isValid, isSubmitting, handleSubmit],
  );

  return (
    <div style={S.overlay}>
      <div style={S.backdrop} onClick={onClose} />

      <div style={S.modal} role="dialog" aria-label="Create Transmittal">
        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.headerTitle}>Create Transmittal</h2>
            <p style={{ ...typography.caption, color: colors.textTertiary, margin: '4px 0 0' }}>
              Issue "{setName}" — {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              padding: 4,
              borderRadius: borderRadius.sm,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Recipient */}
          <div style={S.sectionLabel}>Recipient</div>
          <div style={S.row}>
            <div style={{ ...S.fieldGroup, flex: 1 }}>
              <label style={S.label}><User size={12} /> Name *</label>
              <input
                style={S.input}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Smith"
                onKeyDown={handleKeyDown}
              />
            </div>
            <div style={{ ...S.fieldGroup, flex: 1 }}>
              <label style={S.label}><Building2 size={12} /> Company *</label>
              <input
                style={S.input}
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
                placeholder="Acme Construction"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}><Mail size={12} /> Email</label>
            <input
              type="email"
              style={S.input}
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="john@acme.com"
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Purpose */}
          <div style={S.fieldGroup}>
            <label style={S.label}><FileText size={12} /> Purpose of Issue</label>
            <select
              style={S.select}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as TransmittalPurpose)}
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Remarks */}
          <div style={S.fieldGroup}>
            <label style={S.label}><MessageSquare size={12} /> Remarks</label>
            <textarea
              style={S.textarea}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional notes for the recipient..."
            />
          </div>

          {/* Drawing list */}
          <div>
            <div style={S.sectionLabel}>Drawings Included</div>
            <div style={S.drawingList}>
              {drawings.map((d, i) => (
                <div
                  key={d.id}
                  style={{
                    ...S.drawingRow,
                    borderBottom: i === drawings.length - 1 ? 'none' : S.drawingRow.borderBottom,
                  }}
                >
                  <span style={S.drawingSheet}>{d.setNumber}</span>
                  <span style={S.drawingTitle}>{d.title}</span>
                  <span style={S.drawingRev}>Rev {d.revision}</span>
                </div>
              ))}
              {drawings.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: colors.textTertiary, fontSize: 13 }}>
                  No drawings in this set
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <Btn variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="md"
            icon={<Send size={14} />}
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Issuing...' : 'Issue Transmittal'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

export default TransmittalModal;
