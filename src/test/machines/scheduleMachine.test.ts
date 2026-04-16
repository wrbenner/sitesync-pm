import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  scheduleMachine,
  getValidScheduleTransitions,
  getScheduleStatusConfig,
  deriveStatusFromProgress,
  type ScheduleStatus,
} from '../../machines/scheduleMachine';

describe('Schedule State Machine', () => {
  describe('XState machine', () => {
    it('starts in planned', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      expect(actor.getSnapshot().value).toBe('planned');
      actor.stop();
    });

    it('planned → in_progress → completed (happy path)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      expect(actor.getSnapshot().value).toBe('in_progress');
      actor.send({ type: 'COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });

    it('in_progress → delayed → in_progress → completed', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      actor.send({ type: 'MARK_DELAYED' });
      expect(actor.getSnapshot().value).toBe('delayed');
      actor.send({ type: 'RESUME' });
      expect(actor.getSnapshot().value).toBe('in_progress');
      actor.send({ type: 'COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });

    it('planned → delayed (direct delay without starting)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'MARK_DELAYED' });
      expect(actor.getSnapshot().value).toBe('delayed');
      actor.stop();
    });

    it('completed → in_progress (reopen)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE' });
      actor.send({ type: 'REOPEN', userId: 'u1' });
      expect(actor.getSnapshot().value).toBe('in_progress');
      actor.stop();
    });

    it('delayed can complete without resuming', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      actor.send({ type: 'MARK_DELAYED' });
      actor.send({ type: 'COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });
  });

  describe('getValidScheduleTransitions', () => {
    it('viewer gets no transitions from any state', () => {
      const states: ScheduleStatus[] = ['planned', 'in_progress', 'delayed', 'completed'];
      for (const s of states) {
        expect(getValidScheduleTransitions(s, 'viewer')).toEqual([]);
      }
    });

    it('default role (no arg) gets no transitions', () => {
      expect(getValidScheduleTransitions('planned')).toEqual([]);
    });

    it('superintendent can start and delay from planned', () => {
      const t = getValidScheduleTransitions('planned', 'superintendent');
      expect(t).toContain('in_progress');
      expect(t).toContain('delayed');
    });

    it('superintendent can complete and delay from in_progress', () => {
      const t = getValidScheduleTransitions('in_progress', 'superintendent');
      expect(t).toContain('completed');
      expect(t).toContain('delayed');
    });

    it('superintendent can resume and complete from delayed', () => {
      const t = getValidScheduleTransitions('delayed', 'superintendent');
      expect(t).toContain('in_progress');
      expect(t).toContain('completed');
    });

    it('superintendent cannot reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'superintendent')).toEqual([]);
    });

    it('project_manager can reopen completed phases', () => {
      const t = getValidScheduleTransitions('completed', 'project_manager');
      expect(t).toContain('in_progress');
    });

    it('admin can reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'admin')).toContain('in_progress');
    });

    it('owner can reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'owner')).toContain('in_progress');
    });

    it('subcontractor gets no transitions', () => {
      expect(getValidScheduleTransitions('in_progress', 'subcontractor')).toEqual([]);
    });
  });

  describe('getScheduleStatusConfig', () => {
    it('all statuses have config with CSS variable colors', () => {
      const statuses: ScheduleStatus[] = ['planned', 'in_progress', 'delayed', 'completed'];
      for (const s of statuses) {
        const c = getScheduleStatusConfig(s);
        expect(c.label).toBeTruthy();
        expect(c.color).toMatch(/^var\(/);
        expect(c.bg).toMatch(/^var\(/);
      }
    });

    it('planned is neutral', () => {
      expect(getScheduleStatusConfig('planned').label).toBe('Planned');
    });

    it('delayed is critical red', () => {
      expect(getScheduleStatusConfig('delayed').color).toMatch(/statusCritical/);
    });

    it('completed is green active', () => {
      expect(getScheduleStatusConfig('completed').color).toMatch(/statusActive/);
    });
  });

  describe('deriveStatusFromProgress', () => {
    it('100% percent becomes completed', () => {
      expect(deriveStatusFromProgress(100, 'planned')).toBe('completed');
    });

    it('partial progress on planned becomes in_progress', () => {
      expect(deriveStatusFromProgress(50, 'planned')).toBe('in_progress');
    });

    it('partial progress on delayed stays delayed', () => {
      expect(deriveStatusFromProgress(50, 'delayed')).toBe('delayed');
    });

    it('0% on planned stays planned', () => {
      expect(deriveStatusFromProgress(0, 'planned')).toBe('planned');
    });
  });
});
