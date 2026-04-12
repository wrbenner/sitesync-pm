# SiteSync PM — Governance

## Authority Hierarchy

1. **Walker (@wrbenner)** — Sole merge authority on all PRs to main.
2. **perceive-and-reason.yml** — Generates strategic direction (TONIGHT.md) via PR. No merge authority.
3. **build.yml** — Generates code changes via PR. No merge authority.
4. **reflect-and-evolve.yml** — Generates evolution changes via PR. No merge authority.
5. **Oversight cron** — Observes, sends notifications, opens GitHub issues. No write authority. No PRs.

## Rules

- No workflow may modify its own workflow file or any other workflow file without PR + CODEOWNERS review.
- No autonomous process may merge to main without approval.
- All changes to main require: PR + required status checks + CODEOWNERS review where applicable.

## Branch Protection (applied via GitHub repository settings)

- Pull request required before merging (minimum 1 approval)
- Required status checks: Gate 1: TypeScript, Gate 2: ESLint, Gate 3: Tests, Gate 4: Build
- Branches must be up to date before merging
- Enforce admins enabled (no bypass)
- Force pushes disabled
- Branch deletions disabled

## Vercel Deployment Protection

- Current plan: to be confirmed and documented here
- Production deployments: protected if plan supports it; otherwise documented as unavailable
- Preview deployments: URL exposure controlled per plan capabilities
- This section will be updated with actual plan details after verification

## CODEOWNERS

Protected paths requiring @wrbenner review are defined in the CODEOWNERS file at repo root.
