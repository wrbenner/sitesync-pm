/**
 * Branded type for monetary values in integer cents.
 * All money in SiteSync is stored and computed as integer cents.
 * Convert at serialization boundaries only (display, API responses).
 *
 * Usage:
 *   const price = 1999 as Cents  // $19.99
 *   const display = centsToDisplay(price)  // "$19.99"
 *   const fromUser = dollarsToCents(19.99)  // 1999 as Cents
 */
export type Cents = number & { readonly __brand: 'cents' }

/** Convert integer cents to display string: 1999 → "$19.99" */
export function centsToDisplay(cents: Cents, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** Convert floating-point dollars to integer cents: 19.99 → 1999 */
export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100) as Cents
}

/** Add two Cents values safely */
export function addCents(a: Cents, b: Cents): Cents {
  return (a + b) as Cents
}

/** Multiply cents by a quantity (e.g., unit_price * quantity) */
export function multiplyCents(unitCents: Cents, quantity: number): Cents {
  return Math.round(unitCents * quantity) as Cents
}
