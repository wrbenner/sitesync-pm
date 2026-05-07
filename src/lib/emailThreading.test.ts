import { describe, it, expect } from 'vitest'
import {
  buildReplyToAddress,
  buildMessageId,
  buildSubjectWithThreadHint,
  stripAngleBrackets,
} from './emailThreading'

describe('buildReplyToAddress', () => {
  it('uses rfi alias for rfi entity', () => {
    expect(buildReplyToAddress('rfi', 'abc-123')).toMatch(
      /^reply\+rfi-abc-123@/,
    )
  })

  it('uses sub alias for submittal entity', () => {
    expect(buildReplyToAddress('submittal', 'xyz')).toMatch(/^reply\+sub-xyz@/)
  })

  it('uses co alias for change_order entity', () => {
    expect(buildReplyToAddress('change_order', '42')).toMatch(/^reply\+co-42@/)
  })

  it('uses configured reply domain', () => {
    expect(buildReplyToAddress('rfi', 'r1')).toMatch(/@reply\.sitesync\.app$/)
  })

  it('round-trips identifier in plus-tag', () => {
    const addr = buildReplyToAddress('rfi', 'order-99')
    expect(addr.split('@')[0]).toBe('reply+rfi-order-99')
  })
})

describe('buildMessageId', () => {
  it('wraps in angle brackets per RFC 5322', () => {
    const id = buildMessageId('rfi', 'r1')
    expect(id.startsWith('<')).toBe(true)
    expect(id.endsWith('>')).toBe(true)
  })

  it('embeds the entity alias and id in the local part', () => {
    const id = buildMessageId('change_order', 'co-1')
    expect(id).toMatch(/<co-co-1-[a-f0-9]{24}@/)
  })

  it('appends a 24-char hex random suffix', () => {
    const id = buildMessageId('rfi', 'a')
    const inner = id.slice(1, -1)
    const local = inner.split('@')[0]
    const random = local.split('-').pop()!
    expect(random).toMatch(/^[a-f0-9]{24}$/)
  })

  it('produces unique ids for repeated calls on the same entity', () => {
    const a = buildMessageId('rfi', 'r1')
    const b = buildMessageId('rfi', 'r1')
    expect(a).not.toBe(b)
  })

  it('uses the configured message-id domain', () => {
    expect(buildMessageId('submittal', 's1')).toMatch(/@mail\.sitesync\.app>$/)
  })
})

describe('buildSubjectWithThreadHint', () => {
  it('labels rfi entities as RFI', () => {
    expect(buildSubjectWithThreadHint('rfi', 5, 'Slab elevation')).toBe(
      'RFI #5 — Slab elevation',
    )
  })

  it('labels submittal entities as Submittal', () => {
    expect(buildSubjectWithThreadHint('submittal', 12, 'HVAC drawings')).toBe(
      'Submittal #12 — HVAC drawings',
    )
  })

  it('labels change_order entities as CO', () => {
    expect(buildSubjectWithThreadHint('change_order', 3, 'Adder')).toBe(
      'CO #3 — Adder',
    )
  })

  it('accepts string numbers (e.g. RFI-2024-001)', () => {
    expect(buildSubjectWithThreadHint('rfi', 'RFI-2024-001', 'Door 7')).toBe(
      'RFI #RFI-2024-001 — Door 7',
    )
  })
})

describe('stripAngleBrackets', () => {
  it('removes leading and trailing angle brackets', () => {
    expect(stripAngleBrackets('<abc@example.com>')).toBe('abc@example.com')
  })

  it('trims whitespace around an unbracketed id', () => {
    expect(stripAngleBrackets('  id@host  ')).toBe('id@host')
  })

  it('is a no-op on bare ids', () => {
    expect(stripAngleBrackets('id@host')).toBe('id@host')
  })

  it('handles missing trailing bracket', () => {
    expect(stripAngleBrackets('<id@host')).toBe('id@host')
  })

  it('handles missing leading bracket', () => {
    expect(stripAngleBrackets('id@host>')).toBe('id@host')
  })
})
