/**
 * Money utilities. Financial values are stored and computed as integer cents
 * to avoid floating point drift. Convert to/from dollars only at boundaries
 * (display, external API payloads, CSV export).
 *
 * DECISIONS.md ADR 006 mandates integer cents for all monetary math.
 */

declare const centsBrand: unique symbol
export type Cents = number & { readonly [centsBrand]: 'cents' }

declare const dollarsBrand: unique symbol
export type Dollars = number & { readonly [dollarsBrand]: 'dollars' }

export const ZERO_CENTS = 0 as Cents

/**
 * Convert a dollar value (possibly fractional) to integer cents.
 * Rounds half away from zero so 0.005 becomes 1 cent, -0.005 becomes -1 cent.
 */
export function toCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) return ZERO_CENTS
  const sign = dollars < 0 ? -1 : 1
  const rounded = Math.round(Math.abs(dollars) * 100)
  return (sign * rounded) as Cents
}

export function fromCents(cents: Cents): Dollars {
  return (cents / 100) as Dollars
}

export function addCents(a: Cents, b: Cents): Cents {
  return ((a as number) + (b as number)) as Cents
}

export function subCents(a: Cents, b: Cents): Cents {
  return ((a as number) - (b as number)) as Cents
}

export function sumCents(values: Cents[]): Cents {
  let total = 0
  for (const value of values) total += value as number
  return total as Cents
}

/**
 * Multiply cents by a dimensionless quantity (for example unit_price * quantity).
 * Rounds half away from zero to keep the result as integer cents.
 */
export function mulCents(cents: Cents, quantity: number): Cents {
  if (!Number.isFinite(quantity)) return ZERO_CENTS
  const raw = (cents as number) * quantity
  const sign = raw < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(raw))) as Cents
}

/**
 * Compute a percentage of cents (for example retainage or tax). Percent is in
 * basis points to avoid a second layer of floating point. 1000 bps = 10%.
 */
export function pctCents(cents: Cents, basisPoints: number): Cents {
  if (!Number.isFinite(basisPoints)) return ZERO_CENTS
  const raw = ((cents as number) * basisPoints) / 10_000
  const sign = raw < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(raw))) as Cents
}

export const RETAINAGE_BASIS_POINTS = 1000 as const

export function retainage(cents: Cents, basisPoints: number = RETAINAGE_BASIS_POINTS): Cents {
  return pctCents(cents, basisPoints)
}

export function maxCents(a: Cents, b: Cents): Cents {
  return Math.max(a as number, b as number) as Cents
}

export function formatUSD(cents: Cents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(fromCents(cents))
}
