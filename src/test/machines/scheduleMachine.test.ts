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
    it('starts in upcoming', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      expect(actor.getSnapshot().value).toBe('upcoming');
      actor.stop();
    });

    it('upcoming → active → completed (happy path)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      expect(actor.getSnapshot().value).toBe('active');
      actor.send({ type: 'COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });

    it('active → delayed → active → completed', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      actor.send({ type: 'MARK_DELAYED' });
      expect(actor.getSnapshot().value).toBe('delayed');
      actor.send({ type: 'RESUME' });
      expect(actor.getSnapshot().value).toBe('active');
      actor.send({ type: 'COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });

    it('upcoming → delayed (direct delay without starting)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'MARK_DELAYED' });
      expect(actor.getSnapshot().value).toBe('delayed');
      actor.stop();
    });

    it('completed → active (reopen)', () => {
      const actor = createActor(scheduleMachine);
      actor.start();
      actor.send({ type: 'START' });
      actor.send({ type: 'COMPLETE' });
      actor.send({ type: 'REOPEN', userId: 'u1' });
      expect(actor.getSnapshot().value).toBe('active');
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
      const states: ScheduleStatus[] = ['upcoming', 'active', 'delayed', 'completed', 'on_track', 'at_risk'];
      for (const s of states) {
        expect(getValidScheduleTransitions(s, 'viewer')).toEqual([]);
      }
    });

    it('default role (no arg) gets no transitions', () => {
      expect(getValidScheduleTransitions('upcoming')).toEqual([]);
    });

    it('superintendent can start and delay from upcoming', () => {
      const t = getValidScheduleTransitions('upcoming', 'superintendent');
      expect(t).toContain('active');
      expect(t).toContain('delayed');
    });

    it('superintendent can complete and delay from active', () => {
      const t = getValidScheduleTransitions('active', 'superintendent');
      expect(t).toContain('completed');
      expect(t).toContain('delayed');
    });

    it('superintendent can resume and complete from delayed', () => {
      const t = getValidScheduleTransitions('delayed', 'superintendent');
      expect(t).toContain('active');
      expect(t).toContain('completed');
    });

    it('superintendent cannot reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'superintendent')).toEqual([]);
    });

    it('project_manager can reopen completed phases', () => {
      const t = getValidScheduleTransitions('completed', 'project_manager');
      expect(t).toContain('active');
    });

    it('admin can reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'admin')).toContain('active');
    });

    it('owner can reopen completed phases', () => {
      expect(getValidScheduleTransitions('completed', 'owner')).toContain('active');
    });

    it('subcontractor gets no transitions', () => {
      expect(getValidScheduleTransitions('active', 'subcontractor')).toEqual([]);
    });
  });

  describe('getScheduleStatusConfig', () => {
    it('all statuses have config with CSS variable colors', () => {
      const statuses: ScheduleStatus[] = ['upcoming', 'active', 'delayed', 'completed', 'on_track', 'at_risk'];
      for (const s of statuses) {
        const c = getScheduleStatusConfig(s);
        expect(c.label).toBeTruthy();
        expect(c.color).toMatch(/^var\(/);
        expect(c.bg).toMatch(/^var\(/);
      }
    });

    it('upcoming is neutral', () => {
      expect(getScheduleStatusConfig('upcoming').label).toBe('Upcoming');
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
      expect(deriveStatusFromProgress(100, 'upcoming')).toBe('completed');
    });

    it('partial progress on upcoming becomes active', () => {
      expect(deriveStatusFromProgress(50, 'upcoming')).toBe('active');
    });

    it('partial progress on delayed stays delayed', () => {
      expect(deriveStatusFromProgress(50, 'delayed')).toBe('delayed');
    });

    it('0% on upcoming stays upcoming', () => {
      expect(deriveStatusFromProgress(0, 'upcoming')).toBe('upcoming');
    });
  });
});
