import { describe, it, expect } from 'vitest';
import { parseXer } from '../parser';

const PROJECT_HEADER = '%T\tPROJECT\n%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date\tlast_recalc_date';

function build(project: string, ...tables: string[]): string {
  return ['ERMHDR\t8.0', PROJECT_HEADER, '%R\t' + project, ...tables, '%E'].join('\n');
}

describe('parseXer', () => {
  it('parses project + tasks', () => {
    const xer = build(
      'P1\tHHQ\t2026-01-01\t2026-12-31\t2026-04-01',
      '%T\tTASK',
      '%F\ttask_id\ttask_code\ttask_name\ttask_type\ttarget_drtn_hr_cnt\tphys_complete_pct\tcstr_type\tcstr_date',
      '%R\tT1\t1000\tFoundation\tTT_Task\t40\t25\tCS_MSO\t2026-02-15',
    );
    const result = parseXer(xer);
    expect(result.error).toBeNull();
    expect(result.data?.project.id).toBe('P1');
    expect(result.data?.tasks.length).toBe(1);
    expect(result.data?.tasks[0].name).toBe('Foundation');
    expect(result.data?.tasks[0].durationDays).toBe(5);
    expect(result.data?.tasks[0].percentComplete).toBe(25);
  });

  it('preserves unsupported constraints in legacy_constraints', () => {
    const xer = build(
      'P1\tHHQ\t2026-01-01\t2026-12-31\t2026-04-01',
      '%T\tTASK',
      '%F\ttask_id\ttask_code\ttask_name\ttask_type\ttarget_drtn_hr_cnt\tphys_complete_pct\tcstr_type\tcstr_date',
      '%R\tT1\t1000\tFoundation\tTT_Task\t40\t25\tCS_MSO\t2026-02-15',
    );
    const result = parseXer(xer);
    expect(result.data?.tasks[0].legacy_constraints.cstr_type).toBe('CS_MSO');
    expect(result.data?.tasks[0].legacy_constraints.cstr_date).toBe('2026-02-15');
  });

  it('parses TASKPRED with FS default and lag', () => {
    const xer = build(
      'P1\tHHQ\t\t\t',
      '%T\tTASKPRED',
      '%F\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt',
      '%R\tT2\tT1\tPR_FS\t16',
      '%R\tT3\tT2\tPR_SS\t0',
      '%R\tT4\tT3\tBOGUS\t0',
    );
    const result = parseXer(xer);
    expect(result.data?.predecessors[0].type).toBe('FS');
    expect(result.data?.predecessors[0].lagDays).toBe(2);
    expect(result.data?.predecessors[1].type).toBe('SS');
    expect(result.data?.predecessors[2].type).toBe('FS'); // fallback
  });

  it('parses calendars and resources', () => {
    const xer = build(
      'P1\tHHQ\t\t\t',
      '%T\tCALENDAR',
      '%F\tclndr_id\tclndr_name\tclndr_type',
      '%R\tC1\tStandard\tCA_Base',
      '%T\tRSRC',
      '%F\trsrc_id\trsrc_name\trsrc_type\tcost_per_qty',
      '%R\tR1\tIronworker\tRT_Labor\t75.50',
      '%R\tR2\tCrane\tRT_Equip\t',
    );
    const result = parseXer(xer);
    expect(result.data?.calendars.length).toBe(1);
    expect(result.data?.resources[0].type).toBe('labor');
    expect(result.data?.resources[0].rate).toBe(75.5);
    expect(result.data?.resources[1].type).toBe('other');
  });

  it('parses TASKRSRC assignments', () => {
    const xer = build(
      'P1\tHHQ\t\t\t',
      '%T\tTASKRSRC',
      '%F\ttask_id\trsrc_id\ttarget_qty',
      '%R\tT1\tR1\t8',
    );
    const result = parseXer(xer);
    expect(result.data?.assignments.length).toBe(1);
    expect(result.data?.assignments[0].units).toBe(8);
  });

  it('returns validation error when PROJECT table is missing', () => {
    const result = parseXer('ERMHDR\t8.0\n%E');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('returns validation error on empty content', () => {
    const result = parseXer('');
    expect(result.error?.category).toBe('ValidationError');
  });
});
