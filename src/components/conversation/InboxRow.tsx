// ── InboxRow ───────────────────────────────────────────────────────────────
// Unified inbox row for the Conversation page. Shape is identical for RFIs,
// Submittals, Change Orders, and Punch Items so the page can sort and
// filter them together — that's the whole point of the Conversation view.
//
// SLA chip is rendered inline; click anywhere on the row navigates the
// caller to the entity detail (passed via onSelect).

import React from 'react';
import { ChevronRight, HelpCircle, Send, FileEdit, ListChecks } from 'lucide-react';
import { OrangeDot, Eyebrow } from '../atoms';
import { colors, typography, transitions } from '../../styles/theme';
import { SlaTimer } from './SlaTimer';
import { MiniApprovalChain } from '../../pages/submittals/types';

export type InboxItemType = 'rfi' | 'submittal' | 'change_order' | 'punch';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  number: string | number;
  title: string;
  status: string;
  /** Display-ready assignee name (NOT a uuid). Empty string is fine. */
  assignee?: string;
  /** ISO date — the contractual response window. */
  dueDate?: string | null;
  /** ISO timestamp — when the entity was created (used for tie-breaks). */
  createdAt: string;
  /** True when this item is on the current user's plate. */
  waitingOnYou: boolean;
  /** SLA pause anchor; null/undefined when ticking. */
  pausedAt?: string | null;
  /** Multi-party approval chain (jsonb); renders as compact stepper. */
  approvalChain?: unknown;
  /** Underlying record so callers don't have to refetch. */
  data: Record<string, unknown>;
}

export interface InboxRowProps {
  item: InboxItem;
  onSelect: (item: InboxItem) => void;
  /** Per-project holiday calendar passed through to SLA calc. */
  holidays?: ReadonlyArray<string>;
}

const TYPE_META: Record<InboxItemType, { label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }>; iconColor: string; iconBg: string }> = {
  rfi:          { label: 'RFI', Icon: HelpCircle,  iconColor: '#3A7BC8', iconBg: 'rgba(58, 123, 200, 0.08)' },
  submittal:    { label: 'SUB', Icon: Send,        iconColor: '#7C5DC7', iconBg: 'rgba(124, 93, 199, 0.08)' },
  change_order: { label: 'CO',  Icon: FileEdit,    iconColor: '#C75D7C', iconBg: 'rgba(199, 93, 124, 0.08)' },
  punch:        { label: 'PUNCH', Icon: ListChecks, iconColor: '#5DA86F', iconBg: 'rgba(93, 168, 111, 0.08)' },
};

const STATUS_COLOR: Record<string, string | undefined> = {
  closed: colors.statusActive,
  answered: colors.statusActive,
  approved: colors.statusActive,
  verified: colors.statusActive,
  resolved: colors.statusActive,
  in_review: colors.statusPending,
  under_review: colors.statusPending,
  pending_review: colors.statusPending,
  pending: colors.statusPending,
  submitted: colors.statusPending,
  rejected: colors.statusCritical,
  revise_resubmit: colors.statusCritical,
  resubmit: colors.statusCritical,
  void: colors.statusCritical,
};

export const InboxRow: React.FC<InboxRowProps> = ({ item, onSelect, holidays }) => {
  const meta = TYPE_META[item.type];
  const Icon = meta.Icon;
  const statusColor = STATUS_COLOR[item.status] ?? colors.statusInfo;
  const showOrange = item.waitingOnYou;

  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); } }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--hairline-2)',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        transition: transitions.quick,
      }}
    >
      {/* Type icon */}
      <div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: meta.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 2, position: 'relative',
        }}
      >
        <Icon size={16} style={{ color: meta.iconColor }} />
        {showOrange && (
          <OrangeDot size={7} haloSpread={2} style={{ position: 'absolute', top: -2, right: -2 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
          <Eyebrow style={{ fontSize: '10px' }}>
            {meta.label} #{item.number}
          </Eyebrow>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 500,
              color: colors.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.title}
          </span>
          <SlaTimer dueDate={item.dueDate} pausedAt={item.pausedAt} holidays={holidays} />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '10px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: statusColor,
            }}
          >
            {item.status.replace(/_/g, ' ')}
          </span>
          {item.assignee && (
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
              → {item.assignee}
            </span>
          )}
          {item.approvalChain != null && (
            <MiniApprovalChain status={item.status} approvalChain={item.approvalChain} />
          )}
        </div>
      </div>

      <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0, marginTop: 8 }} />
    </div>
  );
};

export default InboxRow;
