import { describe, it, expect } from 'vitest'
import { ValidationError } from '../../hooks/mutations/createAuditedMutation'

// ---------------------------------------------------------------------------
// ValidationError class
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  it('should be an instance of Error', () => {
    const err = new ValidationError({ title: ['Title is required'] })
    expect(err).toBeInstanceOf(Error)
  })

  it('should have name "ValidationError"', () => {
    const err = new ValidationError({ title: ['Title is required'] })
    expect(err.name).toBe('ValidationError')
  })

  it('should expose fieldErrors on the instance', () => {
    const fieldErrors = { title: ['Title is required'], due_date: ['Must be a future date'] }
    const err = new ValidationError(fieldErrors)
    expect(err.fieldErrors).toEqual(fieldErrors)
  })

  it('should build a message summarizing all field errors', () => {
    const err = new ValidationError({ title: ['Title is required'] })
    expect(err.message).toContain('Validation failed')
    expect(err.message).toContain('title')
    expect(err.message).toContain('Title is required')
  })

  it('should include all fields in the message when multiple fields fail', () => {
    const err = new ValidationError({
      title: ['Title is required'],
      due_date: ['Must be a future date'],
    })
    expect(err.message).toContain('title')
    expect(err.message).toContain('due_date')
  })

  it('should use the first error message per field in the summary', () => {
    const err = new ValidationError({
      title: ['Title is required', 'Must be at least 3 characters'],
    })
    expect(err.message).toContain('Title is required')
    // Only the first error appears in the summary message
    expect(err.message).not.toContain('Must be at least 3 characters')
  })

  it('should handle empty fieldErrors object', () => {
    const err = new ValidationError({})
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.fieldErrors).toEqual({})
    expect(err.message).toContain('Validation failed')
  })

  it('should handle _root field for schema-level errors', () => {
    const err = new ValidationError({ _root: ['At least one field is required'] })
    expect(err.fieldErrors._root).toEqual(['At least one field is required'])
    expect(err.message).toContain('_root')
  })

  it('should preserve multiple error messages per field in fieldErrors', () => {
    const multipleErrors = ['Field is required', 'Must be at least 5 characters', 'Cannot contain special characters']
    const err = new ValidationError({ description: multipleErrors })
    expect(err.fieldErrors.description).toHaveLength(3)
    expect(err.fieldErrors.description).toEqual(multipleErrors)
  })
})

// ---------------------------------------------------------------------------
// ValidationError vs Error discrimination
// ---------------------------------------------------------------------------

describe('ValidationError instance discrimination', () => {
  it('should be distinguishable from a plain Error', () => {
    const validationErr = new ValidationError({ title: ['Required'] })
    const plainErr = new Error('Something went wrong')

    expect(validationErr).toBeInstanceOf(ValidationError)
    expect(plainErr instanceof ValidationError).toBe(false)
  })

  it('should be distinguishable from a TypeError', () => {
    const validationErr = new ValidationError({ field: ['Bad value'] })
    const typeErr = new TypeError('Cannot read property')

    expect(validationErr instanceof ValidationError).toBe(true)
    expect(typeErr instanceof ValidationError).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createOnError utility (tested via module import)
// ---------------------------------------------------------------------------

describe('createOnError utility', () => {
  it('should be importable from createAuditedMutation', async () => {
    const { createOnError } = await import('../../hooks/mutations/createAuditedMutation')
    expect(typeof createOnError).toBe('function')
  })

  it('should return a function when called with a mutation name', async () => {
    const { createOnError } = await import('../../hooks/mutations/createAuditedMutation')
    const handler = createOnError('create_rfi')
    expect(typeof handler).toBe('function')
  })

  it('should return different handlers for different mutation names', async () => {
    const { createOnError } = await import('../../hooks/mutations/createAuditedMutation')
    const handler1 = createOnError('create_rfi')
    const handler2 = createOnError('delete_task')
    // Each call returns a new function
    expect(handler1).not.toBe(handler2)
  })
})
