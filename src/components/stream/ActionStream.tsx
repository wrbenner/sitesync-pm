import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hairline } from '../atoms';
import { StreamItem as StreamItemView } from './StreamItem';
import { SwipeActions } from './SwipeActions';
import type {
  StreamItem,
  StreamAction,
  SnoozeDuration,
  SourceReference,
} from '../../types/stream';

interface ActionStreamProps {
  items: StreamItem[];
  isMobile: boolean;
  onAction: (action: StreamAction, item: StreamItem) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, duration: SnoozeDuration) => void;
  onSourceOpen: (source: SourceReference) => void;
  onIrisAction: (
    handler: 'send_draft' | 'edit_draft' | 'dismiss_draft',
    item: StreamItem,
  ) => void;
  onRefresh?: () => void;
}

const PULL_TRIGGER = 64;

export const ActionStream: React.FC<ActionStreamProps> = ({
  items,
  isMobile,
  onAction,
  onDismiss,
  onSnooze,
  onSourceOpen,
  onIrisAction,
  onRefresh,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pullState = useRef<{ startY: number; pulling: boolean } | null>(null);
  const [pullDelta, setPullDelta] = useState(0);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  // Keyboard navigation: ArrowUp/Down moves focus across items by their data attribute.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const handler = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('[data-stream-item-id] [role="button"]'),
      );
      if (focusables.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? focusables.indexOf(active) : -1;
      let next = idx;
      if (e.key === 'ArrowDown') next = idx < 0 ? 0 : Math.min(idx + 1, focusables.length - 1);
      if (e.key === 'ArrowUp') next = idx < 0 ? 0 : Math.max(idx - 1, 0);
      if (next !== idx) {
        e.preventDefault();
        focusables[next].focus();
      }
    };

    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, []);

  // Pull-to-refresh on mobile only — only engage when scrolled to the top.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || !onRefresh) return;
    if (window.scrollY > 0) return;
    pullState.current = { startY: e.touches[0].clientY, pulling: true };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!pullState.current?.pulling) return;
    const delta = e.touches[0].clientY - pullState.current.startY;
    if (delta > 0) setPullDelta(Math.min(delta, PULL_TRIGGER * 1.5));
  };

  const handleTouchEnd = () => {
    if (pullState.current?.pulling && pullDelta >= PULL_TRIGGER && onRefresh) {
      onRefresh();
    }
    pullState.current = null;
    setPullDelta(0);
  };

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label="Action stream"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        transform: pullDelta > 0 ? `translateY(${pullDelta}px)` : undefined,
        transition: pullDelta === 0 ? 'transform 200ms ease-out' : 'none',
      }}
    >
      {items.map((item, idx) => (
        <div key={item.id} role="listitem" data-stream-item-id={item.id}>
          <SwipeActions
            itemId={item.id}
            enabled={isMobile}
            onDismiss={onDismiss}
            onSnooze={onSnooze}
          >
            <StreamItemView
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
              onAction={onAction}
              onSnooze={onSnooze}
              onSourceOpen={onSourceOpen}
              onIrisAction={onIrisAction}
              isMobile={isMobile}
            />
          </SwipeActions>
          {idx < items.length - 1 && <Hairline weight={3} spacing="tight" style={{ margin: 0 }} />}
        </div>
      ))}
    </div>
  );
};

export default ActionStream;
