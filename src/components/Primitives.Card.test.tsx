import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Card, Btn } from './Primitives'

describe('Card — interaction modes', () => {
  it('renders children inside the card', () => {
    const { getByText } = render(<Card>Hello world</Card>)
    expect(getByText('Hello world')).toBeTruthy()
  })

  it('static (no onClick): no role, no tabIndex', () => {
    const { container } = render(<Card>static</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.getAttribute('role')).toBeNull()
    expect(card.tabIndex).toBe(-1) // tabIndex defaults to -1 when not set
  })

  it('clickable (onClick supplied): role="button" + tabIndex=0', () => {
    const { container } = render(<Card onClick={() => {}}>click me</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.getAttribute('role')).toBe('button')
    expect(card.tabIndex).toBe(0)
  })

  it('explicit role prop overrides the implicit "button" role', () => {
    const { container } = render(<Card onClick={() => {}} role="link">x</Card>)
    expect((container.firstChild as HTMLElement).getAttribute('role')).toBe('link')
  })

  it('Enter key fires onClick (keyboard a11y)', () => {
    const onClick = vi.fn()
    const { container } = render(<Card onClick={onClick}>x</Card>)
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Space key fires onClick (keyboard a11y)', () => {
    const onClick = vi.fn()
    const { container } = render(<Card onClick={onClick}>x</Card>)
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('other keys do not trigger onClick', () => {
    const onClick = vi.fn()
    const { container } = render(<Card onClick={onClick}>x</Card>)
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'Tab' })
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'a' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aria-label prop forwards to the rendered element', () => {
    const { container } = render(<Card aria-label="Project card">x</Card>)
    expect((container.firstChild as HTMLElement).getAttribute('aria-label')).toBe('Project card')
  })
})

describe('Btn — interaction + accessibility', () => {
  it('renders children as button text', () => {
    const { getByRole } = render(<Btn>Click me</Btn>)
    expect(getByRole('button').textContent).toContain('Click me')
  })

  it('default type is "button" (avoids accidental form submission)', () => {
    const { getByRole } = render(<Btn>X</Btn>)
    expect((getByRole('button') as HTMLButtonElement).type).toBe('button')
  })

  it('honours an explicit type="submit"', () => {
    const { getByRole } = render(<Btn type="submit">Save</Btn>)
    expect((getByRole('button') as HTMLButtonElement).type).toBe('submit')
  })

  it('clicking fires the onClick handler', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<Btn onClick={onClick}>X</Btn>)
    fireEvent.click(getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled button does not fire onClick', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<Btn onClick={onClick} disabled>X</Btn>)
    fireEvent.click(getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled state sets aria-disabled', () => {
    const { getByRole } = render(<Btn disabled>X</Btn>)
    expect(getByRole('button').getAttribute('aria-disabled')).toBe('true')
  })

  it('loading state disables the button + sets aria-busy', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<Btn onClick={onClick} loading>X</Btn>)
    const btn = getByRole('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aria-label prop forwards', () => {
    const { getByRole } = render(<Btn aria-label="Save document">Save</Btn>)
    expect(getByRole('button').getAttribute('aria-label')).toBe('Save document')
  })

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'variant "%s" renders without errors',
    (variant) => {
      const { getByRole } = render(<Btn variant={variant}>X</Btn>)
      expect(getByRole('button')).toBeTruthy()
    },
  )

  it.each(['sm', 'md', 'lg'] as const)('size "%s" sets the documented minHeight', (size) => {
    const { getByRole } = render(<Btn size={size}>X</Btn>)
    const btn = getByRole('button') as HTMLButtonElement
    const expected = size === 'lg' ? '48px' : size === 'md' ? '40px' : '32px'
    expect(btn.style.minHeight).toBe(expected)
  })

  it('fullWidth=true sets width:100%', () => {
    const { getByRole } = render(<Btn fullWidth>X</Btn>)
    expect((getByRole('button') as HTMLButtonElement).style.width).toBe('100%')
  })
})
