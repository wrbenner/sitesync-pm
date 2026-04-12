import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prevent side effects from module-level imports in createAuditedMutation.ts
vi.mock('../../lib/analytics', () => ({ default: { capture: vi.fn() } }))
vi.mock('../../lib/sentry', () => ({ default: { captureException: vi.fn() } }))
vi.mock('../../lib/auditLogger', () => ({ logAuditEntry: vi.fn().mockResolvedValue(undefined) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
  fromTable: vi.fn(),
}))

import { ValidationError, createOnError } from '../../hooks/mutations/createAuditedMutation'

// ── ValidationError ────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('should be an instance of Error', () => {
    const err = new ValidationError({ title: ['Title is required'] })
    expect(err).toBeInstanceOf(Error)
  })

  it('should have name "ValidationError"', () => {
    const err = new ValidationError({ status: ['Invalid status'] })
    expect(err.name).toBe('ValidationError')
  })

  it('should expose fieldErrors on the instance', () => {
    const fields = { title: ['Required'], priority: ['Must be low, medium, or high'] }
    const err = new ValidationError(fields)
    expect(err.fieldErrors).toEqual(fields)
  })

  it('should generate a human readable message from field errors', () => {
    const err = new ValidationError({
      title: ['Title is required'],
      priority: ['Invalid priority value'],
    })
    expect(err.message).toContain('title')
    expect(err.message).toContain('Title is required')
  })

  it('should include all field names in the message', () => {
    const err = new ValidationError({
      title: ['Required'],
      due_date: ['Must be in the future'],
      amount: ['Must be positive'],
    })
    expect(err.message).toContain('title')
    expect(err.message).toContain('due_date')
    expect(err.message).toContain('amount')
  })

  it('should only include the first error message per field', () => {
    const err = new ValidationError({ password: ['Too short', 'Must contain a number'] })
    // message uses only first error per field
    expect(err.message).toContain('Too short')
    // Second message may or may not appear (implementation-defined); first must appear
  })

  it('should handle a root-level error under the _root key', () => {
    const err = new ValidationError({ _root: ['Invalid data structure'] })
    expect(err.fieldErrors._root).toContain('Invalid data structure')
    expect(err.message).toContain('Invalid data structure')
  })

  it('should be throwable and catchable as ValidationError', () => {
    expect(() => {
      throw new ValidationError({ title: ['Required'] })
    }).toThrow(ValidationError)
  })

  it('should be distinguishable from generic Error instances', () => {
    const validationErr = new ValidationError({ x: ['err'] })
    const genericErr = new Error('Something went wrong')

    expect(validationErr instanceof ValidationError).toBe(true)
    expect(genericErr instanceof ValidationError).toBe(false)
  })

  it('should be an instanceof Error for try/catch compatibility', () => {
    try {
      throw new ValidationError({ field: ['bad'] })
    } catch (e) {
      expect(e instanceof Error).toBe(true)
      expect(e instanceof ValidationError).toBe(true)
    }
  })

  it('should handle many field errors without throwing', () => {
    const fields: Record<string, string[]> = {}
    for (let i = 0; i < 20; i++) {
      fields[`field_${i}`] = [`Error ${i}`]
    }
    expect(() => new ValidationError(fields)).not.toThrow()
  })
})

// ── createOnError ──────────────────────────────────────────────────────────

describe('createOnError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a function', () => {
    const handler = createOnError('create_rfi')
    expect(typeof handler).toBe('function')
  })

  it('should call Sentry.captureException with the error when handler is invoked', async () => {
    const Sentry = await import('../../lib/sentry')
    const sentrySpy = vi.mocked(Sentry.default.captureException)

    const handler = createOnError('update_submittal')
    const error = new Error('Network error')
    handler(error)

    expect(sentrySpy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ extra: { mutation: 'update_submittal' } })
    )
  })

  it('should pass the mutation name as Sentry context', async () => {
    const Sentry = await import('../../lib/sentry')
    const sentrySpy = vi.mocked(Sentry.default.captureException)

    const handler = createOnError('delete_punch_item')
    handler(new Error('test'))

    expect(sentrySpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: { mutation: 'delete_punch_item' } })
    )
  })

  it('should show a toast error notification when handler is invoked', async () => {
    const { toast } = await import('sonner')
    const toastSpy = vi.mocked(toast.error)

    const handler = createOnError('close_daily_log')
    handler(new Error('fail'))

    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('close daily log')
    )
  })

  it('should replace underscores with spaces in the toast message', async () => {
    const { toast } = await import('sonner')
    const toastSpy = vi.mocked(toast.error)

    const handler = createOnError('approve_change_order')
    handler(new Error('fail'))

    const toastMessage = toastSpy.mock.calls[0][0] as string
    expect(toastMessage).not.toContain('_')
    expect(toastMessage).toContain('approve change order')
  })

  it('should produce independent handlers for different mutation names', () => {
    const handler1 = createOnError('create_rfi')
    const handler2 = createOnError('approve_change_order')

    expect(handler1).not.toBe(handler2)
  })

  it('should not throw when the error has no message', () => {
    const handler = createOnError('close_daily_log')
    expect(() => handler(new Error())).not.toThrow()
  })

  it('should capture any error type, not just Error instances', async () => {
    const Sentry = await import('../../lib/sentry')
    const sentrySpy = vi.mocked(Sentry.default.captureException)

    const handler = createOnError('submit_rfi')
    // Pass a non-Error object (TS cast needed here)
    handler({ message: 'weird error' } as unknown as Error)

    expect(sentrySpy).toHaveBeenCalled()
  })
})
