import { describe, it, expect } from 'vitest'
import { exportToXER, exportToCSV } from './scheduleExport'
import type { ImportedActivity } from './scheduleImport'

function activity(o: Partial<ImportedActivity> = {}): ImportedActivity {
  return {
    id: 'A1',
    name: 'Activity 1',
    startDate: '2026-01-01',
    endDate: '2026-01-15',
    duration: 14,
    percentComplete: 0,
    predecessors: [],
    ...o,
  }
}

describe('scheduleExport — exportToXER (Primavera P6 format)', () => {
  it('emits the ERMHDR header row', () => {
    const xer = exportToXER([activity()], 'TestProject')
    const lines = xer.split('\r\n')
    expect(lines[0]).toMatch(/^ERMHDR\t9\.0/)
  })

  it('includes PROJECT, CALENDAR, PROJWBS, and TASK tables', () => {
    const xer = exportToXER([activity()], 'P1')
    expect(xer).toContain('%T\tPROJECT')
    expect(xer).toContain('%T\tCALENDAR')
    expect(xer).toContain('%T\tPROJWBS')
    expect(xer).toContain('%T\tTASK')
  })

  it('does not emit a TASKPRED block when no predecessors exist', () => {
    const xer = exportToXER([activity()], 'P1')
    expect(xer).not.toContain('%T\tTASKPRED')
  })

  it('emits TASKPRED when at least one predecessor link exists', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1' }),
        activity({ id: 'A2', predecessors: [{ activityId: 'A1', type: 'FS', lag: 0 }] }),
      ],
      'P1',
    )
    expect(xer).toContain('%T\tTASKPRED')
  })

  it('maps relationship types to P6 codes (FS/SS/FF/SF → PR_FS/PR_SS/PR_FF/PR_SF)', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1' }),
        activity({ id: 'A2', predecessors: [{ activityId: 'A1', type: 'SS', lag: 0 }] }),
        activity({ id: 'A3', predecessors: [{ activityId: 'A1', type: 'FF', lag: 0 }] }),
        activity({ id: 'A4', predecessors: [{ activityId: 'A1', type: 'SF', lag: 0 }] }),
      ],
      'P1',
    )
    expect(xer).toContain('PR_SS')
    expect(xer).toContain('PR_FF')
    expect(xer).toContain('PR_SF')
  })

  it('milestone activities use task_type TT_Mile', () => {
    const xer = exportToXER([activity({ isMilestone: true })], 'P1')
    expect(xer).toContain('TT_Mile')
  })

  it('non-milestone activities use TT_Task', () => {
    const xer = exportToXER([activity({ isMilestone: false })], 'P1')
    expect(xer).toContain('TT_Task')
  })

  it('converts duration days to hours (× 8)', () => {
    const xer = exportToXER([activity({ duration: 5 })], 'P1')
    // 5 days × 8 hours = 40
    expect(xer).toMatch(/\t40\t/)
  })

  it('groups distinct WBS codes into PROJWBS rows', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1', wbs: 'Foundation' }),
        activity({ id: 'A2', wbs: 'Foundation' }),
        activity({ id: 'A3', wbs: 'Frame' }),
      ],
      'TestProj',
    )
    // Expect both the project row + 2 unique WBS codes (= 3 PROJWBS rows)
    const projwbsRows = xer.split('\r\n').filter((l) => l.startsWith('%R'))
      .filter((l) => l.includes('TestProj') || l.includes('Foundation') || l.includes('Frame'))
    expect(xer).toContain('Foundation')
    expect(xer).toContain('Frame')
    expect(projwbsRows.length).toBeGreaterThanOrEqual(3)
  })

  it('uses "General" as fallback WBS code', () => {
    const xer = exportToXER([activity({ wbs: undefined })], 'P1')
    expect(xer).toContain('General')
  })
})

describe('scheduleExport — exportToCSV', () => {
  it('emits the documented 13-column header row', () => {
    const csv = exportToCSV([])
    const headerRow = csv.split('\r\n')[0]
    expect(headerRow.split(',')).toEqual([
      'ID', 'Name', 'WBS', 'Start', 'End', 'Duration (days)', 'Progress (%)',
      'Predecessors', 'Resources', 'Milestone', 'Critical',
      'Total Float (days)', 'Free Float (days)',
    ])
  })

  it('only the header row when no activities supplied', () => {
    const csv = exportToCSV([])
    expect(csv.split('\r\n')).toHaveLength(1)
  })

  it('escapes fields containing commas, quotes, or newlines', () => {
    const csv = exportToCSV([
      activity({ id: 'A1', name: 'Pour, level 2' }),
    ])
    expect(csv).toMatch(/"Pour, level 2"/)
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = exportToCSV([
      activity({ id: 'A1', name: 'Job "alpha"' }),
    ])
    expect(csv).toMatch(/"Job ""alpha"""/)
  })

  it('formats predecessors as "ID[type][±lag]" with FS implied when default', () => {
    const csv = exportToCSV([
      activity({
        id: 'A2',
        predecessors: [
          { activityId: 'A1', type: 'FS', lag: 0 },     // FS+0d → just "A1"
          { activityId: 'A0', type: 'SS', lag: 2 },     // → "A0SS+2d"
          { activityId: 'A3', type: 'FF', lag: -1 },    // → "A3FF-1d"
        ],
      }),
    ])
    const dataRow = csv.split('\r\n')[1]
    // Predecessors column is the 8th
    expect(dataRow).toContain('A1')
    expect(dataRow).toContain('A0SS+2d')
    expect(dataRow).toContain('A3FF-1d')
  })

  it('"Yes"/"No" cells for milestone + critical flags', () => {
    const csv = exportToCSV([
      activity({ isMilestone: true, isCritical: false }),
    ])
    const cells = csv.split('\r\n')[1].split(',')
    // Milestone is 10th column (0-indexed 9), Critical is 11th (0-indexed 10)
    expect(cells[9]).toBe('Yes')
    expect(cells[10]).toBe('No')
  })

  it('omits float columns when undefined (empty cells)', () => {
    const csv = exportToCSV([activity({ totalFloat: undefined, freeFloat: undefined })])
    const cells = csv.split('\r\n')[1].split(',')
    expect(cells[11]).toBe('')
    expect(cells[12]).toBe('')
  })

  it('joins resources with comma separator inside a quoted field', () => {
    const csv = exportToCSV([activity({ resources: ['Crew A', 'Crew B'] })])
    expect(csv).toMatch(/"Crew A, Crew B"/)
  })
})
