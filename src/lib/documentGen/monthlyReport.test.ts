import { describe, it, expect } from 'vitest'
import { generateMonthlyReport } from './monthlyReport'
import { generateCloseoutPackage } from './closeoutPackage'
import type {
  ProjectSnapshot,
  RfiSnapshotRow,
  PunchItemSnapshotRow,
  ChangeOrderSnapshotRow,
  InspectionSnapshotRow,
  SubmittalSnapshotRow,
  DailyLogSnapshotRow,
} from './snapshot'

const snapshot = (over: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  meta: {
    project_id: 'p-1',
    project_name: 'Maple Ridge',
    snapshot_at: '2026-05-04T12:00:00Z',
    period_start: '2026-04-01T00:00:00Z',
    period_end: '2026-04-30T23:59:59Z',
  },
  rfis: [],
  submittals: [],
  change_orders: [],
  punch_items: [],
  daily_logs: [],
  inspections: [],
  payments: [],
  ...over,
})

const rfi = (over: Partial<RfiSnapshotRow> = {}): RfiSnapshotRow => ({
  id: 'r1',
  number: 1,
  title: 'Door dim?',
  status: 'open',
  sent_at: null,
  responded_at: null,
  days_open: 5,
  ...over,
})

const sub = (over: Partial<SubmittalSnapshotRow> = {}): SubmittalSnapshotRow => ({
  id: 's1',
  number: 'SUB-001',
  title: 'Steel shop drawings',
  status: 'submitted',
  submitted_at: '2026-04-15',
  reviewed_at: null,
  ...over,
})

const co = (over: Partial<ChangeOrderSnapshotRow> = {}): ChangeOrderSnapshotRow => ({
  id: 'co1',
  number: 1,
  title: 'Adder',
  status: 'approved',
  cost_impact: 12_000,
  schedule_impact_days: 2,
  ...over,
})

const punch = (over: Partial<PunchItemSnapshotRow> = {}): PunchItemSnapshotRow => ({
  id: 'pi1',
  title: 'Touch up paint',
  status: 'open',
  severity: 'low',
  trade: 'painter',
  ...over,
})

const insp = (over: Partial<InspectionSnapshotRow> = {}): InspectionSnapshotRow => ({
  id: 'i1',
  inspection_type: 'framing',
  date: '2026-04-12',
  result: 'pass',
  deficiencies_count: 0,
  ...over,
})

const dailyLog = (over: Partial<DailyLogSnapshotRow> = {}): DailyLogSnapshotRow => ({
  id: 'l1',
  log_date: '2026-04-15',
  manpower_count: 12,
  weather_condition: 'sunny',
  notes: 'pour',
  ...over,
})

describe('generateMonthlyReport', () => {
  it('renders KPI section first with six tiles', () => {
    const out = generateMonthlyReport({ snapshot: snapshot(), month: '2026-04' })
    expect(out.sections[0].heading).toBe('Project KPIs')
    expect(out.sections[0].kpis).toHaveLength(6)
  })

  it('counts answered RFIs distinctly from total RFIs', () => {
    const snap = snapshot({
      rfis: [
        rfi({ id: 'a', status: 'open' }),
        rfi({ id: 'b', status: 'answered' }),
        rfi({ id: 'c', status: 'answered' }),
      ],
    })
    const out = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    const labels = Object.fromEntries(
      out.sections[0].kpis!.map((k) => [k.label, k.value]),
    )
    expect(labels['RFIs sent']).toBe(3)
    expect(labels['RFIs answered']).toBe(2)
  })

  it('formats CO cost impact as USD currency', () => {
    const snap = snapshot({
      change_orders: [co({ cost_impact: 12_000 }), co({ id: 'x', cost_impact: 8500 })],
    })
    const out = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    const tile = out.sections[0].kpis!.find((k) => k.label === 'CO cost impact')!
    expect(String(tile.value)).toMatch(/\$20,500/)
  })

  it('singular vs plural daily log copy', () => {
    const single = generateMonthlyReport({
      snapshot: snapshot({ daily_logs: [dailyLog()] }),
      month: '2026-04',
    })
    const multi = generateMonthlyReport({
      snapshot: snapshot({ daily_logs: [dailyLog(), dailyLog({ id: 'l2' })] }),
      month: '2026-04',
    })
    const sec = (doc: typeof single) =>
      doc.sections.find((s) => s.heading === 'Daily logs')!.body
    expect(sec(single)).toMatch(/^1 log captured/)
    expect(sec(multi)).toMatch(/^2 logs captured/)
  })

  it('omits Outstanding RFIs section when none open', () => {
    const out = generateMonthlyReport({
      snapshot: snapshot({ rfis: [rfi({ status: 'answered' })] }),
      month: '2026-04',
    })
    expect(out.sections.find((s) => s.heading === 'Outstanding RFIs')).toBeUndefined()
  })

  it('includes Outstanding RFIs section when at least one is open', () => {
    const out = generateMonthlyReport({
      snapshot: snapshot({ rfis: [rfi(), rfi({ id: 'r2', status: 'closed' })] }),
      month: '2026-04',
    })
    const sec = out.sections.find((s) => s.heading === 'Outstanding RFIs')
    expect(sec).toBeDefined()
    expect(sec!.rows).toHaveLength(1)
  })

  it('includes Failed inspections section only when failures exist', () => {
    const passOnly = generateMonthlyReport({
      snapshot: snapshot({ inspections: [insp()] }),
      month: '2026-04',
    })
    expect(
      passOnly.sections.find((s) => s.heading === 'Failed inspections'),
    ).toBeUndefined()
    const withFail = generateMonthlyReport({
      snapshot: snapshot({
        inspections: [
          insp(),
          insp({ id: 'f', result: 'fail', deficiencies_count: 3 }),
        ],
      }),
      month: '2026-04',
    })
    const fail = withFail.sections.find((s) => s.heading === 'Failed inspections')
    expect(fail!.rows).toHaveLength(1)
    expect(fail!.rows![0]['Deficiencies']).toBe(3)
  })

  it('uses project_id as title fallback when project_name is empty', () => {
    const out = generateMonthlyReport({
      snapshot: snapshot({ meta: { ...snapshot().meta, project_name: '' } }),
      month: '2026-04',
    })
    expect(out.title).toMatch(/Monthly report — p-1/)
  })

  it('preserves the supplied month in subtitle and snapshot_at as as_of', () => {
    const out = generateMonthlyReport({ snapshot: snapshot(), month: '2026-04' })
    expect(out.subtitle).toBe('2026-04')
    expect(out.as_of).toBe('2026-05-04T12:00:00Z')
  })
})

describe('generateCloseoutPackage', () => {
  it('always includes a Project summary KPI section', () => {
    const out = generateCloseoutPackage(snapshot())
    expect(out.sections[0].heading).toBe('Project summary')
    expect(out.sections[0].kpis).toHaveLength(6)
  })

  it('counts both closed and verified punch items as completed', () => {
    const out = generateCloseoutPackage(
      snapshot({
        punch_items: [
          punch({ status: 'open' }),
          punch({ status: 'closed' }),
          punch({ status: 'verified' }),
        ],
      }),
    )
    const tile = out.sections[0].kpis!.find((k) => k.label === 'Punch closed')!
    expect(tile.value).toBe(2)
  })

  it('emits an RFI log section when rfis exist', () => {
    const out = generateCloseoutPackage(snapshot({ rfis: [rfi()] }))
    expect(out.sections.find((s) => s.heading === 'RFI log')).toBeDefined()
  })

  it('emits a submittal log section when submittals exist', () => {
    const out = generateCloseoutPackage(snapshot({ submittals: [sub()] }))
    expect(out.sections.find((s) => s.heading === 'Submittal log')).toBeDefined()
  })

  it('emits a change order log section with formatted cost', () => {
    const out = generateCloseoutPackage(snapshot({ change_orders: [co({ cost_impact: 25000 })] }))
    const sec = out.sections.find((s) => s.heading === 'Change order log')!
    expect(sec.rows![0]['Cost']).toBe('$25,000')
  })

  it('emits a punch list section listing only OPEN items', () => {
    const out = generateCloseoutPackage(
      snapshot({
        punch_items: [
          punch({ status: 'open' }),
          punch({ id: 'p2', status: 'closed' }),
        ],
      }),
    )
    const sec = out.sections.find((s) => s.heading === 'Punch list (open)')!
    expect(sec.rows).toHaveLength(1)
  })

  it('omits empty optional sections', () => {
    const out = generateCloseoutPackage(snapshot())
    const headings = out.sections.map((s) => s.heading)
    expect(headings).toEqual(['Project summary'])
  })

  it('renders trade as em-dash when null', () => {
    const out = generateCloseoutPackage(
      snapshot({ punch_items: [punch({ trade: null })] }),
    )
    const sec = out.sections.find((s) => s.heading === 'Punch list (open)')!
    expect(sec.rows![0]['Trade']).toBe('—')
  })

  it('renders sent/responded as em-dash when null', () => {
    const out = generateCloseoutPackage(
      snapshot({ rfis: [rfi({ sent_at: null, responded_at: null })] }),
    )
    const sec = out.sections.find((s) => s.heading === 'RFI log')!
    expect(sec.rows![0]['Sent']).toBe('—')
    expect(sec.rows![0]['Responded']).toBe('—')
  })
})
