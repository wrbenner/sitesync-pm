import { describe, it, expect } from 'vitest'
import { createTaskSchema, taskPriorityEnum, taskStatusEnum } from './task'

describe('taskPriorityEnum + taskStatusEnum', () => {
  it.each(['critical', 'high', 'medium', 'low'])('priority "%s" valid', (p) => {
    expect(() => taskPriorityEnum.parse(p)).not.toThrow()
  })

  it.each(['todo', 'in_progress', 'in_review', 'done'])('status "%s" valid', (s) => {
    expect(() => taskStatusEnum.parse(s)).not.toThrow()
  })

  it('rejects unknown enum values', () => {
    expect(() => taskPriorityEnum.parse('urgent')).toThrow()
    expect(() => taskStatusEnum.parse('canceled')).toThrow()
  })
})

describe('createTaskSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return { title: 'Survey slab', due_date: '2026-02-01', ...o }
  }

  it('accepts a valid create payload', () => {
    expect(() => createTaskSchema.parse(valid())).not.toThrow()
  })

  it('priority defaults to "medium" + status defaults to "todo"', () => {
    const r = createTaskSchema.parse(valid())
    expect(r.priority).toBe('medium')
    expect(r.status).toBe('todo')
  })

  it('rejects empty title', () => {
    expect(() => createTaskSchema.parse(valid({ title: '' })))
      .toThrow(/Title is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createTaskSchema.parse(valid({ title: 'x'.repeat(201) })))
      .toThrow()
  })

  it('rejects empty due_date (required for task scheduling)', () => {
    expect(() => createTaskSchema.parse(valid({ due_date: '' })))
      .toThrow(/Due date is required/)
  })

  it('description and assignee optional with empty-string allowance', () => {
    expect(() => createTaskSchema.parse(valid({ description: '' }))).not.toThrow()
    expect(() => createTaskSchema.parse(valid({ assignee: '' }))).not.toThrow()
  })
})
