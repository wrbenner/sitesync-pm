import { describe, it, expect } from 'vitest'
import { API_VERSION, API_BASE_PATH } from './index'

describe('api/v1 — public versioning constants', () => {
  it('API_VERSION is "v1"', () => {
    expect(API_VERSION).toBe('v1')
  })

  it('API_BASE_PATH is "/api/v1"', () => {
    expect(API_BASE_PATH).toBe('/api/v1')
  })

  it('API_BASE_PATH ends with the version', () => {
    expect(API_BASE_PATH.endsWith(API_VERSION)).toBe(true)
  })

  it('API_BASE_PATH starts with /api/', () => {
    expect(API_BASE_PATH.startsWith('/api/')).toBe(true)
  })
})
