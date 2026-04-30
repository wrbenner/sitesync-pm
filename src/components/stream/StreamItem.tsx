import React from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  FileCheck,
  CheckCircle,
  DollarSign,
  ListTodo,
  BookOpen,
  AlertTriangle,
  Calendar,
  Handshake,
  Sparkles,
} from 'lucide-react';
import { colors, typography, spacing, transitions } from '../../styles/theme';
import { StreamItemExpanded } from './StreamItemExpanded';
import type {
  StreamItem as StreamItemType,
  StreamItemType as ItemType,
  Urgency,
  StreamAction,
  SnoozeDuration,
  SourceReference,
} from '../../types/stream';

interface StreamItemProps {
  item: StreamItemType;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: StreamAction, item: StreamItemType) => void;
  onSnooze: (id: string, duration: SnoozeDuration) => void;
  onSourceOpen: (source: SourceReference) => void;
  onIrisAction: (
    handler: 'send_draft' | 'edit_draft' | 'dismiss_draft',
    item: StreamItemType,
  ) => void;
  isMobile: boolean;
}

const TYPE_ICONS: Record<ItemType, React.ComponentType<{ size?: number; color?: string }>> = {
  rfi: MessageCircle,
  submittal: FileCheck,
  punch: CheckCircle,
  change_order: DollarSign,
  task: ListTodo,
  daily_log: BookOpen,
  incident: AlertTriangle,
  schedule: Calendar,
  commitment: Handshake,
};

function urgencyBarColor(urgency: Urgency): string {
  if (urgency === 'critical') return 'var(--color-primary)';
  if (urgency === 'high') return 'var(--color-statusCritical)';
  return 'transparent';
}

// Reason text styling: leading "Nd overdue" / "Overdue" segment renders in
// statusCritical; the rest of the reason stays in ink3. We split on the first
// `·` so callers can write "3 days overdue · Martinez Eng." without extra
// wiring; if the leading segment isn't an overdue marker we treat the whole
// reason as normal.
function ReasonLine({ reason, overdue }: { reason: string; overdue: boolean }) {
  if (!overdue || !reason) {
    return (
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          fontWeight: 400,
          color: colors.ink3,
          lineHeight: 1.4,
        }}
      >
        {reason}
      </span>
    );
  }
  const idx = reason.indexOf(' · ');
  const leading = idx > 0 ? reason.slice(0, idx) : reason;
  const trailing = idx > 0 ? reason.slice(idx) : '';
  return (
    <span
      style={{
        fontFamily: typography.fontFamily,
        fontSize: '13px',
        fontWeight: 400,
        color: colors.ink3,
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: colors.statusCritical, fontWeight: 500 }}>{leading}</span>
      {trailing}
    </span>
  );
}

export const StreamItem: React.FC<StreamItemProps> = ({
  item,
  expanded,
  onToggle,
  onAction,
  onSnooze,
  onSourceOpen,
  onIrisAction,
  isMobile,
}) => {
  const Icon = TYPE_ICONS[item.type] ?? Calendar;
  const barColor = urgencyBarColor(item.urgency);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="article"
      aria-expanded={expanded}
      data-stream-item-id={item.id}
      style={{
        position: 'relative',
        background: 'transparent',
        transition: transitions.quick,
      }}
    >
      {/* Urgency bar */}
      {barColor !== 'transparent' && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: barColor,
          }}
        />
      )}

      {/* Collapsed header (always shown; click to toggle) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={(e) => {
          if (!isMobile) e.currentTarget.style.background = colors.surfaceHover;
        }}
        onMouseLeave={(e) => {
          if (!isMobile) e.currentTarget.style.background = 'transparent';
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing[3],
          paddingTop: spacing[4],
          paddingBottom: spacing[4],
          paddingLeft: isMobile ? spacing[4] : spacing[5],
          paddingRight: isMobile ? spacing[4] : spacing[5],
          minHeight: 56,
          cursor: 'pointer',
          transition: transitions.quick,
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = colors.surfaceHover;
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Icon size={16} color={colors.ink4} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 600,
              color: colors.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.4,
            }}
            title={item.title}
          >
            {item.title}
          </div>
          <div style={{ marginTop: 2 }}>
            <ReasonLine reason={item.reason} overdue={item.overdue} />
          </div>
          {item.irisEnhancement && (
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                fontWeight: 500,
                color: colors.indigo,
                lineHeight: 1.4,
              }}
            >
              <Sparkles size={12} aria-hidden="true" />
              <span>{item.irisEnhancement.summary}</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <StreamItemExpanded
            item={item}
            onAction={onAction}
            onSnooze={onSnooze}
            onSourceOpen={onSourceOpen}
            onIrisAction={onIrisAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreamItem;
