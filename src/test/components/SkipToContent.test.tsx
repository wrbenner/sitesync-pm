import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkipToContent } from '../../components/ui/SkipToContent'

describe('SkipToContent', () => {
  it('should render skip link', () => {
    render(<SkipToContent />)
    expect(screen.getByText('Skip to content')).toBeDefined()
  })

  it('should link to main content', () => {
    render(<SkipToContent />)
    const link = screen.getByText('Skip to content') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#main-content')
  })
})
