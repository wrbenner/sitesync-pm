#!/usr/bin/env python3
"""
check-freeze.py
───────────────
Checks whether the self-improvement loop is frozen.

Exit codes:
  0 = not frozen (proceed)
  1 = frozen (skip this run)

Also sets freeze_until in the archive if 3 consecutive no-improvement nights detected.
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

ARCHIVE_FILE = Path(".agent/prompt-archive.json")

if not ARCHIVE_FILE.exists():
    # No archive yet -- not frozen
    print("No archive yet -- not frozen")
    sys.exit(0)

archive = json.loads(ARCHIVE_FILE.read_text())

# Check hard freeze window
freeze_until = archive.get("freeze_until")
if freeze_until:
    try:
        if date.fromisoformat(freeze_until) > date.today():
            reason = archive.get("freeze_reason", "unknown reason")
            print(f"FROZEN until {freeze_until}: {reason}")
            sys.exit(1)
    except ValueError:
        pass  # malformed date -- ignore

# Check for 3 consecutive no-improvement nights
versions = archive.get("versions", [])
consecutive_no_improve = 0

for i in range(len(versions) - 1, 0, -1):
    curr_score = versions[i].get("score_after") or versions[i].get("baseline_score")
    prev_score = versions[i - 1].get("score_after") or versions[i - 1].get("baseline_score")
    if curr_score is None or prev_score is None:
        break
    try:
        if float(curr_score) <= float(prev_score):
            consecutive_no_improve += 1
        else:
            break
    except (TypeError, ValueError):
        break

if consecutive_no_improve >= 3:
    freeze_date = (date.today() + timedelta(days=2)).isoformat()
    archive["freeze_until"] = freeze_date
    archive["freeze_reason"] = "3 consecutive nights without improvement"
    ARCHIVE_FILE.write_text(json.dumps(archive, indent=2))
    print(f"TRIGGER_FREEZE: 3 consecutive no-improvement nights -- frozen until {freeze_date}")
    sys.exit(1)

print(f"Not frozen (consecutive_no_improve={consecutive_no_improve})")
sys.exit(0)
