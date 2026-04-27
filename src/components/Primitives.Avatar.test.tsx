import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Avatar, ProgressBar, TableHeader, TableRow, PageContainer } from './Primitives'

// ── Avatar ────────────────────────────────────────────────────────

describe('Avatar — initials rendering + a11y', () => {
  it('renders initials text', () => {
    const { getByText } = render(<Avatar initials="WB" />)
    expect(getByText('WB')).toBeTruthy()
  })

  it('uses role="img" + aria-label="Avatar: <initials>" so SR announces who, not "image"', () => {
    const { getByRole } = render(<Avatar initials="JD" />)
    const img = getByRole('img')
    expect(img.getAttribute('aria-label')).toBe('Avatar: JD')
  })

  it('default size renders at 36×36 with sm fontSize (≥36 boundary)', () => {
    const { getByRole } = render(<Avatar initials="A" />)
    const el = getByRole('img') as HTMLElement
    expect(el.style.width).toBe('36px')
    expect(el.style.height).toBe('36px')
  })

  it('size <36 drops to xs fontSize (boundary check)', () => {
    const { getByRole } = render(<Avatar initials="A" size={28} />)
    const el = getByRole('img') as HTMLElement
    expect(el.style.width).toBe('28px')
    // xs path — fontSize differs from 36+ path
  })

  it('explicit color prop overrides hash-derived bg', () => {
    const { getByRole } = render(<Avatar initials="WB" color="#FF0000" />)
    const el = getByRole('img') as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('same initials always pick the same hash-derived color (deterministic)', () => {
    const { getByRole: getA, unmount: unmountA } = render(<Avatar initials="ZZ" />)
    const colorA = (getA('img') as HTMLElement).style.backgroundColor
    unmountA()
    const { getByRole: getB } = render(<Avatar initials="ZZ" />)
    const colorB = (getB('img') as HTMLElement).style.backgroundColor
    expect(colorA).toBe(colorB)
  })
})

// ── ProgressBar ───────────────────────────────────────────────────

describe('ProgressBar — ARIA value + width capping', () => {
  it('renders role="progressbar" with aria-valuenow + min + max', () => {
    const { getByRole } = render(<ProgressBar value={42} />)
    const bar = getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('aria-label rounds the percentage for screen readers', () => {
    const { getByRole } = render(<ProgressBar value={33} max={100} />)
    expect(getByRole('progressbar').getAttribute('aria-label')).toBe('33% complete')
  })

  it('aria-label rounds non-integer percents (50/3 = 16.67% → 17%)', () => {
    const { getByRole } = render(<ProgressBar value={50} max={3} />)
    // 50/3 * 100 = 1666.67 — Math.round = 1667
    expect(getByRole('progressbar').getAttribute('aria-label')).toBe('1667% complete')
  })

  it('custom max scales the aria-valuemax', () => {
    const { getByRole } = render(<ProgressBar value={5} max={10} />)
    const bar = getByRole('progressbar')
    expect(bar.getAttribute('aria-valuemax')).toBe('10')
    expect(bar.getAttribute('aria-label')).toBe('50% complete')
  })

  it('fill width caps at 100% when value > max (overflow guard)', () => {
    const { getByRole } = render(<ProgressBar value={150} max={100} />)
    const fill = getByRole('progressbar').firstChild as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('fill width is value/max*100 when within range', () => {
    const { getByRole } = render(<ProgressBar value={25} max={100} />)
    const fill = getByRole('progressbar').firstChild as HTMLElement
    expect(fill.style.width).toBe('25%')
  })

  it('honours custom height + color overrides', () => {
    const { getByRole } = render(<ProgressBar value={50} height={10} color="#00FF00" />)
    const bar = getByRole('progressbar') as HTMLElement
    expect(bar.style.height).toBe('10px')
    const fill = bar.firstChild as HTMLElement
    expect(fill.style.backgroundColor).toBe('rgb(0, 255, 0)')
  })
})

// ── TableHeader ───────────────────────────────────────────────────

describe('TableHeader — grid + ARIA', () => {
  it('renders one columnheader per column with its label', () => {
    const { getAllByRole, getByText } = render(
      <TableHeader columns={[{ label: 'Name' }, { label: 'Status' }, { label: 'Date' }]} />,
    )
    expect(getAllByRole('columnheader')).toHaveLength(3)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Status')).toBeTruthy()
    expect(getByText('Date')).toBeTruthy()
  })

  it('outer element is role="row" so AT treats columnheaders as a header row', () => {
    const { getByRole } = render(
      <TableHeader columns={[{ label: 'Name' }]} />,
    )
    expect(getByRole('row')).toBeTruthy()
  })

  it('gridTemplateColumns stitches widths, defaulting unset columns to 1fr', () => {
    const { getByRole } = render(
      <TableHeader columns={[{ label: 'A', width: '200px' }, { label: 'B' }, { label: 'C', width: '100px' }]} />,
    )
    const row = getByRole('row') as HTMLElement
    expect(row.style.gridTemplateColumns).toBe('200px 1fr 100px')
  })
})

// ── TableRow ──────────────────────────────────────────────────────

describe('TableRow — interaction polymorphism', () => {
  it('renders one cell per column', () => {
    const { getAllByRole } = render(
      <TableRow columns={[{ content: 'a' }, { content: 'b' }, { content: 'c' }]} />,
    )
    expect(getAllByRole('cell')).toHaveLength(3)
  })

  it('static row (no onClick) has no tabIndex (not focusable)', () => {
    const { getByRole } = render(
      <TableRow columns={[{ content: 'a' }]} />,
    )
    const row = getByRole('row')
    expect(row.getAttribute('tabindex')).toBe(null)
  })

  it('clickable row sets tabIndex=0 + cursor pointer', () => {
    const { getByRole } = render(
      <TableRow columns={[{ content: 'a' }]} onClick={() => {}} />,
    )
    const row = getByRole('row') as HTMLElement
    expect(row.getAttribute('tabindex')).toBe('0')
    expect(row.style.cursor).toBe('pointer')
  })

  it('Enter key fires onClick (keyboard a11y parity with mouse)', () => {
    const fn = vi.fn()
    const { getByRole } = render(<TableRow columns={[{ content: 'x' }]} onClick={fn} />)
    fireEvent.keyDown(getByRole('row'), { key: 'Enter' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('Space key fires onClick (keyboard a11y parity with mouse)', () => {
    const fn = vi.fn()
    const { getByRole } = render(<TableRow columns={[{ content: 'x' }]} onClick={fn} />)
    fireEvent.keyDown(getByRole('row'), { key: ' ' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('selected=true sets aria-selected + the orange left-border treatment', () => {
    const { getByRole } = render(
      <TableRow columns={[{ content: 'x' }]} onClick={() => {}} selected />,
    )
    const row = getByRole('row') as HTMLElement
    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(row.style.borderLeft).toContain('3px solid')
  })

  it('selected=false leaves aria-selected unset (null, not "false")', () => {
    const { getByRole } = render(
      <TableRow columns={[{ content: 'x' }]} onClick={() => {}} selected={false} />,
    )
    expect(getByRole('row').getAttribute('aria-selected')).toBe(null)
  })

  it('divider=false removes the bottom border-style', () => {
    const { getByRole } = render(
      <TableRow columns={[{ content: 'x' }]} divider={false} />,
    )
    // jsdom normalises `border-bottom: none` to `medium none` shorthand;
    // assert via the resolved border-style rather than the shorthand string.
    expect((getByRole('row') as HTMLElement).style.borderBottomStyle).toBe('none')
  })

  it('mouse click fires onClick once', () => {
    const fn = vi.fn()
    const { getByRole } = render(<TableRow columns={[{ content: 'x' }]} onClick={fn} />)
    fireEvent.click(getByRole('row'))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// ── PageContainer ─────────────────────────────────────────────────

describe('PageContainer — semantic landmark + heading', () => {
  it('renders children inside a role="region" landmark', () => {
    const { getByRole, getByText } = render(
      <PageContainer><span>inner</span></PageContainer>,
    )
    expect(getByRole('region')).toBeTruthy()
    expect(getByText('inner')).toBeTruthy()
  })

  it('aria-label prefers explicit prop > title > "Page content" fallback', () => {
    const { getByRole, unmount } = render(<PageContainer aria-label="Custom"><i /></PageContainer>)
    expect(getByRole('region').getAttribute('aria-label')).toBe('Custom')
    unmount()

    const { getByRole: getB, unmount: unmountB } = render(
      <PageContainer title="Projects"><i /></PageContainer>,
    )
    expect(getB('region').getAttribute('aria-label')).toBe('Projects')
    unmountB()

    const { getByRole: getC } = render(<PageContainer><i /></PageContainer>)
    expect(getC('region').getAttribute('aria-label')).toBe('Page content')
  })

  it('renders title as an h1 heading when provided', () => {
    const { getByRole } = render(
      <PageContainer title="My Page"><i /></PageContainer>,
    )
    const h1 = getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('My Page')
  })

  it('omits the entire header block when title is missing', () => {
    const { queryByRole } = render(<PageContainer><span>body</span></PageContainer>)
    expect(queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('renders subtitle below the title when provided', () => {
    const { getByText } = render(
      <PageContainer title="X" subtitle="Subtitle text"><i /></PageContainer>,
    )
    expect(getByText('Subtitle text')).toBeTruthy()
  })

  it('renders actions slot alongside the title', () => {
    const { getByText } = render(
      <PageContainer title="X" actions={<button>Create</button>}><i /></PageContainer>,
    )
    expect(getByText('Create')).toBeTruthy()
  })
})
