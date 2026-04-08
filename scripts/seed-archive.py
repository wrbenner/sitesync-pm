#!/usr/bin/env python3
"""
seed-archive.py
───────────────
Creates .agent/prompt-archive.json with the current organism prompt as v0.
Called by self-improve.yml on the first run if no archive exists.

For a more comprehensive initialization (with runbook, state file, etc.),
use initialize-archive.py instead.
"""

import json
import re
from datetime import date
from pathlib import Path

ARCHIVE_FILE = Path(".agent/prompt-archive.json")
NIGHTLY_WORKFLOW = Path(".github/workflows/nightly-build.yml")

ARCHIVE_FILE.parent.mkdir(parents=True, exist_ok=True)

if ARCHIVE_FILE.exists():
    print("Archive already exists -- not overwriting")
    import sys
    sys.exit(0)

# Extract organism prompt
prompt_text = ""
try:
    content = NIGHTLY_WORKFLOW.read_text(encoding="utf-8")
    match = re.search(
        r'"(You are the SiteSync PM Organism.*?Output <promise>DONE</promise>)',
        content,
        re.DOTALL,
    )
    if match:
        prompt_text = match.group(1)[:4000]
    else:
        prompt_text = content[:4000]
except Exception as e:
    prompt_text = f"Could not extract: {e}"

archive = {
    "_comment": (
        "SICA-style prompt version archive. "
        "NEVER delete entries -- stepping stones matter (DGM/SICA pattern)."
    ),
    "_schema": "1.0",
    "freeze_until": None,
    "freeze_reason": None,
    "versions": [
        {
            "version": "v0",
            "date": date.today().isoformat(),
            "modification_type": "SEED",
            "target": str(NIGHTLY_WORKFLOW),
            "before": None,
            "after": None,
            "rationale": "Initial seed -- baseline prompt before self-improvement began.",
            "baseline_score": None,
            "score_after": None,
            "deployed": True,
            "is_seed": True,
            "prompt_snapshot": prompt_text,
        }
    ],
}

ARCHIVE_FILE.write_text(json.dumps(archive, indent=2))
print(f"Initialized prompt archive with v0 seed ({len(prompt_text)} chars)")
