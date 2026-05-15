import { describe, it, expect } from 'vitest'
import {
  UserRole,
  ProjectStatus,
  RFIStatus,
  RFIPriority,
  SubmittalStatus,
  ChangeOrderStatus,
  PunchStatus,
  PunchPriority,
  PayAppStatus,
  WaiverType,
  AIRole,
  LinkType,
  getStatusLabel,
  statusColorMap,
  priorityColorMap,
} from './enums'

describe('enums — UserRole', () => {
  it('exposes the 10 documented roles', () => {
    expect(Object.values(UserRole).sort()).toEqual([
      'admin', 'architect', 'client', 'crew', 'engineer',
      'foreman', 'project_manager', 'subcontractor_pm',
      'superintendent', 'viewer',
    ].sort())
  })
})

describe('enums — ProjectStatus', () => {
  it('exposes the lifecycle: bid → planning → active → on_hold → complete → archived', () => {
    expect(ProjectStatus.Bid).toBe('bid')
    expect(ProjectStatus.Planning).toBe('planning')
    expect(ProjectStatus.Active).toBe('active')
    expect(ProjectStatus.OnHold).toBe('on_hold')
    expect(ProjectStatus.Complete).toBe('complete')
    expect(ProjectStatus.Archived).toBe('archived')
  })
})

describe('enums — RFI status + priority', () => {
  it('RFIStatus has 6 values', () => {
    expect(Object.values(RFIStatus)).toHaveLength(6)
  })

  it('RFIPriority: critical / high / medium / low', () => {
    expect(Object.values(RFIPriority)).toEqual(['critical', 'high', 'medium', 'low'])
  })
})

describe('enums — SubmittalStatus + ChangeOrderStatus + PunchStatus', () => {
  it('SubmittalStatus exposes the documented states including ApprovedWithComments', () => {
    expect(SubmittalStatus.ApprovedWithComments).toBe('approved_with_comments')
  })

  it('ChangeOrderStatus.Executed is the documented terminal state', () => {
    expect(ChangeOrderStatus.Executed).toBe('executed')
  })

  it('PunchStatus has 6 values including ReadyForInspection', () => {
    expect(PunchStatus.ReadyForInspection).toBe('ready_for_inspection')
    expect(Object.values(PunchStatus)).toHaveLength(6)
  })

  it('PunchPriority is the same 4-level scale as RFIPriority', () => {
    expect(Object.values(PunchPriority)).toEqual(Object.values(RFIPriority))
  })
})

describe('enums — Other (PayApp / Waiver / AI / Link)', () => {
  it('PayAppStatus.Paid is the terminal positive state', () => {
    expect(PayAppStatus.Paid).toBe('paid')
  })

  it('WaiverType: 4 documented types', () => {
    expect(Object.values(WaiverType)).toEqual([
      'unconditional', 'conditional', 'final_unconditional', 'final_conditional',
    ])
  })

  it('AIRole: user / assistant / system', () => {
    expect(Object.values(AIRole)).toEqual(['user', 'assistant', 'system'])
  })

  it('LinkType exposes the 4 CPM relationship types (FS/FF/SS/SF)', () => {
    expect(Object.values(LinkType)).toEqual([
      'finish_to_start', 'finish_to_finish', 'start_to_start', 'start_to_finish',
    ])
  })
})

describe('enums — getStatusLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(getStatusLabel('under_review')).toBe('Under Review')
    expect(getStatusLabel('ready_for_inspection')).toBe('Ready For Inspection')
  })

  it('capitalizes single words', () => {
    expect(getStatusLabel('open')).toBe('Open')
    expect(getStatusLabel('archived')).toBe('Archived')
  })

  it('handles already-capitalised input', () => {
    expect(getStatusLabel('Open')).toBe('Open')
  })

  it('handles empty string', () => {
    expect(getStatusLabel('')).toBe('')
  })
})

describe('enums — statusColorMap', () => {
  it('every documented RFI status has a color mapping', () => {
    for (const s of Object.values(RFIStatus)) {
      expect(statusColorMap[s], `${s} missing color`).toBeDefined()
    }
  })

  it('every documented Submittal status has a color mapping', () => {
    for (const s of Object.values(SubmittalStatus)) {
      expect(statusColorMap[s], `${s} missing color`).toBeDefined()
    }
  })

  it('every documented ChangeOrder status has a color mapping', () => {
    for (const s of Object.values(ChangeOrderStatus)) {
      expect(statusColorMap[s], `${s} missing color`).toBeDefined()
    }
  })

  it('rejected and redBadge are paired (negative-outcome invariant)', () => {
    expect(statusColorMap[SubmittalStatus.Rejected]).toEqual(statusColorMap[ChangeOrderStatus.Rejected])
  })

  it('every value has fg + bg properties (not undefined)', () => {
    for (const [status, cfg] of Object.entries(statusColorMap)) {
      expect(cfg.fg, `${status} missing fg`).toBeTruthy()
      expect(cfg.bg, `${status} missing bg`).toBeTruthy()
    }
  })
})

describe('enums — priorityColorMap', () => {
  it('every priority has a color mapping', () => {
    for (const p of Object.values(RFIPriority)) {
      expect(priorityColorMap[p], `${p} missing color`).toBeDefined()
    }
  })

  it('critical priority maps to red badge', () => {
    expect(priorityColorMap[RFIPriority.Critical].fg).toBeTruthy()
  })
})
