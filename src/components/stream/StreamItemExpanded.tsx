import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { colors, typography, spacing, borderRadius, transitions } from '../../styles/theme';
import { PermissionGate } from '../auth/PermissionGate';
import type {
  StreamItem,
  StreamAction,
  SnoozeDuration,
  SourceReference,
} from '../../types/stream';

interface StreamItemExpandedProps {
  item: StreamItem;
  onAction: (action: StreamAction, item: StreamItem) => void;
  onSnooze: (id: string, duration: SnoozeDuration) => void;
  onSourceOpen: (source: SourceReference) => void;
  onIrisAction: (handler: 'send_draft' | 'edit_draft' | 'dismiss_draft', item: StreamItem) => void;
}

const SNOOZE_OPTIONS: Array<{ value: SnoozeDuration; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: 'tomorrow', label: 'Tomorrow morning' },
  { value: 'next_week', label: 'Next week' },
];

const ACTION_BTN_BASE: React.CSSProperties = {
  fontFamily: typography.fontFamily,
  fontSize: '13px',
  fontWeight: 500,
  padding: `${spacing[2]} ${spacing[4]}`,
  borderRadius: borderRadius.base,
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  minHeight: 36,
  transition: transitions.quick,
};

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ACTION_BTN_BASE,
        background: colors.ink,
        color: colors.parchment,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ACTION_BTN_BASE,
        background: 'transparent',
        color: colors.ink2,
      }}
    >
      {children}
    </button>
  );
}

function DismissButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ACTION_BTN_BASE,
        background: 'transparent',
        color: colors.ink4,
        fontSize: '12px',
        padding: `${spacing[2]} ${spacing[3]}`,
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({
  action,
  item,
  onAction,
}: {
  action: StreamAction;
  item: StreamItem;
  onAction: (action: StreamAction, item: StreamItem) => void;
}) {
  const handleClick = () => onAction(action, item);
  const button =
    action.type === 'primary' ? (
      <PrimaryButton onClick={handleClick}>{action.label}</PrimaryButton>
    ) : action.type === 'dismiss' ? (
      <DismissButton onClick={handleClick}>{action.label}</DismissButton>
    ) : (
      <SecondaryButton onClick={handleClick}>{action.label}</SecondaryButton>
    );

  if (action.permissionKey) {
    return <PermissionGate permission={action.permissionKey}>{button}</PermissionGate>;
  }
  return button;
}

function SnoozePopover({
  itemId,
  onSnooze,
}: {
  itemId: string;
  onSnooze: (id: string, duration: SnoozeDuration) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Snooze options"
          style={{
            ...ACTION_BTN_BASE,
            background: 'transparent',
            color: colors.ink4,
            fontSize: '12px',
            padding: `${spacing[2]} ${spacing[3]}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Snooze
          <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          style={{
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            padding: spacing[1],
            minWidth: 180,
            zIndex: 1050,
          }}
        >
          {SNOOZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSnooze(itemId, opt.value);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: `${spacing[2]} ${spacing[3]}`,
                background: 'transparent',
                border: 'none',
                borderRadius: borderRadius.sm,
                fontFamily: typography.fontFamily,
                fontSize: '13px',
                fontWeight: 400,
                color: colors.ink,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {opt.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SourceTrail({
  sources,
  onSourceOpen,
}: {
  sources: SourceReference[];
  onSourceOpen: (source: SourceReference) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 2,
        marginTop: spacing[3],
      }}
    >
      {sources.map((source, idx) => (
        <React.Fragment key={`${source.type}-${source.id}-${idx}`}>
          <button
            type="button"
            onClick={() => onSourceOpen(source)}
            style={{
              flexShrink: 0,
              fontFamily: typography.fontFamily,
              fontSize: '11px',
              fontWeight: 500,
              color: colors.ink3,
              background: colors.surfaceInset,
              padding: '4px 8px',
              borderRadius: borderRadius.sm,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {source.title}
          </button>
          {idx < sources.length - 1 && (
            <span style={{ color: colors.ink4, fontSize: 11 }}>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ImpactChain({ chain }: { chain: string[] }) {
  if (chain.length === 0) return null;
  return (
    <div
      style={{
        marginTop: spacing[3],
        fontFamily: typography.fontFamily,
        fontSize: '12px',
        fontWeight: 500,
        color: colors.rust,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {chain.map((step, idx) => (
        <React.Fragment key={idx}>
          <span>{step}</span>
          {idx < chain.length - 1 && <span style={{ opacity: 0.6 }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function IrisDraftSection({
  item,
  onIrisAction,
}: {
  item: StreamItem;
  onIrisAction: (handler: 'send_draft' | 'edit_draft' | 'dismiss_draft', item: StreamItem) => void;
}) {
  const enhancement = item.irisEnhancement;
  const [showFull, setShowFull] = useState(false);
  if (!enhancement?.draftContent) return null;

  const draft = enhancement.draftContent;
  const truncated = !showFull && draft.length > 280;
  const visible = truncated ? draft.slice(0, 280).trimEnd() + '…' : draft;

  return (
    <div
      style={{
        marginTop: spacing[4],
        background: colors.surfaceInset,
        borderRadius: borderRadius.base,
        padding: `${spacing[3]} ${spacing[4]}`,
        borderLeft: `2px solid ${colors.indigo}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          fontWeight: 500,
          color: colors.indigo,
          marginBottom: spacing[2],
        }}
      >
        <Sparkles size={12} aria-hidden="true" />
        <span>Iris drafted this — review before sending</span>
      </div>
      <p
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: 1.55,
          color: colors.ink2,
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {visible}
      </p>
      {truncated && (
        <button
          type="button"
          onClick={() => setShowFull(true)}
          style={{
            marginTop: spacing[2],
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: colors.indigo,
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Show full draft →
        </button>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing[2],
          marginTop: spacing[3],
          alignItems: 'center',
        }}
      >
        <PermissionGate permission="ai.use">
          <PrimaryButton onClick={() => onIrisAction('send_draft', item)}>Send as-is</PrimaryButton>
        </PermissionGate>
        <PermissionGate permission="ai.use">
          <SecondaryButton onClick={() => onIrisAction('edit_draft', item)}>Edit</SecondaryButton>
        </PermissionGate>
        <PermissionGate permission="ai.use">
          <DismissButton onClick={() => onIrisAction('dismiss_draft', item)}>Dismiss</DismissButton>
        </PermissionGate>
      </div>
    </div>
  );
}

export const StreamItemExpanded: React.FC<StreamItemExpandedProps> = ({
  item,
  onAction,
  onSnooze,
  onSourceOpen,
  onIrisAction,
}) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const description = (item.sourceData as Record<string, unknown> | null)?.description as
    | string
    | undefined;
  const truncatedDescription = !!description && !showFullDescription && description.length > 220;
  const visibleDescription = truncatedDescription
    ? description!.slice(0, 220).trimEnd() + '…'
    : description ?? '';

  const visibleActions = item.actions.filter(
    (a) => a.handler !== 'snooze' && a.handler !== 'dismiss',
  );

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div
        style={{
          paddingLeft: spacing[8],
          paddingRight: spacing[4],
          paddingBottom: spacing[5],
          paddingTop: spacing[1],
        }}
      >
        {description && (
          <div
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.55,
              color: colors.ink2,
              maxWidth: 600,
              whiteSpace: 'pre-wrap',
            }}
          >
            {visibleDescription}
            {truncatedDescription && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowFullDescription(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: colors.ink,
                    fontFamily: typography.fontFamily,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Show more →
                </button>
              </>
            )}
          </div>
        )}

        <SourceTrail sources={item.sourceTrail} onSourceOpen={onSourceOpen} />

        {item.impactChain && <ImpactChain chain={item.impactChain} />}

        <IrisDraftSection item={item} onIrisAction={onIrisAction} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing[2],
            marginTop: spacing[4],
            alignItems: 'center',
          }}
        >
          {visibleActions.map((action, idx) => (
            <ActionButton
              key={`${action.handler}-${idx}`}
              action={action}
              item={item}
              onAction={onAction}
            />
          ))}
          <SnoozePopover itemId={item.id} onSnooze={onSnooze} />
        </div>
      </div>
    </motion.div>
  );
};

export default StreamItemExpanded;
