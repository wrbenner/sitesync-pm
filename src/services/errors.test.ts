import { describe, it, expect } from 'vitest';
import {
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
  conflictError,
} from './errors';

describe('errors', () => {
  describe('ok', () => {
    it('returns data with null error', () => {
      const result = ok([1, 2, 3]);
      expect(result.data).toEqual([1, 2, 3]);
      expect(result.error).toBeNull();
    });

    it('handles null data', () => {
      const result = ok(null);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('handles empty array', () => {
      const result = ok([]);
      expect(result.data).toEqual([]);
    });
  });

  describe('fail', () => {
    it('returns null data with error', () => {
      const err = dbError('boom');
      const result = fail(err);
      expect(result.data).toBeNull();
      expect(result.error).toBe(err);
    });
  });

  describe('dbError', () => {
    it('sets correct category and code', () => {
      const err = dbError('connection failed');
      expect(err.category).toBe('DatabaseError');
      expect(err.code).toBe('DB_ERROR');
      expect(err.message).toBe('connection failed');
    });

    it('attaches context when provided', () => {
      const err = dbError('query failed', { projectId: 'p-1' });
      expect(err.context).toEqual({ projectId: 'p-1' });
    });

    it('omits context when not provided', () => {
      const err = dbError('query failed');
      expect(err.context).toBeUndefined();
    });

    it('has a user-friendly userMessage', () => {
      const err = dbError('internal error');
      expect(err.userMessage).toBe('A database error occurred. Please try again.');
    });
  });

  describe('permissionError', () => {
    it('sets correct category and code', () => {
      const err = permissionError('not allowed');
      expect(err.category).toBe('PermissionError');
      expect(err.code).toBe('PERMISSION_DENIED');
    });

    it('has a user-friendly userMessage', () => {
      const err = permissionError('not allowed');
      expect(err.userMessage).toBe('You do not have permission to perform this action.');
    });
  });

  describe('notFoundError', () => {
    it('includes entity name and id in message', () => {
      const err = notFoundError('Inspection', 'insp-1');
      expect(err.category).toBe('NotFoundError');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toContain('Inspection');
      expect(err.message).toContain('insp-1');
    });

    it('works without id', () => {
      const err = notFoundError('Drawing');
      expect(err.message).toBe('Drawing not found');
      expect(err.context).toBeUndefined();
    });

    it('stores id in context when provided', () => {
      const err = notFoundError('Phase', 'ph-42');
      expect(err.context).toEqual({ id: 'ph-42' });
    });
  });

  describe('validationError', () => {
    it('sets correct category and uses message as userMessage', () => {
      const err = validationError('Bad transition');
      expect(err.category).toBe('ValidationError');
      expect(err.code).toBe('INVALID_TRANSITION');
      expect(err.userMessage).toBe('Bad transition');
    });

    it('attaches context', () => {
      const err = validationError('bad', { from: 'a', to: 'b' });
      expect(err.context).toEqual({ from: 'a', to: 'b' });
    });
  });

  describe('conflictError', () => {
    it('sets correct category and code', () => {
      const err = conflictError('already exists');
      expect(err.category).toBe('ConflictError');
      expect(err.code).toBe('CONFLICT');
    });

    it('attaches optional context', () => {
      const err = conflictError('duplicate', { id: 'x' });
      expect(err.context).toEqual({ id: 'x' });
    });
  });
});
