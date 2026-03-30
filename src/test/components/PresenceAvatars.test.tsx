import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PresenceAvatars } from '../../components/shared/PresenceAvatars'

describe('PresenceAvatars', () => {
  it('should render nothing for empty users', () => {
    const { container } = render(<PresenceAvatars users={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render user initials', () => {
    render(<PresenceAvatars users={[{ name: 'Mike Patterson', avatar: null, color: '#3A7BC8' }]} />)
    expect(screen.getByTitle('Mike Patterson')).toBeDefined()
  })

  it('should show overflow count', () => {
    const users = Array.from({ length: 8 }, (_, i) => ({
      name: `User ${i}`,
      avatar: null,
      color: '#333',
    }))
    render(<PresenceAvatars users={users} maxVisible={5} />)
    expect(screen.getByText('+3')).toBeDefined()
  })
})
