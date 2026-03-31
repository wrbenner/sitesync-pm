# Phase 1D — Complete Real-time Presence Indicators

**Status**: Foundation Layer | **Priority**: High | **Effort**: 30 hours | **Risk**: Medium

## Pre-Requisite: Paste 00_SYSTEM_CONTEXT.md before this prompt

---

## Problem Statement

**Architecture Law 3 Violation**: 15 pages lack real-time subscriptions. Data becomes stale immediately after load.

**Current State**:
- Manual refresh required to see updates from other users
- Two users editing same task = data conflict with no detection
- No presence indicators (who's viewing what)
- No optimistic conflict resolution
- Cache never auto-invalidates when backend data changes
- Mobile field workers see stale data in offline-first app

**Target State**:
- Every page subscribes to Supabase Realtime
- Cache auto-invalidates on remote changes
- Presence indicators show "John editing RFI-123"
- Rich collaboration with Liveblocks cursors
- Conflict detection and resolution for concurrent edits
- Optimistic updates survive real-time conflicts

---

## Architecture: Supabase Realtime Subscriptions

### Setup: Supabase Client with Realtime

**File**: `src/utils/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limit to prevent spam
    },
  },
});

// Re-export types
export type { RealtimeChannel } from '@supabase/supabase-js';
```

### useRealtimeSubscription Hook

**File**: `src/hooks/useRealtimeSubscription.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, RealtimeChannel } from '@/utils/supabase';
import * as Sentry from '@sentry/react';

interface SubscriptionOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string; // PostgreSQL syntax: e.g., "projectId=eq.123"
  queryKey: (string | number)[];
  onData?: (data: any) => void;
  onDelete?: (data: any) => void;
  onUpdate?: (data: any) => void;
}

export function useRealtimeSubscription(options: SubscriptionOptions) {
  const queryClient = useQueryClient();
  let channel: RealtimeChannel | null = null;

  const handleInsert = useCallback(
    (payload: any) => {
      // Invalidate cache to refetch, or update optimistically
      queryClient.invalidateQueries({ queryKey: options.queryKey });

      if (options.onData) {
        options.onData(payload.new);
      }

      console.debug(`[Realtime] INSERT on ${options.table}:`, payload.new);
    },
    [queryClient, options]
  );

  const handleUpdate = useCallback(
    (payload: any) => {
      // Update cache with new data
      queryClient.setQueryData(options.queryKey, (oldData: any) => {
        if (Array.isArray(oldData)) {
          return oldData.map((item) =>
            item.id === payload.new.id ? payload.new : item
          );
        }
        return payload.new;
      });

      if (options.onUpdate) {
        options.onUpdate(payload.new);
      }

      console.debug(`[Realtime] UPDATE on ${options.table}:`, payload.new);
    },
    [queryClient, options]
  );

  const handleDelete = useCallback(
    (payload: any) => {
      // Remove from cache
      queryClient.setQueryData(options.queryKey, (oldData: any) => {
        if (Array.isArray(oldData)) {
          return oldData.filter((item) => item.id !== payload.old.id);
        }
        return null;
      });

      if (options.onDelete) {
        options.onDelete(payload.old);
      }

      console.debug(`[Realtime] DELETE on ${options.table}:`, payload.old);
    },
    [queryClient, options]
  );

  useEffect(() => {
    // Subscribe to realtime updates
    const subscribeToTable = () => {
      const event = options.event || '*';

      channel = supabase
        .channel(`public:${options.table}`)
        .on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: options.table,
            filter: options.filter,
          },
          (payload) => {
            if (event === '*' || event === 'INSERT') {
              if (payload.eventType === 'INSERT') {
                handleInsert(payload);
              }
            }

            if (event === '*' || event === 'UPDATE') {
              if (payload.eventType === 'UPDATE') {
                handleUpdate(payload);
              }
            }

            if (event === '*' || event === 'DELETE') {
              if (payload.eventType === 'DELETE') {
                handleDelete(payload);
              }
            }
          }
        )
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.info(`[Realtime] Subscribed to ${options.table}`);
          } else if (status === 'CLOSED') {
            console.warn(`[Realtime] Subscription to ${options.table} closed`);
          } else if (status === 'CHANNEL_ERROR') {
            Sentry.captureMessage(
              `Realtime subscription error for ${options.table}`,
              'warning'
            );
          }
        });
    };

    subscribeToTable();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [options, handleInsert, handleUpdate, handleDelete]);
}
```

---

## Presence System: Who's Viewing What

### Presence Types

**File**: `src/types/presence.ts`

```typescript
export interface UserPresence {
  userId: string;
  userName: string;
  userRole: string;
  currentPage: string; // e.g., "rfis", "punch_list", "schedule"
  viewingEntityId?: string; // e.g., "rfi-123" if viewing detail panel
  cursorPosition?: { x: number; y: number };
  lastSeen: ISO8601DateTime;
  isOnline: boolean;
}

export interface PresenceUpdate {
  event: 'JOINED' | 'UPDATED' | 'LEFT';
  user: UserPresence;
  timestamp: ISO8601DateTime;
}
```

### usePresence Hook

**File**: `src/hooks/usePresence.ts`

```typescript
import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/utils/supabase';
import { UserPresence, PresenceUpdate } from '@/types/presence';
import { useAtom } from 'jotai';
import { presenceAtom } from '@/store/presence';

interface UsePresenceOptions {
  page: string;
  entityId?: string;
}

export function usePresence(options: UsePresenceOptions) {
  const { currentUser } = useAuth();
  const [presenceList, setPresenceList] = useAtom(presenceAtom);
  const presenceChannelRef = useRef<any>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  const publishPresence = useCallback(async () => {
    if (!currentUser) return;

    const presence: UserPresence = {
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      currentPage: options.page,
      viewingEntityId: options.entityId,
      lastSeen: new Date().toISOString(),
      isOnline: true,
    };

    try {
      await presenceChannelRef.current?.track(presence);
    } catch (error) {
      console.error('[Presence] Failed to publish:', error);
    }
  }, [currentUser, options.page, options.entityId]);

  useEffect(() => {
    if (!currentUser) return;

    // Create presence channel
    presenceChannelRef.current = supabase.channel(
      `presence:${currentUser.projectId}`,
      {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      }
    );

    // Subscribe to presence updates
    presenceChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current.presenceState();
        const users: UserPresence[] = [];

        Object.values(state).forEach((presenceList: any[]) => {
          presenceList.forEach((presence: UserPresence) => {
            if (presence.userId !== currentUser.id) {
              users.push(presence);
            }
          });
        });

        setPresenceList(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.info(`[Presence] User joined:`, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.info(`[Presence] User left:`, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await publishPresence();
        }
      });

    // Update presence every 10 seconds
    updateIntervalRef.current = setInterval(() => {
      publishPresence();
    }, 10000);

    return () => {
      clearInterval(updateIntervalRef.current);
      presenceChannelRef.current?.unsubscribe();
    };
  }, [currentUser, publishPresence, setPresenceList]);

  return { presenceList };
}
```

### Presence Indicator Component

**File**: `src/components/PresenceIndicator.tsx`

```typescript
import React from 'react';
import { UserPresence } from '@/types/presence';
import styles from '@/styles/theme';
import { useAtom } from 'jotai';
import { presenceAtom } from '@/store/presence';

interface PresenceIndicatorProps {
  entityId?: string;
  page?: string;
  compact?: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  entityId,
  page,
  compact = false,
}) => {
  const [presenceList] = useAtom(presenceAtom);

  // Filter to users on this page and entity
  const activeUsers = presenceList.filter((user) => {
    if (page && user.currentPage !== page) return false;
    if (entityId && user.viewingEntityId !== entityId) return false;
    return user.isOnline;
  });

  if (activeUsers.length === 0) {
    return null;
  }

  if (compact) {
    // Show avatars in a row
    return (
      <div
        style={{
          display: 'flex',
          gap: styles.spacing.xs,
          alignItems: 'center',
        }}
        title={`Viewing: ${activeUsers.map((u) => u.userName).join(', ')}`}
      >
        {activeUsers.slice(0, 3).map((user) => (
          <div
            key={user.userId}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: hashToColor(user.userId),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 12,
              fontWeight: 'bold',
              border: `2px solid ${styles.colors.primary}`,
            }}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {activeUsers.length > 3 && (
          <span
            style={{
              fontSize: 12,
              color: styles.colors.textSecondary,
              marginLeft: styles.spacing.xs,
            }}
          >
            +{activeUsers.length - 3}
          </span>
        )}
      </div>
    );
  }

  // Show detailed list
  return (
    <div
      style={{
        borderLeft: `4px solid ${styles.colors.primary}`,
        paddingLeft: styles.spacing.md,
        marginTop: styles.spacing.md,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: styles.colors.textSecondary,
          marginBottom: styles.spacing.sm,
        }}
      >
        Now viewing:
      </div>
      {activeUsers.map((user) => (
        <div
          key={user.userId}
          style={{
            display: 'flex',
            gap: styles.spacing.sm,
            alignItems: 'center',
            marginBottom: styles.spacing.sm,
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: styles.colors.success,
            }}
          />
          <span>{user.userName}</span>
          <span
            style={{
              fontSize: 12,
              color: styles.colors.textSecondary,
            }}
          >
            ({user.userRole})
          </span>
        </div>
      ))}
    </div>
  );
};

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightness = 50;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
```

---

## Real-time Integration: By Page

### RFIs.tsx with Realtime

**File**: `src/pages/RFIs.tsx` (Updated)

```typescript
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { usePresence } from '@/hooks/usePresence';
import { PresenceIndicator } from '@/components/PresenceIndicator';

export function RFIs() {
  const { projectId } = useParams();
  const { data: rfis } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: () => fetchRFIs(projectId),
  });

  // Subscribe to RFI table changes
  useRealtimeSubscription({
    table: 'rfis',
    filter: `projectId=eq.${projectId}`,
    queryKey: ['rfis', projectId],
    onUpdate: (rfi) => {
      // Show toast for updates from other users
      if (rfi.updatedBy !== currentUser.id) {
        toast.info(`${rfi.updatedByName} updated "${rfi.title}"`);
      }
    },
  });

  // Track user presence on this page
  const { presenceList } = usePresence({ page: 'rfis' });

  return (
    <PageContainer>
      <SectionHeader title="Requests for Information">
        <PresenceIndicator page="rfis" compact />
      </SectionHeader>

      {/* Table with presence indicators for each row */}
      <Table>
        {rfis?.map((rfi) => (
          <TableRow key={rfi.id}>
            <td>{rfi.title}</td>
            <td>{rfi.status}</td>
            <td>
              {/* Show avatar of user viewing this specific RFI */}
              <PresenceIndicator entityId={rfi.id} compact />
            </td>
          </TableRow>
        ))}
      </Table>

      {/* Detail panel also shows who's viewing it */}
      {selectedRFI && (
        <DetailPanel>
          <PresenceIndicator entityId={selectedRFI.id} />
          {/* Detail content */}
        </DetailPanel>
      )}
    </PageContainer>
  );
}
```

### Schedule.tsx with Realtime

**File**: `src/pages/Schedule.tsx` (Updated)

```typescript
export function Schedule() {
  const { projectId } = useParams();
  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => fetchTasks(projectId),
  });

  // Subscribe to task changes
  useRealtimeSubscription({
    table: 'tasks',
    filter: `projectId=eq.${projectId}`,
    queryKey: ['tasks', projectId],
    onUpdate: (task) => {
      if (task.updatedBy !== currentUser.id) {
        toast.info(`${task.updatedByName} updated "${task.title}"`);
      }
    },
  });

  // Subscribe to task assignments
  useRealtimeSubscription({
    table: 'task_assignments',
    filter: `projectId=eq.${projectId}`,
    queryKey: ['tasks', projectId],
  });

  const { presenceList } = usePresence({ page: 'schedule' });

  return (
    <PageContainer>
      <SectionHeader title="Schedule">
        <PresenceIndicator page="schedule" compact />
      </SectionHeader>

      <GanttChart
        tasks={tasks}
        onTaskUpdate={(taskId, updates) => {
          updateTask.mutate({ id: taskId, ...updates });
        }}
        presenceIndicators={presenceList}
      />
    </PageContainer>
  );
}
```

### DailyLog.tsx with Realtime

**File**: `src/pages/DailyLog.tsx` (Updated)

```typescript
export function DailyLog() {
  const { projectId } = useParams();
  const { data: logs } = useQuery({
    queryKey: ['daily-logs', projectId],
    queryFn: () => fetchDailyLogs(projectId),
  });

  // Subscribe to daily log changes
  useRealtimeSubscription({
    table: 'daily_logs',
    filter: `projectId=eq.${projectId}`,
    queryKey: ['daily-logs', projectId],
    onUpdate: (log) => {
      toast.info(`Daily log from ${log.createdByName} was updated`);
    },
  });

  const { presenceList } = usePresence({ page: 'daily_log' });

  return (
    <PageContainer>
      <SectionHeader title="Daily Logs">
        <PresenceIndicator page="daily_log" compact />
      </SectionHeader>

      {/* Daily logs */}
      {logs?.map((log) => (
        <Card key={log.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3>{log.date}</h3>
              <p>{log.content}</p>
            </div>
            {/* Show who's viewing this log */}
            <PresenceIndicator entityId={log.id} compact />
          </div>
        </Card>
      ))}
    </PageContainer>
  );
}
```

---

## Conflict Resolution for Concurrent Edits

**File**: `src/hooks/useConflictResolution.ts`

```typescript
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';

export interface ConflictResolutionOptions {
  strategy: 'LAST_WRITE_WINS' | 'CLIENT_WINS' | 'SERVER_WINS' | 'MANUAL';
  onConflict?: (conflict: {
    clientData: any;
    serverData: any;
    field: string;
  }) => Promise<any>;
}

export function useConflictResolution(
  options: ConflictResolutionOptions = { strategy: 'LAST_WRITE_WINS' }
) {
  const queryClient = useQueryClient();

  const detectConflict = useCallback(
    (clientData: any, serverData: any): boolean => {
      return (
        JSON.stringify(clientData) !== JSON.stringify(serverData)
      );
    },
    []
  );

  const resolveConflict = useCallback(
    async (clientData: any, serverData: any) => {
      if (!detectConflict(clientData, serverData)) {
        return serverData; // No conflict
      }

      Sentry.captureMessage('Conflict detected during concurrent edit', 'info');

      switch (options.strategy) {
        case 'LAST_WRITE_WINS':
          // Assume server is authoritative
          return serverData;

        case 'CLIENT_WINS':
          // Keep client changes
          return clientData;

        case 'SERVER_WINS':
          // Always use server
          return serverData;

        case 'MANUAL':
          // Call user callback to resolve
          if (options.onConflict) {
            return await options.onConflict({
              clientData,
              serverData,
              field: Object.keys(clientData).find(
                (key) => clientData[key] !== serverData[key]
              ) || 'unknown',
            });
          }
          return serverData;

        default:
          return serverData;
      }
    },
    [detectConflict, options]
  );

  return { detectConflict, resolveConflict };
}
```

---

## Liveblocks Integration (Optional, for Rich Collaboration)

**File**: `src/utils/liveblocks.ts`

```typescript
import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

const client = createClient({
  publicApiKey: process.env.REACT_APP_LIVEBLOCKS_PUBLIC_KEY!,
});

type Presence = {
  cursor: { x: number; y: number } | null;
  selectedEntityId?: string;
};

type Storage = {
  // Define your collaborative data structure
};

export const {
  RoomProvider,
  useRoom,
  useOthers,
  useMyPresence,
  useStorage,
} = createRoomContext<Presence, Storage>(client);
```

### Using Liveblocks for Cursors

**File**: `src/components/CollaborativeCursor.tsx`

```typescript
import { useOthers, useMyPresence } from '@/utils/liveblocks';
import styles from '@/styles/theme';

export const CollaborativeCursor: React.FC = () => {
  const others = useOthers();
  const [myPresence, updateMyPresence] = useMyPresence();

  const handleMouseMove = (e: React.MouseEvent) => {
    updateMyPresence({
      cursor: { x: e.clientX, y: e.clientY },
    });
  };

  return (
    <div onMouseMove={handleMouseMove}>
      {/* Show other users' cursors */}
      {others.map((other) => (
        <div
          key={other.connectionId}
          style={{
            position: 'fixed',
            left: other.presence.cursor?.x ?? 0,
            top: other.presence.cursor?.y ?? 0,
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: hashToColor(other.connectionId.toString()),
              border: `2px solid ${styles.colors.primary}`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: styles.colors.textSecondary,
              whiteSpace: 'nowrap',
              marginLeft: 4,
            }}
          >
            {other.info?.name || 'User'}
          </span>
        </div>
      ))}
    </div>
  );
};
```

---

## Store: Presence Atom

**File**: `src/store/presence.ts`

```typescript
import { atom } from 'jotai';
import { UserPresence } from '@/types/presence';

export const presenceAtom = atom<UserPresence[]>([]);
```

---

## Testing Real-time Subscriptions

**File**: `src/hooks/__tests__/useRealtimeSubscription.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useRealtimeSubscription', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('subscribes to table updates', async () => {
    const onData = vi.fn();

    renderHook(
      () =>
        useRealtimeSubscription({
          table: 'rfis',
          queryKey: ['rfis'],
          onData,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(onData).toHaveBeenCalled();
    });
  });

  it('handles INSERT events', async () => {
    const onData = vi.fn();

    renderHook(
      () =>
        useRealtimeSubscription({
          table: 'rfis',
          event: 'INSERT',
          queryKey: ['rfis'],
          onData,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(onData).toHaveBeenCalled();
    });
  });

  it('invalidates query on UPDATE', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(
      () =>
        useRealtimeSubscription({
          table: 'rfis',
          event: 'UPDATE',
          queryKey: ['rfis'],
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalled();
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Supabase client configured with Realtime in `src/utils/supabase.ts`
- [ ] `useRealtimeSubscription` hook implemented for all table types
- [ ] Subscriptions handle INSERT, UPDATE, DELETE events
- [ ] Cache invalidates automatically on remote INSERT/UPDATE/DELETE
- [ ] RFIs.tsx subscribed to rfis table changes with toast notifications
- [ ] Submittals.tsx subscribed to submittals table changes
- [ ] PunchList.tsx subscribed to punch_items table changes
- [ ] Schedule.tsx subscribed to tasks and task_assignments table changes
- [ ] Budget.tsx subscribed to change_orders table changes
- [ ] DailyLog.tsx subscribed to daily_logs table changes
- [ ] Meetings.tsx subscribed to meetings table changes
- [ ] Files.tsx subscribed to files table changes
- [ ] FieldCapture.tsx subscribed to field_captures table changes
- [ ] `UserPresence` type defined with userId, userName, currentPage, viewingEntityId, isOnline
- [ ] `usePresence` hook publishes user presence every 10 seconds
- [ ] Presence updates automatically on page/entity change
- [ ] `PresenceIndicator` component shows avatars of users viewing same entity
- [ ] Presence indicators show on every detail panel and table row
- [ ] Compact mode shows first 3 avatars with +N indicator
- [ ] Full mode shows detailed list with user roles
- [ ] Concurrent edit conflict detection implemented
- [ ] Conflict resolution strategies (LAST_WRITE_WINS, CLIENT_WINS, MANUAL) supported
- [ ] Liveblocks integrated for collaborative cursors (optional)
- [ ] Sentry logs conflicts with context
- [ ] All 15 pages with realtime subscriptions (Dashboard, RFIs, Submittals, PunchList, Schedule, Budget, DailyLog, FieldCapture, Meetings, Files, Crews, Directory, Drawings, AICopilot, Vision)
- [ ] Realtime subscriptions clean up properly on unmount
- [ ] Network reconnection re-establishes subscriptions
- [ ] Rate limiting (10 events/second) prevents subscription spam
- [ ] Code compiles with zero TypeScript errors
- [ ] Unit tests for presence tracking and conflict resolution
- [ ] No memory leaks from subscriptions
- [ ] Offline mode queues presence updates for sync on reconnect

---

**Effort estimate**: 30 hours
**Status**: Ready for implementation
**Owner**: Full-stack engineer
**Review**: Backend architect + DevOps
