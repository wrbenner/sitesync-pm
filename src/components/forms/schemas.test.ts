import { describe, it, expect } from 'vitest'
import {
  rfiSchema,
  submittalSchema,
  punchItemSchema,
  dailyLogSchema,
  dailyLogDbSchema,
  changeOrderSchema,
} from './schemas'

// Form-level Zod schemas validate user input before mutations fire.
// Tests pin: required-field validation, enum constraints, default values,
// and the "passthrough" allowance for fields not in the schema.

describe('rfiSchema', () => {
  it('parses a valid minimal RFI', () => {
    const r = rfiSchema.parse({ title: 'Concrete pour clearance' })
    expect(r.title).toBe('Concrete pour clearance')
    expect(r.priority).toBe('medium')   // default
    expect(r.description).toBe('')      // default
  })

  it('rejects empty title', () => {
    expect(() => rfiSchema.parse({ title: '' })).toThrow(/Title is required/)
  })

  it('rejects title > 200 characters', () => {
    expect(() => rfiSchema.parse({ title: 'x'.repeat(201) }))
      .toThrow(/under 200 characters/)
  })

  it('rejects invalid priority enum', () => {
    expect(() => rfiSchema.parse({ title: 'A', priority: 'urgent' }))
      .toThrow()
  })

  it('passthrough preserves unknown fields', () => {
    const r = rfiSchema.parse({ title: 'A', extraField: 'kept' })
    expect((r as Record<string, unknown>).extraField).toBe('kept')
  })
})

describe('submittalSchema', () => {
  it('parses with defaults', () => {
    const r = submittalSchema.parse({ title: 'Anchor bolts' })
    expect(r.type).toBe('shop_drawing')
  })

  it('accepts numeric or string lead_time_weeks', () => {
    expect(submittalSchema.parse({ title: 'A', lead_time_weeks: 4 }).lead_time_weeks).toBe(4)
    expect(submittalSchema.parse({ title: 'A', lead_time_weeks: '8' }).lead_time_weeks).toBe('8')
  })

  it('rejects invalid type enum', () => {
    expect(() => submittalSchema.parse({ title: 'A', type: 'mystery' })).toThrow()
  })

  it('valid types: shop_drawing, product_data, sample, design_data, test_report, certificate, closeout', () => {
    for (const type of ['shop_drawing', 'product_data', 'sample', 'design_data', 'test_report', 'certificate', 'closeout']) {
      expect(() => submittalSchema.parse({ title: 'A', type })).not.toThrow()
    }
  })
})

describe('punchItemSchema', () => {
  it('parses with priority default = medium', () => {
    const r = punchItemSchema.parse({ title: 'Touch-up paint' })
    expect(r.priority).toBe('medium')
  })

  it('rejects invalid priority', () => {
    expect(() => punchItemSchema.parse({ title: 'A', priority: 'urgent' })).toThrow()
  })

  it('photos array is optional', () => {
    const r = punchItemSchema.parse({ title: 'A', photos: ['url1', 'url2'] })
    expect(r.photos).toEqual(['url1', 'url2'])
  })

  it('passthrough preserves project_id and unknown fields', () => {
    const r = punchItemSchema.parse({ title: 'A', project_id: 'p-1', random: true })
    expect(r.project_id).toBe('p-1')
    expect((r as Record<string, unknown>).random).toBe(true)
  })
})

describe('dailyLogSchema (form-level)', () => {
  it('weather_condition default = clear', () => {
    const r = dailyLogSchema.parse({ date: '2026-01-01' })
    expect(r.weather_condition).toBe('clear')
  })

  it('rejects empty date', () => {
    expect(() => dailyLogSchema.parse({ date: '' })).toThrow(/Date is required/)
  })

  it('valid weather conditions: clear/partly_cloudy/cloudy/rain/snow/fog/windy', () => {
    for (const w of ['clear', 'partly_cloudy', 'cloudy', 'rain', 'snow', 'fog', 'windy']) {
      expect(() => dailyLogSchema.parse({ date: '2026-01-01', weather_condition: w })).not.toThrow()
    }
  })

  it('rejects unknown weather conditions', () => {
    expect(() => dailyLogSchema.parse({ date: '2026-01-01', weather_condition: 'mystery' }))
      .toThrow()
  })
})

describe('dailyLogDbSchema (DB-level with coercion)', () => {
  it('coerces numeric strings to numbers', () => {
    const r = dailyLogDbSchema.parse({
      project_id: 'p',
      log_date: '2026-01-01',
      workers_onsite: '15',
      total_hours: '120',
    })
    expect(r.workers_onsite).toBe(15)
    expect(r.total_hours).toBe(120)
  })

  it('rejects empty project_id', () => {
    expect(() => dailyLogDbSchema.parse({ project_id: '', log_date: '2026-01-01' }))
      .toThrow(/Project is required/)
  })

  it('status default = draft', () => {
    const r = dailyLogDbSchema.parse({ project_id: 'p', log_date: '2026-01-01' })
    expect(r.status).toBe('draft')
  })

  it('valid statuses: draft, submitted, approved, rejected, amending', () => {
    for (const status of ['draft', 'submitted', 'approved', 'rejected', 'amending']) {
      expect(() => dailyLogDbSchema.parse({ project_id: 'p', log_date: '2026-01-01', status }))
        .not.toThrow()
    }
  })
})

describe('changeOrderSchema', () => {
  it('rejects empty title and empty description', () => {
    expect(() => changeOrderSchema.parse({ title: '', description: 'd' }))
      .toThrow(/Title is required/)
    expect(() => changeOrderSchema.parse({ title: 't', description: '' }))
      .toThrow(/Description is required/)
  })

  it('type default = pco', () => {
    const r = changeOrderSchema.parse({ title: 't', description: 'd' })
    expect(r.type).toBe('pco')
  })

  it('reason default = owner_request', () => {
    const r = changeOrderSchema.parse({ title: 't', description: 'd' })
    expect(r.reason).toBe('owner_request')
  })

  it('valid types: pco, cor, co', () => {
    for (const type of ['pco', 'cor', 'co']) {
      expect(() => changeOrderSchema.parse({ title: 't', description: 'd', type }))
        .not.toThrow()
    }
  })

  it('valid reasons match the documented set', () => {
    const validReasons = [
      'design_change', 'unforeseen_condition', 'owner_request',
      'code_change', 'value_engineering', 'scope_addition',
      'error_omission', 'other',
    ]
    for (const reason of validReasons) {
      expect(() => changeOrderSchema.parse({ title: 't', description: 'd', reason }))
        .not.toThrow()
    }
  })

  it('rejects unknown reason values', () => {
    expect(() => changeOrderSchema.parse({ title: 't', description: 'd', reason: 'mystery' }))
      .toThrow()
  })
})
