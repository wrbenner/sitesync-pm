import { describe, it, expect } from 'vitest';
import {
  getRelatedItemsForRfi,
  getRelatedItemsForTask,
  getRelatedItemsForSubmittal,
  getRelatedItemsForChangeOrder,
  getRelatedItemsForPunchItem,
  getRelatedItemsForInsight,
  getTasksForCrew,
  getPersonDetails,
  type ConnectionData,
  type TaskData,
  type RfiData,
  type SubmittalData,
  type SchedulePhaseData,
  type PunchItemData,
  type CrewData,
  type DirectoryData,
  type CostDataShape,
} from './connections';

// ── Fixtures ────────────────────────────────────────────────────

const directory: DirectoryData[] = [
  { id: 1, contactName: 'Alice Owner', company: 'Owner Corp', role: 'Owner' },
  { id: 2, contactName: 'Bob Sub', company: 'SubCo', role: 'Architect' },
  { id: 3, contactName: 'Carol Frame', company: 'Framing Inc', role: 'Subcontractor' },
];

const tasks: TaskData[] = [
  {
    id: 1,
    title: 'Steel erection on floor 7',
    status: 'in_progress',
    tags: ['structural', 'steel'],
    description: '',
    assignee: { name: 'Bob', company: 'SubCo' },
    linkedItems: [
      { type: 'rfi', id: 'RFI-001' },
      { type: 'submittal', id: 'SUB-001' },
    ],
  },
  {
    id: 2,
    title: 'Drywall finish lobby',
    status: 'done',
    tags: ['interior', 'drywall'],
    description: '',
    assignee: { name: 'Carol', company: 'Framing Inc' },
    linkedItems: [],
  },
];

const rfis: RfiData[] = [
  {
    id: 1,
    rfiNumber: 'RFI-001',
    title: 'Structural connection at curtain wall',
    status: 'open',
    from: 'Owner Corp',
    to: 'SubCo',
  },
  {
    id: 2,
    rfiNumber: 'RFI-002',
    title: 'Generic question',
    status: 'closed',
    from: 'X',
    to: 'Y',
  },
];

const submittals: SubmittalData[] = [
  {
    id: 1,
    submittalNumber: 'SUB-001',
    title: 'Steel shop drawings',
    status: 'submitted',
    from: 'SubCo',
  },
];

const schedulePhases: SchedulePhaseData[] = [
  { id: 1, name: 'Structure', progress: 50 },
  { id: 2, name: 'Interior', progress: 20 },
];

const costData: CostDataShape = {
  divisions: [
    { id: 1, name: 'Structural', budget: 500_000, spent: 200_000, committed: 300_000 },
    { id: 2, name: 'Mechanical', budget: 200_000, spent: 50_000, committed: 100_000 },
  ],
  changeOrders: [
    { id: 1, coNumber: 'CO-001', title: 'Additional structural bracing', amount: 125_000, status: 'approved' },
    { id: 2, coNumber: 'CO-002', title: 'HVAC scope add', amount: 50_000, status: 'submitted' },
  ],
};

const punchList: PunchItemData[] = [
  {
    id: 1,
    itemNumber: 'P-001',
    description: 'Touch up paint in lobby',
    area: 'Interior',
    status: 'open',
    assigned: 'John Smith',
  },
];

const crews: CrewData[] = [
  { id: 1, name: 'Steel Crew', task: 'Structural steel erection' },
  { id: 5, name: 'Curtain Crew', task: 'Exterior curtain wall' },
];

const fullData: ConnectionData = {
  tasks,
  rfis,
  submittals,
  schedulePhases,
  costData,
  punchList,
  crews,
  directory,
};

// ── getRelatedItemsForRfi ───────────────────────────────────────

describe('getRelatedItemsForRfi', () => {
  it('returns [] for unknown RFI id', () => {
    expect(getRelatedItemsForRfi(9999, fullData)).toEqual([]);
  });

  it('returns [] when no data is supplied', () => {
    expect(getRelatedItemsForRfi(1)).toEqual([]);
  });

  it('finds linked tasks via linkedItems', () => {
    const items = getRelatedItemsForRfi(1, fullData);
    expect(items.some(i => i.entityType === 'task' && i.id === 1)).toBe(true);
  });

  it('finds matching schedule phase via keywords', () => {
    const items = getRelatedItemsForRfi(1, fullData);
    expect(items.some(i => i.entityType === 'schedule_phase')).toBe(true);
  });

  it('finds change orders in matching domain', () => {
    const items = getRelatedItemsForRfi(1, fullData);
    expect(items.some(i => i.entityType === 'change_order')).toBe(true);
  });

  it('finds people via from/to fields', () => {
    const items = getRelatedItemsForRfi(1, fullData);
    expect(items.filter(i => i.entityType === 'person')).toHaveLength(2);
  });

  it('does not duplicate when from/to resolve to same person', () => {
    const items = getRelatedItemsForRfi(1, {
      ...fullData,
      rfis: [{ ...rfis[0], from: 'Owner Corp', to: 'Owner Corp' }],
    });
    expect(items.filter(i => i.entityType === 'person')).toHaveLength(1);
  });

  it('returns no related items when title has no domain keywords', () => {
    const items = getRelatedItemsForRfi(2, fullData);
    expect(items.filter(i => i.entityType === 'change_order')).toHaveLength(0);
  });
});

// ── getRelatedItemsForTask ──────────────────────────────────────

describe('getRelatedItemsForTask', () => {
  it('returns [] for unknown task', () => {
    expect(getRelatedItemsForTask(9999, fullData)).toEqual([]);
  });

  it('finds linked RFIs and submittals', () => {
    const items = getRelatedItemsForTask(1, fullData);
    expect(items.some(i => i.entityType === 'rfi')).toBe(true);
    expect(items.some(i => i.entityType === 'submittal')).toBe(true);
  });

  it('finds the matching schedule phase', () => {
    const items = getRelatedItemsForTask(1, fullData);
    expect(items.some(i => i.entityType === 'schedule_phase' && i.label.includes('Structure'))).toBe(true);
  });

  it('finds the assignee in the directory', () => {
    const items = getRelatedItemsForTask(1, fullData);
    expect(items.some(i => i.entityType === 'person' && i.label === 'Bob Sub')).toBe(true);
  });

  it('finds a matching crew via tags', () => {
    const items = getRelatedItemsForTask(1, fullData);
    expect(items.some(i => i.entityType === 'crew')).toBe(true);
  });
});

// ── getRelatedItemsForSubmittal ─────────────────────────────────

describe('getRelatedItemsForSubmittal', () => {
  it('returns [] for unknown submittal', () => {
    expect(getRelatedItemsForSubmittal(9999, fullData)).toEqual([]);
  });

  it('finds related tasks via linkedItems', () => {
    const items = getRelatedItemsForSubmittal(1, fullData);
    expect(items.some(i => i.entityType === 'task' && i.id === 1)).toBe(true);
  });

  it('finds matching schedule phase via keywords', () => {
    const items = getRelatedItemsForSubmittal(1, fullData);
    expect(items.some(i => i.entityType === 'schedule_phase')).toBe(true);
  });

  it('finds person via from company', () => {
    const items = getRelatedItemsForSubmittal(1, fullData);
    // SubCo is mapped to "Bob Sub"
    expect(items.some(i => i.entityType === 'person' && i.label === 'Bob Sub')).toBe(true);
  });

  it('finds matching budget division', () => {
    const items = getRelatedItemsForSubmittal(1, fullData);
    expect(items.some(i => i.label.includes('Structural Division'))).toBe(true);
  });
});

// ── getRelatedItemsForChangeOrder ───────────────────────────────

describe('getRelatedItemsForChangeOrder', () => {
  it('returns [] for unknown CO', () => {
    expect(getRelatedItemsForChangeOrder(9999, fullData)).toEqual([]);
  });

  it('returns [] when costData missing', () => {
    expect(getRelatedItemsForChangeOrder(1, {})).toEqual([]);
  });

  it('finds matching RFI via shared division keywords', () => {
    const items = getRelatedItemsForChangeOrder(1, fullData);
    expect(items.some(i => i.entityType === 'rfi')).toBe(true);
  });

  it('finds the matching schedule phase', () => {
    const items = getRelatedItemsForChangeOrder(1, fullData);
    expect(items.some(i => i.entityType === 'schedule_phase')).toBe(true);
  });

  it('formats currency in division subtitle', () => {
    const items = getRelatedItemsForChangeOrder(1, fullData);
    const div = items.find(i => i.label.includes('Budget'));
    expect(div?.subtitle).toMatch(/\$/);
  });
});

// ── getRelatedItemsForPunchItem ─────────────────────────────────

describe('getRelatedItemsForPunchItem', () => {
  it('returns [] for unknown punch item', () => {
    expect(getRelatedItemsForPunchItem(9999, fullData)).toEqual([]);
  });

  it('finds the interior schedule phase', () => {
    const items = getRelatedItemsForPunchItem(1, fullData);
    expect(items.some(i => i.entityType === 'schedule_phase' && i.label.includes('Interior'))).toBe(true);
  });
});

// ── getRelatedItemsForInsight ───────────────────────────────────

describe('getRelatedItemsForInsight', () => {
  it('returns hard-coded steel-delay related items for insight 1', () => {
    const items = getRelatedItemsForInsight(1);
    expect(items.some(i => i.label.includes('steel'))).toBe(true);
    expect(items).toHaveLength(6);
  });

  it('returns hard-coded electrical-RFI related items for insight 2', () => {
    const items = getRelatedItemsForInsight(2);
    expect(items.length).toBe(4);
  });

  it('returns hard-coded productivity uplift items for insight 3', () => {
    const items = getRelatedItemsForInsight(3);
    expect(items.length).toBe(3);
  });

  it('returns [] for unknown insight ID', () => {
    expect(getRelatedItemsForInsight(99)).toEqual([]);
  });
});

// ── getTasksForCrew ─────────────────────────────────────────────

describe('getTasksForCrew', () => {
  it('returns [] when crew is unknown', () => {
    expect(getTasksForCrew(9999, fullData)).toEqual([]);
  });

  it('returns [] when no crews in data', () => {
    expect(getTasksForCrew(1, {})).toEqual([]);
  });

  it('returns up to 2 matching open tasks', () => {
    const result = getTasksForCrew(1, fullData);
    // Crew 1 keywords: structural/steel/erection, Task 1 matches and is in_progress
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result.every(t => t.status !== 'done')).toBe(true);
  });

  it('skips crews without keywords', () => {
    expect(getTasksForCrew(7, fullData)).toEqual([]);
  });
});

// ── getPersonDetails ────────────────────────────────────────────

describe('getPersonDetails', () => {
  it('matches by name', () => {
    expect(getPersonDetails('Alice', fullData)?.contactName).toBe('Alice Owner');
  });

  it('matches by company', () => {
    expect(getPersonDetails('Framing', fullData)?.company).toBe('Framing Inc');
  });

  it('is case-insensitive', () => {
    expect(getPersonDetails('ALICE', fullData)?.contactName).toBe('Alice Owner');
  });

  it('returns null when nothing matches', () => {
    expect(getPersonDetails('nobody', fullData)).toBeNull();
  });

  it('returns null when no directory in data', () => {
    expect(getPersonDetails('Alice', {})).toBeNull();
  });
});
