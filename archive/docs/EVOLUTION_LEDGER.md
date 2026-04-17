# Evolution Ledger

Append-only log of every organism experiment attempt.
Each entry records what was tried, what happened, and what was learned.

New entries are appended by the `organism-learn.yml` workflow after each experiment
completes (whether it succeeds, fails, or is closed without merging).

## Format

Each entry includes:
- **Date** — when the experiment ran
- **Outcome** — merged, failed, or closed
- **Target** — primary file or directory modified
- **Metric** — which quality metric was targeted
- **Risk** — low, medium, or high
- **Before/After** — metric snapshots
- **Failure reason** — why it failed (if applicable)

---

*Ledger initialized. Entries will appear below as the organism runs experiments.*
