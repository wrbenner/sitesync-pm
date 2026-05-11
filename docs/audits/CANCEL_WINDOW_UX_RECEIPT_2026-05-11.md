# Cancel-window UX

Date: 2026-05-11. Branch: cancel-window-ux. Stacked on Phase 2e (#427).

## TL;DR

Ships the 60-second cancel-window primitives: pure timing logic, in-app banner, and 5-surface dispatch shell. Race condition tested: cancel at 59.999s wins, cancel at 60.001s loses; tie at 60.000s favors the executor (deterministic tie-break).

16 new tests pass; typecheck zero.

## Changes

- src/services/iris/cancelWindow.ts: pure timer module shared by the browser hook and the edge-fn worker. CANCEL_WINDOW_DURATION_MS = 60_000. evaluateCancelWindow + applyCancel functions.
- src/services/iris/cancelDispatch.ts: fan-out across the 5 cancel surfaces (in-app banner, push, email, sms, desktop). Pluggable surface functions; failures recorded without throwing.
- src/components/iris/CancelWindowBanner.tsx: in-app banner with 56px+ button (industrial-touch-target invariant), 250ms tick interval, auto-hide on commit/cancel.
- src/services/iris/__tests__/cancelWindow.test.ts: 13 tests (timer math, deadline boundary cases, applyCancel decisions, dispatch fan-out + failures + listAllSurfaces).
- src/components/iris/__tests__/CancelWindowBanner.test.tsx: 3 tests (renders label + remaining seconds, auto-hides at deadline + fires on_commit, button minHeight 56px).

## Race condition coverage

- Cancel at 59.999s -> status 'cancelled' (the cancel wins).
- Cancel at exactly 60.000s -> status 'committed' (deterministic tie-breaker; executor wins).
- Cancel at 60.001s -> status 'committed' (past deadline).
- Server-side applyCancel mirrors the same boundary: strict less-than against deadline.

## What this does NOT do

- iOS Live Activity / Android countdown native shells (Capacitor surface; shipped Phase 5).
- Real push/email/sms transports (the dispatch fan-out accepts injected surface functions; production integrations wire in the next step).
- Database write of the cancel decision to executor_runs.was_human_cancelled (the executor worker that owns the 60s wait timer wires this).

## Next up

auto-execute-opt-in PR + lap-3-acceptance.yml.
