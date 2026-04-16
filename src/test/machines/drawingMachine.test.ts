import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  drawingMachine,
  getValidTransitions,
  getNextStatus,
  getDrawingStatusConfig,
  getDaysSinceIssued,
  type DrawingStatus,
} from '../../machines/drawingMachine';

describe('Drawing State Machine', () => {
  describe('getValidTransitions', () => {
    it('draft can only Submit for Review (non-admin)', () => {
      const transitions = getValidTransitions('draft', 'member');
      expect(transitions).toContain('Submit for Review');
      expect(transitions).not.toContain('Approve');
      expect(transitions).not.toContain('Publish');
    });

    it('draft: admin can also Archive', () => {
      const transitions = getValidTransitions('draft', 'admin');
      expect(transitions).toContain('Submit for Review');
      expect(transitions).toContain('Archive');
    });

    it('under_review: reviewer can Approve or Reject', () => {
      const transitions = getValidTransitions('under_review', 'reviewer');
      expect(transitions).toContain('Approve');
      expect(transitions).toContain('Reject');
    });

    it('under_review: non-reviewer cannot Approve or Reject', () => {
      const transitions = getValidTransitions('under_review', 'member');
      expect(transitions).not.toContain('Approve');
      expect(transitions).not.toContain('Reject');
    });

    it('approved: admin can Publish or Revise', () => {
      const transitions = getValidTransitions('approved', 'admin');
      expect(transitions).toContain('Publish');
      expect(transitions).toContain('Revise');
    });

    it('approved: non-admin cannot Publish', () => {
      const transitions = getValidTransitions('approved', 'member');
      expect(transitions).not.toContain('Publish');
      expect(transitions).not.toContain('Revise');
    });

    it('rejected: any role can Revise', () => {
      expect(getValidTransitions('rejected', 'member')).toContain('Revise');
      expect(getValidTransitions('rejected', 'viewer')).toContain('Revise');
    });

    it('published: admin can Supersede', () => {
      expect(getValidTransitions('published', 'admin')).toContain('Supersede');
    });

    it('published: non-admin cannot Supersede', () => {
      expect(getValidTransitions('published', 'member')).not.toContain('Supersede');
    });

    it('archived has no transitions', () => {
      expect(getValidTransitions('archived', 'admin')).toEqual([]);
    });

    it('owner has same privileges as admin', () => {
      expect(getValidTransitions('approved', 'owner')).toContain('Publish');
      expect(getValidTransitions('draft', 'owner')).toContain('Archive');
    });

    it('non-admin cannot Archive', () => {
      expect(getValidTransitions('draft', 'member')).not.toContain('Archive');
      expect(getValidTransitions('under_review', 'reviewer')).not.toContain('Archive');
    });

    it('default (no role) behaves as viewer', () => {
      const transitions = getValidTransitions('under_review');
      expect(transitions).not.toContain('Approve');
      expect(transitions).not.toContain('Archive');
    });
  });

  describe('getNextStatus', () => {
    it('Submit for Review from draft goes to under_review', () => {
      expect(getNextStatus('draft', 'Submit for Review')).toBe('under_review');
    });

    it('Approve from under_review goes to approved', () => {
      expect(getNextStatus('under_review', 'Approve')).toBe('approved');
    });

    it('Reject from under_review goes to rejected', () => {
      expect(getNextStatus('under_review', 'Reject')).toBe('rejected');
    });

    it('Publish from approved goes to published', () => {
      expect(getNextStatus('approved', 'Publish')).toBe('published');
    });

    it('Revise from approved goes back to draft', () => {
      expect(getNextStatus('approved', 'Revise')).toBe('draft');
    });

    it('Revise from rejected goes back to draft', () => {
      expect(getNextStatus('rejected', 'Revise')).toBe('draft');
    });

    it('Supersede from published goes to draft', () => {
      expect(getNextStatus('published', 'Supersede')).toBe('draft');
    });

    it('Archive from any non-archived state goes to archived', () => {
      const states: DrawingStatus[] = ['draft', 'under_review', 'approved', 'rejected', 'published'];
      for (const s of states) {
        expect(getNextStatus(s, 'Archive')).toBe('archived');
      }
    });

    it('invalid action returns null', () => {
      expect(getNextStatus('draft', 'Approve')).toBeNull();
      expect(getNextStatus('archived', 'Submit for Review')).toBeNull();
      expect(getNextStatus('published', 'Reject')).toBeNull();
    });
  });

  describe('getDrawingStatusConfig', () => {
    it('all statuses have label and CSS var color', () => {
      const statuses: DrawingStatus[] = [
        'draft',
        'under_review',
        'approved',
        'rejected',
        'published',
        'archived',
      ];
      for (const s of statuses) {
        const config = getDrawingStatusConfig(s);
        expect(config.label).toBeTruthy();
        expect(config.color).toMatch(/^var\(/);
        expect(config.bg).toMatch(/^var\(/);
      }
    });

    it('approved is green', () => {
      const config = getDrawingStatusConfig('approved');
      expect(config.color).toContain('statusActive');
    });

    it('rejected is red', () => {
      const config = getDrawingStatusConfig('rejected');
      expect(config.color).toContain('statusCritical');
    });
  });

  describe('getDaysSinceIssued', () => {
    it('null returns 0', () => {
      expect(getDaysSinceIssued(null)).toBe(0);
    });

    it('past date returns positive day count', () => {
      const past = new Date(Date.now() - 5 * 86400000).toISOString();
      expect(getDaysSinceIssued(past)).toBeGreaterThanOrEqual(5);
    });
  });

  describe('XState machine', () => {
    it('starts in draft', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      expect(actor.getSnapshot().value).toBe('draft');
      actor.stop();
    });

    it('full approval happy path: draft -> under_review -> approved -> published', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      actor.send({ type: 'SUBMIT_FOR_REVIEW' });
      expect(actor.getSnapshot().value).toBe('under_review');
      actor.send({ type: 'APPROVE', userId: 'reviewer-1' });
      expect(actor.getSnapshot().value).toBe('approved');
      actor.send({ type: 'PUBLISH', userId: 'admin-1' });
      expect(actor.getSnapshot().value).toBe('published');
      actor.stop();
    });

    it('rejection path: draft -> under_review -> rejected -> draft', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      actor.send({ type: 'SUBMIT_FOR_REVIEW' });
      actor.send({ type: 'REJECT', userId: 'reviewer-1', reason: 'Missing details' });
      expect(actor.getSnapshot().value).toBe('rejected');
      actor.send({ type: 'REVISE', userId: 'drafter-1' });
      expect(actor.getSnapshot().value).toBe('draft');
      actor.stop();
    });

    it('supersede path: published -> draft', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      actor.send({ type: 'SUBMIT_FOR_REVIEW' });
      actor.send({ type: 'APPROVE', userId: 'reviewer-1' });
      actor.send({ type: 'PUBLISH', userId: 'admin-1' });
      actor.send({ type: 'SUPERSEDE', userId: 'admin-1' });
      expect(actor.getSnapshot().value).toBe('draft');
      actor.stop();
    });

    it('archive is a final state', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      actor.send({ type: 'ARCHIVE', userId: 'admin-1', reason: 'Obsolete' });
      expect(actor.getSnapshot().value).toBe('archived');
      expect(actor.getSnapshot().status).toBe('done');
      actor.stop();
    });

    it('revise from approved goes back to draft', () => {
      const actor = createActor(drawingMachine);
      actor.start();
      actor.send({ type: 'SUBMIT_FOR_REVIEW' });
      actor.send({ type: 'APPROVE', userId: 'reviewer-1' });
      actor.send({ type: 'REVISE', userId: 'admin-1' });
      expect(actor.getSnapshot().value).toBe('draft');
      actor.stop();
    });
  });
});
