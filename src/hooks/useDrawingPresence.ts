/**
 * useDrawingPresence — Real-time presence for the drawing viewer.
 *
 * Shows who else is viewing the same drawing, with live cursor positions.
 * Uses Supabase Realtime channels (not Liveblocks) for the tiled viewer.
 *
 * Channel: `drawing:{drawingId}`
 * Presence payload: { user_id, name, initials, color, cursor, tool }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { NormalizedPoint } from '../lib/annotationGeometry';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawingPresenceUser {
  user_id: string;
  name: string;
  initials: string;
  color: string;
  /** Cursor position in normalized [0,1] coords, or null if offscreen */
  cursor: NormalizedPoint | null;
  /** Currently active tool */
  tool: string;
  /** When this presence was last updated */
  last_seen: string;
}

interface DrawingPresenceState {
  /** Other users currently viewing this drawing */
  viewers: DrawingPresenceUser[];
  /** Update our own cursor position (throttled internally) */
  updateCursor: (cursor: NormalizedPoint | null) => void;
  /** Update our active tool */
  updateTool: (tool: string) => void;
  /** Broadcast a markup event (new annotation added) */
  broadcastMarkup: (markupData: unknown) => void;
  /** Whether the channel is connected */
  isConnected: boolean;
}

// ── Presence colors — deterministic from user_id ───────────────────────────

const PRESENCE_COLORS = [
  '#4EC896', '#06B6D4', '#7C3AED', '#E07070', '#FB923C',
  '#A3E635', '#F472B6', '#60A5FA', '#FBBF24', '#34D399',
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDrawingPresence(
  drawingId: string | undefined,
  userId: string | undefined,
  userName: string,
  userInitials: string,
): DrawingPresenceState {
  const [viewers, setViewers] = useState<DrawingPresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cursorRef = useRef<NormalizedPoint | null>(null);
  const toolRef = useRef<string>('select');

  // Throttled presence update
  const lastUpdate = useRef(0);
  const THROTTLE_MS = 50; // ~20fps for cursor updates

  const sendPresence = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !userId) return;
    ch.track({
      user_id: userId,
      name: userName,
      initials: userInitials,
      color: colorForUser(userId),
      cursor: cursorRef.current,
      tool: toolRef.current,
      last_seen: new Date().toISOString(),
    });
  }, [userId, userName, userInitials]);

  const updateCursor = useCallback(
    (cursor: NormalizedPoint | null) => {
      cursorRef.current = cursor;
      const now = Date.now();
      if (now - lastUpdate.current > THROTTLE_MS) {
        lastUpdate.current = now;
        sendPresence();
      }
    },
    [sendPresence],
  );

  const updateTool = useCallback(
    (tool: string) => {
      toolRef.current = tool;
      sendPresence();
    },
    [sendPresence],
  );

  const broadcastMarkup = useCallback(
    (markupData: unknown) => {
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({
        type: 'broadcast',
        event: 'markup',
        payload: { user_id: userId, markup: markupData },
      });
    },
    [userId],
  );

  // Subscribe to drawing presence channel
  useEffect(() => {
    if (!drawingId || !userId) return;

    const channelName = `drawing:${drawingId}`;
    const ch = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<DrawingPresenceUser>();
      const users: DrawingPresenceUser[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const p of presences as DrawingPresenceUser[]) {
          if (p.user_id !== userId) {
            users.push(p);
          }
        }
      }
      setViewers(users);
    });

    ch.on('presence', { event: 'join' }, () => {
      // Handled by sync
    });

    ch.on('presence', { event: 'leave' }, () => {
      // Handled by sync
    });

    // Listen for markup broadcasts from other users
    ch.on('broadcast', { event: 'markup' }, (payload) => {
      // Could trigger a refetch of markups or add to local state
      // For now, we rely on DB polling via React Query
      console.debug('[DrawingPresence] Markup broadcast received:', payload);
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        // Track our presence
        await ch.track({
          user_id: userId,
          name: userName,
          initials: userInitials,
          color: colorForUser(userId),
          cursor: null,
          tool: 'select',
          last_seen: new Date().toISOString(),
        });
      }
    });

    channelRef.current = ch;

    return () => {
      ch.untrack();
      supabase.removeChannel(ch);
      channelRef.current = null;
      setIsConnected(false);
      setViewers([]);
    };
  }, [drawingId, userId, userName, userInitials]);

  return { viewers, updateCursor, updateTool, broadcastMarkup, isConnected };
}
