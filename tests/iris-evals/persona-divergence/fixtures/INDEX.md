# Persona-divergence fixtures

Spec: [`IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`](../../../../docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md) §7.

The full eval set is 50 invocations × 5 personas = 250 outputs. Phase 1e
ships **10 representative invocations** as a working starter set so the
harness, similarity metric, and CI gate are real. The remaining 40
invocations are Walker-authored during the Day 27 hand-rating step
(calendar-bound).

## Fixture shape

Each `.json` file is a single `IrisInvocation` + caller-side slot inputs.
The harness builds 5 IrisContexts (one per persona) and renders 5 system
prompts. The similarity metric measures pairwise divergence across the 5.

## File naming

```
<surface>-<short-description>.json
```

Examples:
- `rfi-overdue-1d.json`
- `rfi-overdue-5d-blocked-by-spec.json`
- `submittal-pending-architect-review.json`
- `daily-log-rainout-day.json`
- `co-pricing-narrative.json`

## Surface coverage target (per spec §7.1)

| Surface | Count |
|---|---|
| RFI follow-up | 12 |
| Submittal review | 8 |
| Daily log | 8 |
| Owner update | 8 |
| Schedule risk | 6 |
| Lien waiver chase | 4 |
| Cost-impact narration | 4 |
| **Total** | **50** |

Phase 1e ships ~1 per surface; Walker authors the rest during the Day 27 review.
