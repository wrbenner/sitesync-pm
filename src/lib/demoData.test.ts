import { describe, it, expect } from 'vitest'
import {
  DEMO_PROJECT,
  DEMO_TEAM,
  DEMO_VENDORS,
  DEMO_PHASES,
  DEMO_RFIS,
  DEMO_SUBMITTALS,
  DEMO_CHANGE_ORDERS,
  DEMO_PUNCH_ITEMS,
  DEMO_DAILY_LOGS,
  DEMO_DRAWINGS,
  DEMO_BUNDLE,
} from './demoData'

// ── DEMO_PROJECT ──────────────────────────────────────────────────

describe('DEMO_PROJECT — Maple Ridge fixture', () => {
  it('id prefix is "demo-" so re-seeding upserts instead of duplicating', () => {
    expect(DEMO_PROJECT.id.startsWith('demo-')).toBe(true)
  })

  it('is_demo=true so RLS / read-only filters can find it', () => {
    expect(DEMO_PROJECT.is_demo).toBe(true)
  })

  it('contract_value_cents is an integer (no floats in money)', () => {
    expect(Number.isInteger(DEMO_PROJECT.contract_value_cents)).toBe(true)
    expect(DEMO_PROJECT.contract_value_cents).toBeGreaterThan(0)
  })

  it('substantial_completion_date is after start_date (storyline sanity)', () => {
    expect(new Date(DEMO_PROJECT.substantial_completion_date).getTime())
      .toBeGreaterThan(new Date(DEMO_PROJECT.start_date).getTime())
  })

  it('start + completion dates parse as valid ISO YYYY-MM-DD', () => {
    expect(DEMO_PROJECT.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(DEMO_PROJECT.substantial_completion_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── DEMO_TEAM ─────────────────────────────────────────────────────

describe('DEMO_TEAM — populated org seed', () => {
  it('has at least 8 members covering the canonical roles', () => {
    expect(DEMO_TEAM.length).toBeGreaterThanOrEqual(8)
    const roles = new Set(DEMO_TEAM.map(m => m.role))
    expect(roles.has('project_manager')).toBe(true)
    expect(roles.has('superintendent')).toBe(true)
    expect(roles.has('owner')).toBe(true)
  })

  it('every email uses the demo subdomain (avoid leaking real addresses)', () => {
    DEMO_TEAM.forEach(m => {
      expect(m.email).toMatch(/demo\.sitesync\.app$/)
    })
  })

  it('every member has an id with the demo- prefix', () => {
    DEMO_TEAM.forEach(m => {
      expect(m.id.startsWith('demo-')).toBe(true)
    })
  })
})

// ── DEMO_VENDORS ──────────────────────────────────────────────────

describe('DEMO_VENDORS — subcontractor list', () => {
  it('every contract value is an integer cents > 0', () => {
    DEMO_VENDORS.forEach(v => {
      expect(Number.isInteger(v.contract_value_cents)).toBe(true)
      expect(v.contract_value_cents).toBeGreaterThan(0)
    })
  })

  it('total subcontractor commitments are well below the project contract value', () => {
    const total = DEMO_VENDORS.reduce((s, v) => s + v.contract_value_cents, 0)
    expect(total).toBeLessThan(DEMO_PROJECT.contract_value_cents)
  })

  it('all trades are unique (no duplicate vendor in same trade)', () => {
    const trades = DEMO_VENDORS.map(v => v.trade)
    expect(new Set(trades).size).toBe(trades.length)
  })
})

// ── DEMO_PHASES ───────────────────────────────────────────────────

describe('DEMO_PHASES — schedule storyline', () => {
  it('phase 1 starts on the project start date (anchored)', () => {
    expect(DEMO_PHASES[0].start).toBe(DEMO_PROJECT.start_date)
  })

  it('last phase ends on the substantial completion date (anchored)', () => {
    const last = DEMO_PHASES[DEMO_PHASES.length - 1]
    expect(last.end).toBe(DEMO_PROJECT.substantial_completion_date)
  })

  it('completed phases have pct=100, upcoming phases have pct=0', () => {
    DEMO_PHASES.forEach(p => {
      if (p.status === 'completed') expect(p.pct).toBe(100)
      if (p.status === 'upcoming') expect(p.pct).toBe(0)
    })
  })

  it('in_progress phases have pct strictly between 0 and 100', () => {
    DEMO_PHASES.filter(p => p.status === 'in_progress').forEach(p => {
      expect(p.pct).toBeGreaterThan(0)
      expect(p.pct).toBeLessThan(100)
    })
  })

  it('every phase end is on or after its start (no inverted ranges)', () => {
    DEMO_PHASES.forEach(p => {
      expect(new Date(p.end).getTime()).toBeGreaterThanOrEqual(new Date(p.start).getTime())
    })
  })
})

// ── DEMO_RFIS ─────────────────────────────────────────────────────

describe('DEMO_RFIS — 30-RFI storyline', () => {
  it('fixture contains exactly 30 RFIs (sales-demo coverage target)', () => {
    expect(DEMO_RFIS).toHaveLength(30)
  })

  it('RFI numbers are 1..30 with no gaps', () => {
    const numbers = DEMO_RFIS.map(r => r.number).sort((a, b) => a - b)
    for (let i = 0; i < 30; i++) expect(numbers[i]).toBe(i + 1)
  })

  it('every RFI id is unique', () => {
    const ids = DEMO_RFIS.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('status mix tells a coherent story: some closed, some in-review, some open', () => {
    const counts = DEMO_RFIS.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
    expect(counts.closed).toBeGreaterThan(0)
    expect(counts.in_review).toBeGreaterThan(0)
    expect(counts.open).toBeGreaterThan(0)
  })

  it('closed RFIs have a closed_date, non-closed do not', () => {
    DEMO_RFIS.forEach(r => {
      if (r.status === 'closed') {
        expect((r as { closed_date?: string }).closed_date).toBeDefined()
      } else {
        expect((r as { closed_date?: string }).closed_date).toBeUndefined()
      }
    })
  })

  it('priority is one of low/medium/high (frontend has no fallback for others)', () => {
    DEMO_RFIS.forEach(r => {
      expect(['low', 'medium', 'high']).toContain(r.priority)
    })
  })

  it('discipline coverage spans the major construction trades', () => {
    const disciplines = new Set(DEMO_RFIS.map(r => r.discipline))
    expect(disciplines.has('architectural')).toBe(true)
    expect(disciplines.has('structural')).toBe(true)
    expect(disciplines.has('mechanical')).toBe(true)
    expect(disciplines.has('electrical')).toBe(true)
  })
})

// ── DEMO_SUBMITTALS ───────────────────────────────────────────────

describe('DEMO_SUBMITTALS — 12-submittal storyline', () => {
  it('fixture contains exactly 12 submittals', () => {
    expect(DEMO_SUBMITTALS).toHaveLength(12)
  })

  it('every spec_section is in CSI MasterFormat NN NN NN format', () => {
    DEMO_SUBMITTALS.forEach(s => {
      expect(s.spec_section).toMatch(/^\d{2} \d{2} \d{2}$/)
    })
  })

  it('approved submittals have an approved_date; drafts do not', () => {
    DEMO_SUBMITTALS.forEach(s => {
      if (s.status === 'approved' || s.status === 'approved_as_noted') {
        expect((s as { approved_date?: string }).approved_date).toBeDefined()
      }
      if (s.status === 'draft') {
        expect((s as { approved_date?: string }).approved_date).toBeUndefined()
        expect(s.submitted_date).toBeNull()
      }
    })
  })

  it('type is one of the allowed enum values (frontend renders only these)', () => {
    DEMO_SUBMITTALS.forEach(s => {
      expect(['shop_drawing', 'product_data', 'sample', 'mockup']).toContain(s.type)
    })
  })
})

// ── DEMO_CHANGE_ORDERS ────────────────────────────────────────────

describe('DEMO_CHANGE_ORDERS — 6-CO storyline', () => {
  it('fixture contains 6 change orders', () => {
    expect(DEMO_CHANGE_ORDERS).toHaveLength(6)
  })

  it('every amount is integer cents > 0 (no fractional pennies)', () => {
    DEMO_CHANGE_ORDERS.forEach(co => {
      expect(Number.isInteger(co.amount_cents)).toBe(true)
      expect(co.amount_cents).toBeGreaterThan(0)
    })
  })

  it('approved COs have an approved_date; drafts do not', () => {
    DEMO_CHANGE_ORDERS.forEach(co => {
      if (co.status === 'approved') {
        expect((co as { approved_date?: string }).approved_date).toBeDefined()
      }
      if (co.status === 'draft') {
        expect((co as { approved_date?: string }).approved_date).toBeUndefined()
      }
    })
  })

  it('type is one of co/pco/cor (UI legend only handles these)', () => {
    DEMO_CHANGE_ORDERS.forEach(co => {
      expect(['co', 'pco', 'cor']).toContain(co.type)
    })
  })

  it('CO numbers are 1..6 with no gaps', () => {
    const ns = DEMO_CHANGE_ORDERS.map(c => c.number).sort((a, b) => a - b)
    expect(ns).toEqual([1, 2, 3, 4, 5, 6])
  })
})

// ── DEMO_PUNCH_ITEMS ──────────────────────────────────────────────

describe('DEMO_PUNCH_ITEMS — programmatic 60-item generation', () => {
  it('exactly 60 items (target enforced inside the IIFE)', () => {
    expect(DEMO_PUNCH_ITEMS).toHaveLength(60)
  })

  it('numbers are 1..60 with no gaps', () => {
    const numbers = DEMO_PUNCH_ITEMS.map(p => p.number).sort((a, b) => a - b)
    for (let i = 0; i < 60; i++) expect(numbers[i]).toBe(i + 1)
  })

  it('every id is unique', () => {
    const ids = DEMO_PUNCH_ITEMS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('zero-padded ids: number 1 → "demo-punch-001", number 60 → "demo-punch-060"', () => {
    expect(DEMO_PUNCH_ITEMS[0].id).toBe('demo-punch-001')
    expect(DEMO_PUNCH_ITEMS[59].id).toBe('demo-punch-060')
  })

  it('floor is "L1" or "L2"', () => {
    DEMO_PUNCH_ITEMS.forEach(p => {
      expect(['L1', 'L2']).toContain(p.floor)
    })
  })

  it('status mix uses all 4 lifecycle states (round-robin distribution)', () => {
    const statuses = new Set(DEMO_PUNCH_ITEMS.map(p => p.status))
    expect(statuses.has('open')).toBe(true)
    expect(statuses.has('in_progress')).toBe(true)
    expect(statuses.has('sub_complete')).toBe(true)
    expect(statuses.has('verified')).toBe(true)
  })

  it('priority is one of low/medium/high', () => {
    DEMO_PUNCH_ITEMS.forEach(p => {
      expect(['low', 'medium', 'high']).toContain(p.priority)
    })
  })
})

// ── DEMO_DAILY_LOGS ───────────────────────────────────────────────

describe('DEMO_DAILY_LOGS — 14-day rolling window', () => {
  it('exactly 14 daily logs (one per day, two weeks)', () => {
    expect(DEMO_DAILY_LOGS).toHaveLength(14)
  })

  it('logs are sorted ascending by date with no gaps', () => {
    for (let i = 1; i < DEMO_DAILY_LOGS.length; i++) {
      const prev = new Date(DEMO_DAILY_LOGS[i - 1].log_date)
      const cur  = new Date(DEMO_DAILY_LOGS[i].log_date)
      const diffDays = (cur.getTime() - prev.getTime()) / 86_400_000
      expect(diffDays).toBe(1)
    }
  })

  it('last entry anchors to the storyline anchor date 2026-04-25', () => {
    const last = DEMO_DAILY_LOGS[DEMO_DAILY_LOGS.length - 1]
    expect(last.log_date).toBe('2026-04-25')
  })

  it('every log has a workforce count >= 0 and a non-empty work_summary', () => {
    DEMO_DAILY_LOGS.forEach(log => {
      expect(log.workers_onsite).toBeGreaterThanOrEqual(0)
      expect(log.work_summary.length).toBeGreaterThan(0)
    })
  })

  it('temperature_high is always >= temperature_low', () => {
    DEMO_DAILY_LOGS.forEach(log => {
      expect(log.temperature_high).toBeGreaterThanOrEqual(log.temperature_low)
    })
  })

  it('weather is one of the 4 storyline conditions', () => {
    DEMO_DAILY_LOGS.forEach(log => {
      expect(['clear', 'partly_cloudy', 'overcast', 'rain']).toContain(log.weather)
    })
  })
})

// ── DEMO_DRAWINGS ─────────────────────────────────────────────────

describe('DEMO_DRAWINGS — sheet set fixture', () => {
  it('every sheet_number matches the AIA-style D-NNN format', () => {
    DEMO_DRAWINGS.forEach(d => {
      expect(d.sheet_number).toMatch(/^[A-Z]-\d{3}$/)
    })
  })

  it('discipline column matches the prefix letter (A=arch, S=struct, M=mech, E=elec)', () => {
    const expected: Record<string, string> = { A: 'architectural', S: 'structural', M: 'mechanical', E: 'electrical' }
    DEMO_DRAWINGS.forEach(d => {
      const prefix = d.sheet_number[0]
      expect(d.discipline).toBe(expected[prefix])
    })
  })

  it('every drawing is "current" status (no superseded fixtures in the bundle)', () => {
    DEMO_DRAWINGS.forEach(d => {
      expect(d.status).toBe('current')
    })
  })
})

// ── DEMO_BUNDLE ───────────────────────────────────────────────────

describe('DEMO_BUNDLE — full convenience export', () => {
  it('exposes every per-entity fixture by stable key', () => {
    expect(DEMO_BUNDLE.project).toBe(DEMO_PROJECT)
    expect(DEMO_BUNDLE.team).toBe(DEMO_TEAM)
    expect(DEMO_BUNDLE.vendors).toBe(DEMO_VENDORS)
    expect(DEMO_BUNDLE.phases).toBe(DEMO_PHASES)
    expect(DEMO_BUNDLE.rfis).toBe(DEMO_RFIS)
    expect(DEMO_BUNDLE.submittals).toBe(DEMO_SUBMITTALS)
    expect(DEMO_BUNDLE.change_orders).toBe(DEMO_CHANGE_ORDERS)
    expect(DEMO_BUNDLE.punch_items).toBe(DEMO_PUNCH_ITEMS)
    expect(DEMO_BUNDLE.daily_logs).toBe(DEMO_DAILY_LOGS)
    expect(DEMO_BUNDLE.drawings).toBe(DEMO_DRAWINGS)
  })

  it('total expected row count matches the storyline (project + team + entities)', () => {
    expect(DEMO_BUNDLE.team.length).toBe(8)
    expect(DEMO_BUNDLE.vendors.length).toBe(8)
    expect(DEMO_BUNDLE.phases.length).toBe(12)
    expect(DEMO_BUNDLE.rfis.length).toBe(30)
    expect(DEMO_BUNDLE.submittals.length).toBe(12)
    expect(DEMO_BUNDLE.change_orders.length).toBe(6)
    expect(DEMO_BUNDLE.punch_items.length).toBe(60)
    expect(DEMO_BUNDLE.daily_logs.length).toBe(14)
    expect(DEMO_BUNDLE.drawings.length).toBe(5)
  })
})
