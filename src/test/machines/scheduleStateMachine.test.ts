import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  scheduleStateMachine,
  getValidTaskTransitions,
  getTaskStatusConfig,
  getNextTaskStatus,
  type TaskLifecycleStatus,
} from '../../machines/scheduleStateMachine';

// ── XState actor tests ────────────────────────────────────────────────────────

describe('scheduleStateMachine — XState actor', () => {
  it('starts in planned state', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('planned');
    actor.stop();
  });

  it('planned → in_progress → completed → approved (happy path)', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();

    actor.send({ type: 'START' });
    expect(actor.getSnapshot().value).toBe('in_progress');

    actor.send({ type: 'COMPLETE' });
    expect(actor.getSnapshot().value).toBe('completed');

    actor.send({ type: 'APPROVE', approverId: 'pm-1' });
    expect(actor.getSnapshot().value).toBe('approved');

    actor.stop();
  });

  it('completed can be reopened to in_progress without approving', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();

    actor.send({ type: 'START' });
    actor.send({ type: 'COMPLETE' });
    actor.send({ type: 'REOPEN', userId: 'pm-1' });

    expect(actor.getSnapshot().value).toBe('in_progress');
    actor.stop();
  });

  it('approved → in_progress (reopen from approved)', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();

    actor.send({ type: 'START' });
    actor.send({ type: 'COMPLETE' });
    actor.send({ type: 'APPROVE', approverId: 'admin-1' });
    actor.send({ type: 'REOPEN', userId: 'admin-1' });

    expect(actor.getSnapshot().value).toBe('in_progress');
    actor.stop();
  });

  it('ignores invalid transitions (planned ignores COMPLETE)', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();

    actor.send({ type: 'COMPLETE' });
    // Should remain in planned — invalid event is a no-op
    expect(actor.getSnapshot().value).toBe('planned');
    actor.stop();
  });

  it('in_progress ignores APPROVE without completing first', () => {
    const actor = createActor(scheduleStateMachine);
    actor.start();

    actor.send({ type: 'START' });
    actor.send({ type: 'APPROVE', approverId: 'pm-1' });

    expect(actor.getSnapshot().value).toBe('in_progress');
    actor.stop();
  });
});

// ── getValidTaskTransitions — role-gated logic ────────────────────────────────

describe('getValidTaskTransitions', () => {
  const allStatuses: TaskLifecycleStatus[] = ['planned', 'in_progress', 'completed', 'approved'];

  it('viewer gets no transitions from any state', () => {
    for (const s of allStatuses) {
      expect(getValidTaskTransitions(s, 'viewer')).toEqual([]);
    }
  });

  it('subcontractor gets no transitions from any state', () => {
    for (const s of allStatuses) {
      expect(getValidTaskTransitions(s, 'subcontractor')).toEqual([]);
    }
  });

  it('no-role default gets no transitions', () => {
    expect(getValidTaskTransitions('planned')).toEqual([]);
  });

  it('superintendent can start a planned task', () => {
    expect(getValidTaskTransitions('planned', 'superintendent')).toContain('in_progress');
  });

  it('superintendent can complete an in_progress task', () => {
    expect(getValidTaskTransitions('in_progress', 'superintendent')).toContain('completed');
  });

  it('superintendent cannot approve a completed task', () => {
    const transitions = getValidTaskTransitions('completed', 'superintendent');
    expect(transitions).not.toContain('approved');
    expect(transitions).not.toContain('in_progress');
  });

  it('project_manager can approve a completed task', () => {
    expect(getValidTaskTransitions('completed', 'project_manager')).toContain('approved');
  });

  it('project_manager can reopen a completed task', () => {
    expect(getValidTaskTransitions('completed', 'project_manager')).toContain('in_progress');
  });

  it('project_manager cannot reopen an approved task', () => {
    expect(getValidTaskTransitions('approved', 'project_manager')).not.toContain('in_progress');
  });

  it('admin can reopen an approved task', () => {
    expect(getValidTaskTransitions('approved', 'admin')).toContain('in_progress');
  });

  it('owner can reopen an approved task', () => {
    expect(getValidTaskTransitions('approved', 'owner')).toContain('in_progress');
  });

  it('planned only allows in_progress for all edit roles', () => {
    for (const role of ['superintendent', 'project_manager', 'admin', 'owner']) {
      const transitions = getValidTaskTransitions('planned', role);
      expect(transitions).toEqual(['in_progress']);
    }
  });

  it('in_progress only allows completed for all edit roles', () => {
    for (const role of ['superintendent', 'project_manager', 'admin', 'owner']) {
      const transitions = getValidTaskTransitions('in_progress', role);
      expect(transitions).toEqual(['completed']);
    }
  });
});

// ── getTaskStatusConfig ────────────────────────────────────────────────────────

describe('getTaskStatusConfig', () => {
  it('all statuses have non-empty label, color, and bg', () => {
    const statuses: TaskLifecycleStatus[] = ['planned', 'in_progress', 'completed', 'approved'];
    for (const s of statuses) {
      const cfg = getTaskStatusConfig(s);
      expect(cfg.label).toBeTruthy();
      expect(cfg.color).toMatch(/^var\(/);
      expect(cfg.bg).toMatch(/^var\(/);
    }
  });

  it('planned has Planned label', () => {
    expect(getTaskStatusConfig('planned').label).toBe('Planned');
  });

  it('approved has Approved label', () => {
    expect(getTaskStatusConfig('approved').label).toBe('Approved');
  });

  it('in_progress has In Progress label', () => {
    expect(getTaskStatusConfig('in_progress').label).toBe('In Progress');
  });

  it('completed has Completed label', () => {
    expect(getTaskStatusConfig('completed').label).toBe('Completed');
  });
});

// ── getNextTaskStatus ─────────────────────────────────────────────────────────

describe('getNextTaskStatus', () => {
  it('START from planned returns in_progress', () => {
    expect(getNextTaskStatus('planned', 'START')).toBe('in_progress');
  });

  it('COMPLETE from in_progress returns completed', () => {
    expect(getNextTaskStatus('in_progress', 'COMPLETE')).toBe('completed');
  });

  it('APPROVE from completed returns approved', () => {
    expect(getNextTaskStatus('completed', 'APPROVE')).toBe('approved');
  });

  it('REOPEN from completed returns in_progress', () => {
    expect(getNextTaskStatus('completed', 'REOPEN')).toBe('in_progress');
  });

  it('REOPEN from approved returns in_progress', () => {
    expect(getNextTaskStatus('approved', 'REOPEN')).toBe('in_progress');
  });

  it('returns null for invalid transitions', () => {
    expect(getNextTaskStatus('planned', 'COMPLETE')).toBeNull();
    expect(getNextTaskStatus('planned', 'APPROVE')).toBeNull();
    expect(getNextTaskStatus('in_progress', 'APPROVE')).toBeNull();
    expect(getNextTaskStatus('approved', 'COMPLETE')).toBeNull();
  });
});
