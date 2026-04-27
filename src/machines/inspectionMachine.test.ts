import { describe, it, expect } from 'vitest'
import {
  getValidInspectionTransitions,
  getInspectionStatusConfig,
  getScoreConfig,
} from './inspectionMachine'

describe('inspectionMachine — getValidInspectionTransitions (role-gated)', () => {
  it('viewers and subcontractors get no transitions (read-only)', () => {
    expect(getValidInspectionTransitions('scheduled', 'viewer')).toEqual([])
    expect(getValidInspectionTransitions('completed', 'subcontractor')).toEqual([])
  })

  it('field roles can start + complete inspections', () => {
    expect(getValidInspectionTransitions('scheduled', 'foreman')).toEqual(
      expect.arrayContaining(['in_progress']),
    )
    expect(getValidInspectionTransitions('in_progress', 'superintendent')).toEqual(
      expect.arrayContaining(['completed']),
    )
  })

  it('PM/admin/owner can approve or reject completed inspections', () => {
    const r = getValidInspectionTransitions('completed', 'project_manager')
    expect(r).toEqual(expect.arrayContaining(['approved', 'rejected']))
  })

  it('field roles cannot approve a completed inspection', () => {
    const r = getValidInspectionTransitions('completed', 'foreman')
    expect(r).not.toContain('approved')
  })

  it('PM can cancel scheduled / in_progress / rejected inspections', () => {
    expect(getValidInspectionTransitions('scheduled', 'admin')).toContain('cancelled')
    expect(getValidInspectionTransitions('in_progress', 'admin')).toContain('cancelled')
    expect(getValidInspectionTransitions('rejected', 'admin')).toContain('cancelled')
  })

  it('rejected inspections can be re-scheduled', () => {
    expect(getValidInspectionTransitions('rejected', 'foreman')).toContain('scheduled')
  })

  it('approved inspections are terminal', () => {
    expect(getValidInspectionTransitions('approved', 'admin')).toEqual([])
  })

  it('cancelled inspections are terminal', () => {
    expect(getValidInspectionTransitions('cancelled', 'admin')).toEqual([])
  })
})

describe('inspectionMachine — getInspectionStatusConfig', () => {
  it.each([
    ['scheduled', 'Scheduled'],
    ['in_progress', 'In Progress'],
    ['completed', 'Completed'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['cancelled', 'Cancelled'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getInspectionStatusConfig(status).label).toBe(label)
  })

  it('falls back to scheduled for unknown status', () => {
    // @ts-expect-error — exercising fallback
    expect(getInspectionStatusConfig('mystery').label).toBe('Scheduled')
  })
})

describe('inspectionMachine — getScoreConfig', () => {
  it('null → "Not scored"', () => {
    expect(getScoreConfig(null).label).toBe('Not scored')
  })

  it('≥90 → Pass', () => {
    expect(getScoreConfig(95).label).toMatch(/Pass/)
    expect(getScoreConfig(90).label).toMatch(/Pass/)
  })

  it('70-89 → Marginal', () => {
    expect(getScoreConfig(89).label).toMatch(/Marginal/)
    expect(getScoreConfig(70).label).toMatch(/Marginal/)
  })

  it('<70 → Fail', () => {
    expect(getScoreConfig(69).label).toMatch(/Fail/)
    expect(getScoreConfig(0).label).toMatch(/Fail/)
  })

  it('label includes the score percentage', () => {
    expect(getScoreConfig(85).label).toBe('85% Marginal')
    expect(getScoreConfig(50).label).toBe('50% Fail')
  })
})
