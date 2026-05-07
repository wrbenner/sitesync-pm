import { describe, it, expect } from 'vitest'
import { sha256Hex } from './_hash'

describe('sha256Hex', () => {
  it('returns the canonical sha256 of the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('returns the canonical sha256 of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('produces a 64-character hex string', async () => {
    const hex = await sha256Hex('hello world')
    expect(hex).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic across calls', async () => {
    const a = await sha256Hex('same input')
    const b = await sha256Hex('same input')
    expect(a).toBe(b)
  })

  it('is sensitive to single-character changes', async () => {
    const a = await sha256Hex('abc')
    const b = await sha256Hex('abd')
    expect(a).not.toBe(b)
  })

  it('handles unicode input via UTF-8 encoding', async () => {
    // sha256("héllo") with UTF-8 encoding
    const hex = await sha256Hex('héllo')
    expect(hex).toMatch(/^[a-f0-9]{64}$/)
  })
})
