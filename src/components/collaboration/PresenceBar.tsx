import React from 'react';
import { Eye } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { usePresenceStore } from '../../stores/presenceStore';

// ── PresenceBar: shows who is currently viewing this page ──

interface PresenceBarProps {
  page: string;
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ page }) => {
  const users = usePresenceStore(s => s.getUsersOnPage(page));

  if (users.length === 0) return null;

  return (
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
        {users.slice(0, 5).map((user, i) => (
          <div
            key={user.userId}
            title={user.name}
            style={{
              width: 22, height: 22,
              borderRadius: borderRadius.full,
              backgroundColor: user.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: typography.fontWeight.semibold,
              color: colors.white, border: `2px solid ${colors.surfaceRaised}`,
              marginLeft: i > 0 ? '-6px' : 0,
              zIndex: users.length - i,
              cursor: 'default',
            }}
          >
            {user.initials}
          </div>
        ))}
        {users.length > 5 && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['1'] }}>
            +{users.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
};

// ── EntityPresence: shows who else is viewing a specific entity ──

interface EntityPresenceProps {
  entityId: string;
}

export const EntityPresence: React.FC<EntityPresenceProps> = ({ entityId }) => {
  const users = usePresenceStore(s => s.getUsersViewingEntity(entityId));

  if (users.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `${spacing['1']} ${spacing['2']}`,
    }}>
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Also viewing:</span>
      {users.map((user) => (
        <div
          key={user.userId}
          title={user.name}
          style={{
            width: 20, height: 20,
            borderRadius: borderRadius.full,
            backgroundColor: user.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '8px', fontWeight: typography.fontWeight.semibold,
            color: colors.white,
          }}
        >
          {user.initials}
        </div>
      ))}
    </div>
  );
};

// ── SidebarPresenceDot: small dot next to sidebar nav items ──

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
        <span style={{ fontSize: '9px', color: colors.textTertiary }}>{count}</span>
      )}
    </div>
  );
};
