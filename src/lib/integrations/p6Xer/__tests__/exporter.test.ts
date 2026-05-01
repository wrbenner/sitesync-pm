import { describe, it, expect } from 'vitest';
import { parseXer } from '../parser';
import { exportXer } from '../exporter';
import type { P6Schedule } from '../../../../types/integrations';

const SAMPLE: P6Schedule = {
  project: {
    id: 'P9',
    name: 'Demo',
    plannedStart: '2026-01-01',
    plannedFinish: '2026-12-31',
    dataDate: '2026-04-01',
  },
  tasks: [
    {
      id: 'T1',
      code: '1000',
      name: 'Foundation',
      type: 'TT_Task',
      durationDays: 5,
      percentComplete: 25,
      legacy_constraints: {},
    },
  ],
  predecessors: [{ taskId: 'T2', predecessorId: 'T1', type: 'FS', lagDays: 2 }],
  calendars: [{ id: 'C1', name: 'Standard' }],
  resources: [{ id: 'R1', name: 'Crew', type: 'labor', rate: 50 }],
  assignments: [{ taskId: 'T1', resourceId: 'R1', units: 8 }],
};

describe('exportXer', () => {
  it('round-trips through parseXer', () => {
    const xer = exportXer(SAMPLE);
    const parsed = parseXer(xer);
    expect(parsed.error).toBeNull();
    expect(parsed.data?.project.id).toBe('P9');
    expect(parsed.data?.tasks[0].durationDays).toBe(5);
    expect(parsed.data?.predecessors[0].lagDays).toBe(2);
    expect(parsed.data?.resources[0].type).toBe('labor');
  });
});
