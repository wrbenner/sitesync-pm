import React from 'react'
import { colors } from '../../styles/theme'

interface PresenceUser {
  name: string
  avatar: string | null
  color: string
}

interface PresenceAvatarsProps {
  users: PresenceUser[]
  maxVisible?: number
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, maxVisible = 5 }) => {
  if (users.length === 0) return null

  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((user, i) => (
        <div
          key={i}
          title={user.name}
          style={{
            width: 28, height: 28,
            borderRadius: '50%',
            backgroundColor: user.color || colors.statusInfo,
            border: `2px solid ${colors.surfaceRaised}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 600, color: 'white',
            marginLeft: i > 0 ? '-8px' : 0,
            position: 'relative',
            zIndex: maxVisible - i,
            cursor: 'default',
          }}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: 28, height: 28,
            borderRadius: '50%',
            backgroundColor: colors.surfaceFlat,
            border: `2px solid ${colors.surfaceRaised}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 600, color: colors.textSecondary,
            marginLeft: '-8px',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
