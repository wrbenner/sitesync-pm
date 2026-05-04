import { describe, it, expect } from 'vitest'
import { parseQuery, highlightSegments, groupByEntity, snippet, type SearchRow } from '../ftsQuery'

describe('parseQuery', () => {
  it('strips tsquery operators that could break Postgres', () => {
    expect(parseQuery('flashing & detail').tsqueryInput).toBe('flashing detail')
    expect(parseQuery('punch !item').tsqueryInput).toBe('punch item')
    expect(parseQuery('rfi:closed').tsqueryInput).toBe('rfi closed')
  })

  it('flags empty input', () => {
    expect(parseQuery('').empty).toBe(true)
    expect(parseQuery('   ').empty).toBe(true)
  })

  it('flags too-short queries', () => {
    expect(parseQuery('a').tooShort).toBe(true)
  })

  it('produces highlight tokens', () => {
    expect(parseQuery('punch list flashing').highlights).toEqual(['punch', 'list', 'flashing'])
  })

  it('collapses excessive whitespace', () => {
    expect(parseQuery('  punch    list  ').tsqueryInput).toBe('punch list')
  })
})

describe('highlightSegments', () => {
  it('marks matched substrings, leaves the rest as plain text', () => {
    const segs = highlightSegments('flashing detail at corner', ['flashing'])
    expect(segs[0]).toEqual({ text: 'flashing', highlighted: true })
    expect(segs[1]).toEqual({ text: ' detail at corner', highlighted: false })
  })

  it('matches case-insensitively', () => {
    const segs = highlightSegments('Flashing Detail', ['flashing'])
    expect(segs[0]).toEqual({ text: 'Flashing', highlighted: true })
  })

  it('returns single plain segment when no highlights', () => {
    expect(highlightSegments('plain', [])).toEqual([{ text: 'plain', highlighted: false }])
  })

  it('escapes regex metachars in highlight terms', () => {
    const segs = highlightSegments('cost.code', ['cost.code'])
    expect(segs[0]).toEqual({ text: 'cost.code', highlighted: true })
  })

  it('prefers longest token first to avoid sub-matching', () => {
    const segs = highlightSegments('flashing-detail', ['flash', 'flashing-detail'])
    expect(segs[0]).toEqual({ text: 'flashing-detail', highlighted: true })
  })
})

describe('groupByEntity', () => {
  it('buckets by entity_type and sorts by rank desc', () => {
    const rows: SearchRow[] = [
      { entity_type: 'rfi', entity_id: '1', project_id: 'p', title: '', body: '', status: '', rank: 0.3, created_at: '' },
      { entity_type: 'rfi', entity_id: '2', project_id: 'p', title: '', body: '', status: '', rank: 0.9, created_at: '' },
      { entity_type: 'punch_item', entity_id: '3', project_id: 'p', title: '', body: '', status: '', rank: 0.5, created_at: '' },
    ]
    const out = groupByEntity(rows)
    expect(out.rfi.map(r => r.entity_id)).toEqual(['2', '1'])
    expect(out.punch_item).toHaveLength(1)
  })
})

describe('snippet', () => {
  it('returns body verbatim when shorter than maxLength', () => {
    expect(snippet('short body', ['body'])).toBe('short body')
  })

  it('clips around the first highlight match', () => {
    const body = 'a'.repeat(200) + 'flashing' + 'b'.repeat(200)
    const out = snippet(body, ['flashing'])
    expect(out).toContain('flashing')
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
  })

  it('clips from the start when no highlight matches', () => {
    const body = 'lorem '.repeat(50)
    expect(snippet(body, ['flashing'])).toMatch(/^lorem .*…$/)
  })
})
