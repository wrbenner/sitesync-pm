import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '../auth';
import { createRfiSchema, rfiResponseSchema } from '../rfi';
import { createSubmittalSchema } from '../submittal';
import { createPunchItemSchema } from '../punchItem';
import { createMeetingSchema, actionItemSchema } from '../meeting';
import { createChangeOrderSchema } from '../budget';

describe('Auth schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'password123' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({ email: 'notanemail', password: 'password123' });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '12345' });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('accepts valid registration', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects mismatched passwords', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'different',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing first name', () => {
      const result = registerSchema.safeParse({
        firstName: '',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('RFI schemas', () => {
  describe('createRfiSchema', () => {
    it('accepts valid RFI', () => {
      const result = createRfiSchema.safeParse({
        title: 'Test RFI',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('accepts RFI with all optional fields', () => {
      const result = createRfiSchema.safeParse({
        title: 'Test RFI',
        description: 'Some description',
        priority: 'critical',
        dueDate: '2025-04-01',
        assignedTo: 'user@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const result = createRfiSchema.safeParse({
        title: '',
        priority: 'medium',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing priority', () => {
      const result = createRfiSchema.safeParse({ title: 'Test' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid priority', () => {
      const result = createRfiSchema.safeParse({
        title: 'Test',
        priority: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rfiResponseSchema', () => {
    it('accepts valid response', () => {
      const result = rfiResponseSchema.safeParse({ responseText: 'Approved as submitted.' });
      expect(result.success).toBe(true);
    });

    it('rejects empty response', () => {
      const result = rfiResponseSchema.safeParse({ responseText: '' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Submittal schemas', () => {
  it('accepts valid submittal', () => {
    const result = createSubmittalSchema.safeParse({
      title: 'Structural Steel Shop Drawings',
      priority: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('accepts submittal with spec section', () => {
    const result = createSubmittalSchema.safeParse({
      title: 'Structural Steel',
      specSection: '05 12 00',
      priority: 'medium',
    });
    expect(result.success).toBe(true);
  });
});

describe('Punch Item schemas', () => {
  it('accepts valid punch item', () => {
    const result = createPunchItemSchema.safeParse({
      description: 'Paint touch up needed in lobby',
      area: 'Lobby Level 1',
      priority: 'low',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing area', () => {
    const result = createPunchItemSchema.safeParse({
      description: 'Paint touch up',
      area: '',
      priority: 'low',
    });
    expect(result.success).toBe(false);
  });
});

describe('Meeting schemas', () => {
  it('accepts valid meeting', () => {
    const result = createMeetingSchema.safeParse({
      title: 'Weekly OAC Meeting',
      meetingType: 'oac',
      meetingDate: '2025-04-01',
      meetingTime: '10:00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid action item', () => {
    const result = actionItemSchema.safeParse({
      description: 'Submit revised drawings by Friday',
    });
    expect(result.success).toBe(true);
  });
});

describe('Budget schemas', () => {
  it('accepts valid change order', () => {
    const result = createChangeOrderSchema.safeParse({
      title: 'Additional structural reinforcement',
      amount: 45000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = createChangeOrderSchema.safeParse({
      title: 'Test',
      amount: -100,
    });
    expect(result.success).toBe(false);
  });
});
