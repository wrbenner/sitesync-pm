import { describe, it, expect } from 'vitest'
import { estimateCostCents } from './aiObservability'

// estimateCostCents prices LLM calls in integer cents using the documented
// per-1000-token rates. A regression here would mis-charge customers' AI
// usage budgets — a customer-trust + revenue-impact issue.

describe('estimateCostCents', () => {
  it('returns 0 for an unknown model (no rate available)', () => {
    expect(estimateCostCents('unknown-model', 1_000_000, 1_000_000)).toBe(0)
  })

  it('returns 0 when both token counts are 0', () => {
    expect(estimateCostCents('claude-sonnet-4-6', 0, 0)).toBe(0)
  })

  it('Sonnet 4.6: 1k input + 1k output = $0.003 + $0.015 = $0.018 = 2 cents (rounded)', () => {
    // 0.018 USD * 100 = 1.8 cents → rounds to 2
    expect(estimateCostCents('claude-sonnet-4-6', 1_000, 1_000)).toBe(2)
  })

  it('Opus 4.7 is the most expensive Anthropic model in the table', () => {
    const opus = estimateCostCents('claude-opus-4-7', 1_000, 1_000)
    const sonnet = estimateCostCents('claude-sonnet-4-6', 1_000, 1_000)
    const haiku = estimateCostCents('claude-haiku-4-5', 1_000, 1_000)
    expect(opus).toBeGreaterThan(sonnet)
    expect(sonnet).toBeGreaterThan(haiku)
  })

  it('Haiku 4.5: 100k input + 50k output costs less than $1 in this table', () => {
    // 100 * 0.0008 + 50 * 0.004 = 0.08 + 0.20 = 0.28 USD = 28 cents
    expect(estimateCostCents('claude-haiku-4-5', 100_000, 50_000)).toBe(28)
  })

  it('GPT-4o-mini is cheaper than GPT-4o for the same workload', () => {
    const big = estimateCostCents('gpt-4o', 10_000, 5_000)
    const mini = estimateCostCents('gpt-4o-mini', 10_000, 5_000)
    expect(mini).toBeLessThan(big)
  })

  it('Gemini 2.0 Flash + Haiku 4.5 are the cheapest models in the table', () => {
    const flash = estimateCostCents('gemini-2.0-flash', 1_000_000, 500_000)
    const opus = estimateCostCents('claude-opus-4-7', 1_000_000, 500_000)
    expect(flash).toBeLessThan(opus / 10) // Order-of-magnitude cheaper
  })

  it('output tokens are billed at the higher rate (per Anthropic pricing)', () => {
    // 10k output costs more than 10k input for every Claude model
    const inputOnly = estimateCostCents('claude-sonnet-4-6', 10_000, 0)
    const outputOnly = estimateCostCents('claude-sonnet-4-6', 0, 10_000)
    expect(outputOnly).toBeGreaterThan(inputOnly)
  })

  it('rounds to integer cents (no fractional cents in storage)', () => {
    // 1 input token at sonnet input rate = 0.003/1000 USD = 0.0003 cents
    // Rounds to 0.
    expect(estimateCostCents('claude-sonnet-4-6', 1, 0)).toBe(0)
  })

  it('high-volume Opus call: 1M input + 1M output = $15 + $75 = $90 = 9000 cents', () => {
    expect(estimateCostCents('claude-opus-4-7', 1_000_000, 1_000_000)).toBe(9000)
  })

  it('rate ordering invariant: input rate < output rate for every model in the table', () => {
    const models = [
      'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5',
      'gpt-4o', 'gpt-4o-mini', 'gemini-2.0-flash', 'gemini-1.5-pro',
    ]
    for (const model of models) {
      const inputCost = estimateCostCents(model, 100_000, 0)
      const outputCost = estimateCostCents(model, 0, 100_000)
      expect(outputCost, `${model}: output rate not > input rate`).toBeGreaterThan(inputCost)
    }
  })
})
