POLISHING MODE — No new features. Only quality improvements.

Focus areas (in priority order):

1. PERFORMANCE
   - Find components missing React.memo where props are stable
   - Find derived data not wrapped in useMemo
   - Find event handlers not wrapped in useCallback when passed as props
   - Check for N+1 queries in React Query hooks
   - Verify code splitting for heavy routes (Drawings, BIM, Charts)
   - Run `npm run build:analyze` and identify the largest chunks

2. ACCESSIBILITY
   - Run `npx axe-core` on every page route
   - Fix every violation
   - Verify keyboard navigation (Tab through all interactive elements)
   - Verify focus traps in modals
   - Verify aria-labels on icon-only buttons
   - Verify color contrast (especially orange #F47820 on white — it fails AA)

3. ANIMATION & MICRO-INTERACTIONS
   - Add Framer Motion entry animations to page transitions (use variants from src/components/transitions/variants.ts)
   - Add skeleton loaders that match the final layout dimensions
   - Add hover states on all clickable cards
   - Add focus rings (2px solid, offset 2px, brand color)

4. ERROR STATES
   - Every page needs an ErrorBoundary with retry button
   - Every API call needs an error toast
   - Every form needs field-level error messages with aria-describedby

5. CONSISTENCY
   - Verify all colors come from theme.ts
   - Verify all spacing comes from theme.ts spacing tokens
   - Verify all typography comes from theme.ts typography tokens
   - No inline magic numbers

After each fix, run quality gates. Update .quality-floor.json if any metric improved.
