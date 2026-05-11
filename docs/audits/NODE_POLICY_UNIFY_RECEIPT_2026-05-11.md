# Node policy unification (PR ζ) — receipt
**Date:** 2026-05-11
**Branch:** `node-policy-unify`
**Status:** Ready for review.

## Goal

One Node version, one source of truth, one heap setting that doesn't OOM. Close out the two structural issues surfaced after PR ε (#415):

1. **Node policy was fragmented** across `.nvmrc` (`20`), `package.json` engines (`>=20`), Walker's local (`v23.10.0`), and CI (a mix of `20`, `22`, and `${{ env.NODE_VERSION }}` across 23 workflow files).
2. **Pre-commit hook OOM'd** on cold `.tsbuildinfo` rebuilds because Node defaulted to ~2GB heap.

## What changes

### Single source of truth: `.nvmrc`

| File | Before | After |
|---|---|---|
| `.nvmrc` | `20` | `22.13.0` |
| `package.json` engines.node | `">=20"` | `"^22.13.0"` |
| 23 workflows | mix of `'20'` / `'22'` / `"20"` / `${{ env.NODE_VERSION }}` | `node-version-file: '.nvmrc'` |

The `actions/setup-node@v4` `node-version-file` parameter reads `.nvmrc` directly. Bumping Node versions across the whole repo is now a one-line edit to `.nvmrc`; no workflow churn, no drift between local and CI.

### Pre-commit heap bump

```diff
+ # Bump tsc heap to 4GB. Node's ~2GB default OOMs on this project graph
+ # whenever the .tsbuildinfo cache is cold (fresh clone, post-relocation,
+ # branch switch with major schema deltas). Default goes first so a caller
+ # can still override via env: later flags win in NODE_OPTIONS parsing.
+ export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-}"
```

4GB is sized for an 8GB dev machine (50% headroom). Bigger isn't better — if `tsc` legitimately needs more than 4GB, that's an architectural smell worth surfacing, not a knob to crank.

### Documentation

`CLAUDE.md` gets a **Node version policy** paragraph: `.nvmrc` is the source of truth, engines enforce it, all 23 workflows resolve through it, local dev uses `nvm use` / `fnm use`. Plus the pre-commit gate paragraph now mentions the heap setting and why.

## Why these versions

| Choice | Reason |
|---|---|
| **Node 22 LTS** | Active LTS through April 2027. Node 24 just entered LTS (Oct 2025); too new to bet the repo on. |
| **22.13.0 floor** | `eslint-visitor-keys@5.0.1` requires `^20.19.0 \|\| ^22.13.0 \|\| >=24` — 22.13 is the lowest satisfying value on the 22 line. All other EBADENGINE warnings (`@jest/*@30`, `pretty-format@30`, etc.) accept any 22. |
| **`^22.13.0` in engines** | Allows patch + minor updates within the 22 line, locks out 23/24/25 surprises. |

## Why this is the Bugatti shape (not a patch)

- No "fix it later" — every version pin in the repo is now coherent.
- No reliance on machine-local Node — local dev uses `nvm use` against `.nvmrc`, same answer as CI.
- No hidden second source of truth — eliminating `NODE_VERSION:` env vars across 8 workflows kills the drift surface.
- The heap bump is honest: documented why, sized for the real machine, overridable by env.

## Files touched (26)

```
.nvmrc                              | 2 +-
package.json                        | 2 +-
.husky/pre-commit                   | 6 ++++++
CLAUDE.md                           | 4 +++-
.github/workflows/*.yml             | 23 files unified
docs/audits/NODE_POLICY_UNIFY_RECEIPT_2026-05-11.md  | new
```

## Test plan

- [x] Pre-commit hook runs tsc without OOM on cold cache (verified locally — the OOM that hit PR ε's commit no longer reproduces with `NODE_OPTIONS=--max-old-space-size=4096`)
- [x] All `actions/setup-node@v4` invocations resolve `.nvmrc` to `22.13.0`
- [x] No raw `node-version:` pins remain in `.github/workflows/`
- [x] No `NODE_VERSION:` env entries remain in `.github/workflows/`
- [ ] CI green on all 6 required gates
- [ ] Auto-merge fires

## Walker's one-time follow-up (recommended, not required)

Switch local Node from Homebrew's v23 to the pinned version via nvm:

```
brew install nvm                          # or `fnm` if you prefer
echo 'source $(brew --prefix nvm)/nvm.sh' >> ~/.zshrc
source ~/.zshrc
cd ~/code/sitesync-pm
nvm install                               # reads .nvmrc → installs 22.13.0
nvm use                                   # activates it
node --version                            # v22.13.0
```

After that, `npm install` will stop printing EBADENGINE warnings.
