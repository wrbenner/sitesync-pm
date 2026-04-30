import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import * as Popover from '@radix-ui/react-popover';
import { CheckCircle, Clock } from 'lucide-react';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import type { SnoozeDuration } from '../../types/stream';

interface SwipeActionsProps {
  itemId: string;
  enabled: boolean;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, duration: SnoozeDuration) => void;
  children: React.ReactNode;
}

const COMMIT_THRESHOLD = 80;

const SNOOZE_OPTIONS: Array<{ value: SnoozeDuration; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: 'tomorrow', label: 'Tomorrow morning' },
  { value: 'next_week', label: 'Next week' },
];

export const SwipeActions: React.FC<SwipeActionsProps> = ({
  itemId,
  enabled,
  onDismiss,
  onSnooze,
  children,
}) => {
  const x = useMotionValue(0);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeAnchor, setSnoozeAnchor] = useState({ x: 0, y: 0 });

  const doneOpacity = useTransform(x, [0, COMMIT_THRESHOLD], [0, 1]);
  const snoozeOpacity = useTransform(x, [-COMMIT_THRESHOLD, 0], [1, 0]);

  if (!enabled) {
    return <>{children}</>;
  }

  const handleDragEnd = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x > COMMIT_THRESHOLD) {
      onDismiss(itemId);
      x.set(0);
    } else if (info.offset.x < -COMMIT_THRESHOLD) {
      // Anchor the snooze popover near the touch point
      const target = event.target as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        setSnoozeAnchor({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      setSnoozeOpen(true);
      x.set(0);
    } else {
      x.set(0);
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Right-swipe (Done) background */}
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          background: colors.statusActive,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: spacing[5],
          gap: spacing[2],
          color: colors.parchment,
          fontFamily: typography.fontFamily,
          fontSize: 13,
          fontWeight: 500,
          opacity: doneOpacity,
          pointerEvents: 'none',
        }}
      >
        <CheckCircle size={18} />
        <span>Done</span>
      </motion.div>

      {/* Left-swipe (Snooze) background */}
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          background: colors.statusPending,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: spacing[5],
          gap: spacing[2],
          color: colors.parchment,
          fontFamily: typography.fontFamily,
          fontSize: 13,
          fontWeight: 500,
          opacity: snoozeOpacity,
          pointerEvents: 'none',
        }}
      >
        <span>Snooze</span>
        <Clock size={18} />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -180, right: 180 }}
        dragElastic={0.15}
        style={{ x, background: colors.surfacePage, position: 'relative' }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>

      <Popover.Root open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <Popover.Anchor
          asChild
          style={{
            position: 'fixed',
            left: snoozeAnchor.x,
            top: snoozeAnchor.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        >
          <span aria-hidden="true" />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
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
                  setSnoozeOpen(false);
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
              >
                {opt.label}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export default SwipeActions;
