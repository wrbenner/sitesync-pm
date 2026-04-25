import React, { useEffect, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Eye, RefreshCw, Sparkles, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { usePresenceStore } from '../../stores/presenceStore';
import { useShallow } from 'zustand/react/shallow';
import { useOthers } from '../../lib/liveblocks';
import type { PresenceUserWithAction } from '../../stores/presenceStore';

// ── Error boundary ────────────────────────────────────────────────────────────

interface PresenceBarErrorBoundaryState {
  hasError: boolean;
}

class PresenceBarErrorBoundary extends React.Component<
  React.PropsWithChildren<object>,
  PresenceBarErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<object>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PresenceBarErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.debug('[PresenceBar] Liveblocks context unavailable:', error);
    usePresenceStore.getState().setInitialized(true);
  }

  render() {
    if (this.state.hasError) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: colors.textTertiary }}>
          Presence unavailable
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: colors.textTertiary }}
            aria-label="Retry presence connection"
          >
            <RefreshCw size={12} />
          </button>
        </span>
      );
    }
    return this.props.children;
  }
}

// ── Responsive maxVisible ─────────────────────────────────────────────────────

const MAX_VISIBLE_DEFAULT = 5;
const MAX_VISIBLE_MOBILE = 3;
const MOBILE_BREAKPOINT = 640;

function useMaxVisible(): number {
  const [maxVisible, setMaxVisible] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
      ? MAX_VISIBLE_MOBILE
      : MAX_VISIBLE_DEFAULT
  );
  useEffect(() => {
    const handler = () => {
      setMaxVisible(window.innerWidth < MOBILE_BREAKPOINT ? MAX_VISIBLE_MOBILE : MAX_VISIBLE_DEFAULT);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return maxVisible;
}

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

// ── Role category ─────────────────────────────────────────────────────────────

type RoleCategory = 'gc' | 'architect' | 'owner' | 'subcontractor' | 'unknown';

function getRoleCategory(role?: string): RoleCategory {
  if (!role) return 'unknown';
  const r = role.toLowerCase();
  if (r.includes('project manager') || r.includes('superintendent') || r.includes('gc') || r.includes('general contractor') || r.includes('field engineer') || r.includes('coordinator')) return 'gc';
  if (r.includes('architect') || r.includes('engineer') || r.includes('designer') || r.includes('structural') || r.includes('mep')) return 'architect';
  if (r.includes('owner') || r.includes('developer') || r.includes('client')) return 'owner';
  if (r.includes('sub') || r.includes('electrician') || r.includes('plumber') || r.includes('mechanic') || r.includes('iron') || r.includes('concrete') || r.includes('framing') || r.includes('hvac')) return 'subcontractor';
  return 'unknown';
}

const ROLE_CATEGORY_COLOR: Record<RoleCategory, string> = {
  gc: '#3B82F6',
  architect: '#8B5CF6',
  owner: '#F47820',
  subcontractor: '#9CA3AF',
  unknown: '#9CA3AF',
};

// ── Drawing presence data (Liveblocks presence may include extra fields) ──────

interface DrawingPresenceData {
  displayName?: string;
  name?: string;
  lastSeen?: number;
  role?: string;
  company?: string;
  color?: string;
  initials?: string;
}

function asPresenceData(presence: Record<string, unknown>): DrawingPresenceData {
  return presence as DrawingPresenceData;
}

// ── Entity type display names ─────────────────────────────────────────────────

const ENTITY_TYPE_LABEL: Record<string, string> = {
  rfi: 'RFI',
  submittal: 'Submittal',
  daily_log: 'Daily Log',
  punch_item: 'Punch Item',
  change_order: 'Change Order',
};

function formatActivityLabel(entityType?: string, entityId?: string): string | null {
  if (!entityType) return null;
  const label = ENTITY_TYPE_LABEL[entityType] ?? entityType;
  return entityId ? `Viewing ${label} ${entityId.slice(0, 8)}` : `Viewing ${label}`;
}

// ── Tooltip content ───────────────────────────────────────────────────────────

const AvatarTooltipContent: React.FC<{ user: { displayName: string; role?: string; company?: string; lastSeen: number; action?: 'viewing' | 'editing'; editingEntityType?: string; editingEntityId?: string } }> = ({ user }) => {
  const status = getPresenceStatus(user.lastSeen);
  const roleCategory = getRoleCategory(user.role);
  const roleDotColor = ROLE_CATEGORY_COLOR[roleCategory];
  const roleCompanyLine = [user.role, user.company].filter(Boolean).join(', ');
  const activityLabel = formatActivityLabel(user.editingEntityType, user.editingEntityId);
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'] }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: roleDotColor,
          flexShrink: 0,
        }} />
        <div style={{
          fontSize: 14,
          fontWeight: typography.fontWeight.bold,
          color: colors.white,
          lineHeight: typography.lineHeight.snug,
        }}>
          {user.displayName}
        </div>
      </div>
      {roleCompanyLine && (
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.65)',
          marginTop: 2,
          lineHeight: typography.lineHeight.snug,
          paddingLeft: 14,
        }}>
          {roleCompanyLine}
        </div>
      )}
      {activityLabel && (
        <div style={{
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 2,
          lineHeight: typography.lineHeight.snug,
          paddingLeft: 14,
        }}>
          {activityLabel}
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


interface AvatarProps {
  user: PresenceUserWithAction;
  index: number;
  total: number;
}

function getActivityDotColor(user: PresenceUserWithAction): string {
  const isIdle = (Date.now() - user.lastSeen) / 60_000 > 5;
  if (isIdle) return '#9CA3AF';
  if (user.action === 'editing') return '#4EC896';
  return '#3B82F6';
}

const PresenceAvatar: React.FC<AvatarProps> = ({ user, index, total }) => {
  const status = getPresenceStatus(user.lastSeen);
  const activityDotColor = getActivityDotColor(user);
  return (
    <div role="listitem">
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger asChild>
        <button
          className="presence-avatar-btn"
          tabIndex={0}
          role="img"
          aria-label={`${user.displayName} is ${status}`}
          style={{
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: index > 0 ? -20 : 0,
            position: 'relative',
            zIndex: total - index,
            cursor: 'default',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <div style={{
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
            pointerEvents: 'none',
            position: 'relative',
          }}>
            {user.initials}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: activityDotColor,
              border: `1px solid ${colors.white}`,
            }} />
          </div>
        </button>
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
    </div>
  );
};

// ── PresenceBar ───────────────────────────────────────────────────────────────

interface PresenceBarProps {
  page: string;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ page }) => {
  const users = usePresenceStore(useShallow(s => s.getUsersOnPage(page)));
  const maxVisible = useMaxVisible();
  const [announcement, setAnnouncement] = useState('');
  const [viewerCountText, setViewerCountText] = useState('');
  const [insightDismissed, setInsightDismissed] = useState(() => {
    try { return sessionStorage.getItem(`presence-insight-dismissed-${page}`) === 'true'; }
    catch { return false; }
  });
  // Stores previous snapshot as a map of userId -> displayName so we can name departing users
  const prevUsersRef = useRef<Map<string, string>>(new Map());

  const handleDismissInsight = () => {
    try { sessionStorage.setItem(`presence-insight-dismissed-${page}`, 'true'); }
    catch { /* ignore */ }
    setInsightDismissed(true);
  };

  const pageLabel = page.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const showInsight = users.length >= 2 && !insightDismissed;
  const insightText = (() => {
    if (users.length < 2) return '';
    if (users.length === 2) return `${users[0].displayName} and ${users[1].displayName} are both viewing ${pageLabel}. Coordinate to avoid duplicate edits.`;
    return `${users[0].displayName}, ${users[1].displayName}, and ${users.length - 2} others are all viewing ${pageLabel}. Coordinate to avoid duplicate edits.`;
  })();

  useEffect(() => {
    setViewerCountText(`${users.length} ${users.length === 1 ? 'person' : 'people'} viewing this page`);
  }, [users.length]);

  useEffect(() => {
    const prev = prevUsersRef.current;
    const curr = new Map(users.map(u => [u.userId, u.displayName]));

    const messages: string[] = [];

    // Joined: in curr but not in prev
    users
      .filter(u => !prev.has(u.userId))
      .forEach(u => {
        const roleText = u.role ? ` as ${u.role}` : '';
        messages.push(`${u.displayName} joined${roleText}`);
      });

    // Left: in prev but not in curr
    prev.forEach((name, id) => {
      if (!curr.has(id)) messages.push(`${name} stopped viewing this page`);
    });

    if (messages.length > 0) setAnnouncement(messages.join('. '));

    prevUsersRef.current = curr;
  // Only re-run when the user list identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {announcement}
      </div>
      <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } } .presence-avatar-btn { background: none; font: inherit; line-height: 1; outline-offset: 2px; } .presence-avatar-btn:focus-visible { outline: 2px solid ${colors.primaryOrange}; outline-offset: 2px; }`}</style>
      <Tooltip.Provider delayDuration={0}>
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
          <div role="list" aria-label="People currently viewing this page" style={{ display: 'flex', alignItems: 'center' }}>
            {visible.map((user, i) => (
              <PresenceAvatar key={user.userId} user={user} index={i} total={visible.length} />
            ))}
            {overflow > 0 && (
              <div role="listitem">
              <Tooltip.Root delayDuration={0}>
                <Tooltip.Trigger asChild>
                  <button
                    className="presence-avatar-btn"
                    tabIndex={0}
                    aria-label={`${overflow} more people viewing`}
                    style={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: -20,
                      cursor: 'default',
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    <div style={{
                      width: AVATAR_SIZE,
                      height: AVATAR_SIZE,
                      borderRadius: '50%',
                      backgroundColor: colors.surfaceOverlay,
                      border: `2px solid ${colors.white}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textSecondary,
                      pointerEvents: 'none',
                    }}>
                      +{overflow}
                    </div>
                  </button>
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
                    <OverflowTooltipContent users={users.slice(maxVisible)} />
                    <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
              </div>
            )}
          </div>
        </div>
      </Tooltip.Provider>
      {showInsight && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          marginTop: spacing['2'],
          padding: spacing['2'],
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: borderRadius.md,
        }}>
          <Sparkles size={13} color={colors.indigo} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.label, color: colors.textSecondary, lineHeight: typography.lineHeight.snug }}>
            {insightText}
          </span>
          <button
            onClick={handleDismissInsight}
            aria-label="Dismiss AI insight"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing['1'],
              display: 'flex',
              alignItems: 'center',
              color: colors.textTertiary,
              borderRadius: borderRadius.sm,
              flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {viewerCountText}
      </div>
    </>
  );
};

// ── EntityPresence ────────────────────────────────────────────────────────────

interface EntityPresenceProps {
  entityId: string;
}

export const EntityPresence: React.FC<EntityPresenceProps> = ({ entityId }) => {
  const users = usePresenceStore(useShallow(s => s.getUsersViewingEntity(entityId)));

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
  const count = usePresenceStore(s => s.getUsersOnPage(page).length); // Returns primitive — safe without useShallow

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
// DrawingPresenceBarContent calls useOthers and must be inside a RoomProvider.
// SafePresenceBar wraps it so that a missing provider fails silently.

const DrawingPresenceBarContent: React.FC = () => {
  const others = useOthers() ?? [];
  const prevLengthRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    try {
      if (others.length === 0 && prevLengthRef.current > 0) {
        setTimeout(() => {
          setIsReconnecting(true);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => setIsReconnecting(false), 5000);
        }, 0);
      } else if (others.length > 0) {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setTimeout(() => setIsReconnecting(false), 0);
      }
      prevLengthRef.current = others.length;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[PresenceBar] Error syncing presence state:', err);
    }
  }, [others.length]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  if (others.length === 0 && isReconnecting) {
    return (
      <>
        <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } } @keyframes presenceSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .presence-avatar-btn { background: none; font: inherit; line-height: 1; outline-offset: 2px; } .presence-avatar-btn:focus-visible { outline: 2px solid ${colors.primaryOrange}; outline-offset: 2px; }`}</style>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: borderRadius.full,
          opacity: 0.7,
        }}>
          <RefreshCw size={12} color="rgba(255,255,255,0.5)" style={{ animation: 'presenceSpin 1s linear infinite' }} />
          <span style={{ fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.5)' }}>
            Reconnecting...
          </span>
        </div>
      </>
    );
  }

  if (others.length === 0) return null;

  const visible = others.slice(0, 5);
  const overflow = others.length - 5;

  type SafeOther = { connectionId: number; lastSeen: number; status: ReturnType<typeof getPresenceStatus>; displayName: string; role: string | undefined; company: string | undefined; color: string; initials: string };
  const safeVisible: SafeOther[] = [];
  for (const other of visible) {
    try {
      const p = asPresenceData(other.presence as unknown as Record<string, unknown>);
      const lastSeen = p.lastSeen ?? nowMs;
      safeVisible.push({
        connectionId: other.connectionId,
        lastSeen,
        status: getPresenceStatus(lastSeen),
        displayName: p.displayName || p.name || 'Someone',
        role: p.role,
        company: p.company,
        color: p.color || colors.statusInfo,
        initials: p.initials || '?',
      });
    } catch {
      // skip malformed presence entry
    }
  }

  return (
    <>
      <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } } .presence-avatar-btn { background: none; font: inherit; line-height: 1; outline-offset: 2px; } .presence-avatar-btn:focus-visible { outline: 2px solid ${colors.primaryOrange}; outline-offset: 2px; }`}</style>
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
          <div role="group" aria-label="Users currently viewing this page" style={{ display: 'flex', alignItems: 'center' }}>
            {safeVisible.map((sv, i) => {
              const { lastSeen, status, displayName, role, company } = sv;
              return (
                <Tooltip.Root key={sv.connectionId}>
                  <Tooltip.Trigger asChild>
                    <button
                      className="presence-avatar-btn"
                      tabIndex={0}
                      role="img"
                      aria-label={`${displayName} is ${getPresenceStatus(lastSeen)}`}
                      style={{
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        minHeight: 44,
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: i > 0 ? -20 : 0,
                        position: 'relative',
                        zIndex: others.length - i,
                        cursor: 'default',
                        flexShrink: 0,
                        padding: 0,
                      }}
                    >
                      <div style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        borderRadius: '50%',
                        backgroundColor: sv.color,
                        border: `2px solid ${colors.white}`,
                        boxShadow: `0 0 0 2px ${STATUS_BORDER[status]}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.white,
                        pointerEvents: 'none',
                      }}>
                        {sv.initials}
                      </div>
                    </button>
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
                      <AvatarTooltipContent user={{ displayName, role, company, lastSeen }} />
                      <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            })}
            {overflow > 0 && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    className="presence-avatar-btn"
                    role="status"
                    aria-label={`${overflow} more people viewing`}
                    style={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: -20,
                      cursor: 'default',
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
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
                      pointerEvents: 'none',
                    }}>
                      +{overflow}
                    </div>
                  </button>
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
                      users={others.slice(5).map(o => {
                        const p = asPresenceData(o.presence as unknown as Record<string, unknown>);
                        return {
                          displayName: p.displayName || p.name || 'Someone',
                          role: p.role,
                          lastSeen: p.lastSeen ?? nowMs,
                        };
                      })}
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

// SafePresenceBar: if Liveblocks RoomProvider is absent, useOthers throws during
// render. The error boundary catches it silently (returns null) and marks
// presence as initialized so downstream PresenceDots show their empty state.
const SafePresenceBar: React.FC = () => {
  const [failed] = useState(false);
  if (failed) return null;
  return (
    <PresenceBarErrorBoundary>
      <DrawingPresenceBarContent />
    </PresenceBarErrorBoundary>
  );
};

export const DrawingPresenceBar: React.FC = () => <SafePresenceBar />;

// ── Default export (PresenceBar wrapped in error boundary) ────────────────────

const PresenceBarWithErrorBoundary: React.FC<PresenceBarProps> = (props) => (
  <PresenceBarErrorBoundary>
    <PresenceBar {...props} />
  </PresenceBarErrorBoundary>
);

export default PresenceBarWithErrorBoundary;
