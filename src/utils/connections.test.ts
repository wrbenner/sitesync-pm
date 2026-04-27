import { describe, it, expect } from 'vitest'
import {
  getRelatedItemsForRfi,
  getRelatedItemsForTask,
  getRelatedItemsForSubmittal,
  getRelatedItemsForChangeOrder,
  getRelatedItemsForPunchItem,
  type ConnectionData,
} from './connections'

// connections.ts is a deep cross-linker that resolves "what else is related
// to this entity?" across RFIs, tasks, submittals, change orders, etc.
// All resolvers are pure — no side effects, no I/O — so they're prime
// regression targets.

describe('connections — getRelatedItemsForRfi', () => {
  it('returns [] when the RFI is not in the dataset', () => {
    expect(getRelatedItemsForRfi(999, {})).toEqual([])
    expect(getRelatedItemsForRfi(999, { rfis: [] })).toEqual([])
  })

  it('finds tasks linked via linkedItems[type=rfi]', () => {
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Steel beam', status: 'open', from: 'GC', to: 'AE' }],
      tasks: [
        {
          id: 10, title: 'Investigate beam', status: 'in_progress', tags: [], description: '',
          assignee: { name: 'Mike', company: 'Acme' },
          linkedItems: [{ type: 'rfi', id: 'RFI-001' }],
        },
      ],
    }
    const r = getRelatedItemsForRfi(1, data)
    const taskItem = r.find((i) => i.entityType === 'task')
    expect(taskItem).toBeDefined()
    expect(taskItem?.id).toBe(10)
    expect(taskItem?.label).toBe('Investigate beam')
  })

  it('finds the matching schedule phase via keyword matching', () => {
    // 'concrete' is a Structure-phase keyword
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Concrete pour clearance', status: 'open', from: 'GC', to: 'AE' }],
      schedulePhases: [
        { id: 100, name: 'Structure', progress: 60 },
        { id: 200, name: 'Finishes', progress: 0 },
      ],
    }
    const r = getRelatedItemsForRfi(1, data)
    const phase = r.find((i) => i.entityType === 'schedule_phase')
    expect(phase?.id).toBe(100)
    expect(phase?.label).toContain('Structure')
  })

  it('matches CO when both RFI and CO share a division-keyword domain', () => {
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Structural steel question', status: 'open', from: 'GC', to: 'AE' }],
      costData: {
        divisions: [],
        changeOrders: [{ id: 50, coNumber: 'CO-005', title: 'Steel reinforcement', amount: 25_000, status: 'approved' }],
      },
    }
    const r = getRelatedItemsForRfi(1, data)
    expect(r.find((i) => i.entityType === 'change_order')?.id).toBe(50)
  })

  it('does NOT match COs from different keyword domains', () => {
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Structural steel question', status: 'open', from: 'GC', to: 'AE' }],
      costData: {
        divisions: [],
        changeOrders: [{ id: 50, coNumber: 'CO-005', title: 'Paint touch-up', amount: 1000, status: 'approved' }],
      },
    }
    const r = getRelatedItemsForRfi(1, data)
    expect(r.find((i) => i.entityType === 'change_order')).toBeUndefined()
  })

  it('resolves "from" + "to" people from the directory', () => {
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Q', status: 'open', from: 'AcmeCo', to: 'PMRole' }],
      directory: [
        { id: 5, contactName: 'Alice', company: 'AcmeCo', role: 'Foreman' },
        { id: 6, contactName: 'Bob',   company: 'OtherCo', role: 'PMRole' },
      ],
    }
    const r = getRelatedItemsForRfi(1, data)
    const people = r.filter((i) => i.entityType === 'person')
    expect(people.map((p) => p.id).sort()).toEqual([5, 6])
  })

  it('does not duplicate a person when from + to resolve to the same record', () => {
    const data: ConnectionData = {
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Q', status: 'open', from: 'AcmeCo', to: 'AcmeCo' }],
      directory: [{ id: 5, contactName: 'Alice', company: 'AcmeCo', role: 'PM' }],
    }
    const r = getRelatedItemsForRfi(1, data)
    const people = r.filter((i) => i.entityType === 'person')
    expect(people).toHaveLength(1)
  })
})

describe('connections — getRelatedItemsForTask', () => {
  it('returns [] when the task is not found', () => {
    expect(getRelatedItemsForTask(999, {})).toEqual([])
  })

  it('resolves linkedItems[type=rfi/submittal] to their full records', () => {
    const data: ConnectionData = {
      tasks: [
        {
          id: 1, title: 't', status: 'open', tags: [], description: '',
          assignee: { name: 'M', company: 'C' },
          linkedItems: [
            { type: 'rfi', id: 'RFI-007' },
            { type: 'submittal', id: 'SUB-009' },
          ],
        },
      ],
      rfis: [{ id: 100, rfiNumber: 'RFI-007', title: 'rfi', status: 'open', from: '', to: '' }],
      submittals: [{ id: 200, submittalNumber: 'SUB-009', title: 'sub', status: 'pending', from: '' }],
    }
    const r = getRelatedItemsForTask(1, data)
    expect(r.find((i) => i.entityType === 'rfi')?.id).toBe(100)
    expect(r.find((i) => i.entityType === 'submittal')?.id).toBe(200)
  })

  it('matches a crew when crew name/task overlaps with a task tag', () => {
    const data: ConnectionData = {
      tasks: [
        {
          id: 1, title: 'Pour foundation', status: 'open',
          tags: ['concrete'], description: '',
          assignee: { name: 'M', company: 'C' },
          linkedItems: [],
        },
      ],
      crews: [{ id: 9, name: 'Foundation Crew', task: 'concrete pour' }],
    }
    const r = getRelatedItemsForTask(1, data)
    expect(r.find((i) => i.entityType === 'crew')?.id).toBe(9)
  })

  it('finds the assignee in the directory by company match', () => {
    const data: ConnectionData = {
      tasks: [
        {
          id: 1, title: 't', status: 'open', tags: [], description: '',
          assignee: { name: 'Mike', company: 'AcmeCo' },
          linkedItems: [],
        },
      ],
      directory: [{ id: 5, contactName: 'Mike', company: 'AcmeCo', role: 'Foreman' }],
    }
    const r = getRelatedItemsForTask(1, data)
    expect(r.find((i) => i.entityType === 'person')?.id).toBe(5)
  })
})

describe('connections — getRelatedItemsForSubmittal', () => {
  it('returns [] for unknown submittal id', () => {
    expect(getRelatedItemsForSubmittal(999, {})).toEqual([])
  })

  it('resolves matching phase by keyword', () => {
    const data: ConnectionData = {
      submittals: [
        { id: 1, submittalNumber: 'SUB-001', title: 'Door hardware', status: 'pending', from: '' },
      ],
      schedulePhases: [{ id: 200, name: 'Interior', progress: 30 }],
    }
    const r = getRelatedItemsForSubmittal(1, data)
    expect(r.find((i) => i.entityType === 'schedule_phase')?.id).toBe(200)
  })

  it('finds tasks that link back via linkedItems[type=submittal]', () => {
    const data: ConnectionData = {
      submittals: [{ id: 1, submittalNumber: 'SUB-001', title: 't', status: 'pending', from: '' }],
      tasks: [
        {
          id: 50, title: 'Review SUB-001', status: 'open', tags: [], description: '',
          assignee: { name: 'M', company: 'C' },
          linkedItems: [{ type: 'submittal', id: 'SUB-001' }],
        },
      ],
    }
    const r = getRelatedItemsForSubmittal(1, data)
    expect(r.find((i) => i.entityType === 'task')?.id).toBe(50)
  })
})

describe('connections — getRelatedItemsForChangeOrder', () => {
  it('returns [] when CO is not in the cost data', () => {
    expect(getRelatedItemsForChangeOrder(999, {})).toEqual([])
    expect(
      getRelatedItemsForChangeOrder(999, {
        costData: { divisions: [], changeOrders: [] },
      }),
    ).toEqual([])
  })

  it('matches RFIs that share a division keyword', () => {
    const data: ConnectionData = {
      costData: {
        divisions: [],
        changeOrders: [{ id: 1, coNumber: 'CO-1', title: 'Electrical panel upgrade', amount: 5000, status: 'approved' }],
      },
      rfis: [{ id: 100, rfiNumber: 'RFI-1', title: 'Conduit routing', status: 'open', from: '', to: '' }],
    }
    const r = getRelatedItemsForChangeOrder(1, data)
    expect(r.find((i) => i.entityType === 'rfi')?.id).toBe(100)
  })
})

describe('connections — getRelatedItemsForPunchItem', () => {
  it('returns [] for unknown punch id', () => {
    expect(getRelatedItemsForPunchItem(999, {})).toEqual([])
  })

  it('matches schedule phase from description keywords', () => {
    const data: ConnectionData = {
      punchList: [{ id: 1, itemNumber: 'PI-1', description: 'Touch up paint', area: 'Lobby', status: 'open', assigned: '' }],
      schedulePhases: [{ id: 99, name: 'Finishes', progress: 80 }],
    }
    const r = getRelatedItemsForPunchItem(1, data)
    expect(r.find((i) => i.entityType === 'schedule_phase')?.id).toBe(99)
  })
})
