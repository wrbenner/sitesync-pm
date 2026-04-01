import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PresenceAvatars } from '../../components/shared/PresenceAvatars'
import type { PresenceUser } from '../../lib/realtime'

function makeUser(name: string, i: number): PresenceUser {
  return {
    userId: `user-${i}`,
    name,
    displayName: name,
    initials: name.split(' ').map(p => p[0]).join('').toUpperCase(),
    color: '#3A7BC8',
    page: 'dashboard',
    lastSeen: Date.now(),
  }
}

describe('PresenceAvatars', () => {
  it('should render nothing for empty users', () => {
    const { container } = render(<PresenceAvatars users={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render user initials', () => {
    render(<PresenceAvatars users={[makeUser('Mike Patterson', 0)]} />)
    expect(screen.getByTitle('Mike Patterson')).toBeDefined()
  })

  it('should show overflow count', () => {
    const users = Array.from({ length: 8 }, (_, i) => makeUser(`User ${i}`, i))
    render(<PresenceAvatars users={users} maxVisible={5} />)
    expect(screen.getByText('+3')).toBeDefined()
  })
})
