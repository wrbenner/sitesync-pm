import { describe, it, expect } from 'vitest';
import { exportToXER, exportToCSV } from './scheduleExport';
import type { ImportedActivity } from './scheduleImport';

function activity(over: Partial<ImportedActivity> = {}): ImportedActivity {
  return {
    id: 'A1',
    name: 'Activity 1',
    wbs: 'Foundation',
    startDate: '2026-01-01',
    endDate: '2026-01-15',
    duration: 14,
    percentComplete: 50,
    predecessors: [],
    resources: [],
    isCritical: false,
    isMilestone: false,
    ...over,
  };
}

// ── exportToXER ────────────────────────────────────────────────

describe('exportToXER', () => {
  it('produces a non-empty XER string with project header', () => {
    const xer = exportToXER([activity()], 'My Project');
    expect(xer).toContain('ERMHDR');
    expect(xer).toContain('My Project');
  });

  it('includes a PROJECT table', () => {
    expect(exportToXER([activity()], 'P')).toContain('%T\tPROJECT');
  });

  it('includes one TASK row per activity', () => {
    const xer = exportToXER([activity({ id: 'A1' }), activity({ id: 'A2' })], 'P');
    const taskBlock = xer.split('%T\tTASK')[1];
    expect(taskBlock).toContain('A1');
    expect(taskBlock).toContain('A2');
  });

  it('emits TASKPRED rows when predecessors exist', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1' }),
        activity({
          id: 'A2',
          predecessors: [{ activityId: 'A1', type: 'FS', lag: 1 }],
        }),
      ],
      'P',
    );
    expect(xer).toContain('TASKPRED');
    expect(xer).toContain('PR_FS');
  });

  it('omits TASKPRED block when no predecessors', () => {
    const xer = exportToXER([activity({ id: 'A1' })], 'P');
    expect(xer).not.toContain('TASKPRED');
  });

  it('uses TT_Mile for milestones', () => {
    const xer = exportToXER([activity({ isMilestone: true })], 'P');
    expect(xer).toContain('TT_Mile');
  });

  it('uses TT_Task for non-milestones', () => {
    const xer = exportToXER([activity({ isMilestone: false })], 'P');
    expect(xer).toContain('TT_Task');
  });

  it('maps SS/FF/SF dependency types', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1' }),
        activity({
          id: 'A2',
          predecessors: [
            { activityId: 'A1', type: 'SS', lag: 0 },
            { activityId: 'A1', type: 'FF', lag: 0 },
            { activityId: 'A1', type: 'SF', lag: 0 },
          ],
        }),
      ],
      'P',
    );
    expect(xer).toContain('PR_SS');
    expect(xer).toContain('PR_FF');
    expect(xer).toContain('PR_SF');
  });

  it('groups WBS codes uniquely', () => {
    const xer = exportToXER(
      [
        activity({ id: 'A1', wbs: 'Foundation' }),
        activity({ id: 'A2', wbs: 'Foundation' }),
        activity({ id: 'A3', wbs: 'Structure' }),
      ],
      'P',
    );
    const wbsBlock = xer.split('%T\tPROJWBS')[1].split('%E')[0];
    expect((wbsBlock.match(/Foundation/g) || []).length).toBe(2); // short_name + name
    expect(wbsBlock).toContain('Structure');
  });

  it('falls back to "General" WBS when not provided', () => {
    const xer = exportToXER([activity({ wbs: undefined })], 'P');
    expect(xer).toContain('General');
  });
});

// ── exportToCSV ────────────────────────────────────────────────

describe('exportToCSV', () => {
  it('produces a CSV with headers', () => {
    const csv = exportToCSV([]);
    expect(csv.split('\r\n')[0]).toContain('ID');
    expect(csv.split('\r\n')[0]).toContain('Predecessors');
  });

  it('escapes fields containing commas', () => {
    const csv = exportToCSV([activity({ name: 'Task, with comma' })]);
    expect(csv).toContain('"Task, with comma"');
  });

  it('escapes embedded double-quotes', () => {
    const csv = exportToCSV([activity({ name: 'Task "quoted"' })]);
    expect(csv).toContain('"Task ""quoted"""');
  });

  it('formats predecessors with type and lag', () => {
    const csv = exportToCSV([
      activity({
        predecessors: [
          { activityId: 'A1', type: 'FS', lag: 0 },
          { activityId: 'A2', type: 'SS', lag: 3 },
          { activityId: 'A3', type: 'FF', lag: -2 },
        ],
      }),
    ]);
    // FS with 0 lag → just the ID
    expect(csv).toContain('A1, A2SS+3d, A3FF-2d');
  });

  it('includes Yes/No for milestone and critical', () => {
    const csv = exportToCSV([
      activity({ isMilestone: true, isCritical: true }),
    ]);
    expect(csv).toContain('Yes');
  });

  it('emits empty string for undefined floats', () => {
    const csv = exportToCSV([activity({ totalFloat: undefined, freeFloat: undefined })]);
    expect(csv.split('\r\n')[1]).toMatch(/,,$/);
  });

  it('joins resources with comma', () => {
    const csv = exportToCSV([activity({ resources: ['Crew A', 'Crew B'] })]);
    expect(csv).toContain('"Crew A, Crew B"');
  });
});

// downloadFile is exercised via integration testing — JSDOM does not
// implement URL.createObjectURL, and stubbing it would test the stub
// rather than the function. Skipping in this unit-test layer.
