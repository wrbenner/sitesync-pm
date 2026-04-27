import { describe, it, expect } from 'vitest'
import { detectFormat, parseCSV, exportToMSProjectXML } from './scheduleImport'

describe('scheduleImport — detectFormat', () => {
  it('detects XER from the ERMHDR header', () => {
    expect(detectFormat('ERMHDR\t9.0\t2026-01-01')).toBe('xer')
  })

  it('detects XER even with leading whitespace', () => {
    expect(detectFormat('   \nERMHDR\t9.0')).toBe('xer')
  })

  it('detects MSP from <?xml prologue', () => {
    expect(detectFormat('<?xml version="1.0"?>\n<Project>')).toBe('msp_xml')
  })

  it('detects MSP from <Project root', () => {
    expect(detectFormat('<Project xmlns="http://schemas.microsoft.com/project">')).toBe('msp_xml')
  })

  it('detects MSP when <Project appears in the first 500 chars', () => {
    const xml = '<!-- Some comment -->\n<root><Project /></root>'
    expect(detectFormat(xml)).toBe('msp_xml')
  })

  it('falls back to CSV for everything else', () => {
    expect(detectFormat('ID,Name,Start,End\n1,A,2026-01-01,2026-01-15')).toBe('csv')
  })
})

describe('scheduleImport — parseCSV', () => {
  it('parses a header row + a single activity', () => {
    const csv = 'ID,Name,Start,End,Duration,Progress\nA1,Foundation,2026-01-01,2026-01-15,14,0'
    const r = parseCSV(csv)
    expect(r.format).toBe('csv')
    expect(r.activities).toHaveLength(1)
    expect(r.activities[0].id).toBe('A1')
    expect(r.activities[0].name).toBe('Foundation')
  })

  it('warnings list is initialised even on a clean parse', () => {
    const r = parseCSV('ID,Name\nA1,Foo')
    expect(Array.isArray(r.warnings)).toBe(true)
  })

  it('handles an empty body (header only)', () => {
    const r = parseCSV('ID,Name,Start,End,Duration')
    expect(r.activities).toEqual([])
  })

  it('produces a non-empty projectName fallback', () => {
    const r = parseCSV('ID,Name,Start,End,Duration\nA1,Foo,2026-01-01,2026-01-02,1')
    expect(r.projectName).toBeTruthy()
  })
})

describe('scheduleImport — exportToMSProjectXML', () => {
  it('emits the XML prologue and Project root', () => {
    const xml = exportToMSProjectXML(
      [
        {
          id: 'A1', name: 'Foundation',
          startDate: '2026-01-01', endDate: '2026-01-15',
          duration: 14, percentComplete: 0,
          predecessors: [],
        },
      ],
      'TestProject',
    )
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<Project')
    expect(xml).toContain('TestProject')
  })

  it('emits at least one <Task> element per supplied activity', () => {
    const xml = exportToMSProjectXML(
      [
        {
          id: 'A1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05',
          duration: 4, percentComplete: 0, predecessors: [],
        },
        {
          id: 'A2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10',
          duration: 4, percentComplete: 0, predecessors: [],
        },
      ],
      'P',
    )
    // The exporter typically prepends a project-level summary task, so allow ≥ 2.
    const taskCount = (xml.match(/<Task>/g) ?? []).length
    expect(taskCount).toBeGreaterThanOrEqual(2)
    expect(xml).toContain('Task 1')
    expect(xml).toContain('Task 2')
  })
})
