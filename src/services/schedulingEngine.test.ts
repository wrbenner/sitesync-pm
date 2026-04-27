import { describe, it, expect } from 'vitest'
import {
  toDateString,
  defaultWorkingDaysConfig,
  isWorkingDay,
  countWorkingDays,
  addWorkingDays,
  subtractWorkingDays,
  soonestWorkingDay,
  calculateEndDate,
  calculateFollowerStartDate,
} from './schedulingEngine'

// Use fixed reference dates with explicit known weekdays.
// 2026-01-05 is a Monday.
const MON = new Date(2026, 0, 5)   // Mon Jan 5 2026
const TUE = new Date(2026, 0, 6)
const WED = new Date(2026, 0, 7)
const THU = new Date(2026, 0, 8)
const FRI = new Date(2026, 0, 9)
const SAT = new Date(2026, 0, 10)
const SUN = new Date(2026, 0, 11)
const MON_NEXT = new Date(2026, 0, 12)

describe('schedulingEngine — toDateString', () => {
  it('formats as YYYY-MM-DD using local components (no timezone drift)', () => {
    expect(toDateString(MON)).toBe('2026-01-05')
    expect(toDateString(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('zero-pads month and day', () => {
    expect(toDateString(new Date(2026, 1, 3))).toBe('2026-02-03')
  })
})

describe('schedulingEngine — defaultWorkingDaysConfig', () => {
  it('Mon-Fri working week, no holidays', () => {
    const c = defaultWorkingDaysConfig()
    expect(c.workingWeekDays).toEqual([false, true, true, true, true, true, false])
    expect(c.nonWorkingDays.size).toBe(0)
  })
})

describe('schedulingEngine — isWorkingDay', () => {
  const config = defaultWorkingDaysConfig()

  it.each([
    ['Mon', MON, true],
    ['Tue', TUE, true],
    ['Wed', WED, true],
    ['Thu', THU, true],
    ['Fri', FRI, true],
    ['Sat', SAT, false],
    ['Sun', SUN, false],
  ] as const)('%s → %s', (_label, date, expected) => {
    expect(isWorkingDay(date, config)).toBe(expected)
  })

  it('respects holidays in nonWorkingDays', () => {
    const c = {
      ...config,
      nonWorkingDays: new Set(['2026-01-05']),
    }
    expect(isWorkingDay(MON, c)).toBe(false)
  })
})

describe('schedulingEngine — countWorkingDays', () => {
  const config = defaultWorkingDaysConfig()

  it('Mon-Fri inclusive = 5', () => {
    expect(countWorkingDays(MON, FRI, config)).toBe(5)
  })

  it('Mon-Sun = 5 (weekend excluded)', () => {
    expect(countWorkingDays(MON, SUN, config)).toBe(5)
  })

  it('returns 0 when start > end', () => {
    expect(countWorkingDays(FRI, MON, config)).toBe(0)
  })

  it('single-day range counts the day if it is working', () => {
    expect(countWorkingDays(MON, MON, config)).toBe(1)
    expect(countWorkingDays(SAT, SAT, config)).toBe(0)
  })

  it('subtracts holidays from the count', () => {
    const c = { ...config, nonWorkingDays: new Set(['2026-01-07']) }  // Wed holiday
    expect(countWorkingDays(MON, FRI, c)).toBe(4)
  })
})

describe('schedulingEngine — addWorkingDays', () => {
  const config = defaultWorkingDaysConfig()

  it('addWorkingDays(Mon, 1) === Mon (the start day counts)', () => {
    expect(toDateString(addWorkingDays(MON, 1, config))).toBe('2026-01-05')
  })

  it('addWorkingDays(Mon, 5) === Fri (Mon..Fri inclusive)', () => {
    expect(toDateString(addWorkingDays(MON, 5, config))).toBe('2026-01-09')
  })

  it('skips the weekend when crossing it', () => {
    // 6 working days from Mon → Mon next (skip Sat/Sun)
    expect(toDateString(addWorkingDays(MON, 6, config))).toBe('2026-01-12')
  })

  it('starting from Saturday skips ahead to Monday before counting', () => {
    expect(toDateString(addWorkingDays(SAT, 1, config))).toBe('2026-01-12')
  })

  it('days <= 0 returns the original date (cloned)', () => {
    expect(toDateString(addWorkingDays(MON, 0, config))).toBe('2026-01-05')
    expect(toDateString(addWorkingDays(MON, -3, config))).toBe('2026-01-05')
  })
})

describe('schedulingEngine — subtractWorkingDays', () => {
  const config = defaultWorkingDaysConfig()

  it('subtractWorkingDays(Fri, 1) === Fri (end day counts)', () => {
    expect(toDateString(subtractWorkingDays(FRI, 1, config))).toBe('2026-01-09')
  })

  it('subtractWorkingDays(Fri, 5) === Mon (5 working days back)', () => {
    expect(toDateString(subtractWorkingDays(FRI, 5, config))).toBe('2026-01-05')
  })

  it('skips weekend going backward', () => {
    // From Mon next, subtract 1 working day → Mon next (the start counts)
    // From Mon next, subtract 2 → Fri (skip Sun/Sat)
    expect(toDateString(subtractWorkingDays(MON_NEXT, 2, config))).toBe('2026-01-09')
  })
})

describe('schedulingEngine — soonestWorkingDay', () => {
  const config = defaultWorkingDaysConfig()

  it('returns the same date if already a working day', () => {
    expect(toDateString(soonestWorkingDay(MON, config))).toBe('2026-01-05')
  })

  it('Saturday → Monday (skip 2 days)', () => {
    expect(toDateString(soonestWorkingDay(SAT, config))).toBe('2026-01-12')
  })

  it('Sunday → Monday', () => {
    expect(toDateString(soonestWorkingDay(SUN, config))).toBe('2026-01-12')
  })

  it('skips holidays as well', () => {
    const c = { ...config, nonWorkingDays: new Set(['2026-01-12']) }  // Mon next is a holiday
    expect(toDateString(soonestWorkingDay(SUN, c))).toBe('2026-01-13')   // Tuesday
  })
})

describe('schedulingEngine — calculateEndDate', () => {
  const config = defaultWorkingDaysConfig()

  it('1-day task starts and ends on the same working day', () => {
    expect(toDateString(calculateEndDate(MON, 1, config))).toBe('2026-01-05')
  })

  it('5-day task Mon → Fri', () => {
    expect(toDateString(calculateEndDate(MON, 5, config))).toBe('2026-01-09')
  })

  it('starts on Saturday → first working day is Monday', () => {
    expect(toDateString(calculateEndDate(SAT, 1, config))).toBe('2026-01-12')
  })
})

describe('schedulingEngine — calculateFollowerStartDate', () => {
  const config = defaultWorkingDaysConfig()

  it('predecessor ends Mon, no lag → successor starts Tue', () => {
    expect(toDateString(calculateFollowerStartDate(MON, 0, config))).toBe('2026-01-06')
  })

  it('predecessor ends Fri, no lag → successor starts Mon (skip weekend)', () => {
    expect(toDateString(calculateFollowerStartDate(FRI, 0, config))).toBe('2026-01-12')
  })

  it('lag of 1 day adds an extra working day', () => {
    // Predecessor ends Mon. Day-after = Tue (working). +1 lag working day:
    // addWorkingDays(Tue, 2) → Wed (Tue and Wed counted, Wed is the result)
    expect(toDateString(calculateFollowerStartDate(MON, 1, config))).toBe('2026-01-07')
  })

  it('negative lag is treated as 0 lag', () => {
    expect(toDateString(calculateFollowerStartDate(MON, -5, config))).toBe('2026-01-06')
  })
})
