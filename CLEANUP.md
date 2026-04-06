# Prompt Sprawl Cleanup Guide

## Files to DELETE (replaced by SPEC.md + AGENTS.md + CLAUDE.md)

These files are superseded by the organism's infrastructure. Delete them all:

```bash
# Duplicate " 2.md" files (macOS copy artifacts)
rm "SITESYNC_CLAUDE_CODE_MASTER_PROMPT 2.md"
rm "SITESYNC_MASTER_PROMPTS 2.md"
rm "SITESYNC_V2_MASTER_PROMPT 2.md"
rm "SITESYNC_V3_MASTER_PROMPT 2.md"
rm "SITESYNC_V4_MASTER_PROMPT 2.md"

# Superseded master prompts (absorbed into SPEC.md)
rm SITESYNC_CLAUDE_CODE_MASTER_PROMPT.md
rm SITESYNC_MASTER_PROMPTS.md
rm SITESYNC_V2_MASTER_PROMPT.md
rm SITESYNC_V3_MASTER_PROMPT.md
rm SITESYNC_V4_MASTER_PROMPT.md

# Superseded by AGENTS.md workflows + SPEC.md
rm COWORK_MASTER_INSTRUCTIONS.md

# Duplicate E2E test files (macOS copy artifacts)
rm "e2e/accessibility.spec 2.ts"
rm "e2e/dashboard.spec 2.ts"
rm "e2e/mobile.spec 2.ts"
rm "e2e/offline.spec 2.ts"
rm "e2e/rfi-workflow.spec 2.ts"
rm "e2e/search.spec 2.ts"

# Duplicate script
rm "scripts/check-bundle-size 2.js"
```

## Files to KEEP but RENAME/MOVE

```bash
# The prompts/ directory is valuable domain knowledge
# but should be archived, not active. The organism reads SPEC.md, not these.
mkdir -p archive/prompts-v5
mv prompts/* archive/prompts-v5/

# Same for v6-prompts — archive as reference, not active
mkdir -p archive/prompts-v6
mv v6-prompts/* archive/prompts-v6/

# autonomous_loop.sh — keep as reference but rename
mv autonomous_loop.sh archive/autonomous_loop_v3.sh
```

## Files to ADD (from organism-files/)

```bash
# Copy all organism infrastructure into the repo
cp SPEC.md /path/to/sitesync-pm/
cp AGENTS.md /path/to/sitesync-pm/
cp DECISIONS.md /path/to/sitesync-pm/
cp LEARNINGS.md /path/to/sitesync-pm/
cp .quality-floor.json /path/to/sitesync-pm/

# Claude commands
mkdir -p /path/to/sitesync-pm/.claude/commands/
cp .claude/commands/* /path/to/sitesync-pm/.claude/commands/

# Immune gate
cp scripts/immune-gate.sh /path/to/sitesync-pm/scripts/
chmod +x /path/to/sitesync-pm/scripts/immune-gate.sh

# Upgraded CI (replaces existing ci.yml)
cp .github/workflows/homeostasis.yml /path/to/sitesync-pm/.github/workflows/homeostasis.yml
# Keep old ci.yml until homeostasis.yml is verified working, then delete it
```

## After Cleanup: Repo Root Should Look Like

```
sitesync-pm/
├── SPEC.md                    ← THE GENOME (new)
├── AGENTS.md                  ← AGENT INSTRUCTIONS (new)
├── CLAUDE.md                  ← CLAUDE-SPECIFIC CONTEXT (existing, upgraded)
├── DECISIONS.md               ← ARCHITECTURE DECISIONS (new)
├── LEARNINGS.md               ← COMPOUNDING INTELLIGENCE (new)
├── .quality-floor.json        ← QUALITY RATCHET (new)
├── README.md                  ← Human readme (existing)
├── SETUP.md                   ← Setup guide (existing)
├── .env.example               ← (existing)
├── package.json               ← (existing)
├── ...
├── .claude/
│   └── commands/
│       ├── implement-feature.md  (new)
│       ├── verify.md             (new)
│       ├── polish.md             (new)
│       ├── evolve.md             (new)
│       └── red-team.md           (new)
├── .github/
│   └── workflows/
│       └── homeostasis.yml       (replaces ci.yml)
├── scripts/
│   ├── immune-gate.sh            (new)
│   ├── check-bundle-size.js      (existing)
│   └── generate-icons.js         (existing)
├── archive/                      (new — historical reference)
│   ├── autonomous_loop_v3.sh
│   ├── prompts-v5/
│   └── prompts-v6/
├── src/                          (existing)
├── supabase/                     (existing)
└── e2e/                          (existing, cleaned of " 2" dupes)
```

## Summary

| Before | After |
|--------|-------|
| 7 master prompt files | 1 SPEC.md |
| 6 duplicate " 2.md" files | 0 duplicates |
| 1 CLAUDE.md (basic) | 1 CLAUDE.md + 1 AGENTS.md (comprehensive) |
| No quality tracking | .quality-floor.json with ratchet |
| No agent commands | 5 slash commands in .claude/commands/ |
| Basic CI (most gates `|| true`) | 8-gate immune system with self-healing |
| No architectural memory | DECISIONS.md + LEARNINGS.md |
| 25+ scattered prompt files | Archived for reference |
