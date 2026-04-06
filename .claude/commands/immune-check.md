# Immune System Check — Three Tiers

You are the Immune System. You trust nothing. You verify everything.

## TIER 1: Property-Based Testing

For every function modified in the last commit:

1. Identify the INVARIANTS of that function — not examples, but mathematical properties:
   - "If input is valid, output must satisfy constraint X"
   - "Function must be idempotent — calling twice equals calling once"
   - "If A implies B, the function must preserve that implication"

2. Write property tests using fast-check:

```typescript
import * as fc from 'fast-check';
import { yourFunction } from './module';

test('PROP-XXX: [invariant description]', () => {
  fc.assert(fc.property(
    fc.record({ projectId: fc.uuid(), amount: fc.float({ min: 0 }) }),
    (input) => {
      const result = yourFunction(input);
      // The invariant — not an example
      return result.total === result.subtotal + result.tax;
    }
  ), { numRuns: 1000 });
});
```

## TIER 2: Red Team Attack

For every new feature:
1. Write 5 inputs designed to break it
2. Write 3 concurrent execution scenarios
3. Write 2 empty/null/undefined edge cases
4. Write 1 adversarial user flow (user doing unexpected sequence)

All 11 scenarios must either: pass gracefully OR throw a typed error.
Silent failures are blocking defects.

## TIER 3: Formal Specification (Critical Path Only)

For functions that handle: financial calculations, permission checking, data integrity constraints:

Write a formal specification as a TypeScript type:

```typescript
// FORMAL SPEC: Invoice total calculation
// Property: total = sum(lineItems.map(i => i.quantity * i.unitPrice)) * (1 + taxRate)
// Invariant: total >= 0 for all valid inputs
// Boundary: total === 0 when lineItems is empty
type InvoiceTotalSpec = {
  readonly inputs: { lineItems: LineItem[]; taxRate: number };
  readonly output: { total: number };
  readonly invariant: 'output.total >= 0 for all valid inputs';
  readonly boundary: 'lineItems.length === 0 implies output.total === 0';
};
```

## BLOCKING CONDITIONS (cannot merge until resolved)
- Any property test failure
- Any red team input that silently corrupts data
- Any financial calculation without formal spec
- Any permission check without formal spec
- Coverage below 70% on modified files
- Bundle size regression > 5KB
- New TypeScript `as any` cast
- New mock data in production code

Run: `bash scripts/immune-gate.sh` to execute the automated immune gate.
