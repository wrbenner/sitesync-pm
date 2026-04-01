import React, { useEffect, useRef } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Eye } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { usePresenceStore } from '../../stores/presenceStore';
import { useOthers } from '../../lib/liveblocks';
import type { PresenceUserWithAction } from '../../stores/presenceStore';
import { useUiStore } from '../../stores';
// Announcements are delivered through the global LiveRegion rendered in App.tsx

// ── Presence helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(lastSeen: number): string {
  const diffMs = Date.now() - lastSeen;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

type PresenceStatus = 'active' | 'idle' | 'away';

function getPresenceStatus(lastSeen: number): PresenceStatus {
  const diffMin = (Date.now() - lastSeen) / 60_000;
  if (diffMin < 5) return 'active';
  if (diffMin < 30) return 'idle';
  return 'away';
}

const STATUS_COLOR: Record<PresenceStatus, string> = {
  active: colors.statusActive,
  idle: colors.statusPending,
  away: colors.statusNeutral,
};

const STATUS_BORDER: Record<PresenceStatus, string> = {
  active: colors.statusActive,
  idle: colors.statusPending,
  away: '#C0C4CC',
};

// ── Tooltip content ───────────────────────────────────────────────────────────

const AvatarTooltipContent: React.FC<{ user: { displayName: string; role?: string; lastSeen: number } }> = ({ user }) => {
  const status = getPresenceStatus(user.lastSeen);
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{
        fontSize: 14,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        lineHeight: typography.lineHeight.snug,
      }}>
        {user.displayName}
      </div>
      {user.role && (
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.65)',
          marginTop: 2,
          lineHeight: typography.lineHeight.snug,
        }}>
          {user.role}
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['1'],
        marginTop: spacing['1.5'],
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: STATUS_COLOR[status],
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          {formatRelativeTime(user.lastSeen)}
        </span>
      </div>
    </div>
  );
};

const OverflowTooltipContent: React.FC<{ users: Array<{ displayName: string; role?: string; lastSeen: number }> }> = ({ users }) => (
  <div style={{ minWidth: 160 }}>
    {users.map((u, i) => (
      <div key={i} style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        marginBottom: i < users.length - 1 ? spacing['2'] : 0,
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: STATUS_COLOR[getPresenceStatus(u.lastSeen)],
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: typography.fontWeight.semibold, color: colors.white }}>
            {u.displayName}
          </div>
          {u.role && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{u.role}</div>
          )}
        </div>
      </div>
    ))}
  </div>
);

const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`,
  backgroundColor: colors.textPrimary,
  borderRadius: borderRadius.md,
  boxShadow: shadows.dropdown,
  fontFamily: typography.fontFamily,
  zIndex: 9999,
  maxWidth: 240,
  animation: 'presenceTooltipIn 0.15s ease',
};

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 32;
const AVATAR_OVERLAP = -8;

interface AvatarProps {
  user: PresenceUserWithAction;
  index: number;
  total: number;
}

const PresenceAvatar: React.FC<AvatarProps> = ({ user, index, total }) => {
  const status = getPresenceStatus(user.lastSeen);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: '50%',
            backgroundColor: user.color,
            border: `2px solid ${colors.white}`,
            boxShadow: `0 0 0 2px ${STATUS_BORDER[status]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: typography.fontWeight.bold,
            color: colors.white,
            marginLeft: index > 0 ? AVATAR_OVERLAP : 0,
            position: 'relative',
            zIndex: total - index,
            cursor: 'default',
            flexShrink: 0,
          }}
        >
          {user.initials}
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          align="center"
          sideOffset={8}
          avoidCollisions
          collisionPadding={12}
          style={TOOLTIP_CONTENT_STYLE}
        >
          <AvatarTooltipContent user={user} />
          <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

// ── PresenceBar ───────────────────────────────────────────────────────────────

interface PresenceBarProps {
  page: string;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ page }) => {
  const users = usePresenceStore(s => s.getUsersOnPage(page));
  const announceStatus = useUiStore(s => s.announceStatus);
  // Stores previous snapshot as a map of userId -> displayName so we can name departing users
  const prevUsersRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevUsersRef.current;
    const curr = new Map(users.map(u => [u.userId, u.displayName]));

    // Joined: in curr but not in prev
    users
      .filter(u => !prev.has(u.userId))
      .forEach(u => announceStatus(`${u.displayName} joined the session`));

    // Left: in prev but not in curr
    prev.forEach((name, id) => {
      if (!curr.has(id)) announceStatus(`${name} left the session`);
    });

    prevUsersRef.current = curr;
  // Only re-run when the user list identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  if (users.length === 0) return null;

  const visible = users.slice(0, 5);
  const overflow = users.length - 5;

  return (
    <>
      <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <Tooltip.Provider delayDuration={150}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
          marginBottom: spacing['3'],
        }}>
          <Eye size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Currently viewing:
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {visible.map((user, i) => (
              <PresenceAvatar key={user.userId} user={user} index={i} total={visible.length} />
            ))}
            {overflow > 0 && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: '50%',
                    backgroundColor: colors.surfaceInset,
                    border: `2px solid ${colors.white}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textSecondary,
                    marginLeft: AVATAR_OVERLAP,
                    cursor: 'default',
                    flexShrink: 0,
                  }}>
                    +{overflow}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    align="center"
                    sideOffset={8}
                    avoidCollisions
                    collisionPadding={12}
                    style={TOOLTIP_CONTENT_STYLE}
                  >
                    <OverflowTooltipContent users={users.slice(5)} />
                    <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </div>
        </div>
      </Tooltip.Provider>
    </>
  );
};

// ── EntityPresence ────────────────────────────────────────────────────────────

interface EntityPresenceProps {
  entityId: string;
}

export const EntityPresence: React.FC<EntityPresenceProps> = ({ entityId }) => {
  const users = usePresenceStore(s => s.getUsersViewingEntity(entityId));

  if (users.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={150}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['1']} ${spacing['2']}`,
      }}>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Also viewing:</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {users.map((user, i) => (
            <PresenceAvatar key={user.userId} user={user} index={i} total={users.length} />
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
};

// ── SidebarPresenceDot ────────────────────────────────────────────────────────

interface SidebarPresenceDotProps {
  page: string;
}

export const SidebarPresenceDot: React.FC<SidebarPresenceDotProps> = ({ page }) => {
  const count = usePresenceStore(s => s.getUsersOnPage(page).length);

  if (count === 0) return null;

  return (
    <div style={{
      position: 'absolute', right: spacing['2'], top: '50%', transform: 'translateY(-50%)',
      display: 'flex', alignItems: 'center', gap: spacing['1'],
      zIndex: 2,
    }}>
      <div style={{
        width: 6, height: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.statusActive,
        boxShadow: `0 0 0 2px ${colors.surfaceSidebar}`,
      }} />
      {count > 1 && (
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{count}</span>
      )}
    </div>
  );
};

// ── DrawingPresenceBar ────────────────────────────────────────────────────────
// Must be rendered inside a Liveblocks RoomProvider.

export const DrawingPresenceBar: React.FC = () => {
  const others = useOthers();

  if (others.length === 0) return null;

  const visible = others.slice(0, 5);
  const overflow = others.length - 5;

  return (
    <>
      <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <Tooltip.Provider delayDuration={150}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: borderRadius.full,
        }}>
          <Eye size={11} color="rgba(255, 255, 255, 0.5)" />
          <span style={{ fontSize: typography.fontSize.caption, color: 'rgba(255, 255, 255, 0.5)' }}>
            Also viewing:
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {visible.map((other, i) => {
              const lastSeen: number = (other.presence as any).lastSeen ?? Date.now();
              const status = getPresenceStatus(lastSeen);
              const displayName: string = (other.presence as any).displayName || other.presence.name || 'Someone';
              const role: string | undefined = (other.presence as any).role;
              return (
                <Tooltip.Root key={other.connectionId}>
                  <Tooltip.Trigger asChild>
                    <div style={{
                      width: AVATAR_SIZE,
                      height: AVATAR_SIZE,
                      borderRadius: '50%',
                      backgroundColor: other.presence.color || colors.statusInfo,
                      border: `2px solid ${colors.white}`,
                      boxShadow: `0 0 0 2px ${STATUS_BORDER[status]}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.white,
                      marginLeft: i > 0 ? AVATAR_OVERLAP : 0,
                      position: 'relative',
                      zIndex: others.length - i,
                      cursor: 'default',
                      flexShrink: 0,
                    }}>
                      {other.presence.initials || '?'}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="bottom"
                      align="center"
                      sideOffset={8}
                      avoidCollisions
                      collisionPadding={12}
                      style={TOOLTIP_CONTENT_STYLE}
                    >
                      <AvatarTooltipContent user={{ displayName, role, lastSeen }} />
                      <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
            {overflow > 0 && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: `2px solid rgba(255,255,255,0.2)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: typography.fontWeight.semibold,
                    color: 'rgba(255,255,255,0.7)',
                    marginLeft: AVATAR_OVERLAP,
                    cursor: 'default',
                    flexShrink: 0,
                  }}>
                    +{overflow}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="bottom"
                    align="center"
                    sideOffset={8}
                    avoidCollisions
                    collisionPadding={12}
                    style={TOOLTIP_CONTENT_STYLE}
                  >
                    <OverflowTooltipContent
                      users={others.slice(5).map(o => ({
                        displayName: (o.presence as any).displayName || o.presence.name || 'Someone',
                        role: (o.presence as any).role,
                        lastSeen: (o.presence as any).lastSeen ?? Date.now(),
                      }))}
                    />
                    <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </div>
        </div>
      </Tooltip.Provider>
    </>
  );
};
