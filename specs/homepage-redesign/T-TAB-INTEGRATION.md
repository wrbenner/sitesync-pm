# T-Tab Integration Plan (lead-session use)

For the lead session to absorb T-tabs cleanly when they return. Order of operations + commit boundaries.

## Expected T-tab landings

| Tab | Files (expected) | Integration step |
|-----|------------------|------------------|
| T-Onboarding | `src/pages/Onboarding.tsx`, `src/pages/CreateProject.tsx`, `src/components/onboarding/`, `src/components/projects/` | Verify `/onboarding` and `/projects/new` routes still resolve in App.tsx; if route changed, update redirect |
| T-IrisInsights | `src/services/iris/insights.ts`, `src/services/iris/insightTemplates.ts`, `src/hooks/useIrisInsights.ts`, `src/services/iris/__tests__/insights.test.ts` | Wire into cockpit (see "Cockpit wiring" below) |
| T-Tasks | `src/pages/Tasks.tsx`, `src/components/tasks/` | No integration; verify `/tasks` route still works |
| T-Polish | `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/pages/auth/Login.tsx`, `src/pages/auth/Signup.tsx`, `src/lib/demoSeeder.ts`, `src/components/admin/DemoSeedButton.tsx` | Mount DemoSeedButton on /admin/compliance if not auto-mounted; verify Sidebar still renders the same nav items |

## Cockpit wiring for T-IrisInsights

Once `useIrisInsights()` lands, add a "Risks" tier to the IrisLane. Pseudo-diff:

```tsx
// src/components/cockpit/IrisLane.tsx
+ import { useIrisInsights } from '../../hooks/useIrisInsights'
  
  export const IrisLane: React.FC<IrisLaneProps> = ({ items, onChip }) => {
+   const { data: insights = [] } = useIrisInsights()
    const { primary, secondary } = useMemo(() => { ... }, [items])
+   const topInsight = insights[0]  // already sorted by severity → impact
    
-   if (!primary) return null
+   if (!primary && !topInsight) return null
    
    return (
      <div ...>
+       {topInsight && (
+         <button ...style={{ background: rust-tint, ... }}>
+           <span>RISK DETECTED</span>
+           <span>{topInsight.headline}</span>
+           <span>{topInsight.impactChain.join(' → ')}</span>
+         </button>
+       )}
        {primary && <PrimaryRecommendation ... />}
        ...
```

**OR** add a separate "Risks" lane below the existing Iris lane — cleaner separation, keeps the primary recommendation chip distinct from passive risk callouts.

Decide on layout based on what the spec author intended; default to the cleaner separate-lane.

## Verification after each merge

1. Typecheck filtered to T-tab files: `tsc --noEmit -p tsconfig.app.json | grep error TS | grep <T-tab-paths>`
2. Production build: `vite build` (must exit 0)
3. Filtered test run: `vitest run src/services/iris src/hooks/__tests__ <T-tab-test-paths>`
4. Manual click-through (auth required): the new page loads, no console errors

## Final commit anchor

Once all 4 T-tabs are merged + integrated:

```bash
# The "demo-locked" rollback point
git tag investor-demo-snapshot
git log --oneline investor-demo-snapshot^..HEAD  # double-check the right HEAD
```

Then `DEMO_RUNBOOK.md` becomes the authoritative click-flow.

## Roll-back priorities (if something breaks AFTER T-tabs merge)

In order of "drop this first":
1. T-IrisInsights cockpit wiring — `git revert <wiring-commit>` (the service stays, just unwire it)
2. T-Polish DemoSeedButton — never demo without it; if the seeder breaks, manually populate via SQL fixtures
3. T-Onboarding — if project-create flow breaks, fall back to the old form (not on demo path anyway)
4. T-Tasks — least demo-critical; safe to rollback completely

Never roll back: cockpit (commits `0c3f561` → `043ebb8`), theme drift (`430db4f`), projectScope fix (`0f80121`), schedule realtime fix (`f7e06ea`), destinationFor fix (`54ea1e3`), IrisDraftDrawer (`44bf142`).
