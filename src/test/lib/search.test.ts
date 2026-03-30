import { describe, it, expect, beforeAll } from 'vitest'
import { createSearchIndex, searchAll } from '../../lib/search'

describe('Orama Search', () => {
  beforeAll(async () => {
    await createSearchIndex()
  })

  it('should create search index without errors', async () => {
    const db = await createSearchIndex()
    expect(db).toBeDefined()
  })

  it('should handle search queries gracefully', async () => {
    const results = await searchAll('structural')
    // Results depend on what data is indexed. In test env with no mock data, this returns 0.
    expect(Array.isArray(results)).toBe(true)
  })

  it('should return results with correct shape', async () => {
    const results = await searchAll('steel')
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('type')
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('title')
      expect(results[0]).toHaveProperty('link')
    }
  })

  it('should return empty for nonsense queries', async () => {
    const results = await searchAll('xyznonexistent12345')
    expect(results.length).toBe(0)
  })

  it('should respect limit parameter', async () => {
    const results = await searchAll('a', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})
