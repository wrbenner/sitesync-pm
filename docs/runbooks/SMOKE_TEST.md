# Production Smoke Test — 12-Step Checklist

Run after every production deploy. Owner: deploying engineer. Output paste
into Slack `#deploys`. Estimated time: 8–12 minutes.

For the automated portion, see [`scripts/smoke-test.sh`](../../scripts/smoke-test.sh).
The manual steps cannot be automated without browser fixtures we don't have at
Beta scale.

---

## Auto (run via `bash scripts/smoke-test.sh https://app.sitesyncai.com`)

1. **HTTP 200** on `/healthz` (or root if no health endpoint)
2. **Static asset** loads with cache-control header set
3. **API roundtrip** to a public read-only endpoint (e.g., GET `/api/v1/health`)
4. **Auth endpoint** returns 200 on the GoTrue health probe
5. **Edge function** smoke: invoke `cron-rate-limit-purge` with no auth header → expect 401 (proves the auth gate is wired, not that the function works)

## Manual (browser, ~5 minutes)

6. **Sign in** as a known-good test account. Confirm dashboard loads in < 4 seconds.
7. **Navigate to RFIs** for a known project. Confirm the list renders + first row clickable.
8. **Open one RFI**. Confirm the AI draft pane loads (cached or fresh, either is fine).
9. **Trigger one Iris draft generation** (real or sample data). Confirm the draft returns within 15 seconds with citations attached.
10. **Settings → Billing**. Confirm the page loads and the current plan is displayed correctly.
11. **Sign out**. Confirm redirect to login.
12. **Sign in again** as the same user. Confirm session persists and lands on dashboard, not onboarding.

## Recording

Paste this template into `#deploys`:

```
🚀 Smoke test for <commit-sha> at <utc-time>

Auto:
[ ] /healthz 200
[ ] static asset cache headers
[ ] API roundtrip
[ ] auth endpoint
[ ] edge function auth gate

Manual:
[ ] sign in (<seconds>)
[ ] RFI list
[ ] open RFI
[ ] Iris draft (<seconds>)
[ ] billing page
[ ] sign out
[ ] sign in again (returning user)

Result: ✅ green / ⚠️ partial / ❌ red
Notes: <what the deploying engineer noticed>
```

If anything is red:
1. Decide rollback OR forward-fix in 5 minutes.
2. Page Founder if customer-facing impact is suspected.
3. File the incident in `#brt-alerts` per [BRT_INCIDENT_PLAYBOOKS.md](BRT_INCIDENT_PLAYBOOKS.md).

## Drift handling

The list above is the floor. If the deploy touched a specific surface (Stripe,
auth, RLS, AI chokepoint), add the surface-specific smoke from the matching
spec acceptance section before declaring green.
